# GRIXI — Arquitecturas Alternativas: Comparativa General

> Este directorio contiene 3 arquitecturas alternativas completas para la plataforma GRIXI, cada una con su propio set de documentación detallada.

---

## Índice de Alternativas

| # | Alternativa | Directorio | Descripción |
|---|---|---|---|
| 1 | [Supabase + Cloudflare](./alt-1-supabase-cloudflare/01-overview.md) | `alt-1-supabase-cloudflare/` | Supabase como backend + Cloudflare Workers como frontend. React Router v7 |
| 2 | [On-Premise Local](./alt-2-onpremise/01-overview.md) | `alt-2-onpremise/` | Mac Studio M4 Max + Docker + Coolify + Cloudflare Tunnel |
| 3 | [Bare Metal Cloud](./alt-3-baremetal/01-overview.md) | `alt-3-baremetal/` | Hetzner Dedicated + Docker + Coolify + Cloudflare |

---

## Arquitectura Actual (Referencia)

| Capa | Tecnología | Servicio | Costo/mes |
|---|---|---|---|
| Framework | Next.js 16 (App Router) | Vercel Pro | $20 |
| Backend + DB + Auth | PostgreSQL 17 + Supabase Auth | Supabase Pro + PITR | $140 |
| CDN + WAF + DNS | Cloudflare | Cloudflare Pro | $20 |
| Repo + CI/CD | GitHub + Vercel Integration | GitHub Teams | $12 |
| **Total** | | | **~$192/mes** |

---

## Comparativa de Infraestructura

| Criterio | Actual | Alt. 1 (SB+CF) | Alt. 2 (On-Prem) | Alt. 3 (Bare Metal) |
|---|---|---|---|---|
| **Costo/mes** | ~$192 | ~$182 | ~$40 | ~$110 |
| **Costo inicial** | $0 | $0 | ~$2,900 | ~$300 |
| **Uptime SLA** | 99.99% | 99.99% | Sin SLA | ~99.9% |
| **Redundancia** | Multi-region | Multi-region | Single server | Single (ampliable) |
| **Latencia global** | ⚡ Buena | ⚡⚡ Mejor | ⚡ Local only | ⚡ Datacenter |
| **Control de datos** | Cloud managed | Cloud managed | 💚 Total | 💚 Datacenter |

## Comparativa de Stack Tecnológico

| Capa | Actual | Alt. 1 | Alt. 2 | Alt. 3 |
|---|---|---|---|---|
| **Framework** | Next.js 16 | **React Router v7** | Next.js 16 | Next.js 16 |
| **Runtime** | Vercel Serverless | **CF Workers** | Node.js Docker | Node.js Docker |
| **DB** | Supabase PG | Supabase PG | **PG self-hosted** | **PG self-hosted** |
| **Auth** | Supabase Auth | Supabase Auth | **Better Auth** | **Better Auth** |
| **Realtime** | Supabase Realtime | Supabase Realtime | **Socket.io** | **Socket.io** |
| **Storage** | Supabase Storage | SB Storage + R2 | **MinIO** | **MinIO** |
| **Cache** | — | **Workers KV** | **Redis** | **Redis** |
| **Jobs** | pg_cron | pg_cron | **BullMQ** | **BullMQ** |
| **ORM** | supabase-js | **Drizzle** | **Drizzle** | **Drizzle** |
| **PaaS/Deploy** | Vercel | **Wrangler CLI** | **Coolify** | **Coolify** |
| **Monitoreo** | Vercel Dashboard | CF Analytics | **Grafana+Prometheus** | **Grafana+Prometheus** |

## Comparativa de Seguridad

| Criterio | Actual | Alt. 1 | Alt. 2 | Alt. 3 |
|---|---|---|---|---|
| **RLS nativo** | ✅ Supabase | ✅ Supabase | ✅ PG manual | ✅ PG manual |
| **Auth integrado** | ✅ | ✅ | ⚠️ Self-hosted | ⚠️ Self-hosted |
| **WAF** | ✅ CF Pro | ✅ CF Pro | ✅ CF Tunnel | ✅ CF Proxy |
| **PITR** | ✅ $100/mes | ✅ $100/mes | ❌ pg_dump | ❌ pg_dump |
| **DB Branching** | ✅ | ✅ | ❌ | ❌ |
| **DDoS Protection** | ✅ CF | ✅ CF | ✅ CF Tunnel | ✅ CF + Hetzner |

## Esfuerzo de Migración

| Criterio | Alt. 1 | Alt. 2 | Alt. 3 |
|---|---|---|---|
| **Rewrite frontend** | Medio (rutas + loaders) | Ninguno | Ninguno |
| **Rewrite backend** | Ninguno | Alto (auth + RT + storage) | Alto (auth + RT + storage) |
| **Setup infra** | Bajo | Alto (Docker + Tunnel) | Alto (Linux + Docker) |
| **Tiempo estimado** | 2-3 semanas | 3-5 semanas | 3-5 semanas |
| **Componentes reutilizables** | ~80% | ~70% | ~70% |

## Recomendación por Escenario

| Escenario | Mejor Opción |
|---|---|
| **Producción rápida** — equipo pequeño | **Actual** (Vercel + Supabase) |
| **Optimizar latencia** + eliminar Vercel | **Alt. 1** (Supabase + Cloudflare) |
| **Desarrollo + staging** local potente | **Alt. 2** (Mac Studio on-premise) |
| **Producción con control total** + costo fijo | **Alt. 3** (Hetzner bare metal) |
| **Cumplimiento regulatorio** / soberanía datos | **Alt. 2** o **Alt. 3** |

> [!TIP]
> **Combinación recomendada:** **Alt. 1 para producción** + **Alt. 2 como entorno dev/staging**. Producción cloud con SLA + desarrollo local con hardware potente.
