# Estado Actual — GRIXI-APP

**Última actualización:** 2026-04-02 (Sesión 3 — Hardening)

---

## Infraestructura

| Componente | Estado | Notas |
|------------|--------|-------|
| Supabase (prod) | ✅ Activo | `zhursgmxnztyepxobvnz` — Auth + PostgreSQL + RLS + Realtime |
| Cloudflare Workers | ✅ Activo | `grixi-app` en `grixi.ai` + `*.grixi.ai` |
| Rate Limiting | ✅ Configurado | `ADMIN_RATE_LIMITER` — 30 req/min rutas `/admin` |
| CI/CD (GitHub Actions) | ✅ Configurado | `.github/workflows/deploy.yml` — push a main |
| Dominio grixi.ai | ✅ Activo | Custom domain + wildcard `*.grixi.ai` |
| Google Workspace CLI | ✅ Configurado | `dmera@grixi.ai` via `gws` |
| Observability | ✅ Habilitado | `wrangler.jsonc` → `observability.enabled: true` |
| Resend (Email) | ✅ Configurado | `RESEND_API_KEY` en Cloudflare secrets |
| Gemini AI | ✅ Configurado | `GEMINI_API_KEY` en Cloudflare secrets |
| PWA / Service Worker | ✅ Completo | Manifest + SW + Offline + A2HS + Splash (cache v2026-04-02) |
| Push Notifications | ✅ Configurado | VAPID keys en CF secrets + Supabase tables |
| CSRF Protection | ✅ Activo | X-GRIXI-Client header en mutation APIs |
| Supabase Realtime | ✅ Habilitado | 7 tablas en publication |

## Base de Datos — Producción

| Métrica | Valor |
|---------|-------|
| Tablas | 19 (todas con RLS ✅) |
| Migraciones | 17 |
| RLS Policies | 31+ |
| Funciones PostgreSQL | 10 |
| Triggers | 5+ |
| Tablas con Realtime | 7 |

### Datos en Producción

| Entidad | Cantidad |
|---------|----------|
| auth.users | 2 |
| organizations | 5 |
| platform_admins | 2 |
| memberships | 2 |
| profiles | 2 |
| roles | 20 (4 system roles × 5 orgs) |
| permissions | 43 (catálogo granular) |
| role_permissions | 425 (asignaciones) |
| invitations | 6 |
| audit_logs | 120 |
| platform_settings | 25 |
| platform_notifications | 0 |
| ai_conversations | 2 |
| ai_messages | 2 |
| finance_transactions | 0 (schema completo, sin seed) |
| finance_cost_centers | 0 (schema completo, sin seed) |
| user_preferences | 1+ |
| domain_whitelists | 1 |
| login_history | 1+ |
| push_subscriptions | 1+ |
| notifications | 10+ |

### 17 Tablas

| Tabla | RLS | Descripción |
|-------|-----|-------------|
| `organizations` | ✅ | Tenants del sistema (status: active/suspended/archived) |
| `memberships` | ✅ | Usuario ↔ Org con rol (status: active/invited/suspended) |
| `profiles` | ✅ | Perfil personal (PK = auth.users.id) |
| `roles` | ✅ | Roles RBAC por tenant (is_system, hierarchy_level, is_default) |
| `permissions` | ✅ | Catálogo global de permisos (key: "module.action", min_plan) |
| `role_permissions` | ✅ | Asignaciones rol → permiso |
| `invitations` | ✅ | Invitaciones con token, expires_at, status |
| `audit_logs` | ✅ | Eventos de auditoría con IP tracking |
| `platform_admins` | ✅ | Superadmins (God Mode) |
| `platform_notifications` | ✅ | Broadcast notifications |
| `platform_settings` | ✅ | Key-value config global |
| `ai_conversations` | ✅ | Conversaciones AI (org_id, user_id, module) |
| `ai_messages` | ✅ | Mensajes AI (role, content, attachments, model_used) |
| `finance_transactions` | ✅ | Transacciones financieras (30 columnas SAP-style) |
| `finance_cost_centers` | ✅ | Centros de costo jerárquicos |
| `user_preferences` | ✅ | Preferencias key-value por usuario |
| `domain_whitelists` | ✅ | Dominios auto-join por organización |
| `login_history` | ✅ | Historial de inicios de sesión (IP, browser, device) |
| `push_subscriptions` | ✅ | Subscriptions para Web Push |
| `notifications` | ✅ | Notificaciones in-app con Realtime |

### Funciones PostgreSQL

| Función | Tipo | Uso |
|---------|------|-----|
| `custom_access_token_hook` | SECURITY DEFINER | Inyecta org_ids y role en JWT |
| `get_user_org_id` | SECURITY DEFINER | Retorna primer org_id del usuario |
| `get_user_org_ids` | SECURITY DEFINER | Retorna array de org_ids |
| `get_user_role_name` | SECURITY DEFINER | Retorna nombre del rol |
| `handle_new_user` | TRIGGER | Auto-crea perfil en registro |
| `has_permission` | SECURITY DEFINER | Verifica permiso granular |
| `is_platform_admin` | SECURITY DEFINER | Verifica si es superadmin |
| `rls_auto_enable` | EVENT TRIGGER | Auto-enable RLS en tablas nuevas |
| `update_updated_at` | TRIGGER | Auto-actualiza timestamp |
| `verify_whitelist_access` | SECURITY DEFINER | Verifica acceso por dominio/invitación |

### 16 Migraciones

| # | Versión | Nombre |
|---|---------|--------|
| 1 | `20260325054720` | `core_multitenant_tables` |
| 2 | `20260325054809` | `core_multitenant_functions_rls` |
| 3 | `20260326052520` | `add_domain_whitelists_and_i18n` |
| 4 | `20260326052534` | `add_verify_whitelist_function` |
| 5 | `20260327201400` | `enterprise_rls_policies` |
| 6 | `20260328215853` | `add_org_id_to_audit_logs` |
| 7 | `20260329015541` | `create_ai_tables` |
| 8 | `20260329022558` | `rbac_schema_enhancements` |
| 9 | `20260329022621` | `rbac_expand_permissions_catalog` |
| 10 | `20260329022634` | `rbac_assign_system_role_permissions` |
| 11 | `20260329022654` | `rbac_new_sql_functions` |
| 12 | `20260329022707` | `rbac_rls_org_status_enforcement` |
| 13 | `20260329041450` | `create_finance_tables` |
| 14 | `20260329215243` | `audit_triggers_system` |
| 15 | `20260329215625` | `harden_platform_admins` |
| 16 | `20260329221157` | `admin_portal_tables_and_realtime` |

## Módulos

| Módulo | Estado | Progreso | Notas |
|--------|--------|----------|-------|
| Auth | ✅ Implementado | 100% | Google OAuth + PKCE + session cookie |
| Admin Panel | ✅ Implementado | 100% | 7 páginas, Recharts, audit timeline, org CRUD |
| Multi-Tenant | ✅ Implementado | 100% | Subdomain routing + branding + membership guard |
| RBAC | ✅ Implementado | 100% | 43 permisos, 20 roles, hierarchy_level, min_plan |
| Email Transaccional | ✅ Implementado | 100% | Resend API, template premium, invitaciones |
| Configuración Tenant | ✅ Implementado | 100% | 5 secciones: Org, Equipo, Roles, Invitaciones, Auditoría |
| Dashboard | ✅ Implementado | 95% | SSR loader, KPIs reales, Recharts, audit timeline, skeletons |
| Finanzas | ✅ Implementado | 90% | 5 tabs, Recharts, multi-moneda, AI analysis, realtime |
| GRIXI AI | ✅ Implementado | 80% | SSE streaming Gemini, Canvas, 3-panel, conversations CRUD |
| Notificaciones | ✅ Implementado | 100% | Push + In-app, centro de notificaciones, badge en bell |
| User Profile | ✅ Implementado | 100% | Avatar R2, tema, login history, preferencias |
| i18n | ✅ Implementado | 100% | es/en/pt, org-level default language |
| Almacenes | ⬜ Pendiente | 0% | Tablas no creadas |
| Compras | ⬜ Pendiente | 0% | Tablas no creadas |
| Flota | ⬜ Pendiente | 0% | — |
| RRHH | ⬜ Pendiente | 0% | — |
| Mantenimiento | ⬜ Pendiente | 0% | — |

## Frontend — ~80 archivos, ~14,927 LOC

### Rutas (19)

| Ruta | Archivo | Tipo |
|------|---------|------|
| `/` (login) | `routes/login.tsx` | Pública — Login con Google OAuth |
| `/auth/callback` | `routes/auth.callback.tsx` | Pública — PKCE code exchange |
| `/auth/signout` | `routes/auth.signout.tsx` | Pública — Logout |
| `/select-org` | `routes/select-org.tsx` | Pública — Selector de organización |
| `/unauthorized` | `routes/unauthorized.tsx` | Pública — Acceso denegado |
| `/suspended` | `routes/suspended.tsx` | Pública — Org suspendida |
| `/dashboard` | `routes/dashboard.tsx` | Protegida — SSR KPIs + Recharts + timeline |
| `/finanzas` | `routes/finanzas.tsx` | Protegida — 5 tabs financieros SAP-style |
| `/ai` | `routes/ai.tsx` | Protegida — Chat AI con Gemini SSE |
| `/configuracion` | `routes/configuracion.tsx` | Protegida — Layout configuración |
| `/configuracion/organizacion` | `routes/configuracion/organizacion.tsx` | Protegida — Settings de org |
| `/configuracion/equipo` | `routes/configuracion/equipo.tsx` | Protegida — Gestión de equipo |
| `/configuracion/roles` | `routes/configuracion/roles.tsx` | Protegida — RBAC roles/permisos |
| `/configuracion/invitaciones` | `routes/configuracion/invitaciones.tsx` | Protegida — Invitaciones + Resend |
| `/configuracion/auditoria` | `routes/configuracion/auditoria.tsx` | Protegida — Audit log |
| `/admin` | `routes/admin/index.tsx` | Platform Admin — Recharts dashboard |
| `/admin/organizations` | `routes/admin/organizations.tsx` | Platform Admin — CRUD orgs |
| `/admin/organizations/:id` | `routes/admin/organizations.$id.tsx` | Platform Admin — 5 tabs detalle |
| `/admin/users` | `routes/admin/users.tsx` | Platform Admin — Gestión usuarios |
| `/admin/audit` | `routes/admin/audit.tsx` | Platform Admin — Log auditoría |
| `/admin/settings` | `routes/admin/settings.tsx` | Platform Admin — Config plataforma |
| `/admin/notifications` | `routes/admin/notifications.tsx` | Platform Admin — Notificaciones |
| `/admin/plans` | `routes/admin/plans.tsx` | Platform Admin — Planes |
| `/*` (404) | `routes/not-found.tsx` | Catch-all — 404 personalizada GRIXI |

### APIs (5)

| Endpoint | Método | Función |
|----------|--------|---------|
| `/api/ai/chat` | POST | SSE streaming Gemini con system prompt enrichment |
| `/api/ai/conversations` | GET/POST/PATCH/DELETE | CRUD conversaciones AI |
| `/api/ai/upload` | POST | Upload archivos para AI context |
| `/api/finance-analyze` | POST | Análisis AI de transacciones individuales |
| `/api/finance-notes` | POST | Guardar notas en transacciones |

### Componentes por Feature

| Feature | Componentes | LOC aprox |
|---------|-------------|-----------|
| Dashboard | hero, activity-chart, activity-timeline, org-info-card, quick-access | ~500 |
| Finanzas | finance-content, general-ledger-tab, accounts-receivable-tab, accounts-payable-tab, budgets-tab, use-finance-realtime, currency utils, types | ~2,500 |
| AI | ai-chat-content, chat-input, chat-message, conversation-sidebar, ai-canvas-panel, ai-chart-block, welcome-screen, grixi-ai-logo, widget-message-content, types | ~2,000 |
| Admin | admin-sidebar, audit-realtime | ~400 |
| Shared | kpi-card, empty-state, permission-gate, permission-guard | ~300 |
| Layout | grixi-orb | ~100 |
| Login | animated-nodes | ~200 |

### Librerías Internas

| Archivo | Función |
|---------|---------|
| `lib/supabase/client.browser.ts` | Cliente Supabase browser-side |
| `lib/supabase/client.server.ts` | Cliente server-side + admin (scoped cookies) |
| `lib/platform-guard.ts` | Guard: `isPlatformTenant()` |
| `lib/permission-guard.server.ts` | Guard: verificación de permisos server-side |
| `lib/rbac/index.ts` | Core RBAC utilities |
| `lib/rbac/hooks.ts` | `usePermissions()` hook |
| `lib/hooks/use-permissions.ts` | Permission hooks adicionales |
| `lib/audit.ts` | Helper: `logAudit()` (admin client bypass RLS) |
| `lib/email.server.ts` | Resend API + template premium HTML |
| `lib/export.ts` | Helper: exportar CSV |
| `lib/storage/r2-client.server.ts` | R2 client con 7-layer security |
| `lib/utils.ts` | Utilidades (cn, format, etc.) |
| `lib/i18n/index.ts` | Sistema i18n con 3 idiomas |
| `lib/i18n/es.ts` | Traducciones español |
| `lib/i18n/en.ts` | Traducciones inglés |
| `lib/i18n/pt.ts` | Traducciones portugués |
| `lib/api-fetch.ts` | Wrapper fetch con CSRF header (X-GRIXI-Client: 1) |

## Arquitectura Multi-Tenant

### Tenant Resolution (4 niveles de prioridad)
1. **Subdomain** (`empresa.grixi.ai` → slug) — Prioridad máxima
2. **URL param** (`?org=slug`) — Fallback
3. **Cookie** (`grixi_org=uuid`) — Persistencia
4. **Primer membership** — Default

### Tenants en Producción

| Tenant | Subdomain | Plan | Color |
|--------|-----------|------|-------|
| GRIXI | `grixi.grixi.ai` | Enterprise | `#7c3aed` |
| Acme Corp | `acme.grixi.ai` | Professional | `#3B82F6` |
| Nexus Technologies | `nexus.grixi.ai` | Starter | `#F59E0B` |
| prueba | `prueba.grixi.ai` | Starter | — |
| (5ta org) | — | — | — |

### Platform Admins

| Nombre | Email |
|--------|-------|
| Diego Mera | `dmera@grixi.ai` |
| Calixto Saldarriaga | `csaldarriaga@grixi.ai` |

### Seguridad Multi-Tenant (9 Capas)

| # | Capa | Protección |
|---|------|-----------|
| 1 | DNS/Cloudflare | Solo `*.grixi.ai` llega al Worker |
| 2 | Worker Edge | `tenantSlug` extraído del hostname real |
| 3 | Rate Limiting | 30 req/min por IP en `/admin` |
| 4 | Membership Guard | Usuario DEBE ser miembro o platform_admin |
| 5 | Loaders (GET) | `isPlatformTenant()` → redirect |
| 6 | Actions (POST) | `isPlatformTenant()` → 403 |
| 7 | DB `platform_admins` | Solo admins acceden a panel admin |
| 8 | Sidebar (UI) | Links admin ocultos si no es admin |
| 9 | RLS (29+ policies) | Aislamiento por org_id |
| 10 | CSRF Header | `X-GRIXI-Client: 1` requerido en POST/PUT/DELETE/PATCH a `/api/*` |
| 11 | Owner Protection | No se puede eliminar al último owner de una org |

## Dependencias

### Producción

| Paquete | Versión | Uso |
|---------|---------|-----|
| react | ^19.1.1 | Core |
| react-dom | ^19.1.1 | Core |
| react-router | ^7.10.0 | SSR + routing |
| @supabase/supabase-js | ^2.50.0 | Backend client |
| @supabase/ssr | ^0.7.0 | Server-side auth (cookies) |
| @google/genai | ^1.47.0 | Gemini AI SDK |
| recharts | ^3.8.1 | Charts (dashboard + finanzas) |
| lucide-react | ^1.7.0 | Iconos |
| framer-motion | ^12.0.0 | Animaciones (client-only) |
| react-markdown | ^10.1.0 | Markdown rendering AI |
| remark-gfm | ^4.0.1 | GitHub Flavored Markdown |
| clsx | ^2.1.1 | Class merging |
| tailwind-merge | ^3.0.0 | Tailwind class merging |
| isbot | ^5.1.31 | Bot detection |

### Dev

| Paquete | Versión |
|---------|---------|
| vite | ^8.0.2 |
| tailwindcss | ^4.1.13 |
| @tailwindcss/vite | ^4.1.13 |
| typescript | ^5.9.2 |
| wrangler | ^4.77.0 |
| @cloudflare/vite-plugin | ^1.13.5 |
| @react-router/dev | ^7.10.0 |

## Secretos en Cloudflare Workers

| Variable | Tipo | Uso |
|----------|------|-----|
| `SUPABASE_URL` | Secret | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Secret | Clave pública Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Clave admin (bypass RLS) |
| `RESEND_API_KEY` | Secret | API key para emails transaccionales |
| `GEMINI_API_KEY` | Secret | API key para Google Gemini AI |
| `VAPID_PUBLIC_KEY` | Secret | Clave pública para Web Push |
| `VAPID_PRIVATE_KEY` | Secret | Clave privada para Web Push |

## Workflows Documentados

| Workflow | Archivo | Descripción |
|----------|---------|-------------|
| `/deploy` | `.agents/workflows/deploy.md` | Build + deploy a Cloudflare |
| `/email-transaccional` | `.agents/workflows/email-transaccional.md` | Enviar emails con Resend |
| `/supabase-rls` | `.agents/workflows/supabase-rls.md` | Implementar RLS |
| `/permisos-rbac` | `.agents/workflows/permisos-rbac.md` | Sistema de permisos RBAC |
| `/r2-storage` | `.agents/workflows/r2-storage.md` | Cloudflare R2 Storage |
| `/multi-tenant` | `.agents/workflows/multi-tenant.md` | Arquitectura multi-tenant |
| `/audit-logs` | `.agents/workflows/audit-logs.md` | Eventos de auditoría |
| `/nuevo-modulo` | `.agents/workflows/nuevo-modulo.md` | Checklist nuevo módulo |

## Git

| Métrica | Valor |
|---------|-------|
| Rama principal | `main` |
| Remoto | `https://github.com/GRIXI/grixi-app.git` |
| Package manager | pnpm 10.24.0 |

## Próximos Pasos

1. Command Center (Cmd+K) — modal global de búsqueda
2. Seed data para Finanzas (transacciones de demo)
3. Org Logo upload + Favicon dinámico
4. Login Page animaciones mejoradas
5. Módulo Almacenes (tablas + UI + 3D warehouse)
6. Módulo Compras (vendors, POs, PRs)
7. Error boundaries globales por tenant
