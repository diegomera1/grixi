# 16 — Sistema de Roles, Permisos y Control de Acceso

> Arquitectura completa del sistema multi-tenant de GRIXI para el control de acceso basado en roles (RBAC) con permisos granulares por módulo.

---

## 1. Visión General

GRIXI implementa un modelo de control de acceso de **3 capas**:

```
┌─────────────────────────────────────────────────────────┐
│                    CAPA 1: PLATAFORMA                   │
│              Platform Admins (Diego, Calixto)           │
│         Acceso total a TODAS las organizaciones         │
│         Crear/suspender orgs · Asignar planes           │
├─────────────────────────────────────────────────────────┤
│                 CAPA 2: ORGANIZACIÓN                    │
│          Owner / Admin / Roles Custom por Org           │
│     Gestionar usuarios · Crear roles · Configurar       │
├─────────────────────────────────────────────────────────┤
│                   CAPA 3: PERMISOS                      │
│       Catálogo UNIVERSAL de permisos granulares         │
│   Cada rol tiene un subset de permisos asignados        │
│   Los permisos disponibles dependen del plan/módulos    │
└─────────────────────────────────────────────────────────┘
```

### Principios Fundamentales

1. **Permisos universales:** El catálogo de permisos es GLOBAL y compartido por todas las orgs. Cada org asigna esos permisos a sus roles.
2. **Roles por organización:** Cada org puede crear roles custom ilimitados. Los 4 roles de sistema (`owner`, `admin`, `member`, `viewer`) se crean automáticamente.
3. **Multi-org:** Un usuario puede pertenecer a varias organizaciones con roles diferentes en cada una.
4. **Plan como limitador:** Los módulos habilitados por plan (`enabled_modules`) filtran qué permisos están disponibles para asignar en esa org.
5. **Platform Admin omnipresente:** Los Platform Admins tienen acceso total a todas las orgs, transparente, con registro en audit log.

---

## 2. Jerarquía de Actores

### 2.1 Platform Admin (Superadmin)

| Atributo | Detalle |
|----------|---------|
| **Tabla** | `platform_admins` |
| **Quiénes son** | Diego Mera, Calixto Saldarriaga |
| **Función SQL** | `is_platform_admin()` → consulta `platform_admins` |
| **Alcance** | Todas las organizaciones, todos los datos |

**¿Qué puede hacer?**

| Capacidad | Detalle |
|-----------|---------|
| ✅ Crear organizaciones | Nombre, slug, plan inicial, módulos, color |
| ✅ Suspender/reactivar orgs | Campo `status` en `organizations` |
| ✅ Cambiar plan de org | Starter → Professional → Enterprise |
| ✅ Ver dashboard global | KPIs de TODAS las orgs (usuarios, actividad, etc.) |
| ✅ Entrar a cualquier org | Ve EXACTAMENTE lo mismo que el Owner de esa org |
| ✅ Asignar Owner inicial | Al crear org, designa al primer Owner |
| ✅ Inyectar usuarios | Puede agregar usuarios directamente a cualquier org |
| ✅ Ver audit logs globales | De todas las orgs, sin restricción |
| ✅ Gestionar Platform Admins | Agregar/remover otros Platform Admins |
| ✅ Gestionar catálogo de permisos | Agregar nuevos permisos al catálogo global |

**¿Qué NO puede hacer?**

| Restricción | Razón |
|-------------|-------|
| ❌ Eliminarse a sí mismo como Platform Admin | Protección contra lockout |
| ❌ Eliminar una org con datos | Debe suspenderla primero, luego purge manual |

### 2.2 Organization Owner

| Atributo | Detalle |
|----------|---------|
| **Rol** | `owner` (is_system = true) |
| **Asignado por** | Platform Admin al crear la org |
| **Máximo por org** | 1-2 (configurable) |

**¿Qué puede hacer?**

| Capacidad | Detalle |
|-----------|---------|
| ✅ Todo dentro de SU org | Acceso completo a todos los módulos habilitados |
| ✅ Crear roles custom | Con permisos granulares del catálogo |
| ✅ Invitar usuarios | Via email, asignando un rol |
| ✅ Gestionar membresías | Cambiar roles, desactivar, reactivar usuarios |
| ✅ Configurar org | Nombre, logo, color, idioma |
| ✅ Ver audit logs | Solo de su organización |
| ✅ Promover Admin | Asignar el rol de admin a otro usuario |

**¿Qué NO puede hacer?**

| Restricción | Razón |
|-------------|-------|
| ❌ Cambiar su propio plan | Solo Platform Admin gestiona planes |
| ❌ Habilitar/deshabilitar módulos | Depende del plan, controlado por Platform Admin |
| ❌ Ver datos de otras orgs | RLS estricto por `organization_id` |
| ❌ Eliminarse como Owner | Debe transferir ownership primero |

### 2.3 Organization Admin

| Atributo | Detalle |
|----------|---------|
| **Rol** | `admin` (is_system = true) |
| **Asignado por** | Owner de la org |

**Mismo poder que Owner EXCEPTO:**

| Diferencia | Detalle |
|------------|---------|
| ❌ No puede degradar al Owner | Protección jerárquica |
| ❌ No puede eliminar la org | Solo el Owner puede solicitarlo |
| ❌ No puede promover a Owner | Solo el Owner actual o Platform Admin |
| ❌ No puede transferir ownership | Reservado al Owner |

### 2.4 Custom Roles

Cada organización puede crear roles custom ilimitados. Ejemplo:

```
Org "Acme Corp" podría tener:
├── owner (sistema)         → Todos los permisos
├── admin (sistema)         → Todos los permisos menos ownership
├── contador                → finance.view, finance.manage, dashboard.view
├── jefe_almacen            → warehouses.*, dashboard.view
├── comprador               → purchases.*, warehouses.view, dashboard.view
├── analista                → dashboard.view, finance.view (solo lectura)
├── member (sistema)        → Permisos base configurables
└── viewer (sistema)        → Solo *.view de módulos activos
```

### 2.5 Member & Viewer

| Rol | Permisos por defecto |
|-----|---------------------|
| `member` | `dashboard.view` + permisos que le asigne el Owner/Admin |
| `viewer` | Solo permisos `*.view` de los módulos habilitados |

---

## 3. Catálogo Universal de Permisos

### 3.1 Estructura del Permiso

Cada permiso tiene la forma: `modulo.accion`

```
{module}.{action}

Módulo:   dashboard, finanzas, almacenes, compras, rrhh, flota, ai, usuarios, reportes, admin
Acción:   view, create, edit, delete, manage, export, approve, configure
```

### 3.2 Catálogo Completo

> **IMPORTANTE:** Este catálogo es GLOBAL. Todas las organizaciones lo comparten. Lo que cambia es qué permisos están ASIGNADOS a cada rol dentro de cada org.

#### Dashboard
| Key | Descripción | Disponible desde |
|-----|------------|------------------|
| `dashboard.view` | Ver dashboard principal | Starter |
| `dashboard.export` | Exportar datos del dashboard | Professional |

#### Finanzas
| Key | Descripción | Disponible desde |
|-----|------------|------------------|
| `finance.view` | Ver módulo de finanzas | Starter |
| `finance.manage` | Crear/editar asientos contables | Professional |
| `finance.approve` | Aprobar movimientos financieros | Professional |
| `finance.export` | Exportar reportes financieros | Professional |
| `finance.configure` | Configurar cuentas y categorías | Enterprise |

#### Almacenes
| Key | Descripción | Disponible desde |
|-----|------------|------------------|
| `warehouses.view` | Ver almacenes e inventario | Professional |
| `warehouses.create` | Crear almacenes | Professional |
| `warehouses.edit` | Editar almacenes e inventario | Professional |
| `warehouses.delete` | Eliminar almacenes | Enterprise |
| `warehouses.3d` | Acceso a visualización 3D | Enterprise |
| `warehouses.export` | Exportar datos de almacén | Professional |

#### Compras
| Key | Descripción | Disponible desde |
|-----|------------|------------------|
| `purchases.view` | Ver órdenes de compra | Professional |
| `purchases.create` | Crear requisiciones y OC | Professional |
| `purchases.edit` | Editar órdenes de compra | Professional |
| `purchases.approve` | Aprobar órdenes de compra | Professional |
| `purchases.delete` | Eliminar órdenes | Enterprise |
| `purchases.export` | Exportar datos de compras | Professional |

#### Recursos Humanos
| Key | Descripción | Disponible desde |
|-----|------------|------------------|
| `hr.view` | Ver empleados y organigramas | Professional |
| `hr.manage` | Gestionar empleados | Professional |
| `hr.payroll` | Acceso a nómina | Enterprise |
| `hr.export` | Exportar datos RRHH | Professional |

#### Flota
| Key | Descripción | Disponible desde |
|-----|------------|------------------|
| `fleet.view` | Ver vehículos y rutas | Professional |
| `fleet.manage` | Gestionar flota | Professional |
| `fleet.export` | Exportar datos de flota | Professional |

#### AI (GRIXI AI)
| Key | Descripción | Disponible desde |
|-----|------------|------------------|
| `ai.chat` | Usar GRIXI AI | Professional |
| `ai.configure` | Configurar asistente AI | Enterprise |

#### Usuarios & Org
| Key | Descripción | Disponible desde |
|-----|------------|------------------|
| `users.view` | Ver lista de usuarios | Starter |
| `users.manage` | Invitar/editar/desactivar usuarios | Starter |
| `roles.manage` | Crear/editar roles y asignar permisos | Starter |
| `members.manage` | Gestionar membresías (asignar roles) | Starter |
| `org.configure` | Configurar la organización | Starter |

#### Reportes
| Key | Descripción | Disponible desde |
|-----|------------|------------------|
| `reports.view` | Ver reportes | Professional |
| `reports.create` | Crear reportes custom | Enterprise |
| `reports.export` | Exportar reportes | Professional |

#### Notificaciones
| Key | Descripción | Disponible desde |
|-----|------------|------------------|
| `notifications.view` | Ver notificaciones | Starter |
| `notifications.configure` | Configurar reglas de notificación | Professional |

#### Admin (Solo Platform Admins — acceso implícito, no asignable a roles de org)
| Key | Descripción | Solo para |
|-----|------------|-----------|
| `admin.orgs.manage` | CRUD de organizaciones | Platform Admin |
| `admin.orgs.suspend` | Suspender/reactivar orgs | Platform Admin |
| `admin.plans.manage` | Cambiar planes de orgs | Platform Admin |
| `admin.users.global` | Ver/gestionar usuarios globalmente | Platform Admin |
| `admin.audit.global` | Ver audit logs de todas las orgs | Platform Admin |
| `admin.permissions.manage` | Gestionar catálogo de permisos | Platform Admin |
| `admin.platform_admins.manage` | Gestionar Platform Admins | Platform Admin |

### 3.3 Permisos filtrados por Plan

```
Plan Starter:        dashboard.*, users.*, roles.*, members.*, org.*, notifications.view, finance.view
Plan Professional:   Todo de Starter + finance.*, warehouses.*, purchases.*, hr.*, fleet.*, ai.chat, reports.*, notifications.*
Plan Enterprise:     Todo de Professional + *.delete, *.configure, ai.configure, reports.create, warehouses.3d, hr.payroll
```

**Lógica:** Si un módulo NO está en `enabled_modules` de la org, sus permisos NO aparecen en el UI al crear/editar roles, aunque existan en el catálogo global.

---

## 4. Modelo de Datos

### 4.1 Diagrama ER

```
┌──────────────────┐     ┌──────────────────┐      ┌──────────────────┐
│  platform_admins │     │   organizations  │      │    permissions   │
│──────────────────│     │──────────────────│      │──────────────────│
│ user_id (FK)     │     │ id               │      │ id               │
│ granted_at       │     │ name             │      │ key (unique)     │
│ granted_by       │     │ slug (unique)    │      │ module           │
│ notes            │     │ status           │◄─┐   │ description      │
└──────────────────┘     │ settings (JSONB) │  │   │ min_plan         │
                         │   → plan         │  │   │ created_at       │
                         │   → modules[]    │  │   └────────┬─────────┘
                         │   → color        │  │            │
                         │   → logo         │  │            │
                         │   → lang         │  │            │
                         │ created_at       │  │            │
                         │ suspended_at     │  │            │
                         │ suspended_by     │  │            │
                         └────────┬─────────┘  │            │
                                  │            │            │
                    ┌─────────────┼────────────┘            │
                    │             │                         │
          ┌─────────▼────────┐   │   ┌────────────────────┐│
          │      roles       │   │   │  role_permissions   ││
          │──────────────────│   │   │────────────────────││
          │ id               │   │   │ id                 ││
          │ organization_id  │───┘   │ role_id (FK) ──────┘│
          │ name             │◄──────│ permission_id (FK) ─┘
          │ description      │       │ created_at          │
          │ is_system        │       └────────────────────┘
          │ is_default       │
          │ hierarchy_level  │
          │ created_at       │
          └────────┬─────────┘
                   │
          ┌────────▼─────────┐     ┌──────────────────┐
          │   memberships    │     │     profiles      │
          │──────────────────│     │──────────────────│
          │ id               │     │ id (= auth.uid)  │
          │ user_id (FK) ────│────►│ full_name        │
          │ organization_id  │     │ avatar_url       │
          │ role_id (FK)     │     │ phone            │
          │ status           │     │ preferred_lang   │
          │ joined_at        │     │ timezone         │
          │ deactivated_at   │     │ created_at       │
          │ deactivated_by   │     └──────────────────┘
          │ created_at       │
          └──────────────────┘

          ┌──────────────────┐
          │   invitations    │
          │──────────────────│
          │ id               │
          │ organization_id  │
          │ email            │
          │ role_id (FK)     │
          │ invited_by       │
          │ status           │   pending | accepted | expired | revoked
          │ token            │
          │ expires_at       │
          │ created_at       │
          └──────────────────┘

          ┌──────────────────┐
          │   audit_logs     │
          │──────────────────│
          │ id               │
          │ organization_id  │
          │ user_id          │
          │ action           │
          │ entity_type      │
          │ entity_id        │
          │ metadata (JSONB) │
          │ ip_address       │
          │ created_at       │
          └──────────────────┘
```

### 4.2 Campos Nuevos Requeridos

#### `organizations` — agregar:
```sql
status          TEXT DEFAULT 'active'    -- active | suspended | archived
suspended_at    TIMESTAMPTZ
suspended_by    UUID REFERENCES auth.users(id)
```

#### `roles` — agregar:
```sql
is_default       BOOLEAN DEFAULT false    -- ¿se asigna por defecto a nuevos miembros?
hierarchy_level  INTEGER DEFAULT 0        -- owner=100, admin=80, member=20, viewer=10, custom=50
```

#### `permissions` — agregar:
```sql
min_plan    TEXT DEFAULT 'starter'    -- starter | professional | enterprise
```

#### `memberships` — agregar:
```sql
deactivated_at   TIMESTAMPTZ
deactivated_by   UUID REFERENCES auth.users(id)
```

---

## 5. Flujos de Negocio

### 5.1 Crear Organización (Solo Platform Admin)

```
Platform Admin → /admin/organizations → "Crear Organización"
│
├── 1. Llenar formulario:
│   ├── Nombre: "Acme Corp"
│   ├── Slug: "acme" (auto-generado, editable)
│   ├── Plan: Starter | Professional | Enterprise
│   ├── Color primario: #3B82F6
│   └── Email del Owner inicial: owner@acme.com
│
├── 2. Backend (server action):
│   ├── INSERT INTO organizations (name, slug, settings)
│   ├── Crear 4 roles de sistema (owner, admin, member, viewer)
│   ├── Asignar permisos según plan a roles de sistema
│   ├── Buscar usuario por email en auth.users
│   │   ├── Si existe → crear membership con role=owner
│   │   └── Si no existe → crear invitation con role=owner
│   └── INSERT INTO audit_logs (action: 'organization.create')
│
└── 3. Resultado:
    ├── Org creada con status='active'
    ├── Owner asignado o invitado
    └── Audit log registrado
```

### 5.2 Invitar Usuario a Org (Owner/Admin de la org o Platform Admin)

```
Owner → /dashboard → Usuarios → "Invitar"
│
├── 1. Llenar formulario:
│   ├── Email: usuario@empresa.com
│   └── Rol: (selector de roles disponibles en la org)
│
├── 2. Backend:
│   ├── Verificar que el invitante tiene permiso `members.manage`
│   ├── Verificar que el email no es ya miembro activo
│   ├── INSERT INTO invitations (email, role_id, invited_by)
│   ├── Enviar email con link de invitación
│   └── Audit log: 'invitation.create'
│
├── 3. Usuario acepta invitación:
│   ├── Click en link → /auth/callback?token=xxx
│   ├── Si no tiene cuenta → OAuth con Google / magic link
│   ├── Si ya tiene cuenta → auto-login
│   ├── UPDATE invitations SET status='accepted'
│   ├── INSERT INTO memberships (user_id, org_id, role_id, status='active')
│   └── Audit log: 'membership.create'
│
└── 4. Resultado:
    └── Usuario es miembro activo de la org con el rol asignado
```

### 5.3 Crear Rol Custom (Owner/Admin con permiso `roles.manage`)

```
Admin → /dashboard → Roles → "Crear Rol"
│
├── 1. Llenar formulario:
│   ├── Nombre: "Contador"
│   ├── Descripción: "Acceso a módulo financiero"
│   └── Permisos: (checkboxes agrupados por módulo)
│       ├── ☑ dashboard.view
│       ├── ☑ finance.view
│       ├── ☑ finance.manage
│       ├── ☑ finance.export
│       ├── ☐ warehouses.view (deshabilitado si módulo no activo)
│       └── ...
│
├── 2. Backend:
│   ├── Verificar permiso `roles.manage`
│   ├── Verificar que los permisos seleccionados están dentro del plan
│   ├── INSERT INTO roles (name, org_id, is_system=false)
│   ├── INSERT INTO role_permissions (role_id, permission_id) x N
│   └── Audit log: 'role.create'
│
└── 3. Resultado:
    └── Rol disponible para asignar a miembros de la org
```

### 5.4 Suspender Organización (Solo Platform Admin)

```
Platform Admin → /admin/organizations → Acme → "Suspender"
│
├── 1. Confirmar acción (modal de confirmación)
│
├── 2. Backend:
│   ├── UPDATE organizations SET status='suspended', suspended_at=now(), suspended_by=uid
│   ├── Audit log: 'organization.suspend'
│   └── (Opcional) Enviar email de notificación al Owner
│
├── 3. Efecto inmediato:
│   ├── Usuarios de esa org NO pueden hacer login
│   ├── El middleware `authenticated.tsx` chequea org.status
│   ├── Si status='suspended' → redirect a /suspended
│   └── Los datos NO se eliminan
│
└── 4. Reactivar:
    ├── Platform Admin → "Reactivar"
    ├── UPDATE organizations SET status='active', suspended_at=NULL
    └── Usuarios pueden volver a acceder
```

### 5.5 Desactivar Usuario (sin eliminar)

```
Admin → Usuarios → "Desactivar"
│
├── Backend:
│   ├── UPDATE memberships SET status='inactive', deactivated_at=now(), deactivated_by=uid
│   ├── Audit log: 'membership.deactivate'
│   └── El usuario pierde acceso a esa org, pero su cuenta sigue existiendo
│
└── Reactivar:
    ├── Admin → "Reactivar"
    ├── UPDATE memberships SET status='active', deactivated_at=NULL
    └── El usuario recupera su rol y permisos anteriores
```

---

## 6. Seguridad — Enforcement en 3 Capas

### 6.1 Capa 1: Base de Datos (RLS)

**Principio:** Ningún dato sale de la DB sin pasar por RLS. El frontend NUNCA es la barrera de seguridad.

#### Funciones SQL Existentes (✅ ya implementadas)

```sql
-- ¿Es Platform Admin?
is_platform_admin() → Consulta platform_admins

-- ¿A qué orgs pertenece?
get_user_org_ids() → Retorna org_ids de memberships activas

-- ¿Qué org tiene activa en el JWT?
get_user_org_id() → Lee app_metadata.organization_id del JWT

-- ¿Tiene un permiso específico?
has_permission('finance.view') → Verifica role_permissions
```

#### Funciones Nuevas Requeridas

```sql
-- ¿Es Owner de la org actual?
is_org_owner() → Verifica que el rol del usuario en la org actual es 'owner'

-- ¿Es Admin o superior en la org actual?
is_org_admin_or_above() → Rol 'owner' o 'admin' en la org actual

-- ¿La org está activa?
is_org_active(org_uuid) → Verifica status='active' en organizations

-- ¿Tiene permiso en una org específica? (para multi-org)
has_permission_in_org(required_permission TEXT, org_uuid UUID)
```

#### Patrón RLS Estándar

```sql
-- Para cualquier tabla con organization_id:
CREATE POLICY "tenant_isolation" ON tabla
  USING (
    organization_id IN (SELECT get_user_org_ids())
    OR is_platform_admin()
  );

-- Para escritura con permiso específico:
CREATE POLICY "authorized_write" ON tabla
  FOR INSERT
  USING (
    (organization_id = get_user_org_id() AND has_permission('modulo.create'))
    OR is_platform_admin()
  );
```

### 6.2 Capa 2: Server-Side (Middleware / Loaders)

**Archivo:** `app/routes/authenticated.tsx` (layout route)

```typescript
// Pseudocódigo del loader
export async function loader({ request, context }) {
  const user = await getUser(request);
  if (!user) redirect('/login');

  const orgId = getOrgFromCookie(request);
  if (!orgId) redirect('/select-org');

  const org = await getOrg(orgId);
  
  // ← NUEVO: Verificar org activa
  if (org.status === 'suspended') redirect('/suspended');
  if (org.status === 'archived') redirect('/archived');
  
  const membership = await getMembership(user.id, orgId);
  
  // ← NUEVO: Verificar membresía activa
  if (!membership || membership.status !== 'active') {
    // Si es platform admin, acceso sin membresía
    if (!isPlatformAdmin) redirect('/unauthorized');
  }

  return { user, org, membership, permissions };
}
```

### 6.3 Capa 3: Frontend (UI Guards)

**Los guards de UI son para UX, NO para seguridad.** Si un usuario no tiene permiso, el botón no aparece. Pero incluso si manipula el DOM, la capa RLS bloquea la operación.

```tsx
// Hook: usePermission
function PermissionGate({ permission, children, fallback }) {
  const { permissions } = useOutletContext();
  if (!permissions.includes(permission)) return fallback || null;
  return children;
}

// Uso en componentes:
<PermissionGate permission="finance.manage">
  <Button>Crear Asiento</Button>
</PermissionGate>

// Rutas protegidas por permiso:
<Route
  path="finanzas"
  loader={({ context }) => {
    if (!context.permissions.includes('finance.view')) {
      throw redirect('/unauthorized');
    }
  }}
/>
```

---

## 7. Roles de Sistema — Permisos por Defecto

Cuando se crea una organización, los 4 roles de sistema se inicializan así:

### Owner (hierarchy_level = 100)

```
TODOS los permisos disponibles para el plan de la org.
No se le pueden quitar permisos. Es inmutable.
```

### Admin (hierarchy_level = 80)

```
TODOS los permisos EXCEPTO:
  ❌ No puede gestionar ownership
  ❌ No puede eliminar la organización
```

### Member (hierarchy_level = 20)

```
Permisos estándar por defecto:
  ✅ dashboard.view
  ✅ notifications.view
  ✅ (módulos).view según plan
  
El Owner/Admin puede personalizar estos permisos.
```

### Viewer (hierarchy_level = 10)

```
Solo permisos de lectura:
  ✅ dashboard.view
  ✅ Todos los *.view de módulos habilitados
  ❌ Ningún *.create, *.edit, *.delete, *.manage, *.approve
```

### Custom Roles (hierarchy_level = 50 por defecto)

```
El admin elige los permisos desde el catálogo.
Solo puede asignar permisos que estén dentro del plan.
hierarchy_level configurable entre 11-79.
```

---

## 8. Regla de Jerarquía

Un usuario SOLO puede gestionar usuarios con un `hierarchy_level` MENOR al suyo:

```
Owner (100) → puede gestionar a Admins (80), Custom (50), Members (20), Viewers (10)
Admin (80)  → puede gestionar a Custom (50), Members (20), Viewers (10)
Custom (50) → NO puede gestionar a nadie (salvo si tiene permiso members.manage Y nivel > objetivo)
Member (20) → NO puede gestionar a nadie
Viewer (10) → NO puede gestionar a nadie
```

**Consecuencia:** Un Admin no puede degradar ni eliminar al Owner. Un Custom Role con `members.manage` solo puede gestionar usuarios de nivel inferior.

---

## 9. Experiencia Platform Admin

### 9.1 Navegación

```
Sidebar (solo visible para Platform Admins):
┌─────────────────────────┐
│ 🏠 Dashboard Global     │  ← KPIs de TODAS las orgs
│ 🏢 Organizaciones       │  ← Listar, crear, editar, suspender
│ 👥 Usuarios Globales    │  ← Todos los usuarios del sistema
│ 📋 Audit Log Global     │  ← Logs de todas las orgs
│ ⚙️ Permisos             │  ← Catálogo global de permisos
│ 🔐 Platform Admins      │  ← Gestionar superadmins
├─────────────────────────┤
│ ↕ Cambiar a Org →       │  ← Puede "entrar" a cualquier org
└─────────────────────────┘
```

### 9.2 "Entrar" a una Organización

Cuando el Platform Admin "entra" a Acme Corp:

1. Se setea cookie `grixi_org = {acme_org_id}`
2. El JWT se actualiza con `app_metadata.organization_id = {acme_org_id}`
3. La UI cambia al contexto de Acme Corp
4. Ve EXACTAMENTE lo mismo que el Owner de Acme
5. Cada acción queda en audit_log con `user_id` del Platform Admin
6. Un badge visual indica: **"Modo Admin — Acme Corp"**

### 9.3 Dashboard Global (Platform Admin)

```
┌─────────────────────────────────────────────┐
│  GRIXI Platform Admin                       │
├──────────┬──────────┬──────────┬───────────┤
│ 4 Orgs   │ 12 Users │ 48 Logs  │ 2 Admins  │
│ activas  │ activos  │ hoy      │ platform  │
├──────────┴──────────┴──────────┴───────────┤
│                                             │
│  Organizaciones                             │
│  ┌─────────┬────────┬────────┬────────┐    │
│  │ GRIXI   │ Enterp │ Active │ 2 usr  │    │
│  │ Acme    │ Prof   │ Active │ 0 usr  │    │
│  │ Nexus   │ Start  │ Active │ 0 usr  │    │
│  │ prueba  │ Start  │ Active │ 0 usr  │    │
│  └─────────┴────────┴────────┴────────┘    │
│                                             │
│  [+ Crear Organización]                     │
└─────────────────────────────────────────────┘
```

---

## 10. Experiencia Org Admin

### 10.1 Panel de Usuarios (dentro de su org)

```
/dashboard → Usuarios
┌─────────────────────────────────────────────┐
│  Usuarios — Acme Corp              [Invitar]│
├──────────┬────────┬────────┬────────────────┤
│ Nombre   │ Rol    │ Estado │ Acciones       │
├──────────┼────────┼────────┼────────────────┤
│ Juan P.  │ Owner  │ Activo │ (sin acciones) │
│ Maria L. │ Admin  │ Activo │ Editar · Desact│
│ Pedro R. │ Cont.  │ Activo │ Editar · Desact│
│ Ana G.   │ Viewer │ Inact. │ Reactivar      │
└──────────┴────────┴────────┴────────────────┘
```

### 10.2 Panel de Roles

```
/dashboard → Roles
┌─────────────────────────────────────────────┐
│  Roles — Acme Corp             [Crear Rol]  │
├──────────┬───────────┬────────┬─────────────┤
│ Nombre   │ Tipo      │ Users  │ Acciones    │
├──────────┼───────────┼────────┼─────────────┤
│ owner    │ 🔒Sistema │ 1      │ (inmutable) │
│ admin    │ 🔒Sistema │ 1      │ Ver perms   │
│ Contador │ ✏️Custom  │ 1      │ Editar ·Del │
│ member   │ 🔒Sistema │ 0      │ Ver perms   │
│ viewer   │ 🔒Sistema │ 1      │ Ver perms   │
└──────────┴───────────┴────────┴─────────────┘
```

---

## 11. Audit Trail

Toda acción administrativa se registra en `audit_logs`:

```
Acciones registradas:
├── organization.create / .update / .suspend / .reactivate
├── membership.create / .update / .deactivate / .reactivate / .delete
├── invitation.create / .accept / .revoke / .expire
├── role.create / .update / .delete
├── role_permission.assign / .revoke
├── user.profile_update
├── platform_admin.grant / .revoke
└── auth.login / .logout / .failed_login
```

Cada log incluye:
- `user_id`: quién hizo la acción
- `organization_id`: en qué org (null para acciones globales)
- `entity_type` + `entity_id`: qué entidad fue afectada
- `metadata`: detalles adicionales (JSON)
- `ip_address`: dirección IP del request

---

## 12. Estado Actual vs. Requerido

### ✅ Ya Implementado

| Componente | Estado |
|-----------|--------|
| `platform_admins` tabla | ✅ Con Diego y Calixto |
| `is_platform_admin()` función | ✅ |
| `organizations` tabla | ✅ (falta campo `status`) |
| `roles` tabla (4 roles sistema / org) | ✅ (falta `hierarchy_level`) |
| `permissions` tabla (18 permisos) | ✅ (falta `min_plan`, faltan ~25 permisos) |
| `role_permissions` junction | ✅ |
| `memberships` tabla | ✅ (falta `deactivated_at/by`) |
| `invitations` tabla | ✅ |
| `audit_logs` con `organization_id` | ✅ |
| `has_permission()` función | ✅ |
| `get_user_org_ids()` función | ✅ |
| RLS policies básicas | ✅ |
| Rutas admin (`/admin/*`) | ✅ (estructura, falta implementación real) |

### 🚧 Falta Implementar

| Componente | Prioridad |
|-----------|-----------|
| Campo `status` en organizations | 🔴 Alta |
| Campo `hierarchy_level` en roles | 🔴 Alta |
| Campo `min_plan` en permissions | 🟡 Media |
| Campos `deactivated_at/by` en memberships | 🔴 Alta |
| Expandir catálogo de permisos (18 → ~43) | 🟡 Media |
| Funciones: `is_org_owner()`, `is_org_admin_or_above()` | 🔴 Alta |
| UI: Panel de creación de orgs (Platform Admin) | 🔴 Alta |
| UI: Gestión de roles y permisos (Org Admin) | 🔴 Alta |
| UI: Invitación de usuarios | 🔴 Alta |
| UI: Dashboard global Platform Admin | 🟡 Media |
| Middleware: verificación `org.status` | 🔴 Alta |
| Hook: `usePermission` + `<PermissionGate>` | 🔴 Alta |
| Email: envío de invitaciones | 🟡 Media |
| Regla de jerarquía en `members.manage` | 🟡 Media |

---

## 13. Plan de Implementación (Orden Sugerido)

### Fase 1 — Migración DB (1 sesión)
1. Agregar campos nuevos a `organizations`, `roles`, `permissions`, `memberships`
2. Expandir catálogo de permisos (18 → ~43)
3. Asignar `min_plan` a cada permiso
4. Asignar `hierarchy_level` a roles existentes
5. Crear funciones SQL nuevas (`is_org_owner`, `is_org_admin_or_above`)
6. Actualizar RLS policies para verificar `org.status`

### Fase 2 — Middleware & Guards (1 sesión)
1. Actualizar `authenticated.tsx` para verificar `org.status`, `membership.status`
2. Crear `usePermission` hook
3. Crear `<PermissionGate>` component
4. Implementar guard de jerarquía

### Fase 3 — UI Platform Admin (2-3 sesiones)
1. Dashboard Global (`/admin/index.tsx`)
2. CRUD de Organizaciones (`/admin/organizations.tsx`)
3. Vista detalle de org (`/admin/organizations.$id.tsx`)
4. Gestión de Platform Admins
5. Audit log global

### Fase 4 — UI Org Admin (2-3 sesiones)
1. Lista de usuarios con acciones (invitar, editar rol, desactivar)
2. CRUD de roles con selector de permisos
3. Panel de configuración de org
4. Timeline de audit logs de la org

### Fase 5 — Invitaciones (1 sesión)
1. Formulario de invitación
2. Envío de email (Edge Function o servicio externo)
3. Flujo de aceptación de invitación
4. Expiración automática de invitaciones

---

## 14. Glosario

| Término | Definición |
|---------|-----------|
| **Platform Admin** | Superadmin de GRIXI. Ve y controla todas las orgs. |
| **Organization** | Tenant aislado. Cada empresa cliente es una org. |
| **Owner** | Dueño de una org. Máxima autoridad dentro de ella. |
| **Admin** | Administrador de org con casi todos los permisos. |
| **Custom Role** | Rol creado por el Owner/Admin con permisos a medida. |
| **Member** | Usuario estándar con permisos configurables. |
| **Viewer** | Solo lectura en todos los módulos habilitados. |
| **Permission** | Capacidad atómica (`finance.view`). Global, compartido. |
| **Role** | Conjunto de permisos, específico de cada org. |
| **Membership** | Relación user ↔ org con rol y estado. |
| **Plan** | Starter / Professional / Enterprise. Limita módulos. |
| **enabled_modules** | Módulos activos de una org, definidos por su plan. |
