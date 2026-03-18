# Alternativa 2 — On-Premise Local: Overview

> **Filosofía:** Todo ejecuta en un Mac Studio M4 Max físico en tu oficina. Docker para contenedores, Coolify como PaaS self-hosted, Cloudflare Tunnel para exponer al internet sin abrir puertos. Control total de los datos.

---

## ¿Por Qué On-Premise?

| Motivo | Detalle |
|---|---|
| **Soberanía de datos** | Los datos nunca salen de tu oficina. Control total |
| **Costo recurrente mínimo** | ~$40/mes después de la inversión en hardware |
| **Sin vendor lock-in** | PostgreSQL + Docker + estándares abiertos |
| **Performance predecible** | Sin noisy neighbors, sin cold starts, sin rate limits |
| **DX excelente** | Coolify provee git-push deploys como Vercel, pero local |

## ¿Qué Se Elimina?

| Servicio eliminado | Reemplazado por |
|---|---|
| **Vercel** | Next.js standalone + Coolify + Caddy |
| **Supabase** | PostgreSQL + Better Auth + Socket.io + MinIO |

## ¿Qué Se Mantiene?

| Servicio | Rol |
|---|---|
| **Cloudflare Pro** | CDN + WAF + DNS + Tunnel |
| **GitHub Teams** | Repo + CI/CD triggers |

## Diagrama de Arquitectura

```
Internet → Cloudflare Edge (WAF + CDN + DNS)
              │
        Cloudflare Tunnel (encrypted)
              │
  ╔═══════════════════════════════════════════════╗
  ║      MAC STUDIO M4 MAX (64 GB RAM)           ║
  ║                                               ║
  ║   Coolify v4 (PaaS — git push auto-deploy)   ║
  ║                                               ║
  ║   Docker / OrbStack                           ║
  ║   ├── Caddy :443 (reverse proxy + HTTPS)     ║
  ║   ├── Next.js 16 :3000 (standalone)          ║
  ║   ├── PostgreSQL 17 :5432 (RLS + exts)       ║
  ║   ├── Redis 7 :6379 (cache + sessions)       ║
  ║   ├── MinIO :9000 (S3-compatible storage)    ║
  ║   ├── BullMQ Workers (background jobs)       ║
  ║   ├── Socket.io (WebSocket realtime)         ║
  ║   ├── Grafana + Prometheus (monitoring)      ║
  ║   └── Uptime Kuma (health checks)            ║
  ║                                               ║
  ║   Backups → SSD Ext + Cloudflare R2           ║
  ╚═══════════════════════════════════════════════╝
```

## Documentos de Esta Alternativa

| Documento | Contenido |
|---|---|
| [02-hardware.md](./02-hardware.md) | Mac Studio specs, alternativas, UPS |
| [03-stack.md](./03-stack.md) | Stack tecnológico completo |
| [04-docker.md](./04-docker.md) | Docker Compose, servicios, configuración |
| [05-coolify.md](./05-coolify.md) | Coolify PaaS, git push deploys |
| [06-cloudflare-tunnel.md](./06-cloudflare-tunnel.md) | Tunnel, DNS, dominios |
| [07-seguridad.md](./07-seguridad.md) | Capas de seguridad |
| [08-backups.md](./08-backups.md) | Backups y disaster recovery |
| [09-costos.md](./09-costos.md) | Desglose de costos |
