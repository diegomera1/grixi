# Alternativas 2 y 3 — Migración de Edge Functions

> Cómo migrar las 14 Supabase Edge Functions a Next.js API Routes + BullMQ Workers para on-premise / bare metal.

---

## 1. Estrategia de Migración

| Edge Function | Migra a | Razón |
|---|---|---|
| `ai-chat` | **API Route** | Request-response síncrono |
| `ai-voice` | **API Route** | Request-response síncrono |
| `ai-image` | **API Route** | Request-response síncrono |
| `send-email` | **BullMQ Worker** | Asíncrono, puede fallar/reintentar |
| `send-notification` | **BullMQ Worker** | Asíncrono, puede fallar/reintentar |
| `sap-sync` | **BullMQ Worker** | Largo (hasta 400s), debe ser background |
| `sap-read` | **API Route** | Request-response síncrono |
| `webhook-receiver` | **API Route** | Receptor HTTP síncrono |
| `cron-daily-reports` | **BullMQ Scheduled** | Cron job, background |
| `cron-cleanup` | **BullMQ Scheduled** | Cron job, background |
| `tenant-onboarding` | **Server Action** | Transaction DB, síncrono |
| `external-api-proxy` | **API Route** | Proxy síncrono |
| `file-processor` | **BullMQ Worker** | Puede ser largo, background |
| `export-generator` | **BullMQ Worker** | Generación de PDF/Excel, background |

---

## 2. API Routes (Reemplaza Edge Functions síncronas)

### ai-chat

```typescript
// app/api/ai/chat/route.ts
import { auth } from '~/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { withTenantContext } from '~/lib/db/middleware'
import { sql } from 'drizzle-orm'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, orgId, context } = await request.json()

  // Obtener contexto del tenant
  const org = await withTenantContext(session.user.id, async (tx) => {
    const result = await tx.execute(sql`
      SELECT name, enabled_modules, config_overrides
      FROM organizations WHERE id = ${orgId}
    `)
    return result.rows[0]
  })

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: enrichPrompt(message, org, context) }] }]
  })

  return Response.json({ response: result.response.text() })
}
```

### webhook-receiver

```typescript
// app/api/webhooks/route.ts
import { verifyWebhookSignature } from '~/lib/utils/crypto'
import { db } from '~/lib/db/client'

export async function POST(request: Request) {
  const signature = request.headers.get('x-webhook-signature')
  const body = await request.text()

  const isValid = await verifyWebhookSignature(body, signature!, process.env.WEBHOOK_SECRET!)
  if (!isValid) return Response.json({ error: 'Invalid signature' }, { status: 401 })

  const payload = JSON.parse(body)

  switch (payload.type) {
    case 'payment.completed':
      await handlePaymentCompleted(db, payload)
      break
    case 'invoice.created':
      await handleInvoiceCreated(db, payload)
      break
  }

  return Response.json({ received: true })
}
```

---

## 3. BullMQ Workers (Reemplaza Edge Functions asíncronas)

### Setup

```typescript
// lib/queue/connection.ts
import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'

const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })

// Definir queues
export const emailQueue = new Queue('email', { connection })
export const sapSyncQueue = new Queue('sap-sync', { connection })
export const reportQueue = new Queue('reports', { connection })
export const fileProcessQueue = new Queue('file-process', { connection })
```

### Email Worker (reemplaza send-email)

```typescript
// workers/email.worker.ts
import { Worker } from 'bullmq'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

const emailWorker = new Worker('email', async (job) => {
  const { to, subject, template, data, orgId } = job.data

  // Obtener branding del tenant
  const org = await db.execute(sql`
    SELECT branding FROM organizations WHERE id = ${orgId}
  `)

  const html = renderEmailTemplate(template, {
    ...data,
    logo: org.rows[0].branding.logo_url,
    primaryColor: org.rows[0].branding.primary_color,
  })

  await resend.emails.send({
    from: 'GRIXI <noreply@grixi.com>',
    to: [to],
    subject,
    html,
  })
}, {
  connection,
  concurrency: 5,
  limiter: { max: 10, duration: 1000 }, // Rate limit: 10/sec
})
```

### SAP Sync Worker (reemplaza sap-sync)

```typescript
// workers/sap-sync.worker.ts
const sapWorker = new Worker('sap-sync', async (job) => {
  const { syncType, orgId, params } = job.data

  const sapEndpoint = process.env.SAP_SOAP_ENDPOINT!
  const sapEnvelope = buildSoapEnvelope(syncType, params)

  const response = await fetch(sapEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'Authorization': `Basic ${Buffer.from(
        `${process.env.SAP_USER}:${process.env.SAP_PASSWORD}`
      ).toString('base64')}`,
    },
    body: sapEnvelope,
  })

  const data = parseSoapResponse(await response.text())

  await db.execute(sql`
    INSERT INTO sap_sync_logs (organization_id, sync_type, records_synced, status)
    VALUES (${orgId}, ${syncType}, ${data.length}, 'success')
  `)

  return { synced: data.length }
}, { connection, concurrency: 2 })
```

### Cron Jobs (reemplaza pg_cron)

```typescript
// workers/scheduler.ts
import { emailQueue, reportQueue } from '~/lib/queue/connection'

// Daily reports — todos los días a las 6 AM
reportQueue.add('daily-reports', {}, {
  repeat: { pattern: '0 6 * * *' },
})

// Cleanup — cada domingo a las 3 AM
reportQueue.add('weekly-cleanup', {}, {
  repeat: { pattern: '0 3 * * 0' },
})

// SAP sync incremental — cada hora
sapSyncQueue.add('hourly-sync', { syncType: 'incremental' }, {
  repeat: { pattern: '0 * * * *' },
})
```

---

## 4. Despachar Jobs desde Server Actions

```typescript
// features/email/actions.ts
'use server'
import { emailQueue } from '~/lib/queue/connection'

export async function sendInvitationEmail(email: string, orgId: string) {
  await emailQueue.add('invitation', {
    to: email,
    subject: 'Invitación a GRIXI',
    template: 'invitation',
    data: { orgId },
    orgId,
  })
}
```

---

## 5. Dockerfile para Workers

```dockerfile
# apps/web/Dockerfile.worker
FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod
COPY dist/workers ./workers
COPY dist/lib ./lib
CMD ["node", "workers/index.js"]
```
