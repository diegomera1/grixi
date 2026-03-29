# Estado Actual — GRIXI-APP

**Última actualización:** 2026-03-28

---

## Infraestructura

| Componente | Estado | Notas |
|------------|--------|-------|
| Supabase (prod) | ✅ Activo | `zhursgmxnztyepxobvnz` — Auth + PostgreSQL + RLS + Realtime |
| Supabase (branch) | ✅ Activo | `wgdgmnmzixrwiphwepyn` — feat/finanzas |
| Cloudflare Workers | ✅ Activo | `grixi-app` en `grixi.ai` + `*.grixi.ai` |
| Rate Limiting | ✅ Configurado | `ADMIN_RATE_LIMITER` — 30 req/min rutas `/admin` |
| CI/CD (GitHub Actions) | ⬜ Pendiente | Deploy manual via `pnpm run deploy` |
| Dominio grixi.ai | ✅ Activo | Custom domain + wildcard `*.grixi.ai` |
| Google Workspace CLI | ✅ Configurado | `dmera@grixi.ai` via `gws` |
| Observability | ✅ Habilitado | `wrangler.jsonc` → `observability.enabled: true` |

## Base de Datos — Producción

| Métrica | Valor |
|---------|-------|
| Tablas | 10 (todas con RLS) |
| RLS Policies | 29 |
| Funciones | 10 |
| Triggers | 5 |
| Índices | 39 |
| Migraciones registradas | 5 |

### Datos en Producción

| Entidad | Cantidad |
|---------|----------|
| auth.users | 2 |
| organizations | 4 |
| platform_admins | 2 |
| memberships | 2 |
| profiles | 2 |
| roles | 16 (4 por org × 4 orgs) |
| permissions | 18 |
| invitations | 1 |
| audit_logs | 2 |

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

### Migraciones

| # | Versión | Nombre | Estado |
|---|---------|--------|--------|
| 1 | `20260325054720` | `core_multitenant_tables` | ✅ Aplicada |
| 2 | `20260325054809` | `core_multitenant_functions_rls` | ✅ Aplicada |
| 3 | `20260326052520` | `add_domain_whitelists_and_i18n` | ✅ Aplicada |
| 4 | `20260326052534` | `add_verify_whitelist_function` | ✅ Aplicada |
| 5 | `20260327201400` | `enterprise_rls_policies` | ✅ Aplicada |

## Módulos

| Módulo | Estado | Progreso | Notas |
|--------|--------|----------|-------|
| Auth | ✅ Implementado | 100% | Google OAuth + PKCE + session cookie `.grixi.ai` |
| Admin Panel | ✅ Implementado | 100% | 5 páginas, Recharts, audit timeline |
| Multi-Tenant | ✅ Implementado | 100% | Subdomain routing + branding + membership guard |
| Dashboard | 🚧 Parcial | 15% | Módule cards con progress bars (placeholder) |
| Finanzas | 🚧 Scaffold | 5% | Ruta + empty state (branch `feat/finanzas` lista) |
| Almacenes | ⬜ Pendiente | 0% | — |
| Compras | ⬜ Pendiente | 0% | — |
| Flota | ⬜ Pendiente | 0% | — |
| RRHH | ⬜ Pendiente | 0% | — |
| Mantenimiento | ⬜ Pendiente | 0% | — |
| Calidad | ⬜ Pendiente | 0% | — |
| Reportes | ⬜ Pendiente | 0% | — |
| GRIXI AI | ⬜ Pendiente | 0% | — |

## Frontend — Archivos (28 archivos, ~3,110 LOC)

### Rutas (10)

| Ruta | Archivo | Tipo |
|------|---------|------|
| `/` (index) | `routes/login.tsx` | Pública — Login con Google OAuth |
| `/auth/callback` | `routes/auth.callback.tsx` | Pública — PKCE code exchange |
| `/auth/signout` | `routes/auth.signout.tsx` | Pública — Logout |
| `/select-org` | `routes/select-org.tsx` | Pública — Selector de organización |
| `/unauthorized` | `routes/unauthorized.tsx` | Pública — Acceso denegado |
| `/dashboard` | `routes/dashboard.tsx` | Protegida — Welcome + module cards |
| `/finanzas` | `routes/finanzas.tsx` | Protegida — Empty state scaffold |
| `/admin` | `routes/admin/index.tsx` | Protegida + Platform Admin — Recharts dashboard |
| `/admin/organizations` | `routes/admin/organizations.tsx` | Protegida + Platform Admin — CRUD orgs |
| `/admin/organizations/:id` | `routes/admin/organizations.$id.tsx` | Protegida + Platform Admin — 5 tabs detalle |
| `/admin/users` | `routes/admin/users.tsx` | Protegida + Platform Admin — Gestión usuarios |
| `/admin/audit` | `routes/admin/audit.tsx` | Protegida + Platform Admin — Log auditoría |

### Componentes

| Componente | Descripción |
|-----------|-------------|
| `components/layout/sidebar.tsx` | Sidebar colapsable con framer-motion, nav groups, orb glow |
| `components/layout/topbar.tsx` | Topbar con org switcher, avatar, user menu |
| `components/login/animated-nodes.tsx` | Background animado de partículas para login |

### Librerías Internas

| Archivo | Función |
|---------|---------|
| `lib/supabase/client.browser.ts` | Cliente Supabase browser-side |
| `lib/supabase/client.server.ts` | Cliente Supabase server-side + admin |
| `lib/platform-guard.ts` | Guard: `isPlatformTenant()` |
| `lib/audit.ts` | Helper: `logAudit()` |
| `lib/export.ts` | Helper: exportar CSV |
| `lib/utils.ts` | Utilidades (cn, format, etc.) |
| `lib/i18n/index.ts` | Sistema i18n con 3 idiomas |
| `lib/i18n/es.ts` | Traducciones español |
| `lib/i18n/en.ts` | Traducciones inglés |
| `lib/i18n/pt.ts` | Traducciones portugués |

## Admin Panel — Detalle

| Página | Ruta | Features |
|--------|------|----------|
| Dashboard | `/admin` | 4 KPIs, AreaChart (growth 7d), PieChart (plans), BarChart (members/org), invitation stats, audit timeline, org list |
| Organizaciones | `/admin/organizations` | CRUD, search, filters, CSV export |
| Detalle Org | `/admin/organizations/:id` | 5 tabs (Miembros, Módulos, Invitaciones, Dominios, Config) |
| Usuarios | `/admin/users` | Promote/demote admin, search, CSV export |
| Audit Log | `/admin/audit` | Filtro por acción, actor avatar, IP tracking |

## Arquitectura Multi-Tenant

### Tenant Resolution (4 niveles de prioridad)
1. **Subdomain** (`empresa.grixi.ai` → slug) — Prioridad máxima
2. **URL param** (`?org=slug`) — Fallback
3. **Cookie** (`grixi_org=uuid`) — Persistencia
4. **Primer membership** — Default

### Tenants en Producción

| Tenant | Subdomain | Plan | Logo | Color |
|--------|-----------|------|------|-------|
| GRIXI | `grixi.grixi.ai` | Enterprise | `/grixi-logo.png` | `#7c3aed` |
| Acme Corp | `acme.grixi.ai` | Professional | `/logos/acme.png` | `#3B82F6` |
| Nexus Technologies | `nexus.grixi.ai` | Starter | `/logos/nexus.png` | `#F59E0B` |
| prueba | `prueba.grixi.ai` | Starter | — (sin logo) | — (sin color) |

### Platform Admins

| Nombre | Email |
|--------|-------|
| Diego Mera | `dmera@grixi.ai` |
| Calixto Saldarriaga | `csaldarriaga@grixi.ai` |

### Seguridad Multi-Tenant (7 Capas)

| # | Capa | Protección | Verificado |
|---|------|-----------|------------|
| 1 | DNS/Cloudflare | Solo `*.grixi.ai` llega al Worker | ✅ |
| 2 | Worker Edge | `tenantSlug` extraído del hostname real (no manipulable) | ✅ |
| 3 | Rate Limiting | 30 req/min por IP en rutas `/admin` (429 auto) | ✅ |
| 4 | Membership Guard | Usuario DEBE ser miembro del tenant o platform_admin | ✅ |
| 5 | Loaders (GET) | `isPlatformTenant()` en 5 admin loaders → redirect `/dashboard` | ✅ |
| 6 | Actions (POST) | `isPlatformTenant()` en admin actions → 403 Forbidden | ✅ |
| 7 | DB `platform_admins` | Solo admins registrados acceden a panel admin | ✅ |
| 8 | Sidebar (UI) | Links admin ocultos si `tenantSlug !== 'grixi'` | ✅ |
| 9 | RLS (29 policies) | Aislamiento a nivel de datos por org_id | ✅ |

## Dependencias

### Producción

| Paquete | Versión | Uso real |
|---------|---------|----------|
| react | ^19.1.1 | Core |
| react-dom | ^19.1.1 | Core |
| react-router | ^7.10.0 | SSR + routing |
| @supabase/supabase-js | ^2.50.0 | Backend client |
| @supabase/ssr | ^0.7.0 | Server-side auth (cookies) |
| recharts | ^3.8.1 | Charts admin dashboard |
| lucide-react | ^1.7.0 | Iconos |
| framer-motion | ^12.0.0 | Animaciones sidebar |
| clsx | ^2.1.1 | Class merging |
| tailwind-merge | ^3.0.0 | Tailwind class merging |
| isbot | ^5.1.31 | Bot detection |
| sonner | ^2.0.0 | ⚠️ Instalado pero NO importado en ningún archivo |
| zustand | ^5.0.0 | ⚠️ Instalado pero NO importado en ningún archivo |

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

## Git

| Métrica | Valor |
|---------|-------|
| Rama principal | `main` |
| Rama activa | `feat/finanzas` |
| Remoto | `https://github.com/GRIXI/grixi-app.git` |
| Package manager | pnpm 10.24.0 |

## Documentación

| Documento | Estado |
|-----------|--------|
| Arquitectura (15 docs) | ✅ Completa |
| Sistema de registro | ✅ Implementado |
| `docs/database.types.ts` | ✅ Generado |
| Docs de módulos | ⬜ `/docs/modulos/` vacío (solo `.gitkeep`) |

## Próximos Pasos

1. ~~Configurar Supabase Redirect URLs~~ ✅ Configurado en `config.toml`
2. ~~Implementar RLS policies (29 policies)~~ ✅ Aplicadas
3. ~~Sincronizar migraciones para Supabase Branching~~ ✅ 5 migraciones registradas
4. Limpiar dependencias no usadas (`sonner`, `zustand`)
5. Implementar módulo Finanzas (branch `feat/finanzas` lista)
6. Documentar módulos implementados (`docs/modulos/auth.md`, etc.)
7. Implementar Supabase Realtime subscriptions para dashboard
8. Configurar CI/CD (GitHub Actions → Cloudflare Workers)
9. R2 para almacenamiento de archivos
10. Hyperdrive para conexiones PostgreSQL optimizadas
11. Error boundaries globales
12. Dark/Light mode toggle
