# Alternativa 1 — Supabase + Cloudflare: Overview

> **Filosofía:** Supabase como backend completo (DB, Auth, Realtime, Storage) + Cloudflare Workers como plataforma de ejecución del frontend. Se cambia Next.js por React Router v7 que tiene soporte **oficial GA** en Cloudflare.

---

## ¿Por Qué Esta Combinación?

| Servicio | Rol | Razón |
|---|---|---|
| **Supabase** | Backend completo | PostgreSQL + RLS + Auth + PostgREST + Realtime + Storage — todo probado en producción |
| **Cloudflare Workers** | Frontend SSR + Edge | React Router v7 con adapter oficial GA. 310+ PoPs, 0ms cold starts |
| **Cloudflare Pro** | CDN + WAF + DNS | Ya lo pagamos — ahora también es nuestro host de frontend |

## ¿Qué Se Elimina?

| Servicio | Motivo de eliminación |
|---|---|
| **Vercel** | Cloudflare Workers ejecuta el frontend directamente en el edge con adapter oficial |

## ¿Qué Se Agrega?

| Servicio | Rol | Costo adicional |
|---|---|---|
| Cloudflare Workers Paid | Ejecutar React Router v7 SSR | ~$5-10/mes |
| Cloudflare Workers KV | Cache ISR/datos en el edge | ~$0-5/mes |
| Drizzle ORM | Reemplaza queries complejas de supabase-js | $0 (open-source) |

## Diagrama de Arquitectura

```
Usuario → Cloudflare Edge (310+ PoPs globales)
  │
  ├── Worker (React Router v7 SSR — adapter oficial)
  │     ├── Loaders → fetch a Supabase (PostgREST + Drizzle)
  │     ├── Actions → mutations en Supabase
  │     └── Middleware → auth check + tenant resolution
  │
  ├── CDN (assets estáticos: JS, CSS, fonts, images)
  │
  ├── WAF + DDoS (protección — igual que ahora)
  │
  └── Workers KV (cache de datos/ISR)
        │
        └──→ Supabase (us-east-1)
              ├── PostgreSQL 17 (DB + RLS multi-tenant)
              ├── Auth (JWT, OAuth, MFA)
              ├── Realtime (WebSockets, CDC)
              ├── Storage (CDN integrado)
              └── Edge Functions (Deno — webhooks, SAP, email)
```

## Documentos de Esta Alternativa

| Documento | Contenido |
|---|---|
| [02-stack.md](./02-stack.md) | Stack tecnológico completo |
| [03-react-router.md](./03-react-router.md) | React Router v7: migración desde Next.js |
| [04-supabase.md](./04-supabase.md) | Supabase: qué se mantiene y qué cambia |
| [05-cloudflare-workers.md](./05-cloudflare-workers.md) | Cloudflare Workers: config, deploy, CI/CD |
| [06-seguridad.md](./06-seguridad.md) | Capas de seguridad |
| [07-costos.md](./07-costos.md) | Desglose de costos |
| [08-avanzado.md](./08-avanzado.md) | Workers KV cache, R2, environments, rollback, limitaciones |
