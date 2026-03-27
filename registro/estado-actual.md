# Estado Actual — GRIXI-APP

**Última actualización:** 2026-03-26

---

## Infraestructura

| Componente | Estado | Notas |
|------------|--------|-------|
| Supabase | ✅ Activo | Auth + PostgreSQL + RLS + audit_logs |
| Cloudflare Workers | ✅ Activo | grixi.ai (v87426b59) |
| CI/CD (GitHub Actions) | ⬜ Pendiente | — |
| Dominio grixi.ai | ✅ Activo | Custom domain en Workers |
| Google Workspace CLI | ✅ Configurado | `dmera@grixi.ai` via `gws` |

## Módulos

| Módulo | Estado | Progreso | Documentación |
|--------|--------|----------|---------------|
| Auth | ✅ Implementado | 100% | Google OAuth + session |
| Admin Panel | ✅ Implementado | 100% | 6 páginas admin |
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
| Billing | `/admin/billing` | MRR, revenue chart, usage tracking |
| Audit Log | `/admin/audit` | Filtro por acción, actor avatar, IP tracking |

## Arquitectura Multi-Tenant

- **Tenant Resolution**: URL `?org=` > cookie `grixi_org` > primer membership
- **Org Switcher**: Topbar dropdown con cookie persistence (1 año)
- **Module Filtering**: Sidebar dinámico basado en `org.settings.enabled_modules`
- **Security**: `createSupabaseAdminClient` para ops admin, RLS para usuarios

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
| vite | v8.0.2 | Build tool |
| recharts | ^2 | Charts admin dashboard |
| lucide-react | ^0.4 | Iconos |
| @supabase/supabase-js | ^2 | Backend client |

## Próximos Pasos

1. Implementar páginas de módulos (Almacenes, Compras, etc.)
2. Supabase Realtime subscriptions para dashboard
3. R2 para almacenamiento de archivos
4. Hyperdrive para conexiones PostgreSQL optimizadas
