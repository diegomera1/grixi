-- ============================================================
-- GRIXI: Migration 1 — Core Multi-Tenant Tables
-- Fecha: 2026-03-25
-- Descripción: Crea todas las tablas base del sistema multi-tenant
-- ============================================================

-- ============================================================
-- Función utilitaria: update_updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 1. organizations — Tenants del sistema
-- ============================================================

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  status text NOT NULL DEFAULT 'active'::text
    CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text, 'archived'::text])),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organizations IS 'Tenants del sistema. Nunca se borran — usan status.';
COMMENT ON COLUMN public.organizations.slug IS 'Identificador URL-friendly único del tenant.';
COMMENT ON COLUMN public.organizations.settings IS 'Config por tenant: timezone, currency, features, etc.';

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. platform_admins — Superadmins globales
-- ============================================================

CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id),
  notes text
);

COMMENT ON TABLE public.platform_admins IS 'Superadmins con acceso completo a todos los tenants.';

CREATE INDEX idx_platform_admins_user_id ON public.platform_admins USING btree (user_id);
CREATE INDEX idx_platform_admins_granted_by ON public.platform_admins USING btree (granted_by);

-- ============================================================
-- 3. profiles — Perfil personal del usuario
-- ============================================================

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text,
  avatar_url text,
  phone text,
  preferred_lang text NOT NULL DEFAULT 'es'::text
    CHECK (preferred_lang = ANY (ARRAY['es'::text, 'en'::text])),
  timezone text NOT NULL DEFAULT 'America/Mexico_City'::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  preferred_language text DEFAULT 'es'::text
    CHECK (preferred_language = ANY (ARRAY['es'::text, 'en'::text, 'pt'::text]))
);

COMMENT ON TABLE public.profiles IS 'Perfil personal del usuario. PK = auth.users.id.';

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. roles — RBAC por tenant
-- ============================================================

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

COMMENT ON TABLE public.roles IS 'Roles RBAC por tenant. is_system=true protege roles built-in.';

CREATE INDEX idx_roles_organization_id ON public.roles USING btree (organization_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. permissions — Catálogo global de permisos
-- ============================================================

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  module text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.permissions IS 'Catálogo global de permisos granulares. key = "module.action".';
COMMENT ON COLUMN public.permissions.key IS 'Ej: "inventory.read", "purchases.approve", "hr.manage"';
COMMENT ON COLUMN public.permissions.module IS 'Módulo al que pertenece: inventory, purchases, hr, etc.';

-- ============================================================
-- 6. role_permissions — Asignación permisos ↔ roles
-- ============================================================

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id),
  permission_id uuid NOT NULL REFERENCES public.permissions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

COMMENT ON TABLE public.role_permissions IS 'Asignación de permisos a roles.';

CREATE INDEX idx_role_permissions_role_id ON public.role_permissions USING btree (role_id);
CREATE INDEX idx_role_permissions_permission_id ON public.role_permissions USING btree (permission_id);

-- ============================================================
-- 7. memberships — Usuario ↔ Organización
-- ============================================================

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  role_id uuid NOT NULL REFERENCES public.roles(id),
  status text NOT NULL DEFAULT 'active'::text
    CHECK (status = ANY (ARRAY['active'::text, 'invited'::text, 'suspended'::text])),
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

COMMENT ON TABLE public.memberships IS 'Relación usuario ↔ organización con rol asignado.';
COMMENT ON COLUMN public.memberships.status IS 'active=activo, invited=pendiente aceptar, suspended=bloqueado.';

CREATE INDEX idx_memberships_user_id ON public.memberships USING btree (user_id);
CREATE INDEX idx_memberships_organization_id ON public.memberships USING btree (organization_id);
CREATE INDEX idx_memberships_role_id ON public.memberships USING btree (role_id);
CREATE INDEX idx_memberships_user_org_active ON public.memberships USING btree (user_id, organization_id) WHERE (status = 'active'::text);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 8. invitations — Invitaciones por tenant
-- ============================================================

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  email text NOT NULL,
  role_id uuid NOT NULL REFERENCES public.roles(id),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending'::text
    CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text])),
  token text NOT NULL UNIQUE DEFAULT (gen_random_uuid())::text,
  expires_at timestamptz NOT NULL DEFAULT (now() + '7 days'::interval),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, email, status)
);

COMMENT ON TABLE public.invitations IS 'Invitaciones pendientes para unirse a un tenant.';

CREATE INDEX idx_invitations_organization_id ON public.invitations USING btree (organization_id);
CREATE INDEX idx_invitations_email ON public.invitations USING btree (email);
CREATE INDEX idx_invitations_role_id ON public.invitations USING btree (role_id);
CREATE INDEX idx_invitations_invited_by ON public.invitations USING btree (invited_by);
CREATE INDEX idx_invitations_token ON public.invitations USING btree (token);
CREATE INDEX idx_invitations_pending ON public.invitations USING btree (organization_id, email) WHERE (status = 'pending'::text);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 9. audit_logs — Log de auditoría
-- ============================================================

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);

-- ============================================================
-- 10. handle_new_user — Auto-crear perfil en registro
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$function$;

-- Trigger en auth.users para auto-crear perfil
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 11. RLS auto-enable para tablas nuevas
-- ============================================================

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE EVENT TRIGGER rls_auto_enable ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();

-- ============================================================
-- 12. Enable RLS en todas las tablas
-- ============================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
