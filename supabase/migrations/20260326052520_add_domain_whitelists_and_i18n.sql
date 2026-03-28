-- ============================================================
-- GRIXI: Migration 3 — Domain Whitelists + i18n
-- Fecha: 2026-03-26
-- Descripción: Tabla domain_whitelists para auto-join por dominio
--              + campo default_language en organizations
-- ============================================================

-- ============================================================
-- 1. domain_whitelists — Auto-onboarding por dominio email
-- ============================================================

CREATE TABLE public.domain_whitelists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  domain text NOT NULL,
  auto_role text NOT NULL DEFAULT 'viewer'::text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, domain)
);

CREATE INDEX idx_domain_whitelists_org_id ON public.domain_whitelists USING btree (organization_id);
CREATE INDEX idx_domain_whitelists_domain ON public.domain_whitelists USING btree (domain);

ALTER TABLE public.domain_whitelists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_manage_domain_whitelists" ON public.domain_whitelists
  FOR ALL USING (is_platform_admin());

-- ============================================================
-- 2. Agregar default_language a organizations
-- ============================================================

ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS default_language text DEFAULT 'es'::text
    CHECK (default_language = ANY (ARRAY['es'::text, 'en'::text, 'pt'::text]));
