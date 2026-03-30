---
description: Cómo funciona la arquitectura multi-tenant de GRIXI y cómo crear nuevas rutas tenant-aware
---

# Arquitectura Multi-Tenant

GRIXI usa **subdominios** para aislamiento de tenants: `{slug}.grixi.ai`.

## Flujo de Resolución

```
Request → Cloudflare Worker → Extract subdomain → Set tenantSlug → React Router
```

### En `workers/app.ts`:

```
empresa-x.grixi.ai → tenantSlug = "empresa-x"
admin.grixi.ai     → tenantSlug = null, isPlatformAdminPortal = true
grixi.ai           → tenantSlug = null (root domain)
```

## Contexto del Tenant

El tenant se resuelve en `app/routes/authenticated.tsx` y se pasa via `Outlet context`:

```typescript
interface TenantContext {
  user: User;
  tenantSlug: string;
  currentOrg: {
    id: string;
    name: string;
    slug: string;
    roleName: string;
    hierarchyLevel: number;
  };
  permissions: string[];  // ["finance.view", "warehouses.edit", ...]
  isPlatformAdmin: boolean;
}
```

### Acceder al contexto en cualquier ruta:

```typescript
import { useTenant } from "~/lib/rbac/hooks";

function MiComponente() {
  const { user, currentOrg, permissions, isPlatformAdmin } = useTenant();
  // ...
}
```

## Crear una Nueva Ruta de Tenant

### 1. Crear el archivo de ruta

```
app/routes/mi-modulo.tsx          → /mi-modulo
app/routes/mi-modulo/index.tsx    → /mi-modulo
app/routes/mi-modulo/$id.tsx      → /mi-modulo/:id
```

### 2. Loader con autenticación

```typescript
import type { Route } from "./+types/mi-modulo";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";
import { requirePermission } from "~/lib/permission-guard.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  // Obtener permisos del contexto (ver authenticated.tsx)
  // requirePermission(permissions, isPlatformAdmin, "mi_modulo.view", headers);

  const { data } = await supabase
    .from("mi_tabla")
    .select("*")
    .order("created_at", { ascending: false });

  return Response.json({ items: data || [] }, { headers });
}
```

### 3. Action con audit log

```typescript
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

export async function action({ request, context }: Route.ActionArgs) {
  // ... auth checks
  
  const admin = createSupabaseAdminClient(env); // Solo si necesitas bypasear RLS
  
  await logAuditEvent(admin, {
    actorId: user.id,
    action: "mi_modulo.create",
    entityType: "mi_entidad",
    entityId: resultado.id,
    organizationId: org.id,
    metadata: { campo: valor },
    ipAddress: getClientIP(request),
  });
}
```

## Aislamiento de Datos

| Capa | Mecanismo |
|------|-----------|
| **Cookies** | Sin `domain=` → aisladas por hostname exacto |
| **Database** | RLS con `organization_id` en cada tabla |
| **Storage** | R2 keys namespaciadas por org/user |
| **Rate Limiting** | Por IP en rutas admin |

## Admin Portal vs Tenant

| Aspecto | Tenant (`{slug}.grixi.ai`) | Admin (`admin.grixi.ai`) |
|---------|---------------------------|--------------------------|
| Context | `tenantSlug = "empresa-x"` | `isPlatformAdminPortal = true` |
| Supabase | Client con RLS | Admin sin RLS |
| Guard | `requirePermission()` | `isPlatformTenant()` + `platform_admins` |
| Rutas | `app/routes/*` (generales) | `app/routes/admin/*` |

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `workers/app.ts` | Resolución de subdomain + routing |
| `app/routes/authenticated.tsx` | Carga de contexto tenant |
| `app/lib/platform-guard.ts` | Guard para admin portal |
| `app/lib/supabase/client.server.ts` | Cookie isolation |
