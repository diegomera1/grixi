import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditEvent {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Log an audit event to the audit_logs table.
 * Uses the admin client (service role) to bypass RLS.
 */
export async function logAuditEvent(
  adminClient: SupabaseClient,
  event: AuditEvent
) {
  const { error } = await adminClient.from("audit_logs").insert({
    actor_id: event.actorId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId || null,
    metadata: event.metadata || {},
    ip_address: event.ipAddress || null,
  });

  if (error) {
    console.error("[AUDIT] Failed to log event:", error.message, event);
  }
}

/**
 * Extract client IP from request headers.
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
