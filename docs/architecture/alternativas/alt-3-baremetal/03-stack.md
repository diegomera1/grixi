# Alternativa 3 — Stack Tecnológico Completo

> El stack es **idéntico al de la Alternativa 2** (On-Premise), con optimizaciones para Linux dedicado.

---

## ¿Cambiar de Framework?

| Opción | Veredicto |
|---|---|
| **Next.js 16 standalone** | ✅ Se mantiene — zero rewrite, perfecto en Docker/Linux |
| Go + Templ + HTMX | ❌ Alto rendimiento, pero rewrite total del frontend. No justifica para UI rica |
| SvelteKit | ❌ Rewrite total sin beneficio real en bare metal |

---

## Stack Completo

El stack de software es **el mismo que la Alternativa 2**. La diferencia es la infraestructura subyacente.

| Capa | Tecnología | Notas vs Alt. 2 |
|---|---|---|
| **Framework** | Next.js 16 (standalone) | Igual |
| **Runtime** | Node.js 22 (Docker) | Igual, pero Linux nativo (no macOS VM) |
| **Lenguaje** | TypeScript (strict) | Igual |
| **UI** | shadcn/ui + Tailwind 4 + Zustand + Framer Motion | Igual |
| **3D** | React Three Fiber + drei | Igual |
| **ORM** | Drizzle ORM | Igual |
| **DB** | PostgreSQL 17 (pgvector, pg_trgm, pg_cron) | Igual, pero RAID 1 de disco |
| **Auth** | Better Auth v1 | Igual |
| **Realtime** | Socket.io + pg_notify | Igual |
| **Cache** | Redis 7 | Igual |
| **Job Queue** | BullMQ | Igual |
| **Storage** | MinIO (S3-compatible) | Igual |
| **Reverse Proxy** | Caddy v2 | Igual, pero con IP pública directa |
| **PaaS** | Coolify v4 | Igual, pero nativo en Linux |
| **Tunnel** | Cloudflare Proxy (directo, no Tunnel) | ⚠️ Diferente — IP pública con CF Proxy |
| **Monitoreo** | Prometheus + Grafana + Loki + Node Exporter | Igual + Node Exporter para Linux |
| **Health** | Uptime Kuma | Igual |
| **Backups** | pg_dump + rclone → R2 | Igual + RAID 1 local |
| **Firewall** | **UFW** + **fail2ban** | ⚠️ Diferente — hardening Linux |
| **AI** | Gemini 2.0 Flash Lite | Igual |
| **CDN + WAF** | Cloudflare Pro | Igual |
| **CI/CD** | Coolify + GitHub webhooks | Igual |

---

## Diferencias Clave vs Alt. 2

| Aspecto | Alt. 2 (macOS) | Alt. 3 (Linux) |
|---|---|---|
| **Docker** | OrbStack (VM Linux en macOS) | Docker nativo (más eficiente) |
| **Coolify** | En VM dentro de macOS | Nativo en Ubuntu |
| **Networking** | Cloudflare Tunnel (outbound) | IP pública + Cloudflare Proxy |
| **Firewall** | macOS firewall | UFW + fail2ban |
| **RAID** | No (1 SSD) | RAID 1 software (2 × NVMe) |
| **Monitoreo HW** | limitado (macOS) | Node Exporter (CPU, RAM, IOPS, disco) |
| **SSH access** | Local | Remoto (requiere SSH keys) |
