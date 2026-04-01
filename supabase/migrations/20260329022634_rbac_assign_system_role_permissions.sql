DO $$
DECLARE
  r RECORD;
  p RECORD;
BEGIN
  FOR r IN SELECT id FROM public.roles WHERE name = 'owner' LOOP
    FOR p IN SELECT id FROM public.permissions LOOP
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (r.id, p.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
