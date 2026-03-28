# Estado Actual — GRIXI-APP

**Última actualización:** 2026-03-27

---

## Infraestructura

| Componente | Estado | Notas |
|------------|--------|-------|
| Supabase | ✅ Activo | Auth + PostgreSQL + RLS + audit_logs |
| Cloudflare Workers | ✅ Activo | grixi.ai (v`44a052de`) |
| CI/CD (GitHub Actions) | ⬜ Pendiente | — |
| Dominio grixi.ai | ✅ Activo | Custom domain + wildcard `*.grixi.ai` |
| Google Workspace CLI | ✅ Configurado | `dmera@grixi.ai` via `gws` |

## Módulos

| Módulo | Estado | Progreso | Documentación |
|--------|--------|----------|---------------|
| Auth | ✅ Implementado | 100% | Google OAuth + session compartida `.grixi.ai` |
| Admin Panel | ✅ Implementado | 100% | 5 páginas admin (billing eliminado) |
| Multi-Tenant | ✅ Implementado | 100% | Subdomain routing + tenant branding + security guard |
| Dashboard | 🚧 Parcial | 30% | Tenant-aware welcome |
| Almacenes | ⬜ Pendiente | 0% | — |
| Compras | ⬜ Pendiente | 0% | — |
| Finanzas | ⬜ Pendiente | 0% | — |
| Flota | ⬜ Pendiente | 0% | — |
| RRHH | ⬜ Pendiente | 0% | — |
| Mantenimiento | ⬜ Pendiente | 0% | — |
| Calidad | ⬜ Pendiente | 0% | — |
| Reportes | ⬜ Pendiente | 0% | — |
| GRIXI AI | ⬜ Pendiente | 0% | — |

## Admin Panel — Detalle

| Página | Ruta | Features |
|--------|------|----------|
| Dashboard | `/admin` | KPIs, Recharts (Area/Pie/Bar), audit timeline, org links |
| Organizaciones | `/admin/organizations` | CRUD, search, filters, CSV export |
| Detalle Org | `/admin/organizations/:id` | 5 tabs (Miembros, Módulos, Invitaciones, Dominios, Config) |
| Usuarios | `/admin/users` | Promote/demote admin, search, CSV export |
| Audit Log | `/admin/audit` | Filtro por acción, actor avatar, IP tracking |

## Arquitectura Multi-Tenant

### Tenant Resolution
- **Subdomain routing**: `empresa.grixi.ai` → `tenantSlug = "empresa"`
- **Worker Edge**: `workers/app.ts` extrae slug del hostname
- **Org matching**: subdomain > URL `?org=` > cookie `grixi_org` > primer membership

### Tenants Demo
| Tenant | Dominio | Plan | Logo |
|--------|---------|------|------|
| GRIXI | `grixi.grixi.ai` | Enterprise | `/grixi-logo.png` |
| Acme Corp | `acme.grixi.ai` | Professional | `/logos/acme.png` |
| Nexus Technologies | `nexus.grixi.ai` | Starter | `/logos/nexus.png` |

### Login Personalizado
- Cada tenant muestra su logo, nombre y color primario en la pantalla de login
- Fallback a branding GRIXI si no hay org asociada al subdomain

### Seguridad Multi-Tenant (6 Capas)

| # | Capa | Protección | Verificado |
|---|------|-----------|------------|
| 1 | DNS/Cloudflare | Solo `*.grixi.ai` llega al Worker | ✅ |
| 2 | Worker Edge | `tenantSlug` del hostname real (no manipulable) | ✅ |
| 3 | Loaders (GET) | `isPlatformTenant()` en 5 admin loaders → redirect `/dashboard` | ✅ |
| 4 | Actions (POST) | `isPlatformTenant()` en 3 admin actions → 403 Forbidden | ✅ |
| 5 | DB `platform_admins` | Solo admins registrados acceden a panel admin | ✅ |
| 6 | Sidebar (UI) | Links admin ocultos si `tenantSlug !== 'grixi'` | ✅ |

**Guard centralizado:** `app/lib/platform-guard.ts`

### Mejoras Futuras (Enterprise-Grade)
- RLS policies en tablas admin (`platform_admins`, `organizations`, `audit_logs`)
- Cookies por tenant (separación total de sesiones)
- Rate limiting en rutas admin (Cloudflare Rate Limiting)

## Documentación

| Documento | Estado |
|-----------|--------|
| Arquitectura (15 docs) | ✅ Completa |
| Sistema de registro | ✅ Implementado |
| Docs de módulos | ⬜ Se crean con cada módulo |

## Dependencias Principales

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| react-router | v7 | SSR + routing |
| vite | v8.0.2 | Build tool (Rolldown) |
| recharts | ^2 | Charts admin dashboard |
| lucide-react | ^0.4 | Iconos |
| @supabase/supabase-js | ^2 | Backend client |
| framer-motion | — | Animaciones sidebar |

## Próximos Pasos

1. Configurar Supabase Redirect URLs (`*.grixi.ai/**`) — requiere Project Owner
2. Implementar RLS policies para tablas admin
3. Implementar páginas de módulos (Almacenes, Compras, etc.)
4. Supabase Realtime subscriptions para dashboard
5. R2 para almacenamiento de archivos
6. Hyperdrive para conexiones PostgreSQL optimizadas
