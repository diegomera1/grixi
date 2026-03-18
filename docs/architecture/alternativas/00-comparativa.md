# GRIXI — Arquitecturas Alternativas: Comparativa General

> Este directorio contiene 3 arquitecturas alternativas completas para la plataforma GRIXI, cada una con su propio set de documentación detallada.

---

## Índice de Alternativas

| # | Alternativa | Directorio | Descripción |
|---|---|---|---|
| 1 | [Supabase + Cloudflare](./alt-1-supabase-cloudflare/01-overview.md) | `alt-1-supabase-cloudflare/` | Supabase como backend + Cloudflare Workers como frontend. React Router v7 |
| 2 | [On-Premise Local](./alt-2-onpremise/01-overview.md) | `alt-2-onpremise/` | Mac Studio M4 Max + Docker + Coolify + Cloudflare Tunnel |
| 3 | [Bare Metal Cloud](./alt-3-baremetal/01-overview.md) | `alt-3-baremetal/` | Hetzner Dedicated + Docker + Coolify + Cloudflare |

## Documentos Transversales

| Documento | Contenido |
|---|---|
| [00-benchmarks.md](./00-benchmarks.md) | Performance benchmarks: TTFB, throughput, DB speed |
| [00-roadmap-migracion.md](./00-roadmap-migracion.md) | Timeline de migración por alternativa |

---

## Arquitectura Actual (Referencia)

### Infraestructura

| Capa | Tecnología | Servicio | Costo/mes |
|---|---|---|---|
| Framework | Next.js 16 (App Router) | Vercel Pro | $20 |
| Backend + DB + Auth | PostgreSQL 17 + Supabase Auth | Supabase Pro (Medium + PITR) | $175 |
| CDN + WAF + DNS | Cloudflare | Cloudflare Pro | $20 |
| **Subtotal infra** | | | **$215/mes** |

### Stack de Trabajo

| Servicio | Detalle | Costo/mes |
|---|---|---|
| GitHub Team | Repo + CI/CD | $4/usuario |
| Google Workspace Standard | Email, Drive, Meet | $14/usuario |
| Discord Level 2 | Comunicación interna (7 boosts) | $40 |
| Gemini API | AI assistant | ~$25 |
| Resend Pro | Emails transaccionales | $20 |
| Sentry | Error tracking | $0 (free) |
| Jira | Project management | $0 (free, 10 users) |
| Dominio | grixi.com | ~$1 |
| **Subtotal fijo** | | **$86/mes + $18/user** |

### Total Actual

| Equipo | Costos fijos | Per-user | **Total/mes** |
|---|---|---|---|
| 1 persona | $301 | $18 | **$319** |
| 3 personas | $301 | $54 | **$355** |
| 5 personas | $301 | $90 | **$391** |

---

## Comparativa de Costos (3 personas)

| Criterio | Actual | Alt. 1 (SB+CF) | Alt. 2 (On-Prem) | Alt. 3 (AX52) |
|---|---|---|---|---|
| **Costos fijos/mes** | $301 | $288 | $114 | $182 |
| **Per-user/mes** | $18 | $18 | $18 | $18 |
| **Total 3 pers./mes** | **$355** | **$342** | **$168** | **$236** |
| **Costo inicial** | $0 | $0 | ~$2,910 | ~$290 |
| **Break-even** | — | Inmediato | ~16 meses | ~3 meses |
| **1 año** | $4,260 | $4,104 | $4,926 | **$3,122** |
| **2 años** | $8,520 | $8,208 | $6,942 | **$5,922** |
| **3 años** | $12,780 | $12,312 | $8,958 | **$8,722** |

---

## Comparativa de Infraestructura

| Criterio | Actual | Alt. 1 (SB+CF) | Alt. 2 (On-Prem) | Alt. 3 (Bare Metal) |
|---|---|---|---|---|
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

## Stack de Trabajo (Igual en Todas)

| Herramienta | Rol | Costo |
|---|---|---|
| **GitHub Team** | Código, CI/CD, PRs, code review | $4/user/mes |
| **Google Workspace Standard** | Email corporativo, Drive, Meet, Calendar | $14/user/mes |
| **Discord Level 2** | Comunicación interna, voice, screen share | $40/mes fijo |
| **Jira** | Project management, sprints, backlog | $0 (free, 10 users) |
| **Resend** | Emails transaccionales (invitaciones, alertas) | $20/mes |
| **Sentry** | Error tracking, crashes, performance | $0 (free tier) |
| **Gemini API** | GRIXI AI assistant | ~$25/mes |

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
| **Producción rápida** — equipo pequeño, cero riesgo | **Actual** (Vercel + Supabase) |
| **Optimizar latencia + eliminar Vercel** — mínimo cambio | **Alt. 1** (Supabase + Cloudflare) |
| **Desarrollo + staging local potente** | **Alt. 2** (Mac Studio on-premise) |
| **Producción con control total + mejor costo/rendimiento** | **Alt. 3** (Hetzner bare metal) ⭐ |
| **Menor costo a largo plazo (> 16 meses)** | **Alt. 2** (On-Premise) |
| **Menor costo sin inversión inicial** | **Alt. 3** (break-even en 3 meses) |
| **Cumplimiento regulatorio / soberanía datos** | **Alt. 2** o **Alt. 3** |

> [!TIP]
> **Combinación recomendada:** **Alt. 1 para producción** + **Alt. 2 como entorno dev/staging**. O bien, **Alt. 3 para todo** si se busca el mejor balance costo/confiabilidad.
