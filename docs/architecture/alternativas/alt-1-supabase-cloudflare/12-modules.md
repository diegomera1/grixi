# Alternativa 1 — Módulos de GRIXI

> Especificación de los 11 módulos de la plataforma con features, rutas, y componentes.
> Cada módulo sigue el patrón: Layout → Loader → Componente → Actions.

---

## Mapa de Módulos

```
GRIXI Platform
├── 🔐 Auth            ← Login, Register, OAuth, MFA
├── 📊 Dashboard        ← KPIs, gráficos, alertas
├── 📦 Almacenes        ← Inventario, racks, vista 3D
├── 🛒 Compras          ← POs, proveedores, aprobaciones
├── 💰 Finanzas         ← Libro Mayor, CxC, CxP, Presupuestos
├── 👥 RRHH             ← Empleados, asistencia, nómina
├── 🚛 Flota            ← Vehículos, mantenimiento, logística
├── 👤 Usuarios         ← RBAC, roles, permisos, invitaciones
├── 🤖 AI               ← Chat, Canvas, Voice, rich output
├── 🎯 Command Center   ← Centro de mando, búsqueda global
└── ⚙️ Admin            ← SuperAdmin: gestión de tenants y plataforma
```

---

## 1. Auth

| Campo | Detalle |
|---|---|
| **Ruta** | `/login`, `/register`, `/forgot-password` |
| **Público** | Sí (no requiere autenticación) |
| **Providers** | Google OAuth (primario), Email/Password, Magic Link |
| **Multi-tenant** | Login page muestra branding del tenant (logo, colores) |

### Features
- Login con Google OAuth (1-click)
- Resolución de tenant por subdominio (`empresa-x.grixi.io` → org_id)
- Pantalla de login personalizada con logo y colores del tenant
- Redireccionamiento post-login a última ruta visitada
- Remember me (refresh token 30 días)

### Rutas React Router

```typescript
// app/routes/login.tsx
export async function loader({ request, context }: Route.LoaderArgs) {
  // Obtener branding del tenant desde el subdominio
  const hostname = request.headers.get('host') || ''
  const slug = hostname.split('.')[0]
  const org = await getOrgBySlug(slug, context.cloudflare.env)
  return { org }  // logo, colores, nombre
}
```

---

## 2. Dashboard

| Campo | Detalle |
|---|---|
| **Ruta** | `/dashboard` |
| **Acceso** | Todos los roles |
| **Data** | SSR pre-rendered (loader) + Realtime updates |

### Features
- **Hero KPIs**: 4-6 tarjetas con métricas principales (ventas, ocupación, pedidos, empleados)
- **Gráficos**: Tendencia de ventas (6 meses), Top productos, Cash flow (Recharts)
- **Alertas recientes**: Stock bajo, OC aprobadas, documentos nuevos (Supabase Realtime)
- **Accesos rápidos**: Links a los módulos más usados
- **Responsive**: Cards apiladas en mobile

### Componentes Clave
- `DashboardContent` — Layout principal con grid de KPIs
- `KpiCard` — Tarjeta de métrica con sparkline, variación %, ícono
- `TrendChart` — Recharts AreaChart con gradientes y tooltips
- `AlertFeed` — Lista de alertas con badge count en sidebar

---

## 3. Almacenes (con 3D)

| Campo | Detalle |
|---|---|
| **Ruta** | `/almacenes`, `/almacenes/:id` |
| **Acceso** | `warehouses.view`, `warehouses.3d` |
| **3D** | React Three Fiber + drei |
| **Realtime** | Sí (movimientos de inventario) |

### Features
- **Lista de almacenes**: Cards con occupancy ring (%), nombre, ubicación
- **Detalle de almacén**: Tabs (Resumen, Racks 2D, Vista 3D, Movimientos)
- **Vista 3D**: Modelo interactivo del almacén con racks, cajas, iluminación
  - Click en caja → detalle del producto
  - Fly-through mode (recorrido automático)
  - Colores por ocupación (verde/amarillo/rojo)
  - HUD overlay con estadísticas
- **Inventario**: Tabla con búsqueda, filtros, paginación
- **Movimientos**: Registro de entradas/salidas con audit trail

### Componentes Clave
- `WarehousesContent` — Grid de warehouse cards con occupancy rings
- `WarehouseDetail` — Layout con tabs
- `Warehouse3DScene` — React Three Fiber canvas con modelo del almacén
- `RackModel` — Componente 3D de rack con cajas dinámicas
- `BoxDetailDrawer` — Sheet lateral con detalle del producto (imagen, stock, SKU)
- `FlightModeCamera` — Cámara de fly-through con animación GSAP
- `WarehouseHUD` — Overlay con estadísticas flotantes

---

## 4. Compras

| Campo | Detalle |
|---|---|
| **Ruta** | `/compras`, `/compras/ordenes/:id`, `/compras/proveedores` |
| **Acceso** | `purchases.view`, `purchases.create`, `purchases.approve` |

### Features
- **Dashboard de Compras**: KPIs (POs pendientes, gasto mensual, top proveedores)
- **Órdenes de Compra**: Tabla con filtros por estado, proveedor, fecha
- **Crear OC**: Form con selección de productos, proveedor, cantidades, aprobación
- **Proveedores**: Lista con compliance score, contacto, historial
- **Flujo de aprobación**: Draft → Pending → Approved → Received

### Componentes Clave
- `PurchaseOrdersTable` — TanStack Table con filtros, sort, paginación
- `CreatePOForm` — Form multi-step con búsqueda de productos
- `VendorCard` — Card con score, rating, historial
- `ApprovalFlow` — Stepper visual del estado de la OC

---

## 5. Finanzas

| Campo | Detalle |
|---|---|
| **Ruta** | `/finanzas`, sub-tabs: libro-mayor, cxc, cxp, presupuestos |
| **Acceso** | `finance.view`, `finance.manage` |

### Features
- **Libro Mayor**: Plan de cuentas jerárquico, asientos contables, balances
- **CxC (Cuentas por Cobrar)**: Facturas pendientes, aging analysis, seguimiento
- **CxP (Cuentas por Pagar)**: Facturas de proveedores, vencimientos
- **Presupuestos**: Planned vs Actual por departamento/cuenta
- **Cash Flow**: Gráfico multi-layer con inflows/outflows
- **P&L**: Estado de resultados con tree view colapsable

### Componentes Clave
- `FinanceContent` — Layout con tabs (Libro Mayor, CxC, CxP, Presupuestos)
- `AccountTree` — Tree view jerárquico de cuentas
- `AgingChart` — Recharts horizontal BarChart para AR aging
- `CashFlowChart` — Recharts AreaChart multi-layer
- `PnLRow` — Componente expandible con animación nested

---

## 6. RRHH

| Campo | Detalle |
|---|---|
| **Ruta** | `/rrhh`, `/rrhh/empleados/:id`, `/rrhh/asistencia` |
| **Acceso** | `hr.view`, `hr.manage` |

### Features
- **Directorio de Empleados**: Grid/List view con búsqueda, filtros por departamento
- **Perfil de Empleado**: Datos personales, historial, asistencia, documentos
- **Departamentos**: Organigrama interactivo
- **Asistencia**: Tabla con check-in/out, horas trabajadas, calendar view
- **Nómina** (futuro): Cálculo de salarios, deducciones

---

## 7. Flota

| Campo | Detalle |
|---|---|
| **Ruta** | `/flota`, `/flota/:id`, sub-tabs: mantenimiento, logistica, tripulacion |
| **Acceso** | `fleet.view`, `fleet.manage` |

### Features
- **Dashboard Flota**: Mapa con ubicaciones de vehículos, KPIs (activos, en mantenimiento)
- **Lista de Vehículos**: Cards con estado, próximo mantenimiento, foto
- **Detalle Vehículo**: Specs, historial de mantenimiento, tripulación asignada
- **Mantenimiento**: Calendario de servicios, órdenes de trabajo
- **Logística**: Rutas, viajes activos, historial de viajes
- **Tripulación**: Asignación de personal a vehículos

### Componentes Clave
- `FleetDashboard` — Mapa + KPI cards
- `VehicleCard` — Card con estado, specs, maintenance badge
- `MaintenanceCalendar` — Calendario de servicios
- `VesselMap` — Mapa interactivo (Leaflet o Mapbox)
- `Vessel3DInterior` — Vista 3D del interior (React Three Fiber)

---

## 8. Usuarios y RBAC

| Campo | Detalle |
|---|---|
| **Ruta** | `/usuarios`, `/usuarios/roles` |
| **Acceso** | `users.view`, `users.manage` |

### Features
- **Lista de Usuarios**: Tabla con rol, última actividad, estado
- **Invitar Usuario**: Form con email, rol, módulos accesibles
- **Roles**: CRUD de roles custom con permisos granulares
- **Permisos**: Matrix de módulo × acción (checkboxes)
- **Profile Sheet**: Panel lateral con detalle de usuario

---

## 9. GRIXI AI

| Campo | Detalle |
|---|---|
| **Acceso** | `ai.chat` (orb flotante disponible en toda la app) |
| **Modelo** | Gemini 3.1 Flash-Lite |
| **Server-side** | Todas las llamadas vía loader/action, NUNCA desde el client |

### Features
- **Chat**: Conversación con streaming, markdown rendering
- **AI Canvas**: Split view con contenido rico a la derecha (Recharts, tablas, imágenes)
- **Contexto por Módulo**: AI recibe datos del módulo activo para respuestas contextuales
- **Voice** (futuro): Interfaz por voz
- **Function Calling**: Acciones interactivas (crear OC, generar reporte)
- **Widget Flotante**: Orb en esquina inferior derecha, arrastrable, redimensionable

### Componentes Clave
- `GrixiAIWidget` — Orb flotante con badge de notificaciones
- `ChatPanel` — Panel de chat con input, mensajes, streaming
- `AICanvas` — Split view con contenido rico
- `WelcomeScreen` — Pantalla de bienvenida con sugerencias
- `ChatInput` — Input con attachments, voice toggle

---

## 10. Command Center

| Campo | Detalle |
|---|---|
| **Ruta** | `Cmd+K` (modal global) |
| **Acceso** | Todos los roles autenticados |

### Features
- **Búsqueda Global**: Usuarios, almacenes, productos, OCs — todo indexado
- **Acciones Rápidas**: Crear OC, invitar usuario, ir a módulo
- **Navegación**: Ir a cualquier ruta desde teclado
- **Recientes**: Historial de búsquedas y accesos

---

## 11. Admin (SuperAdmin Platform)

| Campo | Detalle |
|---|---|
| **Ruta** | `/admin` (solo en `app.grixi.io`) |
| **Acceso** | `is_platform_admin()` únicamente |

### Features
- **Dashboard Global**: Todos los tenants, usuarios totales, revenue
- **Gestión de Organizaciones**: Crear, editar, suspender, eliminar tenants
- **Planes y Facturación**: Asignar planes, monitorear usage
- **Seed Data**: Poblar demos con datos de prueba
- **Logs de Auditoría**: Actividad global de la plataforma
- **Configuración**: Settings de la plataforma

---

## Mapa de Rutas React Router v7

```typescript
// app/routes.ts
import { type RouteConfig, route, layout } from '@react-router/dev/routes'

export default [
  // Public
  route('login', 'routes/login.tsx'),
  route('register', 'routes/register.tsx'),
  route('forgot-password', 'routes/forgot-password.tsx'),

  // Authenticated (layout con sidebar + topbar)
  layout('routes/authenticated.tsx', [
    route('dashboard', 'routes/dashboard.tsx'),

    // Almacenes
    route('almacenes', 'routes/almacenes.tsx'),
    route('almacenes/:id', 'routes/almacenes.$id.tsx'),

    // Compras
    route('compras', 'routes/compras.tsx'),
    route('compras/ordenes/:id', 'routes/compras.ordenes.$id.tsx'),
    route('compras/proveedores', 'routes/compras.proveedores.tsx'),

    // Finanzas
    route('finanzas', 'routes/finanzas.tsx'),

    // RRHH
    route('rrhh', 'routes/rrhh.tsx'),
    route('rrhh/empleados/:id', 'routes/rrhh.empleados.$id.tsx'),
    route('rrhh/asistencia', 'routes/rrhh.asistencia.tsx'),

    // Flota
    route('flota', 'routes/flota.tsx'),
    route('flota/:id', 'routes/flota.$id.tsx'),

    // Usuarios
    route('usuarios', 'routes/usuarios.tsx'),
    route('usuarios/roles', 'routes/usuarios.roles.tsx'),

    // Admin (SuperAdmin only)
    route('admin', 'routes/admin.tsx'),
    route('admin/organizaciones', 'routes/admin.organizaciones.tsx'),
  ]),

  // Catch-all 404
  route('*', 'routes/$.tsx'),
] satisfies RouteConfig
```

---

## Estructura de Carpetas por Módulo

```
src/
├── features/
│   ├── auth/
│   │   ├── components/     (LoginForm, OAuthButton)
│   │   ├── hooks/          (useAuth, useSession)
│   │   └── types.ts
│   ├── dashboard/
│   │   ├── components/     (KpiCard, TrendChart, AlertFeed)
│   │   ├── hooks/          (useDashboardRealtime)
│   │   └── types.ts
│   ├── almacenes/
│   │   ├── components/     (WarehousesContent, Warehouse3DScene, RackModel)
│   │   ├── hooks/          (useWarehouseRealtime)
│   │   ├── actions/        (warehouse-actions.ts)
│   │   └── types.ts
│   ├── compras/
│   ├── finance/
│   ├── rrhh/
│   ├── flota/
│   ├── usuarios/
│   ├── ai/
│   ├── command-center/
│   └── admin/
├── components/
│   ├── ui/                 (shadcn/ui base)
│   ├── layout/             (Sidebar, Topbar, MainLayout)
│   └── shared/             (DataTable, Charts, EmptyState)
├── lib/
│   ├── supabase/           (Clients: server + browser)
│   ├── store/              (Zustand stores)
│   └── utils/              (formatDate, cn, currency)
└── types/                  (Database types, global)
```
