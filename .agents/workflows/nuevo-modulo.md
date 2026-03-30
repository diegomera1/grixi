---
description: Checklist completo para agregar un nuevo módulo a GRIXI
---

# Agregar un Nuevo Módulo a GRIXI

Checklist completo para implementar un módulo nuevo (ej: Inventarios, RRHH, etc.)

## Paso 1: Base de Datos

1. Crear migración SQL en `supabase/migrations/`:
   ```bash
   # Nombrar: YYYYMMDDHHMMSS_modulo_nombre.sql
   touch supabase/migrations/20260401000000_modulo_inventarios.sql
   ```

2. Definir tablas con `organization_id` y RLS (ver workflow `supabase-rls.md`)

3. Ejecutar migración en Supabase Dashboard → SQL Editor

## Paso 2: Permisos

```sql
-- Insertar permisos del módulo
INSERT INTO public.permissions (key, description, module) VALUES
  ('inventarios.view', 'Ver inventarios', 'inventarios'),
  ('inventarios.create', 'Crear items', 'inventarios'),
  ('inventarios.edit', 'Editar items', 'inventarios'),
  ('inventarios.delete', 'Eliminar items', 'inventarios')
ON CONFLICT (key) DO NOTHING;

-- Asignar a roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name IN ('owner', 'admin', 'manager') 
  AND p.module = 'inventarios'
ON CONFLICT DO NOTHING;
```

## Paso 3: Rutas

Crear archivos en `app/routes/`:

```
app/routes/inventarios.tsx           → /inventarios (layout o índice)
app/routes/inventarios/index.tsx     → /inventarios (lista principal)
app/routes/inventarios/$id.tsx       → /inventarios/:id (detalle)
```

## Paso 4: Loader con Auth + Permisos

```typescript
import { requirePermission } from "~/lib/permission-guard.server";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  // ... auth + permission checks
  
  const { data } = await supabase.from("inventario_items")
    .select("*").order("created_at", { ascending: false });
    
  return Response.json({ items: data || [] }, { headers });
}
```

## Paso 5: Registrar el Módulo

Agregar en `app/routes/admin/organizations.$id.tsx` → `ALL_MODULES`:

```typescript
const ALL_MODULES = [
  // ... existentes
  { id: "inventarios", name: "Inventarios", color: "#f59e0b" },
];
```

## Paso 6: Navegación

Agregar el módulo en los sidebars/navbars correspondientes con la protección:

```typescript
import { useHasPermission } from "~/lib/rbac/hooks";

const canViewInventarios = useHasPermission("inventarios.view");

{canViewInventarios && (
  <NavLink to="/inventarios">Inventarios</NavLink>
)}
```

## Paso 7: Audit Logs

En cada action, registrar con `logAuditEvent()` (ver workflow `audit-logs.md`).

## Paso 8: Documentación

1. Crear `docs/modulos/inventarios.md` con estado 🚧
2. Actualizar `registro/estado-actual.md`
3. Registrar en bitácora diaria

## Paso 9: Deploy

```bash
npm run build && npx wrangler deploy
```
