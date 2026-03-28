-- ============================================================
-- GRIXI: Migration 4 — Verify Whitelist Function
-- Fecha: 2026-03-26
-- Descripción: Función para verificar acceso por whitelist
--              (invitaciones + dominio email)
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_whitelist_access(user_email text)
RETURNS TABLE(organization_id uuid, role_name text, source text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- 1. Check pending invitations for this email
  RETURN QUERY
  SELECT i.organization_id, r.name::TEXT, 'invitation'::TEXT
  FROM public.invitations i
  JOIN public.roles r ON r.id = i.role_id
  WHERE i.email = user_email AND i.status = 'pending';

  -- 2. Check domain whitelists
  RETURN QUERY
  SELECT dw.organization_id, dw.auto_role::TEXT, 'domain'::TEXT
  FROM public.domain_whitelists dw
  WHERE dw.domain = split_part(user_email, '@', 2)
  AND NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = (SELECT au.id FROM auth.users au WHERE au.email = user_email LIMIT 1)
    AND m.organization_id = dw.organization_id
  );
END;
$function$;
