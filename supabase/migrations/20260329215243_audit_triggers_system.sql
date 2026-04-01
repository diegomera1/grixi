CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata, organization_id)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    jsonb_build_object('operation', TG_OP),
    CASE
      WHEN TG_OP = 'DELETE' AND TG_TABLE_NAME != 'profiles' THEN (OLD.organization_id)::UUID
      WHEN TG_TABLE_NAME != 'profiles' THEN (NEW.organization_id)::UUID
      ELSE NULL
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
