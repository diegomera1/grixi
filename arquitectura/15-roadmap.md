# Alternativa 1 — Roadmap de Implementación

> Plan fase por fase para construir GRIXI desde cero.
> 2 developers, ~12 semanas, incremental.

---

## Vista General

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       GRIXI IMPLEMENTATION ROADMAP                        │
│                                                                            │
│  Fase 0        Fase 1          Fase 2          Fase 3       Fase 4   F5  │
│  ──────        ──────          ──────          ──────       ──────   ──  │
│  SETUP         FOUNDATION      CORE MODULES    ADVANCED     AI        🚀 │
│  1 sem         2 sem           3 sem           3 sem        2 sem    1s  │
│                                                                            │
│  Herramientas  Auth            Dashboard       Finanzas     AI Chat      │
│  DNS           Multi-tenant    Almacenes 3D    RRHH         Canvas       │
│  Repo          Layout          Compras         Flota        Voice        │
│  DB Schema     Design System   Usuarios/RBAC   Reportes     Cmd Center   │
│  CI/CD         Theme                                                      │
│                                                                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Sem 1       Sem 2-3        Sem 4-6         Sem 7-9     Sem 10-11  S12  │
│                                                                            │
│  Milestone:   Auth works     3 modules       All modules  AI works  DEMO │
│               Login→Dashboard live            live         launch     🎉 │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Fase 0: Setup (Semana 1)

> **Objetivo:** Todas las herramientas compradas, configuradas, y conectadas.
> **Detalle completo:** [10-setup-guide.md](./10-setup-guide.md)

### Tareas

| Día | Tareas | Responsable |
|---|---|---|
| **Lun** | Dominio grixi.io, Google Workspace, Cloudflare (zona + Pro + Workers) | Dev 1 |
| **Mar** | GitHub org + repo monorepo (Turborepo), branch protection, CI/CD workflows | Dev 1 |
| **Mar** | Supabase proyecto (Pro + Medium + PITR), custom domain, Auth config | Dev 2 |
| **Mié** | Resend (dominio + DKIM), Discord (servidor + webhooks), Jira (proyecto) | Dev 2 |
| **Mié** | Sentry proyecto, Antigravity Ultra | Dev 1 |
| **Jue** | React Router v7 + Vite 8 + Cloudflare adapter scaffold | Dev 1 + Dev 2 |
| **Jue** | DB schema core: organizations, profiles, memberships, roles, permissions | Dev 2 |
| **Vie** | Conectar secrets, wrangler.toml final, primer deploy `wrangler deploy` | Dev 1 + Dev 2 |

### Exit Criteria
- [ ] `pnpm dev` inicia React Router + Cloudflare Worker local
- [ ] `pnpm build && wrangler deploy` despliega a Workers
- [ ] app.grixi.io carga una página (aunque sea vacía)
- [ ] Supabase DB tiene schema core
- [ ] CI/CD: push a main → deploy automático

---

## Fase 1: Foundation (Semanas 2-3)

> **Objetivo:** Auth funcional, layout premium, design system completo, multi-tenant operativo.

### Semana 2: Auth + Layout

| Tarea | Detalle | Dev |
|---|---|---|
| Auth flow completo | Login (Google OAuth + email), register, forgot password, logout | Dev 1 |
| Middleware de seguridad | Tenant resolution por subdominio, auth check, redirect | Dev 1 |
| Layout principal | Sidebar (colapsable) + Topbar + Main content area | Dev 2 |
| Design system base | CSS variables, tipografía, colores, dark/light mode | Dev 2 |
| shadcn/ui setup | Button, Card, Dialog, Sheet, Input, Select, Tabs | Dev 2 |
| Root layout | `root.tsx` con Lenis, theme provider, fonts, Sonner | Dev 1 |

### Semana 3: Multi-Tenant + Theme

| Tarea | Detalle | Dev |
|---|---|---|
| Multi-tenant middleware | `slug` → `org_id` resolution en cada request | Dev 1 |
| RLS verification | Tests de aislamiento: usuario A no ve datos de org B | Dev 1 |
| Branding por tenant | Logo, colores, nombre dinámicos desde `organizations` table | Dev 2 |
| Skeleton loading | Componentes de skeleton para toda la app | Dev 2 |
| Error boundaries | ErrorBoundary por ruta + global-error | Dev 1 |
| Zustand stores | Auth store, theme store, sidebar store | Dev 2 |
| Supabase Realtime setup | Client-side subscriptions pattern | Dev 1 |

### Exit Criteria
- [ ] Login con Google OAuth funciona en empresa-x.grixi.io
- [ ] Sidebar + Topbar renderizan con branding del tenant
- [ ] Dark/Light mode funciona
- [ ] RLS aísla datos correctamente entre tenants
- [ ] Realtime subscriptions activas

---

## Fase 2: Core Modules (Semanas 4-6)

> **Objetivo:** Dashboard, Almacenes (con 3D), Compras, y Usuarios funcionando.

### Semana 4: Dashboard + Almacenes Base

| Tarea | Dev |
|---|---|
| Dashboard: KPI cards con datos reales (SSR loader) | Dev 1 |
| Dashboard: Recharts trend charts (ventas, ocupación) | Dev 1 |
| Dashboard: Alert feed con Realtime | Dev 1 |
| Almacenes: Lista con occupancy rings | Dev 2 |
| Almacenes: Detalle con tabs (Resumen, Racks, Movimientos) | Dev 2 |
| Almacenes: CRUD de warehouses y products (loaders + actions) | Dev 2 |
| Seed data: 3 almacenes, 50 productos, 5 racks por almacén | Dev 2 |

### Semana 5: Almacenes 3D + Compras

| Tarea | Dev |
|---|---|
| Almacenes 3D: React Three Fiber scene (warehouse model) | Dev 2 |
| Almacenes 3D: Rack models con cajas dinámicas por ocupación | Dev 2 |
| Almacenes 3D: Click → box detail drawer | Dev 2 |
| Almacenes 3D: Fly-through camera mode | Dev 2 |
| Compras: Dashboard (POs pendientes, gasto, top proveedores) | Dev 1 |
| Compras: Tabla de órdenes de compra (TanStack Table + filtros) | Dev 1 |
| Compras: CRUD de proveedores | Dev 1 |

### Semana 6: Compras Avanzado + Usuarios

| Tarea | Dev |
|---|---|
| Compras: Crear OC (form multi-step, selección de productos) | Dev 1 |
| Compras: Flujo de aprobación (draft → pending → approved) | Dev 1 |
| Usuarios: Lista + invitación por email (Resend) | Dev 2 |
| Usuarios: RBAC (roles, permisos, matrix de acceso) | Dev 2 |
| Usuarios: Profile sheet con actividad | Dev 2 |
| Command Center: Cmd+K modal con búsqueda global | Dev 1 |

### Exit Criteria
- [ ] Dashboard muestra KPIs reales con gráficos interactivos
- [ ] Almacenes 3D funciona con racks, cajas, fly-through
- [ ] Compras: crear OC, aprobar, marcar como recibida
- [ ] Usuarios: invitar, asignar rol, RBAC funciona
- [ ] Cmd+K busca en todos los módulos

---

## Fase 3: Advanced Modules (Semanas 7-9)

> **Objetivo:** Finanzas, RRHH, y Flota completos.

### Semana 7: Finanzas

| Tarea | Dev |
|---|---|
| Plan de cuentas jerárquico (tree view) | Dev 1 |
| Asientos contables (journal entries) | Dev 1 |
| CxC: Facturas por cobrar, aging analysis | Dev 2 |
| CxP: Facturas por pagar, vencimientos | Dev 2 |
| Cash flow chart (Recharts multi-layer AreaChart) | Dev 1 |
| Presupuestos: Planned vs Actual | Dev 2 |

### Semana 8: RRHH

| Tarea | Dev |
|---|---|
| Directorio de empleados (grid + list views) | Dev 1 |
| Perfil de empleado detallado | Dev 1 |
| Departamentos y organigrama | Dev 2 |
| Asistencia (check-in/out, calendar view) | Dev 2 |
| Integración con Usuarios existentes (link user ↔ employee) | Dev 1 |

### Semana 9: Flota

| Tarea | Dev |
|---|---|
| Dashboard de flota con mapa interactivo | Dev 2 |
| Lista de vehículos con cards de estado | Dev 2 |
| Detalle de vehículo con specs e historial | Dev 2 |
| Mantenimiento: calendario + órdenes de trabajo | Dev 1 |
| Logística: viajes, rutas, carga | Dev 1 |
| Tripulación: asignación de personal | Dev 1 |

### Exit Criteria
- [ ] Finanzas: P&L, CxC aging, cash flow chart
- [ ] RRHH: directorio, asistencia, departamentos
- [ ] Flota: mapa, vehículos, mantenimiento, viajes
- [ ] Todos los módulos con responsive mobile

---

## Fase 4: AI Integration (Semanas 10-11)

> **Objetivo:** GRIXI AI funcional con contexto por módulo y rich output.

### Semana 10: AI Core

| Tarea | Dev |
|---|---|
| AI widget (orb flotante, arrastrable) | Dev 2 |
| Chat panel con streaming + markdown | Dev 2 |
| Server-side Gemini integration (action) | Dev 1 |
| Prompt enrichment por módulo activo | Dev 1 |
| Rate limiting (Users KV) | Dev 1 |
| Chat sessions persistence (Supabase) | Dev 2 |

### Semana 11: AI Advanced

| Tarea | Dev |
|---|---|
| AI Canvas split view (rich output a la derecha) | Dev 2 |
| Recharts inline en respuestas AI | Dev 2 |
| Function calling (crear OC, generar reporte) | Dev 1 |
| Usage tracking y logging (ai_usage_logs) | Dev 1 |
| Caching de respuestas frecuentes (KV) | Dev 1 |
| Welcome screen con sugerencias | Dev 2 |

### Exit Criteria
- [ ] AI Chat funciona con streaming en todos los módulos
- [ ] Respuestas incluyen gráficos Recharts interactivos
- [ ] Canvas split view muestra contenido rico
- [ ] Rate limiting funciona por usuario y tenant
- [ ] Usage logging activo para facturación

---

## Fase 5: Polish + Demo (Semana 12)

> **Objetivo:** Primer tenant demo listo, todo pulido, primer deploy de producción.

### Tareas

| Tarea | Dev |
|---|---|
| Admin panel: crear tenant desde SuperAdmin | Dev 1 |
| Admin panel: seed data automático para demos | Dev 1 |
| Animaciones finales: micro-interactions, transitions | Dev 2 |
| Performance audit: LCP, FID, CLS, bundle size | Dev 2 |
| Notificaciones: in-app (Sonner) + email (Resend) | Dev 1 |
| Reportes exportables: PDF + Excel | Dev 1 |
| Mobile responsive: verificar todos los módulos | Dev 2 |
| Testing E2E: flujo completo login → módulos → AI | Dev 1 + Dev 2 |
| SEO: meta tags, OG images, sitemap | Dev 2 |
| Monitoreo: Sentry + CF Analytics configurados | Dev 1 |
| **CREAR DEMO TENANT** | Dev 1 + Dev 2 |

### Exit Criteria
- [ ] demo.grixi.io funciona con datos de demo completos
- [ ] Todos los módulos accesibles y funcionales
- [ ] AI funciona en demo
- [ ] Mobile responsive verificado
- [ ] Sentry capturando errores
- [ ] CI/CD desplegando automáticamente
- [ ] **Listo para primera demo comercial** 🎉

---

## Dependencias Críticas

```
Fase 0 → Fase 1: Sin herramientas no hay código
Fase 1 → Fase 2: Sin auth y layout no hay módulos
Fase 2 → Fase 3: Compras/Almacenes deben funcionar antes de Finanzas (datos compartidos)
Fase 2 → Fase 4: AI necesita datos de módulos para contexto
Fase 3 + 4 → Fase 5: Todo debe funcionar para el polish final
```

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Vite 8 / React Router v7 bugs | Media | Monitorear GitHub issues, tener fallback a Vite 7 |
| Supabase Branching lento | Baja | Usar branches manuales si el automático falla |
| Cloudflare Workers límites | Baja | Monitorear CPU time, usar Unbound si necesario |
| 3D performance en mobile | Alta | Dynamic import, LOD, deshabilitar 3D en mobile si necesario |
| Gemini API costs desbordados | Media | Rate limiting estricto, caching agresivo, monitoreo diario |
| Scope creep en módulos | Alta | MVP primero, features avanzadas post-launch |
