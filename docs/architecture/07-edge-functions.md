# GRIXI — Edge Functions: Catálogo y Patrones

> Documento detallado sobre las Supabase Edge Functions de GRIXI, incluyendo catálogo completo, patrones de implementación, y mejores prácticas.

---

## 1. ¿Qué Son las Edge Functions?

### 1.1 Definición

Supabase Edge Functions son **funciones serverless** que se ejecutan en el edge (cerca del usuario) usando **Deno runtime** con TypeScript nativo.

```
Request del usuario
  → Cloudflare (WAF)
    → Supabase Edge Function
      → Procesa lógica (AI, email, API externa)
      → Responde al usuario
```

### 1.2 ¿Por Qué Edge Functions en Vez de Vercel Functions?

| Característica | Supabase Edge Functions | Vercel Serverless Functions |
|---|---|---|
| **Runtime** | Deno (TypeScript nativo) | Node.js |
| **Cold start** | ~50ms | ~200-500ms |
| **Acceso a Supabase** | Directo (mismo proyecto) | Vía HTTP (red) |
| **Secrets management** | Integrado en Supabase | Vercel env vars |
| **JWT verification** | Automático | Manual |
| **Invocación desde DB** | ✅ (pg_net, triggers) | ❌ No |
| **Cron jobs** | ✅ (pg_cron → Edge Function) | ✅ (Vercel Crons) |
| **Costo** | 2M incluidas/mes (Pro) | 1M incluidas/mes (Pro) |
| **Max duration** | 400s (paid) | 300s |
| **Max memory** | 256 MB | 1024 MB |

**Para GRIXI:** Usamos Supabase Edge Functions porque tienen **acceso directo** al proyecto (DB, Auth, Storage) sin latencia de red adicional, y el JWT se verifica automáticamente.

### 1.3 Limitaciones

| Límite | Valor | Implicación |
|---|---|---|
| **CPU time** | 2 segundos | No para procesamiento heavy (use RPCs SQL) |
| **Wall clock** | 400 segundos | Suficiente para calls a APIs externas |
| **Memory** | 256 MB | No cargar archivos grandes en memoria |
| **Bundle size** | 20 MB | Minimizar dependencias |
| **Invocaciones (Pro)** | 2M/mes | ~66K/día — suficiente para GRIXI |
| **Funciones (Pro)** | 500 por proyecto | Más que suficiente |
| **Secrets** | 100 por proyecto | Suficiente |
| **Log event rate** | 100/10 seconds | No logear excesivamente |

---

## 2. Catálogo de Edge Functions

### 2.1 Resumen

| Función | Categoría | JWT | Frecuencia | Descripción |
|---|---|---|---|---|
| `ai-chat` | AI | ✅ | Alta | Proxy a Gemini para GRIXI AI |
| `ai-voice` | AI | ✅ | Media | Procesamiento de comandos de voz |
| `ai-image` | AI | ✅ | Baja | Generación de imágenes con Gemini |
| `send-email` | Comunicación | ✅ | Media | Emails transaccionales vía Resend |
| `send-notification` | Comunicación | ✅ | Alta | Push notifications |
| `sap-sync` | Integración | ✅ | Media | Sync con SAP ECC vía SOAP |
| `sap-read` | Integración | ✅ | Media | Lectura de datos SAP |
| `webhook-receiver` | Integración | ❌* | Variable | Recibir webhooks de terceros |
| `cron-daily-reports` | Scheduled | ❌** | ~30/mes | Reportes diarios por tenant |
| `cron-cleanup` | Scheduled | ❌** | ~30/mes | Limpieza de datos temporales |
| `tenant-onboarding` | Admin | ✅ | Baja | Provisioning de nuevo tenant |
| `external-api-proxy` | Integración | ✅ | Alta | Proxy seguro a APIs externas |
| `file-processor` | Storage | ✅ | Media | Procesamiento de archivos subidos |
| `export-generator` | Reportes | ✅ | Media | Generación de PDFs / Excel |

*\*Webhooks usan autenticación custom (signature verification)*
*\*\*Crons se invocan internamente vía pg_cron*

### 2.2 Detalle de Cada Función

---

#### `ai-chat` — GRIXI AI Assistant

```typescript
// supabase/functions/ai-chat/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { GoogleGenerativeAI } from "npm:@google/generative-ai"

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!)

Deno.serve(async (req: Request) => {
  // JWT verificado automáticamente por Supabase
  const authHeader = req.headers.get("Authorization")
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: authHeader! } } }
  )
  
  // Obtener usuario y organización del JWT
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })
  
  const { message, orgId, context } = await req.json()
  
  // Obtener contexto del tenant para enriquecer prompt
  const { data: org } = await supabase
    .from("organizations")
    .select("name, enabled_modules, config_overrides")
    .eq("id", orgId)
    .single()
  
  // Llamar a Gemini con contexto multi-tenant
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" })
  const result = await model.generateContent({
    contents: [{ 
      role: "user", 
      parts: [{ text: enrichPrompt(message, org, context) }]
    }]
  })
  
  return new Response(JSON.stringify({
    response: result.response.text()
  }), {
    headers: { "Content-Type": "application/json" }
  })
})
```

**Ventajas:**
- API key de Gemini NUNCA se expone al cliente
- Contexto del tenant enriquece las respuestas
- Rate limiting por organización
- Caching de respuestas frecuentes

---

#### `send-email` — Emails Transaccionales

```typescript
// supabase/functions/send-email/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req: Request) => {
  const { to, subject, template, data, orgId } = await req.json()
  
  // Obtener branding del tenant
  const supabase = createClient(/* ... */)
  const { data: org } = await supabase
    .from("organizations")
    .select("branding")
    .eq("id", orgId)
    .single()
  
  // Renderizar template con branding del tenant
  const html = renderEmailTemplate(template, {
    ...data,
    logo: org.branding.logo_url,
    primaryColor: org.branding.primary_color,
    companyName: org.branding.company_name,
  })
  
  // Enviar vía Resend
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `GRIXI <noreply@grixi.com>`,
      to: [to],
      subject,
      html,
    }),
  })
  
  return new Response(JSON.stringify(await res.json()), {
    headers: { "Content-Type": "application/json" },
  })
})
```

**Casos de uso:**
- Invitación a nueva organización
- Confirmación de email
- Notificación de aprobación de compra
- Alertas de stock bajo
- Reportes diarios

---

#### `sap-sync` — Integración SAP

```typescript
// supabase/functions/sap-sync/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req: Request) => {
  const { syncType, orgId, params } = await req.json()
  
  // Verificar que la org tiene SAP habilitado
  const supabase = createClient(/* ... */)
  const { data: org } = await supabase
    .from("organizations")
    .select("integrations")
    .eq("id", orgId)
    .single()
  
  if (!org?.integrations?.sap?.enabled) {
    return new Response("SAP not enabled for this organization", { status: 403 })
  }
  
  // Conectar a SAP vía SOAP/HTTP
  const sapEndpoint = Deno.env.get("SAP_SOAP_ENDPOINT")
  const sapEnvelope = buildSoapEnvelope(syncType, params)
  
  const sapResponse = await fetch(sapEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "Authorization": `Basic ${btoa(
        `${Deno.env.get("SAP_USER")}:${Deno.env.get("SAP_PASSWORD")}`
      )}`,
    },
    body: sapEnvelope,
  })
  
  const xmlText = await sapResponse.text()
  const data = parseSoapResponse(xmlText)
  
  // Persistir en Supabase con organization_id
  await supabase
    .from("sap_sync_logs")
    .insert({
      organization_id: orgId,
      sync_type: syncType,
      records_synced: data.length,
      status: "success",
    })
  
  return new Response(JSON.stringify({ synced: data.length }))
})
```

**Ventajas:**
- Credenciales SAP seguras en secrets
- Logging de cada sync por tenant
- Solo tenants con SAP habilitado pueden sincronizar
- Wall clock de 400s permite syncs grandes

---

#### `webhook-receiver` — Receptor de Webhooks

```typescript
// supabase/functions/webhook-receiver/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// JWT verification DISABLED — webhooks usan signature verification
Deno.serve(async (req: Request) => {
  // Verificar signature del webhook
  const signature = req.headers.get("x-webhook-signature")
  const body = await req.text()
  
  const isValid = await verifyWebhookSignature(
    body,
    signature,
    Deno.env.get("WEBHOOK_SECRET")!
  )
  
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 })
  }
  
  const payload = JSON.parse(body)
  const supabase = createClient(/* service_role */)
  
  // Procesar según tipo de webhook
  switch (payload.type) {
    case "payment.completed":
      await handlePaymentCompleted(supabase, payload)
      break
    case "invoice.created":
      await handleInvoiceCreated(supabase, payload)
      break
    default:
      console.log(`Unknown webhook type: ${payload.type}`)
  }
  
  return new Response(JSON.stringify({ received: true }))
})
```

---

#### `cron-daily-reports` — Reportes Programados

```sql
-- En PostgreSQL, usando pg_cron:
SELECT cron.schedule(
  'daily-reports',
  '0 6 * * *',  -- Todos los días a las 6:00 AM
  $$
    SELECT net.http_post(
      url := 'https://api.grixi.app/functions/v1/cron-daily-reports',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('trigger', 'daily_cron')
    );
  $$
);
```

```typescript
// supabase/functions/cron-daily-reports/index.ts
Deno.serve(async (req: Request) => {
  const supabase = createClient(/* service_role */)
  
  // Obtener TODAS las organizaciones activas
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, enabled_modules")
    .eq("is_active", true)
  
  // Generar reporte para cada org
  for (const org of orgs || []) {
    const report = await generateDailyReport(supabase, org)
    
    // Enviar por email a los admins de la org
    const { data: admins } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", org.id)
      .in("role", ["owner", "admin"])
    
    for (const admin of admins || []) {
      await sendReportEmail(admin.user_id, org, report)
    }
  }
  
  return new Response(JSON.stringify({ processed: orgs?.length }))
})
```

---

## 3. Patrones de Implementación

### 3.1 Estructura de Archivos

```
supabase/functions/
├── _shared/                    ← Código compartido
│   ├── supabase-client.ts      ← Factory de clientes
│   ├── cors.ts                 ← Headers CORS
│   ├── validation.ts           ← Schemas Zod compartidos
│   └── error-handler.ts        ← Manejo de errores estándar
│
├── ai-chat/
│   └── index.ts
├── ai-voice/
│   └── index.ts
├── send-email/
│   ├── index.ts
│   └── templates/
│       ├── invitation.ts
│       ├── notification.ts
│       └── report.ts
├── sap-sync/
│   └── index.ts
├── webhook-receiver/
│   └── index.ts
└── cron-daily-reports/
    └── index.ts
```

### 3.2 Patrón Base (Template)

```typescript
// Cada Edge Function sigue este patrón:
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { handleError } from "../_shared/error-handler.ts"

Deno.serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  
  try {
    // 2. Create Supabase client (con JWT del usuario)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    )
    
    // 3. Verificar usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders })
    }
    
    // 4. Parsear y validar input
    const body = await req.json()
    // ... lógica de validación con Zod
    
    // 5. Lógica de negocio
    // ... procesar
    
    // 6. Responder
    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
    
  } catch (error) {
    return handleError(error)
  }
})
```

### 3.3 Shared CORS Headers

```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // En producción: dominio específico
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}
```

### 3.4 Error Handler

```typescript
// supabase/functions/_shared/error-handler.ts
export function handleError(error: unknown): Response {
  console.error("Edge Function Error:", error)
  
  // No leakear detalles del error al cliente
  const message = error instanceof Error ? error.message : "Internal Server Error"
  const status = error instanceof ValidationError ? 400 
    : error instanceof AuthError ? 401 
    : 500
  
  return new Response(JSON.stringify({ 
    error: status === 500 ? "Internal Server Error" : message
  }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
```

---

## 4. Invocación desde el Frontend

### 4.1 Desde Server Components / Server Actions

```typescript
// Desde Server Action (recomendado para mutations)
'use server'
import { createServerClient } from '@/lib/supabase/server'

export async function chatWithGrixi(message: string, orgId: string) {
  const supabase = await createServerClient()
  
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: { message, orgId }
  })
  
  if (error) throw new Error('AI chat failed')
  return data
}
```

### 4.2 Desde Client Components

```typescript
// Desde Client Component (para real-time / streaming)
'use client'
import { createBrowserClient } from '@/lib/supabase/client'

export function useGrixiChat() {
  const supabase = createBrowserClient()
  
  async function sendMessage(message: string, orgId: string) {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: { message, orgId }
    })
    
    if (error) throw error
    return data
  }
  
  return { sendMessage }
}
```

### 4.3 Desde pg_cron (Scheduled)

```sql
-- Invocar Edge Function desde PostgreSQL
SELECT cron.schedule(
  'hourly-sync',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://api.grixi.app/functions/v1/sap-sync',
      headers := '{"Authorization": "Bearer [service_role_key]"}'::jsonb,
      body := '{"syncType": "incremental"}'::jsonb
    );
  $$
);
```

---

## 5. Deploy de Edge Functions

### 5.1 Vía MCP (Supabase MCP Server)

```
→ mcp_supabase_deploy_edge_function(
    name: "ai-chat",
    entrypoint_path: "index.ts",
    verify_jwt: true,
    files: [{ name: "index.ts", content: "..." }]
  )
```

### 5.2 Vía Supabase CLI

```bash
# Deploy una función
supabase functions deploy ai-chat

# Deploy todas
supabase functions deploy

# Set secrets
supabase secrets set GEMINI_API_KEY=xxx RESEND_API_KEY=xxx

# Test local
supabase functions serve ai-chat --env-file .env.local
```

### 5.3 Vía GitHub Actions

```yaml
# .github/workflows/deploy-functions.yml
name: Deploy Edge Functions
on:
  push:
    branches: [main]
    paths: ['supabase/functions/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - run: supabase functions deploy --no-verify-jwt=false
```

---

## 6. Ventajas Completas

| Ventaja | Detalle |
|---|---|
| **Sin servidor backend** | Edge Functions reemplazan Express/NestJS para lógica serverless |
| **TypeScript nativo** | Deno runtime — sin transpilación ni bundling complejo |
| **Cold start mínimo** | ~50ms vs ~500ms de Node.js serverless |
| **JWT automático** | Supabase verifica el token sin código — `verify_jwt: true` |
| **Acceso directo a DB** | Misma red que PostgreSQL — latencia mínima |
| **Secrets seguros** | API keys de terceros nunca se exponen al cliente |
| **Escalado automático** | Se ejecutan en el edge — escalan horizontalmente |
| **Cron jobs** | pg_cron invoca Edge Functions para tareas programadas |
| **Costo predecible** | 2M invocaciones incluidas — $2/1M adicional |
| **Deploy instantáneo** | `supabase functions deploy` — <30 segundos |
| **Aislamiento** | Cada invocación es un Deno isolate independiente |
| **Multi-tenant ready** | JWT contiene org_ids — lógica por tenant automática |
