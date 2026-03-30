-- ============================================================
-- GRIXI: Migration 6 — Admin Portal Fixes
-- Fecha: 2026-03-30
-- Descripción: Corrige 7 bugs de desincronización schema↔código.
--   1. roles: +hierarchy_level, +is_default
--   2. permissions: +min_plan
--   3. organizations: +suspended_at, +suspended_by
--   4. memberships: +deactivated_at, +deactivated_by
--   5. audit_logs: +organization_id
--   6. CREATE platform_notifications
--   7. CREATE platform_settings + seeds
-- ============================================================

-- ============================================================
-- 1. roles — hierarchy_level + is_default
-- ============================================================

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS hierarchy_level integer NOT NULL DEFAULT 20;

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.roles.hierarchy_level IS 'Nivel jerárquico: 100=owner, 80=admin, 20=member, 10=viewer. Custom: 10-79.';
COMMENT ON COLUMN public.roles.is_default IS 'Si true, nuevos miembros reciben este rol por defecto.';

-- Actualizar roles existentes con valores correctos
UPDATE public.roles SET hierarchy_level = 100 WHERE name = 'owner' AND hierarchy_level = 20;
UPDATE public.roles SET hierarchy_level = 80  WHERE name = 'admin' AND hierarchy_level = 20;
UPDATE public.roles SET hierarchy_level = 10  WHERE name = 'viewer' AND hierarchy_level = 20;
-- member ya tiene 20 (default)
UPDATE public.roles SET is_default = true WHERE name = 'member' AND is_default = false;

-- ============================================================
-- 2. permissions — min_plan
-- ============================================================

ALTER TABLE public.permissions
  ADD COLUMN IF NOT EXISTS min_plan text NOT NULL DEFAULT 'starter'
    CHECK (min_plan = ANY (ARRAY['starter'::text, 'professional'::text, 'enterprise'::text]));

COMMENT ON COLUMN public.permissions.min_plan IS 'Plan mínimo requerido para este permiso: starter, professional, enterprise.';

-- Asignar min_plan según módulo
UPDATE public.permissions SET min_plan = 'professional'
  WHERE module IN ('ai') AND min_plan = 'starter';

UPDATE public.permissions SET min_plan = 'enterprise'
  WHERE module IN ('admin', 'reportes') AND min_plan = 'starter';

-- ============================================================
-- 3. organizations — suspended_at, suspended_by
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.organizations.suspended_at IS 'Timestamp de suspensión del tenant.';
COMMENT ON COLUMN public.organizations.suspended_by IS 'Admin que suspendió el tenant.';

-- ============================================================
-- 4. memberships — deactivated_at, deactivated_by
-- ============================================================

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.memberships.deactivated_at IS 'Timestamp de desactivación de la membresía.';
COMMENT ON COLUMN public.memberships.deactivated_by IS 'Admin que desactivó la membresía.';

-- ============================================================
-- 5. audit_logs — organization_id
-- ============================================================

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id
  ON public.audit_logs USING btree (organization_id);

COMMENT ON COLUMN public.audit_logs.organization_id IS 'Tenant asociado al evento de auditoría.';

-- ============================================================
-- 6. platform_notifications — Broadcast de notificaciones
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info'
    CHECK (type = ANY (ARRAY['info'::text, 'warning'::text, 'maintenance'::text, 'update'::text])),
  audience jsonb NOT NULL DEFAULT '{"type": "all"}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'scheduled'::text, 'archived'::text])),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'critical'::text])),
  sent_at timestamptz,
  sent_by uuid REFERENCES auth.users(id),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_notifications IS 'Notificaciones broadcast a tenants. Soporta audiencia selectiva.';
COMMENT ON COLUMN public.platform_notifications.audience IS 'JSON: {"type":"all"} o {"type":"orgs","org_ids":["uuid1","uuid2"]}';
COMMENT ON COLUMN public.platform_notifications.priority IS 'Nivel de prioridad: low, normal, high, critical.';

CREATE INDEX IF NOT EXISTS idx_platform_notifications_status
  ON public.platform_notifications USING btree (status, created_at DESC);

ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;

-- RLS: Solo platform admins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'platform_notifications' 
    AND policyname = 'platform_admins_manage_notifications'
  ) THEN
    CREATE POLICY "platform_admins_manage_notifications" ON public.platform_notifications
      FOR ALL TO authenticated
      USING (is_platform_admin())
      WITH CHECK (is_platform_admin());
  END IF;
END $$;

-- Trigger updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_updated_at' 
    AND tgrelid = 'public.platform_notifications'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON public.platform_notifications
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- 7. platform_settings — Configuración global
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  category text NOT NULL DEFAULT 'general'
    CHECK (category = ANY (ARRAY['features'::text, 'limits'::text, 'system'::text, 'general'::text])),
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE public.platform_settings IS 'Configuración global de la plataforma. key-value con categorías.';
COMMENT ON COLUMN public.platform_settings.value IS 'Valor en formato JSON: boolean, string, number, o object.';

CREATE INDEX IF NOT EXISTS idx_platform_settings_category
  ON public.platform_settings USING btree (category, key);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- RLS: Solo platform admins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'platform_settings' 
    AND policyname = 'platform_admins_manage_settings'
  ) THEN
    CREATE POLICY "platform_admins_manage_settings" ON public.platform_settings
      FOR ALL TO authenticated
      USING (is_platform_admin())
      WITH CHECK (is_platform_admin());
  END IF;
END $$;

-- ============================================================
-- 8. Seeds — platform_settings (idempotente con ON CONFLICT)
-- ============================================================

INSERT INTO public.platform_settings (key, value, category, description) VALUES
  ('features.ai_enabled',              'true'::jsonb,   'features', 'Habilitar GRIXI AI en la plataforma'),
  ('features.realtime_enabled',        'true'::jsonb,   'features', 'Habilitar funciones de tiempo real (Supabase Realtime)'),
  ('features.invitations_enabled',     'true'::jsonb,   'features', 'Permitir envío de invitaciones a organizaciones'),
  ('features.domain_whitelist_enabled', 'true'::jsonb,  'features', 'Habilitar auto-join por dominio de email'),
  ('features.audit_log_enabled',       'true'::jsonb,   'features', 'Habilitar registro de auditoría en todas las acciones'),
  ('limits.max_orgs',                  '100'::jsonb,    'limits',   'Número máximo de organizaciones permitidas'),
  ('limits.default_max_users_per_org', '20'::jsonb,     'limits',   'Usuarios por defecto al crear nueva organización'),
  ('limits.max_file_upload_mb',        '50'::jsonb,     'limits',   'Tamaño máximo de archivo para upload (MB)'),
  ('limits.max_api_calls_per_min',     '60'::jsonb,     'limits',   'Rate limit de API calls por minuto por usuario'),
  ('system.maintenance_mode',          'false'::jsonb,  'system',   'Modo mantenimiento — bloquea acceso a tenants'),
  ('system.default_plan',              '"demo"'::jsonb,  'system',   'Plan por defecto al crear nueva organización'),
  ('system.default_language',          '"es"'::jsonb,    'system',   'Idioma por defecto de la plataforma'),
  ('system.backup_enabled',            'true'::jsonb,   'system',   'Habilitar backups automáticos de base de datos')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- FIN
-- ============================================================
