CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id UUID, p_org_id UUID, p_permission_key TEXT
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.role_permissions rp ON rp.role_id = m.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE m.user_id = p_user_id AND m.organization_id = p_org_id
      AND m.status = 'active' AND p.key = p_permission_key
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
