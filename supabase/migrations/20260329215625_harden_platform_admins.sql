COMMENT ON TABLE public.platform_admins IS 'Registry of users with God Mode access. Only modifiable by existing platform admins via RLS. Fully audited.';

DROP POLICY IF EXISTS "Platform admins manage self" ON public.platform_admins;
CREATE POLICY "Platform admins manage self" ON public.platform_admins
  FOR ALL USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform admins readable" ON public.platform_admins;
CREATE POLICY "Platform admins readable" ON public.platform_admins
  FOR SELECT USING (true);
