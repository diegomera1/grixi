# Alternativa 3 — Bare Metal Cloud: Overview

> **Filosofía:** Mismo stack self-hosted que la Alternativa 2 (On-Premise), pero ejecutado en un **servidor dedicado** en un datacenter profesional (Hetzner). Energía, cooling y red de clase enterprise. "Tu servidor" en la nube.

---

## ¿Por Qué Bare Metal en Vez de On-Premise?

| Factor | On-Premise (Alt. 2) | Bare Metal (Alt. 3) |
|---|---|---|
| **Energía** | Tu UPS + electricidad | Generadores + UPS enterprise |
| **Red** | Tu fibra (~100-300 Mbps) | 1 Gbps simétrico unmetered |
| **Uptime** | Depende de tu infraestructura | ~99.9% SLA datacenter |
| **Cooling** | Tu aire acondicionado | Cooling industrial |
| **DDoS** | Solo Cloudflare Tunnel | Hetzner DDoS + Cloudflare |
| **Acceso** | Físico inmediato | SSH + KVM remoto |
| **Failover** | No hay | Posible con 2do servidor |

## ¿Qué Se Elimina?

| Servicio eliminado | Reemplazado por |
|---|---|
| **Vercel** | Next.js standalone + Coolify + Caddy |
| **Supabase** | PostgreSQL + Better Auth + Socket.io + MinIO |

## Diagrama de Arquitectura

```
Internet → Cloudflare Edge (WAF + CDN + DNS)
              │
              │ HTTPS (Full Strict — IP oculta via CF proxy)
              │
  ╔══════════════════════════════════════════════════════╗
  ║   HETZNER AX52 DEDICATED — DATACENTER (Falkenstein) ║
  ║   AMD Ryzen 7 7700 · 64 GB DDR5 · 2 TB NVMe        ║
  ║                                                      ║
  ║   Ubuntu 24.04 LTS · UFW · fail2ban                 ║
  ║                                                      ║
  ║   Coolify v4 (PaaS — git push auto-deploy)          ║
  ║                                                      ║
  ║   Docker Compose                                     ║
  ║   ├── Caddy :443 (HTTPS + reverse proxy)            ║
  ║   ├── Next.js 16 :3000 (standalone)                 ║
  ║   ├── PostgreSQL 17 :5432 (RLS + pgvector)          ║
  ║   ├── Redis 7 :6379 (cache + sessions)              ║
  ║   ├── MinIO :9000 (S3 storage)                      ║
  ║   ├── BullMQ Workers (background jobs)              ║
  ║   ├── Socket.io (WebSocket realtime)                ║
  ║   ├── Prometheus + Grafana + Loki (monitoring)      ║
  ║   └── Uptime Kuma (health checks)                   ║
  ║                                                      ║
  ║   Backups: pg_dump → rclone → Cloudflare R2          ║
  ║   RAID 1: 2× NVMe en mirror (redundancia de disco)  ║
  ╚══════════════════════════════════════════════════════╝
```

## Documentos de Esta Alternativa

| Documento | Contenido |
|---|---|
| [02-hardware.md](./02-hardware.md) | Servidores Hetzner, specs, comparación |
| [03-stack.md](./03-stack.md) | Stack tecnológico completo |
| [04-docker.md](./04-docker.md) | Docker Compose (idéntico a Alt. 2) |
| [05-coolify.md](./05-coolify.md) | Coolify en servidor remoto |
| [06-networking.md](./06-networking.md) | Cloudflare, firewall, DNS |
| [07-seguridad.md](./07-seguridad.md) | Capas de seguridad |
| [08-backups.md](./08-backups.md) | Backups + RAID + disaster recovery |
| [09-costos.md](./09-costos.md) | Desglose de costos |
| [10-avanzado.md](./10-avanzado.md) | RAID, latencia LATAM, scaling, Ansible, Hetzner rescue |
| [Alt 2: 10-multi-tenant.md](../alt-2-onpremise/10-multi-tenant.md) | Multi-tenant (compartido con Alt. 2) |
| [Alt 2: 11-edge-functions-migration.md](../alt-2-onpremise/11-edge-functions-migration.md) | Edge Functions migration (compartido) |
| [Alt 2: 12-realtime-storage.md](../alt-2-onpremise/12-realtime-storage.md) | Socket.io + MinIO (compartido) |
| [Alt 2: 13-monitoreo.md](../alt-2-onpremise/13-monitoreo.md) | Monitoreo (compartido) |
| [Alt 2: 14-database-migration.md](../alt-2-onpremise/14-database-migration.md) | DB migration (compartido) |
