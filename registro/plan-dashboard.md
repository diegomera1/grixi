# Plan de Implementación — Dashboard Real 100%

**Fecha:** 2026-03-28
**Estado actual:** 15% (cards placeholder sin loader, sin datos reales)
**Objetivo:** Dashboard premium, multi-tenant, con datos reales de Supabase, Suspense streaming, Recharts, CSS moderno, y accesos rápidos.
**Tiempo estimado:** ~3 horas

---

## Análisis Tecnológico (Decisiones)

El stack actual (Vite 8 + Rolldown, React 19.1, React Router 7.10, Tailwind 4.1) es **lo más moderno disponible en 2026**. No se cambia nada fundamental, pero se aprovechan features que no se están usando:

| Decisión | Detalle |
|----------|---------|
| ✅ **Suspense streaming** | Datos críticos (KPIs) van en `await`. Datos lentos (audit_logs) se streamean con `Suspense` |
| ✅ **CSS puro para animaciones básicas** | Cards, fade-in, hover → `.animate-fade-in`, `.card-elevated` (ya existen en `app.css`) |
| ✅ **framer-motion solo para lo complejo** | Stagger de KPI cards (`staggerChildren`), `AnimatePresence` para transiciones |
| ✅ **Recharts 3.8** | Mantener — ya funciona en Admin, API JSX-first, consistencia visual |
| ✅ **CSS `color-mix()`** | Backgrounds dinámicos con color del tenant: `color-mix(in oklch, var(--brand) 8%, transparent)` |
| ❌ **Eliminar `sonner` + `zustand`** | 0 imports en todo el código — peso muerto (~11kB) |

---

## Dashboard Actual vs Final

### ANTES (66 LOC, sin loader)
```
dashboard.tsx
├── useOutletContext → { user, currentOrg }
├── "¡Bienvenido, {nombre}!"
└── 6x cards hardcoded (nombre, desc, progress bar estático)
    └── Sin datos reales, sin gráficos, sin actividad
```

### DESPUÉS (~8 componentes nuevos, loader SSR + streaming)
```
dashboard.tsx (loader + streaming)
├── Loader SSR: queries paralelas a Supabase con RLS
├── Suspense streaming: audit_logs carga async
│
├── DashboardHero
│   ├── Gradiente con primary_color del tenant
│   ├── "¡Bienvenido, {nombre}!" + nombre de la org
│   └── 4x KpiCard (Miembros, Roles, Permisos, Invitaciones)
│
├── ActivityChart (Recharts AreaChart)
│   └── Audit logs agrupados por día (7 días), gradiente brand
│
├── OrgInfoCard
│   └── Logo/inicial, nombre, subdomain, plan badge, color, idioma
│
├── ActivityTimeline (Suspense streamed)
│   └── Últimos 10 audit_logs con dot coloreado + tiempo relativo
│
├── QuickAccess
│   └── Mini-cards de módulos con estado real (activo/próximamente)
│
└── ModuleCards (grid refactorizado)
    └── Estado semántico: "Activo" → link, "Próximamente" → badge dimmed
```

---

## Datos Disponibles en la DB

Tablas existentes que alimentan el dashboard (no se crean tablas nuevas):

| Tabla | Campo útil | Query |
|-------|-----------|-------|
| `memberships` | Miembros de la org | `WHERE organization_id = X AND status = 'active'` |
| `roles` | Roles configurados | `WHERE organization_id = X` |
| `role_permissions` | Permisos asignados | `JOIN roles WHERE org_id = X` |
| `invitations` | Invitaciones pendientes | `WHERE organization_id = X AND status = 'pending'` |
| `audit_logs` | Actividad reciente | `ORDER BY created_at DESC LIMIT 10` |
| `organizations` | Config tenant | `settings->plan, primary_color, default_language` |
| `profiles` | Datos del actor | `JOIN` para nombres en timeline |

---

## Implementación Paso a Paso

### Paso 0: Limpieza de dependencias muertas
- [ ] `pnpm remove sonner zustand`
- [ ] Verificar build: `pnpm build`

**Archivos afectados:** `package.json`, `pnpm-lock.yaml`

---

### Paso 1: Loader SSR con Suspense streaming

**Archivo:** `app/routes/dashboard.tsx`

```typescript
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  // currentOrg viene del parent layout (authenticated.tsx)
  // Usamos supabase con session (RLS activo, no admin)

  // ── Datos CRÍTICOS: se esperan (instant) ──────────────
  const [membersRes, rolesRes, permsRes, invRes, orgRes] = await Promise.all([
    supabase.from("memberships").select("id", { count: "exact" })
      .eq("status", "active"),
    supabase.from("roles").select("id", { count: "exact" }),
    supabase.from("role_permissions").select("id", { count: "exact" }),
    supabase.from("invitations").select("id", { count: "exact" })
      .eq("status", "pending"),
    supabase.from("organizations").select("settings, default_language")
      .limit(1).maybeSingle(),
  ]);

  // ── Datos NO-CRÍTICOS: se streamean (Suspense) ───────
  const auditPromise = supabase
    .from("audit_logs")
    .select("id, action, entity_type, actor_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(15);

  return Response.json({
    kpis: {
      members: membersRes.count ?? 0,
      roles: rolesRes.count ?? 0,
      permissions: permsRes.count ?? 0,
      pendingInvites: invRes.count ?? 0,
    },
    orgSettings: orgRes.data?.settings ?? {},
    orgLanguage: orgRes.data?.default_language ?? "es",
    auditPromise,  // NO await — se streamea
  }, { headers });
}
```

**Patrón:** `Promise.all` para KPIs (bloqueante, ~50ms). Audit logs se pasan como promise para `<Suspense>`.

---

### Paso 2: Hero Header con KPIs reales

**Archivo nuevo:** `app/components/dashboard/hero.tsx`

| Elemento | Datos | Estilo |
|----------|-------|--------|
| Gradiente de fondo | `currentOrg.settings.primary_color` | `background: linear-gradient(135deg, color-mix(...))` |
| Welcome message | `user.name` + `currentOrg.name` | Font serif (Instrument Serif), tamaño heading |
| 4 KPI Cards | `kpis.members`, `kpis.roles`, `kpis.permissions`, `kpis.pendingInvites` | Stagger con framer-motion (0.08s delay) |

Cada **KpiCard** tiene:
- Ícono Lucide (Users, Shield, Lock, Mail) con color único
- Número grande (`text-2xl font-bold tabular-nums`)
- Label pequeño (`text-xs text-muted`)
- Fondo con `color-mix(in oklch, {color} 8%, transparent)` — adapta al color

**Animación:** `motion.div` con `staggerChildren: 0.08` — los 4 KPIs aparecen en cascada.

---

### Paso 3: Gráfico de Actividad (Recharts AreaChart)

**Archivo nuevo:** `app/components/dashboard/activity-chart.tsx`

| Elemento | Detalle |
|----------|---------|
| Tipo | `AreaChart` con gradiente fill (`linearGradient` Brand → transparent) |
| Datos | `audit_logs` agrupados por día (últimos 7 días: `Lun`, `Mar`, ... `Dom`) |
| Ejes | X: días, Y: count de acciones. `axisLine: false`, `tickLine: false` |
| Tooltip | Mismos estilos que Admin: `var(--bg-elevated)`, border, rounded-xl |
| Empty state | Si 0 logs → mensaje "Sin actividad esta semana" con ícono Activity |

**Reutiliza** el mismo `CHART_TOOLTIP` style object del Admin Panel para consistencia.

---

### Paso 4: Tarjeta de Organización

**Archivo nuevo:** `app/components/dashboard/org-info-card.tsx`

| Row | Dato | Source |
|-----|------|--------|
| Logo | Imagen o inicial con `primary_color` fondo | `currentOrg.logo_url` / `.name.charAt(0)` |
| Nombre | "GRIXI" | `currentOrg.name` |
| Subdomain | `grixi.grixi.ai` | `currentOrg.slug + ".grixi.ai"` |
| Plan | Badge: "Enterprise" / "Professional" / "Starter" | `currentOrg.settings.plan` |
| Color | Círculo con `primary_color` | `currentOrg.settings.primary_color` |
| Idioma | Bandera + nombre | `currentOrg.default_language` → ES/EN/PT |

**Estilo:** Card con borde, padding, glassmorphism subtle en dark mode.

---

### Paso 5: Timeline de Actividad Reciente (Suspense streamed)

**Archivo nuevo:** `app/components/dashboard/activity-timeline.tsx`

Este componente se renderiza dentro de `<Suspense>` — aparece con skeleton mientras carga.

| Elemento | Detalle |
|----------|---------|
| Lista | Últimos 8-10 `audit_logs` |
| Cada entry | Dot coloreado + acción + actor + tiempo relativo |
| Dot color | `user.*` → azul, `invite.*` → verde, `org.*` → amber, rest → gris |
| Tiempo | `formatRelativeTime()`: "hace 2h", "hace 1d", "ahora" |
| Empty state | "Sin actividad registrada" con ícono History |

**Animación:** CSS puro `@starting-style` — cada item hace fade-in al aparecer en el DOM (0kB JS).

```css
.timeline-item {
  opacity: 1;
  transform: translateX(0);
  transition: opacity 0.3s, transform 0.3s;
  @starting-style {
    opacity: 0;
    transform: translateX(-8px);
  }
}
```

---

### Paso 6: Accesos Rápidos

**Archivo nuevo:** `app/components/dashboard/quick-access.tsx`

| Módulo | Ícono | Estado | Link |
|--------|-------|--------|------|
| Finanzas | `DollarSign` | 🟢 Activo | `/finanzas` |
| Almacenes | `Warehouse` | 🔵 Próximamente | — (dimmed) |
| Compras | `ShoppingCart` | 🔵 Próximamente | — |
| RRHH | `Users` | 🔵 Próximamente | — |
| Flota | `Truck` | 🔵 Próximamente | — |
| GRIXI AI | `Sparkles` | 🔵 Próximamente | — |

- Módulos activos: clickeable, hover → `translateY(-2px)` + glow
- Módulos próximamente: `opacity: 0.5`, badge "Próximamente" superpuesto
- **Responsive:** 2 cols mobile → 3 cols tablet → 6 cols desktop

---

### Paso 7: CSS moderno + mejoras a `app.css`

**Archivo:** `app/app.css` — agregar al final:

```css
/* ─── CSS Moderno 2026 ─────────────────────── */

/* color-mix — variants dinámicas sin hardcodear */
.bg-brand-subtle {
  background: color-mix(in oklch, var(--brand) 8%, transparent);
}
.bg-brand-medium {
  background: color-mix(in oklch, var(--brand) 15%, transparent);
}

/* @starting-style — animaciones de entrada nativas 0kB */
.enter-fade {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.4s var(--ease-spring), transform 0.4s var(--ease-spring);
  @starting-style {
    opacity: 0;
    transform: translateY(12px);
  }
}

.enter-slide-left {
  opacity: 1;
  transform: translateX(0);
  transition: opacity 0.3s var(--ease-spring), transform 0.3s var(--ease-spring);
  @starting-style {
    opacity: 0;
    transform: translateX(-8px);
  }
}

/* Stagger delay helpers */
.stagger-1 { transition-delay: 0.05s; }
.stagger-2 { transition-delay: 0.10s; }
.stagger-3 { transition-delay: 0.15s; }
.stagger-4 { transition-delay: 0.20s; }
.stagger-5 { transition-delay: 0.25s; }
.stagger-6 { transition-delay: 0.30s; }
```

---

### Paso 8: Componentes Compartidos

**Archivo nuevo:** `app/components/shared/kpi-card.tsx`
```typescript
interface KpiCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  delay?: number;  // stagger index
}
```
- Reutilizable en Dashboard Y en Admin
- Número con `tabular-nums` para alineación
- Fondo con `color-mix(in oklch, {color} 8%, transparent)`
- Hover: `.card-elevated`

**Archivo nuevo:** `app/components/shared/empty-state.tsx`
```typescript
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}
```
- Centra ícono + texto
- Usado en: chart vacío, timeline vacía, módulo sin datos

---

### Paso 9: Responsive Layout

```
┌─ Mobile (< 640px) ─────────────────────┐
│ Hero (full width)                       │
│ KPIs: 2x2 grid                         │
│ Activity Chart (full width)             │
│ Org Info Card (full width)              │
│ Timeline (full width)                   │
│ Quick Access: 2x3 grid                  │
└─────────────────────────────────────────┘

┌─ Tablet (640-1024px) ──────────────────┐
│ Hero (full width)                       │
│ KPIs: 4 cols                            │
│ [Activity Chart 2/3] [Org Info 1/3]     │
│ [Timeline 1/2] [Quick Access 1/2]       │
└─────────────────────────────────────────┘

┌─ Desktop (> 1024px) ───────────────────┐
│ Hero (full width, max-w-7xl)            │
│ KPIs: 4 cols                            │
│ [Activity Chart 2/3] [Org Info 1/3]     │
│ [Timeline 1/2] [Quick Access 1/2]       │
└─────────────────────────────────────────┘
```

Tailwind classes:
- KPIs: `grid grid-cols-2 sm:grid-cols-4 gap-3`
- Charts row: `grid grid-cols-1 lg:grid-cols-3 gap-4` (chart=col-span-2)
- Bottom row: `grid grid-cols-1 lg:grid-cols-2 gap-4`

---

### Paso 10: Multi-Tenant Verification

| Test | Cómo verificar |
|------|---------------|
| GRIXI ve sus datos | Login → `grixi.grixi.ai/dashboard` → 2 miembros, 4 roles |
| Acme ve SUS datos | Login → `acme.grixi.ai/dashboard` → datos de Acme (no GRIXI) |
| RLS aísla | Un user de Acme NO puede ver audit_logs de GRIXI |
| Platform Admin | En `grixi.grixi.ai` ve data real + links admin |
| Performance | Loader < 200ms (avg), First Paint < 500ms |
| Build | `pnpm build` sin errores ni warnings |

---

## Archivos: Crear / Modificar

| # | Archivo | Acción | LOC est. |
|---|---------|--------|----------|
| 0 | `package.json` | MODIFICAR — quitar sonner, zustand | -2 |
| 1 | `app/routes/dashboard.tsx` | **REESCRIBIR** — loader SSR + streaming + layout | ~120 |
| 2 | `app/components/dashboard/hero.tsx` | **NUEVO** — Hero header + KPIs row | ~80 |
| 3 | `app/components/dashboard/activity-chart.tsx` | **NUEVO** — Recharts AreaChart | ~70 |
| 4 | `app/components/dashboard/org-info-card.tsx` | **NUEVO** — Tarjeta de org | ~60 |
| 5 | `app/components/dashboard/activity-timeline.tsx` | **NUEVO** — Timeline + Suspense | ~80 |
| 6 | `app/components/dashboard/quick-access.tsx` | **NUEVO** — Grid de módulos | ~70 |
| 7 | `app/components/shared/kpi-card.tsx` | **NUEVO** — Componente reutilizable | ~40 |
| 8 | `app/components/shared/empty-state.tsx` | **NUEVO** — Estado vacío | ~25 |
| 9 | `app/app.css` | MODIFICAR — agregar CSS moderno | +30 |
| | | **TOTAL** | ~575 LOC |

---

## Orden de Ejecución

```
Paso 0: pnpm remove sonner zustand
  ↓
Paso 1: Loader SSR + streaming (dashboard.tsx)
  ↓
Paso 7: CSS moderno (app.css) ← se necesita antes de los componentes
  ↓
Paso 8: Componentes shared (kpi-card, empty-state)
  ↓
Paso 2: Hero + KPIs
  ↓
Paso 3: Activity Chart
  ↓
Paso 4: Org Info Card
  ↓
Paso 5: Activity Timeline (Suspense)
  ↓
Paso 6: Quick Access
  ↓
Paso 9: Responsive tweaks
  ↓
Paso 10: Testing multi-tenant + build
```
