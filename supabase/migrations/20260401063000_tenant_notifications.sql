-- ═══════════════════════════════════════════════════════════
-- Migration: Tenant Notifications (in-app notification system)
-- Cada notificación es per-user per-org (multi-tenant aislado)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Contenido
  title TEXT NOT NULL,
  body TEXT,
  icon TEXT DEFAULT 'bell',
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'action')),
  
  -- Módulo origen (para filtrado y routing)
  module TEXT NOT NULL DEFAULT 'system' CHECK (module IN (
    'system', 'dashboard', 'finanzas', 'almacenes', 'compras',
    'rrhh', 'flota', 'ai', 'audit', 'team', 'admin'
  )),
  
  -- Routing (URL a donde lleva la notificación)
  action_url TEXT,
  
  -- Metadata extensible (cualquier dato extra del módulo)
  metadata JSONB DEFAULT '{}',
  
  -- Estado
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Opcional: quién generó la notificación (puede ser null = sistema)
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT
);

-- Indexes
CREATE INDEX idx_notif_user_org ON notifications(user_id, organization_id);
CREATE INDEX idx_notif_user_unread ON notifications(user_id, organization_id) WHERE read_at IS NULL;
CREATE INDEX idx_notif_created ON notifications(created_at DESC);
CREATE INDEX idx_notif_module ON notifications(module);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
