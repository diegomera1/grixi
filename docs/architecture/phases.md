# Grixi — Plan de Fases

> Cada fase es un bloque de desarrollo independiente.
> Cada una debe quedar 100% funcional antes de avanzar a la siguiente.

---

## Fase 0: Fundación (Repo + Docs + Brand)

**Duración estimada:** 1 sesión
**Objetivo:** Tener el repo, docs, assets y configuraciones base listas.

### Tareas

- [x] Crear repo en GitHub (`diegomera1/grixi`)
- [x] Crear `gemini.md` con reglas del proyecto
- [x] Documentar arquitectura (`docs/architecture/`)
- [x] Documentar esquema de base de datos
- [x] Documentar design system
- [x] Documentar fases del proyecto
- [ ] Generar logo (claro + oscuro) e icono con IA
- [ ] Crear libro de marca (`docs/brand/`)
- [ ] Hacer commit inicial y push

---

## Fase 1: Monorepo + Infraestructura

**Duración estimada:** 1 sesión
**Objetivo:** Next.js funcionando con Supabase, auth y layout base.

### Tareas

- [ ] Inicializar monorepo con Turborepo + Next.js 16
- [ ] Configurar TypeScript strict, ESLint, Prettier
- [ ] Instalar Tailwind CSS 4 + design tokens en `globals.css`
- [ ] Instalar y configurar shadcn/ui (components base)
- [ ] Configurar Supabase client (browser + server + middleware)
- [ ] Configurar Google OAuth en Supabase
  - [ ] Crear proyecto en Google Cloud Console
  - [ ] Configurar OAuth consent screen
  - [ ] Obtener Client ID + Secret
  - [ ] Configurar en Supabase Dashboard → Auth → Providers
- [ ] Implementar auth flow (login, logout, session)
- [ ] Crear layout base: Sidebar + Topbar + Theme toggle
- [ ] Configurar `next-themes` (dark mode)
- [ ] Configurar variables de entorno (`.env.local`)
- [ ] Deploy inicial a Vercel
- [ ] Primer commit

---

## Fase 2: Landing Page

**Duración estimada:** 1 sesión
**Objetivo:** Landing page MetaLab-inspired con login Google.

### Tareas

- [ ] Instalar Lenis (smooth scroll) + GSAP (ScrollTrigger)
- [ ] Hero section: Tipografía Instrument Serif + animación
- [ ] Propuesta de valor: 3 pilares con SVG animados
- [ ] Showcase de módulos: screenshots/mockups
- [ ] Sección de tecnología: badges (OrioleDB, Supabase, Gemini, etc.)
- [ ] CTA con botón "Iniciar con Google"
- [ ] Footer con links y branding
- [ ] Transiciones de tema al scrollear (light ↔ dark)
- [ ] Generar imágenes con IA para secciones
- [ ] Responsive: mobile, tablet, desktop

---

## Fase 3: Base de Datos + Seed Data

**Duración estimada:** 1 sesión
**Objetivo:** Todas las tablas creadas con RLS y datos dummy cargados.

### Tareas

- [ ] Crear migrations SQL para las 18 tablas
- [ ] Configurar RLS en todas las tablas
- [ ] Crear funciones SQL (RPCs) necesarias
- [ ] Crear indexes de rendimiento
- [ ] Generar seed data:
  - [ ] 2 organizaciones (tenants)
  - [ ] 50+ usuarios con fotos reales (randomuser.me)
  - [ ] Roles y permisos para cada org
  - [ ] 3 almacenes con racks y posiciones
  - [ ] 400+ productos con datos tipo SAP
  - [ ] 800+ registros de inventario
  - [ ] Movimientos de inventario
  - [ ] 5000+ registros de audit/tracking
- [ ] Generar TypeScript types desde Supabase

---

## Fase 4: Módulo de Usuarios

**Duración estimada:** 1-2 sesiones
**Objetivo:** CRUD completo de usuarios con roles y permisos dinámicos.

### Tareas

- [ ] Página `/usuarios`: DataTable con todos los usuarios
  - [ ] Filtros por departamento, rol, estado
  - [ ] Búsqueda por nombre/email
  - [ ] Paginación server-side
- [ ] Página `/usuarios/[id]`: Perfil detallado
  - [ ] Info personal (foto Google, nombre, email)
  - [ ] Datos de empresa (departamento, posición)
  - [ ] Roles asignados con badges
  - [ ] Historial de actividad reciente
- [ ] Página `/usuarios/roles`: Gestión de RBAC
  - [ ] Lista de roles del tenant
  - [ ] Crear/editar roles
  - [ ] Asignar permisos por módulo y acción
  - [ ] Asignar roles a usuarios
- [ ] Middleware de permisos (protección de rutas)

---

## Fase 5: Módulo de Administración y Auditoría

**Duración estimada:** 2 sesiones
**Objetivo:** Tracking completo, dashboards, cierre remoto.

### Tareas

- [ ] **Tracking de clicks:**
  - [ ] Client-side tracker (cada click, page view)
  - [ ] Batch insert a Supabase (cada 5s o 10 eventos)
  - [ ] Tabla `activity_tracking` con toda la info
- [ ] **Audit logs:**
  - [ ] Triggers en PostgreSQL para INSERT/UPDATE/DELETE
  - [ ] Tabla `audit_logs` con old_data/new_data
- [ ] **Sesiones activas:**
  - [ ] Heartbeat cada 30s (Supabase Realtime)
  - [ ] Lista de sesiones activas en tiempo real
  - [ ] Botón "Cerrar sesión" remoto
  - [ ] Supabase Realtime: broadcast cuando se cierra sesión
- [ ] **Dashboards:**
  - [ ] KPIs: sesiones hoy, acciones/hora, usuarios activos
  - [ ] Gráficos: actividad por hora, páginas más visitadas
  - [ ] Timeline de acciones de un usuario específico
  - [ ] Pre-llenado con datos dummy
- [ ] **AI Audit (Gemini):**
  - [ ] Análisis de patrones de uso
  - [ ] Detección de anomalías
  - [ ] Resumen inteligente de actividad

---

## Fase 6: Módulo de Almacenes (Warehouse)

**Duración estimada:** 3 sesiones
**Objetivo:** Vista 2D + 3D de almacenes con IA integrada.

### Tareas

- [ ] **Vista general:** `/almacenes`
  - [ ] Cards de 3 almacenes con stats
  - [ ] KPIs: ocupación, productos, alertas
- [ ] **Vista 2D:** `/almacenes/[id]`
  - [ ] Grid de racks con colores por estado
  - [ ] Click en rack → detalle de posiciones
  - [ ] Filtros por estado, producto, fecha
  - [ ] Leyenda de colores
- [ ] **Vista 3D:** `/almacenes/[id]?view=3d`
  - [ ] React Three Fiber con OrbitControls
  - [ ] Racks renderizados en 3D con posiciones
  - [ ] Raycast: click en rack → tooltip con info
  - [ ] Colores por estado (same as 2D)
  - [ ] Toggle 2D ↔ 3D con botón
  - [ ] Lighting, shadows, ambient occlusion
- [ ] **Tiempo real:**
  - [ ] Supabase Realtime subscriptions en inventory
  - [ ] Botón "Simular cambios" que mueve productos
  - [ ] Cambios reflejados en 2D y 3D en vivo
- [ ] **Detalle de rack:**
  - [ ] Todas las posiciones con productos
  - [ ] Lotes, fechas, cantidades
  - [ ] Estado de cada posición
- [ ] **Movimientos:**
  - [ ] Historial de entradas/salidas
  - [ ] Filtros por producto, fecha, tipo

---

## Fase 7: Integración de IA (Gemini)

**Duración estimada:** 2 sesiones
**Objetivo:** Chat interactivo con Gemini que controla la UI.

### Tareas

- [ ] **Service layer:**
  - [ ] Server Action para llamadas a Gemini 3.1 Flash Lite
  - [ ] Streaming de respuestas
  - [ ] Rate limiting y caching
- [ ] **Chat flotante:**
  - [ ] Panel lateral deslizable
  - [ ] Historial de conversaciones
  - [ ] Context-aware (sabe en qué módulo estás)
- [ ] **Function calling:**
  - [ ] `show_rack(rack_code)` → navega al rack
  - [ ] `get_warehouse_stats(warehouse_id)` → muestra stats
  - [ ] `get_user_activity(user_id)` → muestra timeline
  - [ ] `filter_inventory(params)` → aplica filtros
- [ ] **Warehouse AI:**
  - [ ] Análisis de ocupación y sugerencias
  - [ ] Alertas de productos por vencer
  - [ ] Optimización de distribución
- [ ] **Audit AI:**
  - [ ] Patrones de acceso inusuales
  - [ ] Resumen diario de actividad
  - [ ] Detección de anomalías

---

## Resumen de Entregas por Fase

| Fase | Entregable               | Prioridad     |
| ---- | ------------------------ | ------------- |
| 0    | Repo + Docs + Brand      | 🔴 Crítica    |
| 1    | Monorepo + Auth + Layout | 🔴 Crítica    |
| 2    | Landing Page             | 🟡 Alta       |
| 3    | DB Schema + Seed         | 🔴 Crítica    |
| 4    | Módulo Usuarios          | 🟡 Alta       |
| 5    | Módulo Admin/Audit       | 🟡 Alta       |
| 6    | Módulo Warehouse 2D/3D   | 🟠 Media-Alta |
| 7    | AI Chat / Gemini         | 🟠 Media-Alta |
