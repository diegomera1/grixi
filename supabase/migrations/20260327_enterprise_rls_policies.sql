-- ============================================================
-- GRIXI: Enterprise RLS Policies Migration
-- Fecha: 2026-03-27
-- Descripción: Aplica RLS policies en tablas admin para 
--              defensa a nivel de base de datos
-- ============================================================

-- ============================================================
-- 1. Verificar que RLS está habilitado en todas las tablas
-- ============================================================

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. DROP existing policies (idempotente — evita duplicados)
-- ============================================================

-- platform_admins
DROP POLICY IF EXISTS "only_admins_see" ON platform_admins;
DROP POLICY IF EXISTS "only_admins_manage" ON platform_admins;

-- organizations
DROP POLICY IF EXISTS "users_see_own_org" ON organizations;
DROP POLICY IF EXISTS "platform_admin_manage" ON organizations;

-- memberships  
DROP POLICY IF EXISTS "tenant_isolation" ON memberships;
DROP POLICY IF EXISTS "users_see_own" ON memberships;

-- roles
DROP POLICY IF EXISTS "tenant_isolation" ON roles;

-- profiles
DROP POLICY IF EXISTS "users_see_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;

-- invitations
DROP POLICY IF EXISTS "tenant_isolation" ON invitations;

-- ============================================================
-- 3. platform_admins — Solo admins pueden ver/gestionar
-- ============================================================

CREATE POLICY "only_admins_see" ON platform_admins
  FOR SELECT USING (is_platform_admin());

CREATE POLICY "only_admins_manage" ON platform_admins
  FOR ALL USING (is_platform_admin());

-- ============================================================
-- 4. organizations — Usuarios ven sus propias orgs, 
--    admin puede gestionar todas
-- ============================================================

CREATE POLICY "users_see_own_org" ON organizations
  FOR SELECT USING (
    id IN (SELECT get_user_org_ids()) OR is_platform_admin()
  );

CREATE POLICY "platform_admin_manage" ON organizations
  FOR ALL USING (is_platform_admin());

-- ============================================================
-- 5. memberships — Tenant isolation
-- ============================================================

CREATE POLICY "users_see_own" ON memberships
  FOR SELECT USING (
    user_id = auth.uid() 
    OR organization_id IN (SELECT get_user_org_ids()) 
    OR is_platform_admin()
  );

CREATE POLICY "tenant_isolation" ON memberships
  FOR ALL USING (
    organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
  );

-- ============================================================
-- 7. roles — Tenant isolation
-- ============================================================

CREATE POLICY "tenant_isolation" ON roles
  FOR ALL USING (
    organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
  );

-- ============================================================
-- 8. profiles — Usuarios ven su propio perfil
-- ============================================================

CREATE POLICY "users_see_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_platform_admin());

CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- 9. invitations — Tenant isolation
-- ============================================================

CREATE POLICY "tenant_isolation" ON invitations
  FOR ALL USING (
    organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
  );

-- ============================================================
-- VERIFICACIÓN: Ejecutar después de aplicar
-- ============================================================
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
