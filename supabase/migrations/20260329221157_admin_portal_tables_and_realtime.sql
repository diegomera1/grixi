CREATE TABLE IF NOT EXISTS public.platform_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info','warning','maintenance','update')),
  audience JSONB DEFAULT '{"type": "all"}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','scheduled')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.platform_notifications IS 'Notificaciones broadcast de la plataforma.';

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.platform_settings IS 'Configuración global de la plataforma.';

CREATE POLICY "Anyone reads active platform notifs" ON public.platform_notifications FOR SELECT USING (true);
CREATE POLICY "Admins manage platform notifs" ON public.platform_notifications FOR ALL USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));
CREATE POLICY "Anyone reads public settings" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings" ON public.platform_settings FOR ALL USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.memberships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
