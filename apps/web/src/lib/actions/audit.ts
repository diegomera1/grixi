"use server";

import { createClient } from "@/lib/supabase/server";

type AuditAction = "create" | "update" | "delete" | "login" | "logout" | "export" | "view";
type ResourceType = "user" | "role" | "warehouse" | "rack" | "product" | "inventory" | "settings" | "session";

type AuditLogParams = {
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  description: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
};

/**
 * Creates an audit log entry for real user actions.
 * Call this from any Server Action that modifies data.
 */
export async function createAuditLog(params: AuditLogParams) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    org_id: "a0000000-0000-0000-0000-000000000001",
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId || null,
    old_data: params.oldData || null,
    new_data: {
      description: params.description,
      ...(params.newData || {}),
    },
  });
}

/**
 * Log a login event
 */
export async function logLoginEvent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    org_id: "a0000000-0000-0000-0000-000000000001",
    action: "login",
    resource_type: "session",
    new_data: {
      description: "Inició sesión con Google",
      email: user.email,
      provider: user.app_metadata?.provider || "google",
    },
  });
}

/**
 * Log a logout event
 */
export async function logLogoutEvent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Terminate all active sessions
  await supabase
    .from("active_sessions")
    .update({
      is_active: false,
      terminated_at: new Date().toISOString(),
      terminated_by: user.id,
    })
    .eq("user_id", user.id)
    .eq("is_active", true);

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    org_id: "a0000000-0000-0000-0000-000000000001",
    action: "logout",
    resource_type: "session",
    new_data: {
      description: "Cerró sesión",
    },
  });
}
