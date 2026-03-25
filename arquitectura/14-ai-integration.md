# Alternativa 1 — Integración de AI (Gemini 3.1 Flash-Lite)

> Arquitectura completa de AI en GRIXI: server-side only, prompt enrichment por módulo,
> rich output, caching, rate limiting, y tracking de uso.

---

## 1. Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                    GRIXI AI ARCHITECTURE                          │
│                                                                   │
│  Browser (Client)              Worker (Server)       Gemini API  │
│  ─────────────────            ──────────────────    ───────────  │
│                                                                   │
│  ChatInput                                                        │
│  ├── User types ──────→ action() ──────────────→ Gemini 3.1     │
│  │    message            │                       Flash-Lite       │
│  │                       ├── 1. Auth check                        │
│  │                       ├── 2. Rate limit check                  │
│  │                       ├── 3. Enrich prompt                     │
│  │                       │    (inject module data)                │
│  │                       ├── 4. Check KV cache                    │
│  │                       ├── 5. Call Gemini API                   │
│  │                       ├── 6. Parse response                    │
│  │                       ├── 7. Log usage                         │
│  │                       └── 8. Return to client                  │
│  │                                                                │
│  ChatPanel ←──────────── response ────────────── (streaming)     │
│  ├── Render markdown                                              │
│  ├── Render charts (Recharts)                                     │
│  └── Render actions (buttons)                                     │
│                                                                   │
│  ⚠️ API key NUNCA llega al browser                               │
│  ⚠️ TODA llamada pasa por el Worker (server-side)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Implementación Server-Side

### Action de AI Chat

```typescript
// app/routes/api.ai.chat.tsx
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Route } from './+types/api.ai.chat'

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env
  const supabase = createSupabaseServerClient(request, env)

  // 1. Auth check
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })

  // 2. Rate limit check (Workers KV)
  const rateLimitKey = `rate:${session.user.id}:${new Date().toISOString().slice(0, 10)}`
  const currentCount = await env.KV_CACHE.get(rateLimitKey, 'json') as number || 0
  if (currentCount >= 100) { // 100 queries/day/user
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
  await env.KV_CACHE.put(rateLimitKey, JSON.stringify(currentCount + 1), { expirationTtl: 86400 })

  // 3. Parse request
  const { message, moduleContext, sessionId } = await request.json()

  // 4. Enrich prompt con datos del módulo activo
  const enrichedPrompt = await enrichPrompt(supabase, session, message, moduleContext)

  // 5. Check cache (para preguntas frecuentes)
  const cacheKey = `ai:${session.user.app_metadata.organization_id}:${hashMessage(enrichedPrompt)}`
  const cached = await env.KV_CACHE.get(cacheKey)
  if (cached) return Response.json(JSON.parse(cached))

  // 6. Call Gemini
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' })

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: enrichedPrompt }] }],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
  })

  const response = result.response
  const text = response.text()
  const usage = response.usageMetadata

  // 7. Log usage
  await supabase.from('ai_usage_logs').insert({
    organization_id: session.user.app_metadata.organization_id,
    user_id: session.user.id,
    model: 'gemini-3.1-flash-lite',
    tokens_input: usage?.promptTokenCount || 0,
    tokens_output: usage?.candidatesTokenCount || 0,
    cost_usd: calculateCost(usage),
    module: moduleContext,
  })

  // 8. Save message + response
  await supabase.from('chat_messages').insert([
    { session_id: sessionId, role: 'user', content: message, organization_id: session.user.app_metadata.organization_id },
    { session_id: sessionId, role: 'assistant', content: text, tokens_input: usage?.promptTokenCount, tokens_output: usage?.candidatesTokenCount, organization_id: session.user.app_metadata.organization_id },
  ])

  // 9. Cache response (5 min TTL)
  const responsePayload = { text, usage }
  await env.KV_CACHE.put(cacheKey, JSON.stringify(responsePayload), { expirationTtl: 300 })

  return Response.json(responsePayload)
}

function calculateCost(usage: any) {
  const inputCost = (usage?.promptTokenCount || 0) / 1_000_000 * 0.25
  const outputCost = (usage?.candidatesTokenCount || 0) / 1_000_000 * 1.50
  return inputCost + outputCost
}
```

---

## 3. Prompt Enrichment por Módulo

### Sistema de Enriquecimiento

```typescript
// lib/ai/prompt-enrichment.ts

export async function enrichPrompt(
  supabase: SupabaseClient,
  session: Session,
  userMessage: string,
  moduleContext?: string
): Promise<string> {
  const orgId = session.user.app_metadata.organization_id

  // System prompt base
  let systemPrompt = `
Eres GRIXI AI, el asistente inteligente de la plataforma GRIXI.
Empresa actual: ${session.user.app_metadata.organization_name}
Usuario: ${session.user.email}
Fecha: ${new Date().toLocaleDateString('es-EC')}
Idioma: Español

Reglas:
- Responde siempre en español
- Sé conciso y directo
- Si puedes generar un gráfico, hazlo con formato JSON para Recharts
- Si necesitas datos que no tienes, di qué datos necesitas
`

  // Inject module-specific data
  if (moduleContext) {
    const contextData = await getModuleContext(supabase, orgId, moduleContext)
    systemPrompt += `\n\nCONTEXTO DEL MÓDULO (${moduleContext}):\n${contextData}`
  }

  return `${systemPrompt}\n\nPREGUNTA DEL USUARIO:\n${userMessage}`
}

async function getModuleContext(supabase: SupabaseClient, orgId: string, module: string) {
  switch (module) {
    case 'almacenes':
      const { data: warehouses } = await supabase
        .from('warehouses').select('name, total_capacity, status')
        .eq('organization_id', orgId)
      const { data: lowStock } = await supabase
        .from('products').select('name, sku')
        .eq('organization_id', orgId)
        .lt('min_stock', 10)
      return JSON.stringify({ warehouses, lowStockProducts: lowStock })

    case 'compras':
      const { data: pendingPOs } = await supabase
        .from('purchase_orders').select('po_number, total, status, vendor:vendors(name)')
        .eq('organization_id', orgId)
        .in('status', ['pending', 'approved'])
      return JSON.stringify({ pendingOrders: pendingPOs })

    case 'finanzas':
      const { data: invoices } = await supabase
        .from('invoices').select('invoice_number, total, status, due_date, type')
        .eq('organization_id', orgId)
        .eq('status', 'pending')
      return JSON.stringify({ pendingInvoices: invoices })

    default:
      return 'Sin contexto específico del módulo.'
  }
}
```

---

## 4. Rich Output (Charts + Tables + Actions)

### Formato de Respuesta Rica

```typescript
// AI puede responder con JSON estructurado para UI rica
type RichContent = {
  type: 'chart' | 'table' | 'action'

  // type: 'chart'
  chartType?: 'bar' | 'line' | 'area' | 'pie'
  chartData?: Record<string, any>[]
  chartConfig?: Record<string, { label: string; color: string }>

  // type: 'table'
  headers?: string[]
  rows?: string[][]

  // type: 'action'
  actionLabel?: string
  actionUrl?: string
}
```

### Ejemplo de Rich Output

```
Usuario: "¿Cuánto gastamos en el último trimestre por proveedor?"

GRIXI AI responde con:
{
  "text": "El gasto total del Q1 2026 fue de $142,500...",
  "rich_content": {
    "type": "chart",
    "chartType": "bar",
    "chartData": [
      { "vendor": "Proveedor A", "total": 45000 },
      { "vendor": "Proveedor B", "total": 32000 },
      { "vendor": "Proveedor C", "total": 28500 }
    ]
  }
}

→ El ChatPanel renderiza un Recharts BarChart interactivo inline
```

---

## 5. AI Canvas (Split View)

```
┌────────────────────────────────┬─────────────────────────────────┐
│                                │                                  │
│  Chat Panel                    │  AI Canvas                       │
│  ──────────                    │  ─────────                       │
│                                │                                  │
│  [User]: ¿Top products         │  ┌──────────────────────────┐   │
│  por ventas?                   │  │  📊 Top Products Q1       │   │
│                                │  │                            │   │
│  [GRIXI AI]: Los 5             │  │  ████ Product A  $45K     │   │
│  productos más vendidos        │  │  ███ Product B   $32K     │   │
│  este trimestre son:           │  │  ██ Product C    $28K     │   │
│  1. Product A ($45K)           │  │  █ Product D     $15K     │   │
│  2. Product B ($32K)           │  │  █ Product E     $12K     │   │
│  ...                           │  │                            │   │
│                                │  └──────────────────────────┘   │
│  [Input] _______________       │                                  │
│                                │  [Descargar CSV] [Ver en Compras]│
└────────────────────────────────┴─────────────────────────────────┘
```

---

## 6. Rate Limiting

| Nivel | Límite | Cómo |
|---|---|---|
| **Por usuario** | 100 queries/día | Workers KV counter con TTL 24h |
| **Por tenant** | 1,000 queries/día | Workers KV counter por org_id |
| **Burst** | Max 5 queries/minuto/usuario | Sliding window en KV |
| **Token limit** | Max 4,096 output tokens/query | `maxOutputTokens` en API |

---

## 7. Estrategias de Optimización de Costos

| Estrategia | Ahorro | Implementación |
|---|---|---|
| **Response caching** | 30-40% | KV cache por hash de prompt+orgData (5 min TTL) |
| **Prompt compression** | 15-20% | Enviar solo resúmenes de datos, no tablas completas |
| **Modelo híbrido** | 20-30% | Usar modelo más barato para queries simples (clasificar primero) |
| **Context windowing** | 10-15% | Limitar historial de chat a últimos 5 mensajes |
| **Rate limiting** | Control | Previene abuse y costos descontrolados |

---

## 8. Tracking de Uso (para Facturación)

```sql
-- RPC para obtener uso de AI por tenant/periodo
CREATE OR REPLACE FUNCTION ai_get_usage_summary(
  p_org_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  total_queries BIGINT,
  total_tokens_input BIGINT,
  total_tokens_output BIGINT,
  total_cost_usd DECIMAL,
  daily_breakdown JSONB
) AS $$
SELECT
  COUNT(*),
  SUM(tokens_input),
  SUM(tokens_output),
  SUM(cost_usd),
  jsonb_agg(jsonb_build_object(
    'date', created_at::DATE,
    'queries', count,
    'cost', cost
  ))
FROM (
  SELECT
    created_at,
    COUNT(*) as count,
    SUM(cost_usd) as cost
  FROM ai_usage_logs
  WHERE organization_id = p_org_id
    AND created_at BETWEEN p_start_date AND p_end_date
  GROUP BY created_at::DATE
) daily;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```
