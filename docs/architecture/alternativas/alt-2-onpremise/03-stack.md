# Alternativa 2 — Stack Tecnológico Completo

> El framework y la mayoría de librerías de UI se mantienen. Lo que cambia es el backend: Supabase se reemplaza por servicios self-hosted.

---

## ¿Cambiar de Framework?

| Opción | Veredicto | Razón |
|---|---|---|
| **Next.js 16 standalone** | ✅ Se mantiene | `output: 'standalone'` funciona perfecto en Docker. Zero rewrite |
| SvelteKit | ❌ No | Rewrite total del frontend sin beneficio real |
| Remix / React Router v7 | ❌ No | Sin beneficio de edge en un servidor físico local |

> En on-premise **no hay beneficio de edge**. Next.js standalone con Node.js en Docker es lo más maduro.

---

## Stack Completo

| Capa | Tecnología | ¿Cambia? | Justificación |
|---|---|---|---|
| **Framework** | Next.js 16 (`output: 'standalone'`) | ❌ Igual | Docker en macOS — zero rewrite |
| **Runtime** | Node.js 22 (Docker) | ✅ Cambia | Local, no serverless |
| **Lenguaje** | TypeScript (strict) | ❌ Igual | — |
| **UI Components** | shadcn/ui + CVA | ❌ Igual | — |
| **Estilos** | Tailwind CSS 4 | ❌ Igual | — |
| **Estado** | Zustand | ❌ Igual | — |
| **Animaciones** | Framer Motion + GSAP + Lenis | ❌ Igual | — |
| **3D** | React Three Fiber + drei | ❌ Igual | — |
| **ORM** | **Drizzle ORM** | ✅ Nuevo | Conexión directa a PostgreSQL local |
| **DB** | **PostgreSQL 17** (Docker) | ✅ Cambia | Self-hosted con pgvector, pg_trgm, pg_cron |
| **Auth** | **Better Auth** v1 | ✅ Cambia | Google OAuth, MFA, sessions en Redis |
| **Realtime** | **Socket.io** + pg_notify | ✅ Cambia | WebSockets directos, CDC via triggers |
| **Cache** | **Redis 7** (Docker) | ✅ Nuevo | Sessions, query cache, rate limiting |
| **Job Queue** | **BullMQ** (Node.js + Redis) | ✅ Nuevo | Email, reports, SAP sync |
| **Storage** | **MinIO** (Docker) | ✅ Cambia | S3-compatible, buckets por tenant |
| **Reverse Proxy** | **Caddy** v2 | ✅ Nuevo | HTTPS automático, reverse proxy |
| **PaaS** | **Coolify** v4 | ✅ Nuevo | Git push-to-deploy, dashboard web |
| **Tunnel** | **Cloudflare Tunnel** | ✅ Nuevo | Exposición segura sin abrir puertos |
| **Monitoreo** | **Uptime Kuma** + **Grafana** + **Prometheus** | ✅ Nuevo | Health checks, métricas, alerting |
| **Backups** | **pg_dump** → SSD + **R2** | ✅ Nuevo | Automáticos cada 6h |
| **AI** | Gemini 2.0 Flash Lite | ❌ Igual | API call desde Server Actions |
| **CDN + WAF** | Cloudflare Pro | ❌ Igual | — |
| **CI/CD** | Coolify + GitHub webhooks | ✅ Cambia | — |
| **Validación** | Zod + react-hook-form | ❌ Igual | — |

---

## Resumen de Reutilización

| Categoría | Cantidad |
|---|---|
| **Se mantiene sin cambios** | 13 tecnologías |
| **Cambia o se agrega** | 11 tecnologías |
| **Se elimina** | 2 (Vercel + Supabase) |

### Componentes Reutilizables (del código actual)

- ✅ Todos los componentes React (`components/`)
- ✅ Tailwind config, globals.css, design tokens
- ✅ Zustand stores
- ✅ Framer Motion, GSAP, Lenis animaciones
- ✅ React Three Fiber scenes
- ✅ Zod schemas
- ✅ Supabase migrations SQL (se aplican a PostgreSQL local)
- ✅ Types globales

### Requiere Adaptación

- 🔄 `createServerClient()` → Drizzle ORM
- 🔄 Supabase Auth → Better Auth
- 🔄 Supabase Realtime → Socket.io
- 🔄 Supabase Storage → MinIO SDK
- 🔄 Supabase Edge Functions → Next.js API Routes o BullMQ workers
- 🔄 deploy workflow → Coolify git push
