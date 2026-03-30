---
description: Cómo implementar permisos y control de acceso RBAC en GRIXI
---

# Sistema de Permisos RBAC en GRIXI

GRIXI usa un sistema de permisos basado en roles con jerarquía numérica.

## Arquitectura

```
Roles (con hierarchy_level) → role_permissions → Permissions (module.action)
     ↓                                                ↓
Memberships (user + org + role)              Enforcement:
     ↓                                      - DB: RLS policies
     ↓                                      - Server: requirePermission()  
     ↓                                      - Client: useHasPermission()
```

## Jerarquía de Roles

| Nivel | Rol | Descripción |
|-------|-----|-------------|
| 100 | `owner` | Dueño de la organización |
| 80 | `admin` | Administrador con acceso total |
| 60 | `manager` | Gerente con acceso a módulos |
| 40 | `member` | Miembro con acceso básico |
| 20 | `viewer` | Solo lectura |

## Formato de Permisos

```
{modulo}.{accion}
```

Ejemplos: `finance.view`, `warehouses.edit`, `users.manage`, `purchases.create`

## Implementación

### 1. Protección Server-Side (Loaders/Actions)

```typescript
import { requirePermission } from "~/lib/permission-guard.server";

export async function loader({ context }: Route.LoaderArgs) {
  // ... obtener user, permissions, isPlatformAdmin del contexto

  // Redirige a /dashboard si no tiene el permiso
  requirePermission(permissions, isPlatformAdmin, "finance.view", headers);
  
  // ... cargar datos
}
```

Para verificar múltiples permisos:

```typescript
import { requirePermissionAny } from "~/lib/permission-guard.server";

// Permite si tiene CUALQUIERA de los permisos
requirePermissionAny(permissions, isPlatformAdmin, 
  ["warehouses.view", "warehouses.edit"], headers);
```

### 2. Protección Client-Side (Componentes)

```typescript
import { useHasPermission, useIsOrgAdmin, useCanManageUser } from "~/lib/rbac/hooks";

function FinanceTab() {
  const canView = useHasPermission("finance.view");
  const canEdit = useHasPermission("finance.edit");
  const isAdmin = useIsOrgAdmin(); // hierarchy_level >= 80

  if (!canView) return null; // No renderizar

  return (
    <div>
      <h2>Finanzas</h2>
      {canEdit && <button>Editar</button>}
      {isAdmin && <button>Configurar</button>}
    </div>
  );
}
```

### 3. Hooks Disponibles

| Hook | Uso |
|------|-----|
| `useHasPermission("key")` | ¿Tiene un permiso específico? |
| `useHasAllPermissions(["a", "b"])` | ¿Tiene TODOS los permisos? |
| `useHasAnyPermission(["a", "b"])` | ¿Tiene ALGUNO? |
| `useIsOrgAdmin()` | ¿Es admin+ (hierarchy ≥ 80)? |
| `useCanManageUser(targetLevel)` | ¿Puede gestionar usuario con ese nivel? |
| `useTenant()` | Contexto completo del tenant |

### 4. Agregar un Nuevo Permiso

```sql
-- 1. Insertar el permiso
INSERT INTO public.permissions (key, description, module)
VALUES ('finance.export', 'Exportar reportes financieros', 'finance')
ON CONFLICT (key) DO NOTHING;

-- 2. Asignar a roles existentes
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name IN ('owner', 'admin') AND p.key = 'finance.export'
ON CONFLICT DO NOTHING;
```

## Platform Admin

Los Platform Admins (`platform_admins` table) **bypasean todos los permisos**:

```typescript
// Todos los hooks retornan true automáticamente
if (isPlatformAdmin) return true;
```

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `app/lib/rbac/hooks.ts` | Hooks de RBAC para frontend |
| `app/lib/permission-guard.server.ts` | Guards de permisos server-side |
| `app/lib/platform-guard.ts` | Guard de admin de plataforma |
| `app/routes/authenticated.tsx` | Carga permisos en el contexto |

## Reglas

1. **Security in DB, UX in frontend** — Los hooks son para UX, RLS es para seguridad
2. **Platform admins bypasean todo** — No confiar en la ausencia de checks para ellos
3. **Hierarchy trumps permissions** — Un owner siempre puede más que un admin
4. **Verificar en server Y client** — Double-check siempre
