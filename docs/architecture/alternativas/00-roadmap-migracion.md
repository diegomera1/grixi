# Alternativas — Roadmap de Migración

> Timeline fase-por-fase para migrar desde la arquitectura actual a cualquier alternativa.

---

## Alt. 1: Supabase + Cloudflare (2-3 semanas)

```
Semana 1: Setup + Layout
├── Día 1: Create React Router v7 project + wrangler.toml
├── Día 2: Migrate root layout, theme, sidebar, topbar
├── Día 3: Configure Supabase client for Workers env
├── Día 4-5: Migrate core routes (dashboard, auth, 404)

Semana 2: Features
├── Día 1-2: Migrate warehouses module (loaders/actions)
├── Día 3: Migrate compras module
├── Día 4: Migrate finanzas module
├── Día 5: Migrate RRHH + remaining modules

Semana 3: Polish + Deploy
├── Día 1: Workers KV cache setup
├── Día 2: CI/CD with GitHub Actions + Wrangler
├── Día 3: Preview deployments, staging env
├── Día 4: E2E testing, performance validation
├── Día 5: DNS cutover, production deploy
```

### Riesgo: ⚠️ Bajo
- Supabase no se toca (cero riesgo de datos)
- Rollback: apuntar DNS de vuelta a Vercel

---

## Alt. 2: On-Premise Mac Studio (3-5 semanas)

```
Semana 0: Hardware
├── Comprar Mac Studio M4 Max ($2,499)
├── Comprar UPS + SSD externo
├── Instalar OrbStack + Docker

Semana 1: Infrastructure
├── Día 1: Docker Compose base (PG, Redis, Caddy)
├── Día 2: Install Coolify + GitHub integration
├── Día 3: Cloudflare Tunnel setup + DNS
├── Día 4: Migrate DB schema + seed data
├── Día 5: Setup Better Auth (OAuth, sessions)

Semana 2: Backend Migration
├── Día 1-2: Implement Drizzle ORM + withTenantContext middleware
├── Día 3: Migrate RLS policies + helper functions
├── Día 4: Setup MinIO buckets + file upload
├── Día 5: Setup Socket.io + pg_notify triggers

Semana 3: Edge Functions → BullMQ
├── Día 1: BullMQ setup + email worker
├── Día 2: SAP sync worker + cron scheduler
├── Día 3: AI chat + webhook API routes
├── Día 4: Export generator + file processor
├── Día 5: Test all workers end-to-end

Semana 4: Testing + Cutover
├── Día 1-2: E2E testing de todos los flujos
├── Día 3: Setup monitoring (Prometheus + Grafana)
├── Día 4: Backup scripts + DR test
├── Día 5: Production cutover

Semana 5 (buffer): Stabilization
├── Fix bugs post-migration
├── Performance tuning
├── Documentation
```

### Riesgo: 🟡 Medio
- Se reemplaza Supabase completamente (alto esfuerzo)
- Rollback: mantener Supabase activo en paralelo durante migración
- **Recomendación:** usar como staging/dev primero, no como producción inmediata

---

## Alt. 3: Bare Metal Hetzner (3-5 semanas)

```
Semana 0: Server Setup
├── Ordenar Hetzner AX52 (~1-2h provisioning)
├── Ubuntu 24.04 install + hardening
├── Docker + Coolify install
├── UFW + fail2ban config

Semana 1-4: Idéntico a Alt. 2
(Mismo software stack, diferente hardware)

Extra (Semana 1):
├── RAID 1 setup + monitoring
├── Ansible playbook para reproducibilidad
├── Hetzner Firewall externo
```

### Riesgo: 🟡 Medio
- Mismo riesgo que Alt. 2 (misma migración de software)
- Beneficio: infraestructura profesional desde día 1

---

## Estrategia de Migración Segura (Recomendada)

```
Fase 1 (ahora):     Mantener arquitectura actual en producción
Fase 2 (semana 1-3): Setup alternativa elegida en paralelo
Fase 3 (semana 3-4): Testing exhaustivo en la nueva infra
Fase 4 (semana 4-5): Migración de datos + DNS cutover
Fase 5 (semana 5-6): Monitoreo intensivo post-migración
Fase 6 (mes 2):      Dar de baja infraestructura anterior
```

> [!IMPORTANT]
> **Nunca apagar la infra actual hasta validar 2+ semanas en la nueva.** Mantener Supabase/Vercel activos como fallback durante la transición.
