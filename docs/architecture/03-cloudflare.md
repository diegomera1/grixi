# GRIXI × Cloudflare — Plataforma Unificada de Hosting, Seguridad y Edge Computing

> **Cloudflare como hosting, CDN, WAF, DNS y compute en uno.** Este documento reemplaza la visión anterior donde Cloudflare era solo CDN/WAF. Ahora es la plataforma completa de ejecución del frontend GRIXI.
>
> Última actualización: 20 de marzo, 2026.

---

## 1. Nueva Visión: Cloudflare como Plataforma Completa

### 1.1 Antes vs Ahora

| Aspecto | Antes | Ahora |
|---|---|---|
| **Hosting frontend** | Vercel ($20/mes) | **Cloudflare Workers** ($5/mes) |
| **CDN** | Cloudflare Pro ($20/mes) | **Cloudflare Pro** ($20/mes) — mismo |
| **WAF + DDoS** | Cloudflare Pro | **Cloudflare Pro** — mismo |
| **Serverless/SSR** | Vercel Serverless (Node.js, cold starts) | **Cloudflare Workers** (V8, 0ms cold starts) |
| **Build tool** | Turbopack | **Vite 8 + Rolldown** (Rust, 10-30x más rápido) |
| **Framework** | Next.js 16 (App Router) | **React Router v7** (framework mode, adapter GA) |
| **Cache edge** | — | **Workers KV** (datos en 310+ PoPs) |
| **Object storage** | Supabase Storage | Supabase Storage + **R2** ($0 egress) |
| **Total hosting** | $40/mes (Vercel + CF) | **$25/mes** (CF Pro + Workers) |

### 1.2 Diagrama de Arquitectura Unificada

```
Usuario → DNS → CLOUDFLARE (310+ PoPs globales)
  │
  ├── WAF + DDoS + Bot Protection (Capa de seguridad)
  │
  ├── CDN (assets estáticos: JS, CSS, fonts, images)
  │
  ├── Worker (React Router v7 SSR — Vite 8 + Rolldown build)
  │     ├── Loaders → fetch a Supabase (PostgREST / Drizzle + Hyperdrive)
  │     ├── Actions → mutations en Supabase
  │     ├── Middleware → auth check + tenant resolution
  │     └── Workers KV → cache de datos en el edge
  │
  └── R2 Storage (archivos de tenants, $0 egress)
        │
        └──→ Supabase (us-east-1)
              ├── PostgreSQL 17 (DB + RLS multi-tenant)
              ├── Auth (JWT, Google OAuth, MFA)
              ├── Realtime (WebSockets, CDC)
              ├── Storage (origin de archivos)
              └── Edge Functions (Deno — webhooks, SAP, email)
```

---

## 2. Stack Tecnológico Completo (Marzo 2026)

### 2.1 Frontend & Build

| Capa | Tecnología | Versión | Justificación |
|---|---|---|---|
| **Framework** | React Router v7 (framework mode) | 7.13+ | Adapter oficial GA de Cloudflare. Loaders/Actions nativos |
| **Build Tool** | Vite 8 | 8.0+ | Build unificado Rolldown (Rust). 10-30x más rápido |
| **Bundler** | Rolldown (via Vite 8) | Integrado | Un solo bundler dev+prod. Elimina inconsistencias |
| **JS Transforms** | Oxc (via Vite 8) | Integrado | React Refresh sin Babel. cold starts más rápidos |
| **CSS Minifier** | Lightning CSS (via Vite 8) | Integrado | CSS moderno, output más pequeño |
| **Runtime** | Cloudflare Workers (V8 isolates) | Standard | 310+ PoPs, 0ms cold starts |
| **UI Library** | React 19 | 19.2+ | Todos los componentes se reutilizan |
| **Lenguaje** | TypeScript (strict mode) | 5.x | Sin cambios |

### 2.2 UI & Styling

| Capa | Tecnología | ¿Cambia? | Notas |
|---|---|---|---|
| **UI Components** | shadcn/ui + CVA | ❌ Igual | Funciona con cualquier framework React |
| **Estilos** | Tailwind CSS 4 | ❌ Igual | Compatible con Vite 8 |
| **Iconos** | Lucide React | ❌ Igual | — |
| **Dark Mode** | next-themes → manual | ⚠️ Adaptar | `next-themes` → provider custom simple |
| **Fuentes** | `@fontsource/*` packages | ✅ Cambia | Reemplaza `next/font` |

### 2.3 Estado, Animaciones & 3D

| Capa | Tecnología | ¿Cambia? | Notas |
|---|---|---|---|
| **Estado Client** | Zustand 5 | ❌ Igual | Store global, sin dependencia de meta-framework |
| **Animaciones** | Framer Motion + GSAP + Lenis | ❌ Igual | Librería React pura |
| **3D** | React Three Fiber + drei | ❌ Igual | Librería React pura |
| **Gráficos** | Recharts | ❌ Igual | — |
| **Tablas** | TanStack Table | ❌ Igual | — |

### 2.4 Backend & Data

| Capa | Tecnología | ¿Cambia? | Notas |
|---|---|---|---|
| **DB** | Supabase PostgreSQL 17 (OrioleDB) | ❌ Igual | Schema, RLS, extensions — todo se mantiene |
| **ORM** | supabase-js + Drizzle ORM (opcional) | ✅ Nuevo | Drizzle para queries complejas (type-safe, ~7KB) |
| **Connection Pool** | Hyperdrive (Cloudflare) | ✅ Nuevo | Pool de conexiones global, reduce latencia DB |
| **Auth** | Supabase Auth | ❌ Igual | Google OAuth, JWT hooks, MFA |
| **Realtime** | Supabase Realtime | ❌ Igual | CDC, Presence, Broadcast (client-side) |
| **Storage** | Supabase Storage + R2 (cache) | ⚠️ Mejora | R2 como CDN acelerado frente a Supabase Storage |
| **Edge Functions** | Supabase Edge Functions (Deno) | ❌ Igual | Webhooks, SAP, email |
| **Cache** | Workers KV | ✅ Nuevo | ISR / cache de datos en el edge |
| **AI** | Gemini 2.0 Flash Lite | ❌ Igual | Llamada vía loader/action server-side |

### 2.5 Validación & Forms

| Capa | Tecnología | ¿Cambia? | Notas |
|---|---|---|---|
| **Validación** | Zod | ❌ Igual | Client + Server |
| **Forms** | `<Form>` nativo de React Router | ✅ Cambia | Progressive enhancement. Reemplaza react-hook-form |

### 2.6 Infraestructura & DevOps

| Capa | Tecnología | ¿Cambia? | Notas |
|---|---|---|---|
| **CDN + WAF** | Cloudflare Pro | ❌ Igual | Ya pagamos CF, ahora también host |
| **CI/CD** | GitHub Actions → Vite 8 build → wrangler deploy | ✅ Cambia | Build ~5-10s (Rolldown) |
| **Repo** | GitHub Teams | ❌ Igual | — |
| **Deploy CLI** | Wrangler | ✅ Nuevo | Deploy a Workers |
| **Monitoreo** | CF Analytics + Sentry + Supabase Dashboard | ⚠️ Cambia | CF Analytics reemplaza Vercel Dashboard |

### 2.7 Vite 8 Toolchain Unificado

```
Vite 8 (orquestador)
  ├── Rolldown (bundler — Rust, reemplaza esbuild + Rollup)
  ├── Oxc (transforms JS/TS — Rust, reemplaza Babel)
  └── Lightning CSS (minifier CSS — Rust, reemplaza esbuild CSS)

Todo mantenido por VoidZero (Evan You). Un solo equipo, un toolchain.
```

| Métrica | Antes (Next.js + Turbopack) | Ahora (Vite 8 + Rolldown) |
|---|---|---|
| **Production build** | ~60-90s | **~5-10s** |
| **Dev server start** | ~2-3s | **~500ms** |
| **React Refresh** | Babel-based | **Babel-free** (Oxc) |
| **CSS output** | esbuild | **Lightning CSS** (más pequeño) |
| **Dev/Prod consistency** | ⚠️ Diferente bundler | ✅ **Mismo bundler** |
| **tsconfig paths** | Plugin externo | ✅ **Built-in** (`resolve.tsconfigPaths`) |

---

## 3. Planes y Licencias de Cloudflare

### 3.1 Lo que GRIXI necesita

| Servicio | Plan | Costo/mes | Qué incluye |
|---|---|---|---|
| **Cloudflare Pro** (grixi.com) | Pro | $20 | CDN, WAF (20 reglas), DDoS unmetered, SSL, Analytics |
| **Cloudflare Pro** (grixi.app) | Pro | $20 | Wildcard para tenants (`*.grixi.app`) |
| **Workers Paid** | Standard | $5 | 10M requests, 30M CPU ms, Workers KV, Hyperdrive |
| **R2** | Pay-as-you-go | ~$0-3 | 10 GB gratis, $0.015/GB, **$0 egress** |
| **Workers KV** | Incluido en Workers Paid | $0 | 10M reads/mes, 1 GB storage |
| **Hyperdrive** | Incluido en Workers Paid | $0 | Connection pooling para PostgreSQL |
| | **TOTAL** | **~$45-48/mes** | |

### 3.2 Evolución por Fase

| Fase | Cloudflare Plan | Workers | Costo CF total |
|---|---|---|---|
| **Fase 1** (1-5 empresas) | 2× Pro + Workers Paid | Standard ($5) | **$45/mes** |
| **Fase 2** (5-10 empresas) | 2× Pro + Workers Paid + R2 | Standard ($5) | **$50/mes** |
| **Fase 3** (10+ empresas, SLA) | 2× Business + Workers Paid | Standard ($5) | **$405/mes** |

### 3.3 Workers Paid — Límites Detallados

| Recurso | Incluido (Workers Paid $5/mes) | Extra |
|---|---|---|
| **Requests** | 10M/mes | $0.30/M extra |
| **CPU Time** | 30M ms/mes | $0.02/M CPU ms extra |
| **Duration** | Sin límite | — |
| **Worker Scripts** | 500 | — |
| **Data Transfer** | Sin cargo (egress gratis) | — |
| **KV Reads** | 10M/mes | $0.50/M extra |
| **KV Writes** | 1M/mes | $5.00/M extra |
| **KV Storage** | 1 GB | $0.50/GB extra |
| **R2 Storage** | 10 GB gratis | $0.015/GB |
| **R2 Egress** | **$0 siempre** | — |
| **Hyperdrive** | Incluido | — |
| **Max CPU per request** | 5 min (default 30s) | — |
| **Max Memory** | 128 MB por worker | — |

> [!NOTE]
> Con 50 usuarios y ~100K pageviews/mes, GRIXI estará muy por debajo de los 10M requests incluidos. El plan Workers Paid de $5/mes es más que suficiente para los primeros 2 años.

---

## 4. Red Global: 310+ PoPs

### 4.1 Infraestructura

| Métrica | Valor |
|---|---|
| **Data Centers** | 310+ ciudades en 120+ países |
| **Capacidad de Red** | 280+ Tbps |
| **% del Internet global** | ~20% del tráfico web pasa por Cloudflare |
| **DNS response time** | ~11ms promedio global |

### 4.2 Latencia LATAM (Relevante para GRIXI)

| PoP | Ciudad | Latencia estimada |
|---|---|---|
| GYE | Guayaquil | ~5-10ms |
| UIO | Quito | ~5-10ms |
| BOG | Bogotá | ~10-15ms |
| LIM | Lima | ~15-20ms |
| GRU | São Paulo | ~20-30ms |
| MIA | Miami | ~30-40ms |

> Vercel tiene PoPs limitados en LATAM (~3 edge locations). Cloudflare tiene **PoPs en Ecuador** (Guayaquil y Quito), lo que significa latencia mínima para los usuarios de GRIXI.

---

## 5. WAF (Web Application Firewall)

### 5.1 OWASP Managed Rules (incluidas en Pro)

| # | Vulnerabilidad | Protección |
|---|---|---|
| A01 | Broken Access Control | Detecta escalación de privilegios |
| A03 | Injection (SQL, NoSQL, OS) | Bloquea payloads maliciosos |
| A05 | Security Misconfiguration | Headers faltantes, paths expuestos |
| A07 | Auth Failures | Brute force, credential stuffing |
| A10 | SSRF | Server-Side Request Forgery |

### 5.2 Custom WAF Rules para GRIXI (20 disponibles en Pro)

```
Regla 1: Rate limit en auth → IF path starts_with "/auth" AND rate > 20 req/min → CHALLENGE
Regla 2: Bloquear user-agents maliciosos → IF user_agent contains "sqlmap" → BLOCK
Regla 3: Content-Type enforcement → IF method = "POST" AND NOT json → BLOCK
Regla 4: Proteger API Supabase → IF hostname = "api.grixi.app" AND NOT valid_referer → BLOCK
Regla 5: GeoIP (opcional) → IF country NOT IN {"EC","US","CO","PE","MX"} → CHALLENGE
```

### 5.3 DDoS Protection

| Capa | Tipo | Protección |
|---|---|---|
| L3/L4 (Red) | SYN Flood, UDP Flood | ✅ Automática |
| L7 (Aplicación) | HTTP Flood, Slowloris | ✅ Automática + custom |
| DNS | DNS Amplification | ✅ Automática |

> DDoS protection es **unmetered** en todos los planes — no pagas extra por absorber ataques.

---

## 6. CDN: Qué se Cachea

| Tipo de Contenido | Cacheado | TTL |
|---|---|---|
| JavaScript bundles (.js) | ✅ | 1 año (content hash) |
| CSS (.css) | ✅ | 1 año |
| Imágenes | ✅ | 1 mes |
| Fuentes (Geist, Instrument Serif) | ✅ | 1 año |
| HTML dinámico (SSR) | ❌ | No cachear |
| API responses | ❌ | Workers KV para cache selectivo |

**Ahorro estimado:** ~70-80% de requests son assets estáticos servidos desde CDN, nunca llegan al Worker. Solo ~20-30% de requests ejecutan SSR.

---

## 7. SSL/TLS

| Configuración | Valor |
|---|---|
| **SSL Mode** | Full (Strict) |
| **Minimum TLS** | 1.2 |
| **TLS 1.3** | Enabled |
| **HSTS** | max-age=31536000; includeSubDomains |
| **Always HTTPS** | Enabled |
| **HTTP/3 (QUIC)** | Enabled |

---

## 8. Configuración DNS

```
# grixi.com (landing page)
grixi.com.          A       → Worker (proxied ☁️)
www.grixi.com.      CNAME   → grixi.com (proxied ☁️)

# app.grixi.com (dashboard principal)
app.grixi.com.      CNAME   → grixi.workers.dev (proxied ☁️)

# *.grixi.app (tenant wildcard)
*.grixi.app.        CNAME   → grixi.workers.dev (proxied ☁️)

# api.grixi.app (Supabase custom domain)
api.grixi.app.      CNAME   → [supabase-custom-domain].supabase.co (proxied ☁️)

# Email (Resend)
grixi.com.          MX      → mx.resend.com
grixi.com.          TXT     → v=spf1 include:resend.com ~all
grixi.com.          TXT     → [DKIM record from Resend]
```

---

## 9. Workers KV — Cache Strategy

### 9.1 Qué cachear

| Dato | TTL | Razón |
|---|---|---|
| Org config | 5 min | Cambia raramente, se lee en cada request |
| Tenant branding (logo, colores) | 10 min | Cacheable |
| Navigation/menu | 5 min | Basado en módulos habilitados |
| User permissions | 2 min | Cambios infrecuentes |
| Dashboard counters | 1 min | Toleran stale |

### 9.2 Implementación

```typescript
// lib/cache/kv.ts
export async function getCachedOrFetch<T>(
  kv: KVNamespace,
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = await kv.get(key, 'json')
  if (cached) return cached as T

  const data = await fetcher()
  kv.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds })
  return data
}
```

---

## 10. Hyperdrive — Connection Pooling

### 10.1 ¿Qué es?

Hyperdrive es el connection pooler nativo de Cloudflare para PostgreSQL. Mantiene pools de conexiones calientes en el edge, eliminando el overhead de establecer conexiones TCP + TLS en cada request.

### 10.2 Beneficio para GRIXI

```
Sin Hyperdrive:
  Worker request → TCP handshake → TLS handshake → PG auth → query → ~100-200ms

Con Hyperdrive:
  Worker request → conexión pool (caliente) → query → ~20-30ms
```

### 10.3 Configuración

```toml
# wrangler.toml
[[hyperdrive]]
binding = "DB"
id = "abc123..."  # configurado vía wrangler
```

```typescript
// lib/db/client.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export function createDb(env: Env) {
  const client = postgres(env.DB.connectionString)
  return drizzle(client)
}
```

---

## 11. R2 Storage — $0 Egress

### 11.1 Uso en GRIXI

| Contenido | Origin | Cache en R2 |
|---|---|---|
| Logos de tenants | Supabase Storage | ✅ R2 |
| Documentos compartidos | Supabase Storage | ✅ R2 |
| Imágenes de productos | Supabase Storage | ✅ R2 |
| Backups/exports | — | ✅ R2 directo |

### 11.2 Ventaja vs Supabase Storage

- **Supabase Storage egress:** $0.09/GB (después de free tier)
- **R2 egress:** **$0 siempre**
- Para apps con muchos archivos/imágenes, R2 ahorra significativamente

---

## 12. Seguridad — Defense-in-Depth (5 Capas)

```
Capa 5: RED          → Cloudflare WAF + DDoS + Bot Protection
Capa 4: EDGE         → React Router middleware en Workers
Capa 3: APLICACIÓN   → Zod validation en loaders/actions
Capa 2: AUTH         → Supabase Auth (JWT + RLS + custom claims)
Capa 1: DATOS        → PostgreSQL RLS (organization_id)
```

La seguridad es **prácticamente idéntica** al setup actual. La única diferencia es que el middleware corre en Cloudflare Workers en vez de Vercel Edge.

### Security Headers (configurados en Worker)

| Header | Valor |
|---|---|
| `X-Frame-Options` | DENY |
| `X-Content-Type-Options` | nosniff |
| `Referrer-Policy` | strict-origin-when-cross-origin |
| `Strict-Transport-Security` | max-age=31536000; includeSubDomains |
| `Content-Security-Policy` | Configurado según módulos |

---

## 13. Limitaciones de Workers

| Límite | Workers Paid | Mitigación |
|---|---|---|
| **CPU time** | 30s default (5 min max) | Queries pesadas → Supabase RPCs |
| **Memory** | 128 MB por worker | No procesar archivos grandes en el worker |
| **WebSocket initiator** | ❌ Workers no inician WS | ✅ Supabase Realtime conecta desde browser (client-side) |
| **Node.js compat** | ⚠️ Parcial (flag `nodejs_compat`) | Verificar dependencias una por una |
| **Bundle size** | 10 MB por worker | Suficiente (React Router + app = ~2-3MB) |

> [!IMPORTANT]
> **WebSocket:** Workers no pueden iniciar conexiones WebSocket, pero esto NO afecta a GRIXI. Supabase Realtime se conecta desde el **browser** (client-side React), no desde el server.

---

## 14. Deploy y CI/CD

### 14.1 Vite 8 Config

```typescript
// vite.config.ts
import { reactRouter } from '@react-router/dev/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,  // Built-in en Vite 8
  },
})
```

### 14.2 Wrangler Config

```toml
# wrangler.toml
name = "grixi"
compatibility_date = "2026-03-20"
compatibility_flags = ["nodejs_compat"]
main = ".react-router/worker.ts"

[assets]
directory = ".react-router/client"
not_found_handling = "single-page-application"

[[kv_namespaces]]
binding = "KV_CACHE"
id = "abc123..."

[[hyperdrive]]
binding = "DB"
id = "def456..."

[[r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "grixi-assets"

[vars]
SUPABASE_URL = "https://api.grixi.app"
APP_ENV = "production"

# Secrets (via wrangler secret put):
# SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
```

### 14.3 CI/CD con GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm build  # Vite 8 + Rolldown (~5-10s)

      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: ${{ github.ref == 'refs/heads/main' && 'deploy' || 'versions upload' }}
```

### 14.4 Preview Deployments (Ramas)

```
GitHub                          Cloudflare Workers
──────                          ────────────────
main (push) ──────────────────→ Production Deploy (grixi.com, *.grixi.app)
feature/nuevo-modulo (PR) ────→ Preview Deploy (abc123.grixi.workers.dev)
develop (push) ───────────────→ Staging Deploy (grixi-staging.workers.dev)
```

### 14.5 Environments

```toml
# Production (default)
[vars]
APP_ENV = "production"

# Staging
[env.staging]
name = "grixi-staging"
[env.staging.vars]
APP_ENV = "staging"

# Preview
[env.preview]
name = "grixi-preview"
[env.preview.vars]
APP_ENV = "preview"
```

---

## 15. Monitoreo

| Herramienta | Qué monitorea |
|---|---|
| **CF Workers Analytics** | Requests, CPU time, errors, latencia |
| **CF Web Analytics** | Pageviews, visitors, Core Web Vitals |
| **CF Firewall Analytics** | WAF events, bots bloqueados, rate limits |
| **wrangler tail** | Logs en tiempo real (desarrollo) |
| **Sentry** | Error tracking, crashes, performance |
| **Supabase Dashboard** | DB, Auth, Realtime, Storage |
| **Vite 8 Devtools** | Module graph, plugin transforms (dev) |

---

## 16. Comparativa de Costos: Actual vs Cloudflare Unificado

### Fase 1 (1-5 empresas, ~50 usuarios)

| Concepto | Actual (Vercel + CF CDN) | CF Unificado | Diferencia |
|---|---|---|---|
| Vercel Pro | $20 | $0 | -$20 ✅ |
| CF Pro (2 dominios) | $40 | $40 | $0 |
| CF Workers Paid | $0 | $5 | +$5 |
| CF Workers KV + R2 | $0 | ~$3 | +$3 |
| Supabase (Pro + Medium + PITR) | $175 | $175 | $0 |
| **Subtotal infra** | **$235** | **$223** | **-$12/mes** |

### Performance

| Métrica | Actual (Vercel) | CF Unificado |
|---|---|---|
| **Cold starts** | ~250-500ms | **0ms** ✅ |
| **PoPs** | ~18 edge + 1 serverless region | **310+** ✅ |
| **Ecuador PoPs** | ❌ Ninguno | ✅ **Guayaquil + Quito** |
| **Egress cost** | $40/100GB extra | **$0 siempre** ✅ |
| **Build time** | ~60-90s (Turbopack) | **~5-10s** (Rolldown) ✅ |

---

## 17. Checklist de Configuración

```
CLOUDFLARE DASHBOARD:
├── DNS
│   ├── [ ] grixi.com → Worker (proxied)
│   ├── [ ] app.grixi.com → Worker (proxied)
│   ├── [ ] *.grixi.app → Worker (proxied)
│   ├── [ ] api.grixi.app → Supabase (proxied)
│   └── [ ] MX + SPF + DKIM para email
│
├── SSL/TLS
│   ├── [ ] Mode: Full (Strict)
│   ├── [ ] Minimum TLS: 1.2
│   ├── [ ] TLS 1.3: Enabled
│   ├── [ ] HSTS: Enabled
│   ├── [ ] Always Use HTTPS: Enabled
│   └── [ ] HTTP/3 (QUIC): Enabled
│
├── Security
│   ├── [ ] WAF: OWASP rules enabled
│   ├── [ ] Bot Fight Mode: Enabled
│   ├── [ ] Custom WAF Rules (5 reglas iniciales)
│   └── [ ] Browser Integrity Check: Enabled
│
├── Workers
│   ├── [ ] Workers Paid plan activated
│   ├── [ ] Secrets configured (Supabase keys, Gemini)
│   ├── [ ] Hyperdrive configurado (Supabase connection string)
│   ├── [ ] KV namespace creado
│   ├── [ ] R2 bucket creado (grixi-assets)
│   └── [ ] Custom domains configurados
│
├── Caching
│   ├── [ ] Caching Level: Standard
│   ├── [ ] Tiered Cache: Enabled
│   └── [ ] Always Online: Enabled
│
└── Speed
    ├── [ ] Brotli: Enabled
    ├── [ ] Early Hints: Enabled
    └── [ ] HTTP/2 + HTTP/3: Enabled
```
