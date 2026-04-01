CREATE OR REPLACE FUNCTION public.is_org_active(p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = p_org_id AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
