CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  title TEXT NOT NULL,
  body TEXT,
  icon TEXT DEFAULT 'bell',
  type TEXT DEFAULT 'info' CHECK (type IN ('info','success','warning','error','action')),
  module TEXT DEFAULT 'system' CHECK (module IN ('system','dashboard','finanzas','almacenes','compras','rrhh','flota','ai','audit','team','admin')),
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  actor_id UUID REFERENCES auth.users(id),
  actor_name TEXT
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_user_org ON public.notifications(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, organization_id) WHERE read_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_module ON public.notifications(module);

CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
