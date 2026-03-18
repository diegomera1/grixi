# Alternativa 1 — Workers: Limitaciones, Cache KV, R2, y Environments

> Aspectos avanzados de Cloudflare Workers que complementan el doc de deployment.

---

## 1. Limitaciones de Workers

| Límite | Workers Paid | Implicación para GRIXI |
|---|---|---|
| **CPU time** | 30ms por request (puede ser más en Unbound) | Queries pesadas deben ir a Supabase RPCs |
| **Memory** | 128 MB por worker | No procesar archivos grandes en el worker |
| **Request size** | 100 MB | Suficiente para uploads normales |
| **Subrequest** | 1000 por request | Suficiente para SSR con múltiples fetches |
| **Duration** | 30s (standard) / 15min (Unbound) | Usar Unbound para SSR pesado |
| **KV reads** | 100,000/día (paid) | Cache ISR funciona holgadamente |
| **WebSocket** | ❌ No puede iniciar conexiones WS | Supabase Realtime funciona vía browser |
| **Node.js compat** | ⚠️ Parcial (`nodejs_compat` flag) | Algunas libs pueden no funcionar |

> [!IMPORTANT]
> **WebSocket limitation:** Workers no pueden hacer `new WebSocket()` como initiator. Pero esto NO afecta a GRIXI porque **Supabase Realtime se conecta desde el browser** (client-side), no desde el server. Los Workers solo hacen SSR con fetch a Supabase.

---

## 2. Workers KV — Cache Strategy

### ¿Qué cachear?

| Dato | TTL | Razón |
|---|---|---|
| **Org config** | 5 min | Cambia raramente, se lee en cada request |
| **Tenant branding** | 10 min | Logo, colores — cacheable |
| **Navigation/menu** | 5 min | Basado en módulos habilitados |
| **User permissions** | 2 min | Cambios infrecuentes |
| **Dashboard counters** | 1 min | Datos que cambian pero toleran stale |

### Implementación

```typescript
// lib/cache/kv.ts
import type { KVNamespace } from '@cloudflare/workers-types'

export async function getCachedOrFetch<T>(
  kv: KVNamespace,
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  // Try cache
  const cached = await kv.get(key, 'json')
  if (cached) return cached as T

  // Fetch fresh
  const data = await fetcher()
  
  // Store in KV (non-blocking)
  kv.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds })
  
  return data
}
```

### Uso en Loaders

```typescript
// app/routes/dashboard.tsx
export async function loader({ context }: Route.LoaderArgs) {
  const kv = context.cloudflare.env.KV_CACHE
  const supabase = createClient(context.cloudflare.env)

  const orgConfig = await getCachedOrFetch(
    kv,
    `org:${session.orgId}:config`,
    () => supabase.from('organizations').select('*').eq('id', session.orgId).single(),
    300 // 5 min
  )

  return { orgConfig }
}
```

### Invalidación

```typescript
// En un action que modifica config
export async function action({ request, context }: Route.ActionArgs) {
  const kv = context.cloudflare.env.KV_CACHE
  // ... update en Supabase ...
  
  // Invalidar cache
  await kv.delete(`org:${orgId}:config`)
  
  return data({ success: true })
}
```

---

## 3. Cloudflare R2 — Cache de Storage

### Flujo de Assets

```
Upload: Usuario → Supabase Storage (origin) → R2 (cache copy)
Download: Usuario → R2 (edge, rápido) → fallback Supabase Storage
```

### Configuración

```toml
# wrangler.toml
[[r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "grixi-assets"
```

```typescript
// lib/storage/r2.ts
export async function getAsset(env: Env, key: string): Promise<Response> {
  // Try R2 first
  const object = await env.ASSETS_BUCKET.get(key)
  if (object) {
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000',
      }
    })
  }

  // Fallback to Supabase Storage
  const sbUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${key}`
  const response = await fetch(sbUrl)
  
  // Cache in R2 for next time (non-blocking)
  const body = await response.clone().arrayBuffer()
  env.ASSETS_BUCKET.put(key, body, {
    httpMetadata: { contentType: response.headers.get('Content-Type') || undefined }
  })

  return response
}
```

---

## 4. Environment Management

### Estructura

```toml
# wrangler.toml — Multi-environment

# Production (default)
name = "grixi"
[vars]
APP_ENV = "production"
SUPABASE_URL = "https://api.grixi.app"

# Staging
[env.staging]
name = "grixi-staging"
[env.staging.vars]
APP_ENV = "staging"
SUPABASE_URL = "https://staging.grixi.app"

# Preview (PRs)
[env.preview]
name = "grixi-preview"
[env.preview.vars]
APP_ENV = "preview"
```

### Secrets por Environment

```bash
# Production secrets
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put GEMINI_API_KEY

# Staging secrets
wrangler secret put SUPABASE_ANON_KEY --env staging
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
```

### Deploy por Environment

```bash
wrangler deploy              # → production
wrangler deploy --env staging # → staging
wrangler deploy --env preview # → preview
```

---

## 5. Rollback

```bash
# Listar versiones desplegadas
wrangler versions list

# Rollback a una versión anterior
wrangler versions rollback <version-id>

# En CI/CD — deploy con tag
wrangler deploy --message "v1.2.3"
```
