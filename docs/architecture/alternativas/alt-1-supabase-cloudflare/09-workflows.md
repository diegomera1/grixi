# Alternativa 1 — Workflows: Desarrollo, Demo y Producción

> Flujos de trabajo completos para los 3 actores principales de GRIXI:
> **Desarrollador**, **Comercial** y **Usuario Final (Empresa)**.
>
> Arquitectura: React Router v7 + Vite 8 + Cloudflare Workers + Supabase.
> Última actualización: 21 de marzo, 2026.

---

## 1. Workflow del Desarrollador

### 1.1 Flujo Completo: Nueva Feature

```
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │                       WORKFLOW DEL DESARROLLADOR                             │
 │                                                                              │
 │  1. Ticket ──→ 2. Branch ──→ 3. Develop ──→ 4. Preview ──→ 5. PR           │
 │                                                                              │
 │     Jira        GitHub +         Local         Cloudflare     GitHub         │
 │                 Supabase         Vite 8        Workers +      Review         │
 │                 Branch           + HMR         Supabase       + CI           │
 │                 (DB aislada)                   Branch                        │
 │                                                                              │
 │  6. Review ──→ 7. Merge ──→ 8. Deploy Prod ──→ 9. Monitor                  │
 │                                                                              │
 │     Equipo      main +         Cloudflare       CF Analytics                │
 │     prueba      Supabase       Workers +        + Sentry                    │
 │     preview     merge          Supabase Prod    + Supabase                  │
 │                 migrations                      Dashboard                   │
 └──────────────────────────────────────────────────────────────────────────────┘

  PARALELISMO DE BRANCHES:
  ┌──────────────────────────────────────────────────┐
  │  Git Branch                Supabase Branch       │
  │  ──────────                ───────────────       │
  │  main  ──────────────────→ Production (main)    │
  │  develop ────────────────→ develop (persistent)  │
  │  feature/flota-mgmt ─────→ Preview Branch        │
  │  feature/compras-v2 ─────→ Preview Branch        │
  │  hotfix/critical ────────→ Preview Branch        │
  └──────────────────────────────────────────────────┘
```

### 1.2 Paso a Paso

#### Paso 1: Ticket en Jira
```
Jira Board (GRIXI)
  └── Sprint actual
        └── GRIXI-142: "Add fleet management module"
              ├── Tipo: Feature
              ├── Prioridad: High
              ├── Asignado: dev@grixi.com
              └── Estado: In Progress
```

#### Paso 2: Crear Branch (Git + Supabase)

```bash
# Desde la rama develop
git checkout develop
git pull origin develop
git checkout -b feature/flota-management

# Convención: feature/[módulo]-[feature]
# Ejemplos:
#   feature/almacenes-3d
#   feature/compras-dashboard
#   fix/auth-session-refresh
#   hotfix/critical-rls-fix
```

**Supabase Branching 2.0 — Branch automática:**

Al crear un PR (o manualmente), Supabase crea una **branch de base de datos aislada**:

```
git push origin feature/flota-management
  ↓
GitHub PR abierto
  ↓
Supabase detecta el PR → Crea automáticamente:
  ├── DB branch: copia completa del schema de producción
  ├── Auth: instancia de auth separada
  ├── PostgREST: API REST propia
  ├── Realtime: canal propio
  └── URL única: https://[branch-ref].supabase.co

Resultado:
  ├── Git branch:     feature/flota-management
  ├── Supabase branch: feature-flota-management (DB aislada)
  ├── Worker preview:  abc123.grixi.workers.dev
  └── Cada uno conectado entre sí → entorno completo aislado
```

> [!IMPORTANT]
> **Aislamiento total:** La branch de Supabase tiene su propia DB, Auth, y API. Puedes correr migraciones, modificar tablas, insertar datos de prueba — **nada afecta a producción**. Los datos de producción NO se copian (solo el schema + migraciones).

#### Paso 3: Desarrollo Local

```bash
# Instalar dependencias
pnpm install

# Dev server con Vite 8 (Rolldown) + Cloudflare Workers local
pnpm dev
# → http://localhost:5173
# → HMR instantáneo (~50ms React Refresh via Oxc)
# → Cloudflare Workers runtime simulado (miniflare)
# → Workers KV, R2, Hyperdrive disponibles en local
# → Conectado a la Supabase Branch (no producción)
```

**Conexión local → Supabase Branch:**
```bash
# .dev.vars apunta a la branch, NO a producción
SUPABASE_URL=https://[branch-ref].supabase.co      # ← URL del branch
SUPABASE_ANON_KEY=eyJ...                            # ← Key del branch

# En desarrollo, trabajas contra una DB aislada:
# - Puedes romper cosas sin miedo
# - Los datos de prueba no contaminan producción
# - Las migraciones se prueban antes de merge
```

**Estructura de una nueva feature:**
```
src/features/flota/
├── components/
│   ├── fleet-content.tsx       ← Componente principal
│   ├── vehicle-card.tsx        ← Subcomponentes
│   └── maintenance-table.tsx
├── hooks/
│   └── use-fleet-realtime.ts   ← Hook de Supabase Realtime
├── actions/
│   └── fleet-actions.ts        ← Server actions (mutations)
├── utils/
│   └── fleet-helpers.ts
└── types.ts                    ← Types del módulo

app/routes/
├── flota.tsx                   ← Layout + Loader (data fetching)
├── flota._index.tsx            ← Lista de vehículos (/)
└── flota.$id.tsx               ← Detalle de vehículo (/:id)
```

**Ejemplo de desarrollo de una ruta:**
```typescript
// app/routes/flota.tsx
import type { Route } from './+types/flota'
import { createSupabaseServerClient } from '~/lib/supabase/client.server'

// 1. Loader: fetch datos en el server (SSR)
export async function loader({ request, context }: Route.LoaderArgs) {
  const supabase = createSupabaseServerClient(request, context.cloudflare.env)
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*, maintenance_orders(count)')
    .order('name')
  return { vehicles }
}

// 2. Meta: SEO
export function meta() {
  return [
    { title: 'Flota — GRIXI' },
    { name: 'description', content: 'Gestión de flota vehicular' },
  ]
}

// 3. Componente: renderiza con datos del loader
export default function FlotaPage({ loaderData }: Route.ComponentProps) {
  return <FleetContent vehicles={loaderData.vehicles} />
}

// 4. Error boundary: manejo de errores por ruta
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ErrorCard message={error.message} />
}
```

**Base de datos (migraciones en la Supabase Branch):**

Todas las migraciones se crean y prueban en la **branch de Supabase**, nunca directamente en producción:

```bash
# SIEMPRE incluir: organization_id, RLS, índices

# Opción A: Supabase Dashboard del branch → SQL Editor
#   → El dashboard del branch es independiente del de producción

# Opción B: Supabase MCP → apply_migration (contra el branch)
#   → Las migraciones se registran y se aplican al merge

# Opción C: Drizzle Kit → drizzle-kit generate + push
#   → Conectado a la URL del branch
```

**Ejemplo: crear tabla `vehicles` en el branch:**
```sql
-- Esta migración se ejecuta en la Supabase Branch, NO en producción
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plate TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'truck',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vehicles_org ON vehicles(organization_id);
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON vehicles FOR ALL USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);
```

> La migración queda registrada en el branch. Al hacer merge a main, Supabase aplica automáticamente esta migración a producción.

**Variables de entorno locales:**
```bash
# .dev.vars (Cloudflare Workers local env)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIza...
```

#### Paso 4: Preview Deployment (Automático — Frontend + Backend)

```
git push origin feature/flota-management
  ↓
┌─────────────────────────────────────────────────────────────┐
│              SE DISPARAN 2 PROCESOS EN PARALELO              │
│                                                               │
│  FRONTEND (GitHub Actions)       BACKEND (Supabase)           │
│  ─────────────────────           ────────────────              │
│  1. pnpm install                 1. Detecta PR en GitHub      │
│  2. pnpm typecheck               2. Crea/actualiza branch DB │
│  3. pnpm lint                    3. Aplica migraciones        │
│  4. pnpm build (Vite 8, ~5-10s)  4. Genera nueva URL          │
│  5. wrangler versions upload     5. PostgREST + Auth listos   │
│                                                               │
│  Resultado:                      Resultado:                   │
│  abc123.grixi.workers.dev        [branch-ref].supabase.co     │
│  (Worker preview)                (DB branch aislada)           │
│                                                               │
│  El Worker preview apunta automáticamente                     │
│  a la Supabase Branch → entorno completo aislado              │
└─────────────────────────────────────────────────────────────┘
  ↓
Bot comenta en el PR:
  🚀 Preview Frontend: https://abc123.grixi.workers.dev
  🗄️ Supabase Branch: feature-flota-management (DB aislada)
  📊 Branch Dashboard: https://supabase.com/dashboard/project/[branch-ref]
```

**El equipo puede probar la feature completa (UI + DB + Auth + Realtime) sin tocar producción.**

> [!NOTE]
> **¿Qué incluye la Supabase Branch?**
> - ✅ Schema completo (todas las tablas, RLS, funciones, triggers)
> - ✅ Migraciones nuevas de esta feature aplicadas
> - ✅ Auth independiente (se puede crear usuarios de prueba)
> - ✅ PostgREST API propia
> - ✅ Realtime propio
> - ❌ Datos de producción (NO se copian — branch vacía)
> - ❌ Storage (usa seed data para pruebas)

#### Paso 5: Pull Request

```markdown
## PR: feat(flota): add fleet management module

### Cambios
- Nueva ruta `/flota` con lista de vehículos
- CRUD completo con loaders/actions
- Supabase Realtime para actualizaciones en vivo
- Tabla `vehicles` con RLS multi-tenant

### Preview
🔗 Frontend: https://abc123.grixi.workers.dev/flota
🗄️ Supabase Branch: feature-flota-management

### Migraciones incluidas
- `001_create_vehicles_table.sql` — tabla + RLS + índices
- `002_add_vehicle_maintenance.sql` — tabla de mantenimiento

### Checklist
- [x] TypeScript strict — sin errores
- [x] RLS habilitado en nuevas tablas
- [x] organization_id en todas las tablas
- [x] Índices en columnas de filtro
- [x] Migraciones probadas en Supabase Branch
- [x] Zod validation (client + server)
- [x] Responsive (mobile + desktop)
- [x] Error boundaries
```

#### Paso 6: Code Review
- Reviewer abre el **preview deployment** en su browser → prueba la feature completa
- El preview apunta a la **Supabase Branch** → datos aislados, sin riesgo
- Revisa código + migraciones SQL en GitHub
- Aprueba o pide cambios

#### Paso 7: Merge a main (Frontend + Backend simultáneo)

```
Reviewer aprueba PR → Click "Merge"
  ↓
┌─────────────────────────────────────────────────────────────┐
│             SE DISPARAN 2 PROCESOS EN PARALELO               │
│                                                               │
│  FRONTEND (GitHub Actions)       BACKEND (Supabase)           │
│  ─────────────────────           ────────────────              │
│  1. Merge código a main          1. Detecta merge del PR      │
│  2. pnpm build (Vite 8)          2. Aplica migraciones        │
│  3. wrangler deploy              │  del branch → producción   │
│     → 310+ PoPs                  3. Copia Edge Functions      │
│                                  4. Elimina branch DB         │
│                                     (cleanup automático)      │
└─────────────────────────────────────────────────────────────┘
  ↓
Producción actualizada:
  ├── Workers: nueva versión del frontend (~30-60s)
  ├── Supabase: migraciones aplicadas a la DB de producción
  └── app.grixi.com + *.grixi.app → todo actualizado
```

> [!IMPORTANT]
> **Las migraciones son atómicas.** Supabase aplica todas las migraciones del branch de una vez. Si una falla, ninguna se aplica. No hay estado intermedio roto.

#### Paso 8: Verificación Post-Deploy

```
Post-merge automático:
  ├── Frontend: Worker desplegado en 310+ PoPs globales
  ├── Backend: Migraciones aplicadas en PostgreSQL producción
  ├── Supabase Branch: eliminada automáticamente (cleanup)
  └── Preview URL: ya no existe (404)

Verificación:
  ├── Cloudflare Analytics: ¿requests normales? ¿errores nuevos?
  ├── Sentry: ¿excepciones nuevas?
  ├── Supabase Dashboard: ¿queries normales? ¿migraciones OK?
  └── wrangler tail: logs en tiempo real si se necesita debug
```

#### Paso 9: Monitoreo + Rollback

| Herramienta | Qué revisar |
|---|---|
| **Cloudflare Analytics** | Requests, errors, latencia, CPU time |
| **Sentry** | Errores JavaScript, crashes, stack traces |
| **Supabase Dashboard** | Queries lentas, RLS violations, migraciones |
| **wrangler tail** | Logs en tiempo real del Worker |

```bash
# Monitoreo en tiempo real post-deploy
wrangler tail --format pretty

# Si algo falla en el frontend → rollback instantáneo del Worker
wrangler versions rollback <version-id>

# Si algo falla en la DB → revertir migración
# Opción A: nueva migración que revierte los cambios
# Opción B: Supabase PITR (Point-in-Time Recovery) si es crítico
```

### 1.3 Mapa de Branches: Git ↔ Supabase ↔ Cloudflare

```
 ┌────────────────────────────────────────────────────────────────────┐
 │               MAPA COMPLETO DE ENVIRONMENTS                        │
 │                                                                    │
 │  Git Branch         Supabase Branch        Cloudflare Worker       │
 │  ──────────         ───────────────        ─────────────────       │
 │  main ────────────→ Production (main) ───→ grixi (production)     │
 │                     • DB producción        • app.grixi.com         │
 │                     • Datos reales         • *.grixi.app           │
 │                                                                    │
 │  develop ─────────→ develop (persistent) → grixi-staging           │
 │                     • Copia de schema      • staging.grixi.app     │
 │                     • Datos de staging     • Pruebas internas      │
 │                                                                    │
 │  feature/flota ───→ Preview Branch ──────→ abc123.workers.dev     │
 │                     • Schema + migraciones  • Preview temporal     │
 │                     • DB vacía (seed)       • Se elimina al merge  │
 │                     • Auth independiente                           │
 │                                                                    │
 │  feature/compras → Preview Branch ──────→ def456.workers.dev      │
 │                     • Otro branch aislado   • Otro preview         │
 │                     • No interfiere con     • Paralelo             │
 │                       el branch de flota                           │
 └────────────────────────────────────────────────────────────────────┘

 💡 Múltiples devs pueden trabajar en features paralelas.
    Cada uno tiene su propia DB + Worker. Sin conflictos.
```

---

## 2. Workflow Comercial (Demo para Empresas)

### 2.1 Flujo Completo: Demo a un Prospecto

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    WORKFLOW COMERCIAL (DEMO)                           │
 │                                                                        │
 │  1. Preparar     2. Tenant      3. Datos       4. Presentar           │
 │     Demo            Demo           Demo           Demo                │
 │                                                                        │
 │  Jira/CRM →     Supabase →     Seed data →    empresa-demo.grixi.app │
 │  contactar       crear org      poblar con       + screenshare        │
 │  prospecto       + usuario      datos reales     + walk-through       │
 │                                                                        │
 │  5. Seguimiento  6. Onboarding  7. Go Live                            │
 │                                                                        │
 │  Propuesta →     Crear tenant → empresa.grixi.app                     │
 │  negociación     real + users   producción                            │
 └────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Paso a Paso

#### Paso 1: Preparar la Demo

El comercial tiene acceso a un **tenant de demostración** permanente:

```
🌐 demo.grixi.app          ← Tenant de demos genérico
🌐 empresa-x.grixi.app     ← Tenant personalizado para prospecto específico
```

**El comercial NO necesita conocimientos técnicos.** Todo se gestiona desde el panel SuperAdmin de GRIXI.

#### Paso 2: Crear Tenant de Demo (Panel SuperAdmin)

```
app.grixi.com (SuperAdmin) → Organizaciones → + Nueva Organización

  Nombre:    "Empresa X S.A."
  Slug:      empresa-x          → empresa-x.grixi.app
  Plan:      demo                → módulos completos, sin límite de tiempo
  Branding:
    Logo:    [subir logo del prospecto]
    Color:   #1E40AF (azul corporativo del prospecto)
  Módulos:   ✅ Dashboard  ✅ Almacenes  ✅ Compras  ✅ Finanzas  ✅ RRHH  ✅ AI
```

**Resultado:** En 2 minutos el comercial tiene `empresa-x.grixi.app` funcionando con el branding del prospecto.

#### Paso 3: Poblar con Datos de Demo

Dos opciones:

**Opción A: Datos seed automáticos (recomendada)**
```
SuperAdmin → Organización "Empresa X" → Acciones → Poblar datos de demo
  ↓
Script genera automáticamente:
  • 3 almacenes con racks y productos
  • 50 órdenes de compra
  • 20 proveedores
  • Dashboard con KPIs realistas
  • Historial de 6 meses (gráficos)
```

**Opción B: Datos personalizados**
```
El comercial sube un Excel con datos reales del prospecto:
  • Lista de productos
  • Proveedores actuales
  • Estructura de almacenes
  ↓
GRIXI importa y genera dashboards con los datos reales del prospecto
```

#### Paso 4: Presentar la Demo

```
Reunión (Google Meet / presencial)
  │
  ├── 1. Abrir empresa-x.grixi.app (con logo y colores del prospecto)
  │     → "Esto es su plataforma personalizada"
  │
  ├── 2. Dashboard → KPIs en tiempo real con SUS datos
  │     → "Aquí verían sus indicadores clave"
  │
  ├── 3. Almacenes → Vista 3D interactiva
  │     → "Pueden ver la ocupación en tiempo real"
  │     → Demostrar fly-through 3D
  │
  ├── 4. Compras → Órdenes de compra + proveedores
  │     → "Todo integrado con su ERP/SAP"
  │
  ├── 5. GRIXI AI → Hacer preguntas al chat
  │     → "¿Cuánto gastamos en el último trimestre?"
  │     → AI responde con datos del dashboard
  │
  ├── 6. Mobile → Abrir desde el celular
  │     → "Funciona en cualquier dispositivo"
  │
  └── 7. Multi-tenant → Explicar aislamiento de datos
        → "Sus datos están completamente separados"
        → "Nadie más puede ver su información"
```

#### Paso 5: Seguimiento Post-Demo

```
CRM / Jira:
  └── Oportunidad: "Empresa X S.A."
        ├── Estado: Propuesta enviada
        ├── Monto: $X/mes
        ├── Demo URL: empresa-x.grixi.app (sigue activa)
        └── Decisión esperada: 2 semanas
```

**El tenant de demo sigue activo** para que el prospecto pueda explorar por su cuenta. Tiene un banner "Modo Demo" para diferenciarlo de producción.

#### Paso 6: Onboarding (Cliente Nuevo)

```
Cliente firma contrato
  ↓
SuperAdmin convierte tenant demo → producción:
  1. Cambiar plan: demo → professional
  2. Limpiar datos de demo (o mantener si eran reales)
  3. Crear usuarios reales:
     - admin@empresa-x.com (Owner)
     - bodeguero@empresa-x.com (Member)
     - gerente@empresa-x.com (Viewer)
  4. Configurar integraciones (SAP, Google Workspace)
  5. Dominio custom (opcional): app.empresa-x.com
  ↓
Invitaciones por email (via Resend):
  "Has sido invitado a GRIXI por Empresa X S.A."
  → Click → Google OAuth → acceso inmediato
```

#### Paso 7: Go Live
```
empresa-x.grixi.app → Producción
  ├── Datos reales sincronizados
  ├── Usuarios con roles configurados
  ├── Supabase Realtime activo
  └── RLS aísla datos automáticamente
```

---

## 3. Workflow del Usuario Final (Empresa)

### 3.1 Flujo Completo: Día a Día del Usuario

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                WORKFLOW DEL USUARIO FINAL (EMPRESA)                    │
 │                                                                        │
 │  1. Login        2. Dashboard    3. Módulos     4. AI Assistant       │
 │                                                                        │
 │  Google OAuth →  KPIs en vivo →  Almacenes →    "¿Cuánto             │
 │  o email/pass    gráficos        Compras        gastamos este         │
 │                  alertas         Finanzas        mes?"                 │
 │                                  RRHH                                  │
 │                                                                        │
 │  5. Realtime     6. Mobile       7. Reportes    8. Notificaciones     │
 │                                                                        │
 │  Cambios en      Responsive →    PDF + Excel    Alertas email +       │
 │  tiempo real     misma URL       automáticos    in-app                │
 └────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Paso a Paso

#### Paso 1: Login

```
Usuario abre: empresa-x.grixi.app
  ↓
Pantalla de login con branding de "Empresa X S.A."
  (logo, colores corporativos)
  ↓
Opción A: "Continuar con Google" (recomendado — OAuth)
Opción B: Email + contraseña
Opción C: Magic Link (email sin contraseña)
  ↓
Supabase Auth valida → JWT con org_id del tenant
  ↓
Redirige al Dashboard
```

**Seguridad invisible para el usuario:**
```
Worker middleware:
  1. Verifica JWT → ¿sesión válida?
  2. Resuelve tenant → ¿usuario pertenece a esta org?
  3. RLS → PostgreSQL filtra datos automáticamente
  → El usuario SOLO ve datos de su empresa, sin configurar nada
```

#### Paso 2: Dashboard

```
empresa-x.grixi.app/dashboard
  │
  ├── Hero KPIs (SSR — llegan pre-renderizados)
  │   ├── 💰 Ventas del mes: $142,500
  │   ├── 📦 Ocupación almacén: 78%
  │   ├── 📋 Órdenes pendientes: 12
  │   └── 👥 Empleados activos: 45
  │
  ├── Gráficos (Recharts — hydration en client)
  │   ├── Tendencia de ventas (6 meses)
  │   ├── Top 5 productos por rotación
  │   └── Cash flow mensual
  │
  └── Alertas recientes (Supabase Realtime)
      ├── ⚠️ Stock bajo: "Producto X" < 10 unidades
      ├── ✅ OC #1234 aprobada
      └── 📥 Nuevo documento subido
```

#### Paso 3: Usar un Módulo (Ejemplo: Almacenes)

```
Sidebar → Almacenes
  ↓
empresa-x.grixi.app/almacenes
  │
  ├── Lista de almacenes (SSR — pre-renderizada)
  │   ├── Almacén Principal — 78% ocupado
  │   ├── Almacén Norte — 45% ocupado
  │   └── Bodega Temporal — 92% ocupado ⚠️
  │
  ├── Click en "Almacén Principal"
  │   ↓
  │   empresa-x.grixi.app/almacenes/abc123
  │   │
  │   ├── Vista 2D: Cards de racks con ocupación
  │   ├── Vista 3D: Modelo interactivo (React Three Fiber)
  │   │   ├── Navegar con mouse/teclado
  │   │   ├── Click en caja → detalle del producto
  │   │   ├── Fly-through mode (recorrido automático)
  │   │   └── Fullscreen toggle
  │   │
  │   └── Acciones:
  │       ├── Mover producto (drag & drop)
  │       ├── Registrar entrada/salida
  │       └── Generar reporte de ocupación
  │
  └── Realtime: Si otro usuario mueve un producto,
      la vista se actualiza automáticamente para todos
```

#### Paso 4: GRIXI AI Assistant

```
Click en el orb de GRIXI AI (esquina inferior derecha)
  ↓
Chat abierto con contexto del módulo actual:
  │
  │  Usuario: "¿Cuántos productos tenemos con stock menor a 10?"
  │
  │  GRIXI AI: "Tienen 8 productos con stock crítico:
  │   1. Válvula 3" (5 unidades) — Almacén Principal, Rack A3
  │   2. Empaque NBR (3 unidades) — Almacén Norte, Rack B1
  │   ..."
  │
  │  [Gráfico interactivo de stock crítico]
  │
  │  Usuario: "Genera una orden de compra para reabastecer"
  │
  │  GRIXI AI: "He preparado una OC con los 8 productos.
  │   ¿La envío al proveedor principal?"
  │   [Botón: Crear OC] [Botón: Editar primero]
  │
  └── AI Canvas: vista split con resultados a la derecha
```

#### Paso 5: Actualizaciones en Tiempo Real

```
Supabase Realtime → Todos los usuarios conectados ven cambios al instante

Escenario: Bodeguero registra entrada de mercadería
  ↓
  Bodeguero (mobile): Escanea QR → "50 unidades de Válvula 3" ingresadas
  ↓
  Inmediatamente:
    ├── Gerente (desktop): Dashboard KPI actualiza  78% → 82% ocupación
    ├── Compras (desktop): OC #1234 marca "Recibida"
    └── Almacén 3D: Caja aparece en el rack correspondiente
```

#### Paso 6: Mobile

```
El usuario abre empresa-x.grixi.app desde su celular
  ↓
La misma aplicación, responsive:
  ├── Sidebar → menú hamburguesa
  ├── Dashboard → KPIs apilados verticalmente
  ├── Tablas → scroll horizontal
  ├── 3D → touch controls (pinch zoom, drag rotate)
  └── AI → chat fullscreen

No hay app nativa — funciona como PWA:
  ├── "Agregar a pantalla de inicio"
  ├── Ícono en el home screen
  ├── Funciona offline (datos cacheados)
  └── Push notifications (futuro)
```

#### Paso 7: Reportes

```
Cualquier módulo → botón "Exportar"
  ├── PDF → Reporte formateado con logo de la empresa
  ├── Excel → Datos tabulares para análisis
  └── Programado → "Enviar este reporte cada lunes a las 8am"
        ↓
        Supabase Edge Function (cron) → genera PDF → envía por email (Resend)
```

#### Paso 8: Notificaciones

```
Configuración de alertas (por usuario):
  ├── Stock bajo (<10 unidades)      → Email + in-app
  ├── OC aprobada                    → In-app
  ├── Nuevo usuario agregado         → Email
  ├── Backup completado              → Email (solo admin)
  └── Medidas fuera de rango (SCADA) → Email + in-app urgente

Canales:
  ├── In-app: toast notification (Sonner) + badge en sidebar
  ├── Email: via Resend (transaccional, branded)
  └── Futuro: Push notifications (PWA)
```

---

## 4. Flujo por Rol de Usuario

### 4.1 Roles en GRIXI

| Rol | Permisos | Ejemplo |
|---|---|---|
| **SuperAdmin** | Todo — gestión de la plataforma, todos los tenants | Equipo GRIXI |
| **Owner** | Admin total de su empresa/tenant | Gerente General |
| **Admin** | Gestión de usuarios y módulos de su empresa | IT Manager |
| **Member** | Acceso a módulos asignados, CRUD de datos | Bodeguero, Comprador |
| **Viewer** | Solo lectura en módulos asignados | Auditor, Consultor |

### 4.2 Qué ve cada rol

```
SuperAdmin:
  └── app.grixi.com
        ├── Dashboard global (todas las empresas)
        ├── Gestión de organizaciones (crear, editar, suspender)
        ├── Gestión de planes y facturación
        ├── Logs de auditoría globales
        └── Configuración de plataforma

Owner/Admin de empresa:
  └── empresa-x.grixi.app
        ├── Dashboard de su empresa
        ├── Todos los módulos habilitados
        ├── Gestión de usuarios (invitar, roles, permisos)
        ├── Configuración de empresa (branding, integraciones)
        └── Reportes y exportaciones

Member:
  └── empresa-x.grixi.app
        ├── Dashboard (lectura)
        ├── Módulos asignados (CRUD)
        ├── GRIXI AI
        └── Notificaciones

Viewer:
  └── empresa-x.grixi.app
        ├── Dashboard (lectura)
        ├── Módulos asignados (solo lectura)
        └── Exportar reportes
```

---

## 5. Resumen Visual: Los 3 Workflows

```
┌─────────────────────────────────────────────────────────────────┐
│                        GRIXI PLATFORM                            │
│                                                                  │
│  DESARROLLADOR           COMERCIAL          USUARIO FINAL        │
│  ──────────────         ──────────────     ──────────────        │
│  Jira ticket            Preparar demo      Login (OAuth)         │
│       ↓                      ↓                  ↓                │
│  git branch +           Crear tenant       Dashboard             │
│  Supabase Branch        demo en            (SSR → datos          │
│  (DB aislada)           SuperAdmin         instantáneos)         │
│       ↓                      ↓                  ↓                │
│  Vite 8 dev →           Poblar datos       Módulos               │
│  Branch DB              de demo            (Almacenes 3D,        │
│  (HMR ~50ms)                ↓              Compras, etc.)        │
│       ↓                 Presentar               ↓                │
│  git push →             empresa-x.         GRIXI AI              │
│  Preview Worker +       grixi.app         ("¿Cuánto              │
│  Branch DB (paralelo)        ↓              gastamos?")           │
│       ↓                 Cliente firma           ↓                │
│  Code review                 ↓             Realtime              │
│  (prueba en preview)    Onboarding        (cambios en            │
│       ↓                 (demo → prod)      vivo)                 │
│  Merge → main                ↓                  ↓                │
│  Workers + DB           empresa-x.         Reportes              │
│  (migraciones           grixi.app          + Alertas             │
│   atómicas)             GO LIVE ✅         + Mobile              │
│       ↓                                                          │
│  Branch cleanup                                                  │
│  (automático)                                                    │
└─────────────────────────────────────────────────────────────────┘
```
