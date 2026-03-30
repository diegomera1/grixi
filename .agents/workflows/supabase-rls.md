---
description: Cómo implementar y gestionar Row Level Security (RLS) en GRIXI
---

# Row Level Security (RLS) en GRIXI

GRIXI es multi-tenant — **RLS es obligatorio** en toda tabla que contenga datos de tenant.

## Principio Fundamental

```
Frontend = UX guards (pueden ser bypassed)
RLS = Security enforcement (no puede ser bypassed)
```

Los hooks de RBAC (`useHasPermission`, `useIsOrgAdmin`) son para UX. La seguridad real vive en PostgreSQL.

## Patrón Estándar para Tablas Multi-Tenant

### 1. Crear tabla con org_id

```sql
CREATE TABLE public.mi_tabla (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  -- ... más columnas
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2. Habilitar RLS

```sql
ALTER TABLE public.mi_tabla ENABLE ROW LEVEL SECURITY;
```

### 3. Crear políticas

```sql
-- SELECT: Solo miembros activos de la org pueden leer
CREATE POLICY "mi_tabla_select" ON public.mi_tabla
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT: Solo miembros activos pueden insertar
CREATE POLICY "mi_tabla_insert" ON public.mi_tabla
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- UPDATE: Solo miembros activos pueden actualizar
CREATE POLICY "mi_tabla_update" ON public.mi_tabla
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- DELETE: Solo admins+ (hierarchy_level >= 80)
CREATE POLICY "mi_tabla_delete" ON public.mi_tabla
  FOR DELETE USING (
    organization_id IN (
      SELECT m.organization_id FROM public.memberships m
      JOIN public.roles r ON m.role_id = r.id
      WHERE m.user_id = auth.uid() AND m.status = 'active'
      AND r.hierarchy_level >= 80
    )
  );
```

## Helper Function: get_user_org_ids()

GRIXI usa una función helper para simplificar las políticas:

```sql
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id FROM public.memberships
  WHERE user_id = auth.uid() AND status = 'active';
$$;
```

Con esto, las políticas se simplifican:

```sql
CREATE POLICY "mi_tabla_select" ON public.mi_tabla
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));
```

## Clientes Supabase en GRIXI

| Cliente | Uso | RLS |
|---------|-----|-----|
| `createSupabaseServerClient(request, env)` | Operaciones de usuario | ✅ Aplica RLS |
| `createSupabaseAdminClient(env)` | Admin de plataforma | ❌ Bypassa RLS |

```typescript
// En un loader/action de tenant:
const { supabase, headers } = createSupabaseServerClient(request, env);
// → Las queries respetan RLS automáticamente

// SOLO para admin de plataforma:
const admin = createSupabaseAdminClient(env);
// → PELIGRO: No tiene RLS. Usar solo en rutas protegidas por isPlatformTenant()
```

## Migraciones

Todas las migraciones viven en `supabase/migrations/` con formato:

```
YYYYMMDDHHMMSS_descripcion.sql
```

### Para ejecutar:

```bash
# Vía Supabase Dashboard → SQL Editor (recomendado para producción)
# O vía CLI:
npx supabase db push
```

### Template de migración:

```sql
-- Migration: Descripción breve
-- Author: [nombre]
-- Date: YYYY-MM-DD

BEGIN;

-- 1. Crear tabla
CREATE TABLE IF NOT EXISTS public.nueva_tabla (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.nueva_tabla ENABLE ROW LEVEL SECURITY;

-- 3. Políticas
CREATE POLICY "nueva_tabla_select" ON public.nueva_tabla
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "nueva_tabla_insert" ON public.nueva_tabla
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_nueva_tabla_org ON public.nueva_tabla(organization_id);

COMMIT;
```

## Tablas de Plataforma (sin org_id)

Para tablas que son globales (no multi-tenant):

```sql
-- Ejemplo: platform_settings
CREATE POLICY "platform_settings_select" ON public.platform_settings
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.platform_admins)
  );
```

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `supabase/migrations/` | Todas las migraciones SQL |
| `app/lib/supabase/client.server.ts` | Clientes Supabase (server + admin) |
| `arquitectura/06-seguridad.md` | Documentación de capas de seguridad |
| `arquitectura/11-database-schema.md` | Schema completo |

## Reglas de Oro

1. **NUNCA** crear una tabla sin RLS habilitado
2. **NUNCA** usar `createSupabaseAdminClient` fuera de rutas admin protegidas
3. **SIEMPRE** incluir `organization_id` en tablas multi-tenant
4. **SIEMPRE** verificar `status = 'active'` en membership policies
5. **SIEMPRE** usar migraciones idempotentes (`IF NOT EXISTS`, `CREATE OR REPLACE`)
