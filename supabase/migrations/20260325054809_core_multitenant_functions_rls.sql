-- ============================================================
-- GRIXI: Migration 2 — Functions + RLS Policies
-- Fecha: 2026-03-25
-- Descripción: Funciones helper y RLS policies base para 
--              aislamiento multi-tenant
-- ============================================================

-- ============================================================
-- 1. Helper Functions
-- ============================================================

-- is_platform_admin() — Verifica si el usuario actual es superadmin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = (select auth.uid())
  );
END;
$function$;

-- get_user_org_ids() — Retorna IDs de orgs activas del usuario
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
    SELECT m.organization_id
    FROM public.memberships m
    WHERE m.user_id = (select auth.uid())
      AND m.status = 'active';
END;
$function$;

-- get_user_org_id() — Retorna org_id actual del JWT
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN ((select auth.jwt()) -> 'app_metadata' ->> 'organization_id')::uuid;
END;
$function$;

-- get_user_role_name(org_uuid) — Retorna nombre del rol en una org
CREATE OR REPLACE FUNCTION public.get_user_role_name(org_uuid uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _role_name text;
BEGIN
  SELECT r.name INTO _role_name
  FROM public.memberships m
  JOIN public.roles r ON r.id = m.role_id
  WHERE m.user_id = (select auth.uid())
    AND m.organization_id = org_uuid
    AND m.status = 'active';
  RETURN _role_name;
END;
$function$;

-- has_permission(required_permission) — Verifica permiso granular
CREATE OR REPLACE FUNCTION public.has_permission(required_permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _org_id uuid;
BEGIN
  _org_id := public.get_user_org_id();
  IF _org_id IS NULL THEN RETURN false; END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.role_permissions rp ON rp.role_id = m.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE m.user_id = (select auth.uid())
      AND m.organization_id = _org_id
      AND m.status = 'active'
      AND p.key = required_permission
  );
END;
$function$;

-- custom_access_token_hook — Inyecta org_id y role en JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $function$
DECLARE
  claims jsonb;
  _user_id uuid;
  _org_id uuid;
  _role_name text;
BEGIN
  _user_id := (event ->> 'user_id')::uuid;
  claims := event -> 'claims';

  -- Leer org_id actual del app_metadata existente
  _org_id := (claims -> 'app_metadata' ->> 'organization_id')::uuid;

  -- Si no hay org en app_metadata, intentar obtener la primera org activa
  IF _org_id IS NULL THEN
    SELECT m.organization_id INTO _org_id
    FROM public.memberships m
    WHERE m.user_id = _user_id AND m.status = 'active'
    ORDER BY m.joined_at ASC
    LIMIT 1;
  END IF;

  -- Si encontramos org, obtener el rol
  IF _org_id IS NOT NULL THEN
    SELECT r.name INTO _role_name
    FROM public.memberships m
    JOIN public.roles r ON r.id = m.role_id
    WHERE m.user_id = _user_id
      AND m.organization_id = _org_id
      AND m.status = 'active';
  END IF;

  -- Asegurar que app_metadata existe
  IF claims -> 'app_metadata' IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  -- Inyectar claims
  IF _org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, organization_id}', to_jsonb(_org_id::text));
  ELSE
    claims := jsonb_set(claims, '{app_metadata, organization_id}', 'null');
  END IF;

  IF _role_name IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, user_role}', to_jsonb(_role_name));
  ELSE
    claims := jsonb_set(claims, '{app_metadata, user_role}', 'null');
  END IF;

  -- Retornar evento modificado
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$function$;

-- ============================================================
-- 2. RLS Policies — Base policies para todas las tablas
-- ============================================================

-- organizations
CREATE POLICY "Users see their orgs" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT get_user_org_ids()) OR is_platform_admin()
  );

CREATE POLICY "Platform admins manage orgs" ON public.organizations
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- platform_admins
CREATE POLICY "Platform admins see admins" ON public.platform_admins
  FOR SELECT TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Platform admins manage admins" ON public.platform_admins
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- profiles
CREATE POLICY "Users see own profile and org members" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR id IN (
      SELECT m.user_id FROM memberships m
      WHERE m.organization_id = get_user_org_id()
        AND m.status = 'active'
    )
    OR is_platform_admin()
  );

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- roles
CREATE POLICY "Users see roles in their org" ON public.roles
  FOR SELECT TO authenticated
  USING (
    organization_id = get_user_org_id() OR is_platform_admin()
  );

CREATE POLICY "Admins manage roles in their org" ON public.roles
  FOR ALL TO authenticated
  USING (
    (organization_id = get_user_org_id() AND has_permission('roles.manage'))
    OR is_platform_admin()
  )
  WITH CHECK (
    (organization_id = get_user_org_id() AND has_permission('roles.manage'))
    OR is_platform_admin()
  );

CREATE POLICY "Auth admin reads roles" ON public.roles
  FOR SELECT TO supabase_auth_admin
  USING (true);

-- permissions
CREATE POLICY "Authenticated users see permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (true);

-- role_permissions
CREATE POLICY "Users see role_permissions in their org" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    role_id IN (SELECT r.id FROM roles r WHERE r.organization_id = get_user_org_id())
    OR is_platform_admin()
  );

CREATE POLICY "Admins manage role_permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (
    (role_id IN (SELECT r.id FROM roles r WHERE r.organization_id = get_user_org_id())
      AND has_permission('roles.manage'))
    OR is_platform_admin()
  )
  WITH CHECK (
    (role_id IN (SELECT r.id FROM roles r WHERE r.organization_id = get_user_org_id())
      AND has_permission('roles.manage'))
    OR is_platform_admin()
  );

-- memberships
CREATE POLICY "Users see memberships in their org" ON public.memberships
  FOR SELECT TO authenticated
  USING (
    organization_id = get_user_org_id()
    OR user_id = auth.uid()
    OR is_platform_admin()
  );

CREATE POLICY "Admins manage memberships" ON public.memberships
  FOR ALL TO authenticated
  USING (
    (organization_id = get_user_org_id() AND has_permission('members.manage'))
    OR is_platform_admin()
  )
  WITH CHECK (
    (organization_id = get_user_org_id() AND has_permission('members.manage'))
    OR is_platform_admin()
  );

CREATE POLICY "Auth admin reads memberships" ON public.memberships
  FOR SELECT TO supabase_auth_admin
  USING (true);

-- invitations
CREATE POLICY "Users see invitations in their org or own email" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    organization_id = get_user_org_id()
    OR email = (auth.jwt() ->> 'email')
    OR is_platform_admin()
  );

CREATE POLICY "Admins manage invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (
    (organization_id = get_user_org_id() AND has_permission('members.manage'))
    OR is_platform_admin()
  )
  WITH CHECK (
    (organization_id = get_user_org_id() AND has_permission('members.manage'))
    OR is_platform_admin()
  );

-- audit_logs
CREATE POLICY "Service role full access" ON public.audit_logs
  FOR ALL USING (true);

-- ============================================================
-- 3. Grant execute a supabase_auth_admin para el hook
-- ============================================================

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
