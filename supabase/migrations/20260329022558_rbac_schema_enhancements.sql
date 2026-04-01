ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 50;
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS min_plan TEXT DEFAULT 'starter' CHECK (min_plan IN ('starter','professional','enterprise'));
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES auth.users(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'es' CHECK (preferred_language IN ('es','en','pt'));
