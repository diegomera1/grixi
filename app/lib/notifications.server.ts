import type { SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════
// createNotification — Utilidad servidor para emitir notificaciones
// 
// Uso desde cualquier módulo:
//
//   import { createNotification } from "~/lib/notifications.server";
//
//   await createNotification(adminClient, {
//     userId: "uuid...",
//     organizationId: "uuid...",
//     title: "Nueva factura aprobada",
//     body: "La factura #1234 fue aprobada por María García",
//     type: "success",
//     module: "finanzas",
//     actionUrl: "/finanzas?tab=facturas",
//     actorId: user.id,
//     actorName: user.name,
//     metadata: { facturaId: "1234", monto: 5000 },
//   });
//
// También puede enviar push notification si el usuario tiene suscripción.
// ═══════════════════════════════════════════════════════════

export type NotificationType = "info" | "success" | "warning" | "error" | "action";

export type NotificationModule = 
  | "system" | "dashboard" | "finanzas" | "almacenes" | "compras"
  | "rrhh" | "flota" | "ai" | "audit" | "team" | "admin";

export interface CreateNotificationInput {
  userId: string;
  organizationId: string;
  title: string;
  body?: string;
  icon?: string;
  type?: NotificationType;
  module?: NotificationModule;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  actorId?: string;
  actorName?: string;
  /** Also send push notification to user's devices */
  sendPush?: boolean;
}

export interface CreateBulkNotificationInput {
  /** List of user IDs to notify */
  userIds: string[];
  organizationId: string;
  title: string;
  body?: string;
  icon?: string;
  type?: NotificationType;
  module?: NotificationModule;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  actorId?: string;
  actorName?: string;
  sendPush?: boolean;
}

/**
 * Create a single in-app notification for a user.
 * Uses the admin client (bypasses RLS) for server-side insertion.
 */
export async function createNotification(
  adminClient: SupabaseClient,
  input: CreateNotificationInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { error, data } = await adminClient.from("notifications").insert({
    user_id: input.userId,
    organization_id: input.organizationId,
    title: input.title,
    body: input.body || null,
    icon: input.icon || "bell",
    type: input.type || "info",
    module: input.module || "system",
    action_url: input.actionUrl || null,
    metadata: input.metadata || {},
    actor_id: input.actorId || null,
    actor_name: input.actorName || null,
  }).select("id").single();

  if (error) {
    console.error("[Notifications] Error creating notification:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
}

/**
 * Create notifications for multiple users (e.g., all org members).
 * Efficient batch insert.
 */
export async function createBulkNotifications(
  adminClient: SupabaseClient,
  input: CreateBulkNotificationInput
): Promise<{ success: boolean; count: number; error?: string }> {
  const rows = input.userIds.map((userId) => ({
    user_id: userId,
    organization_id: input.organizationId,
    title: input.title,
    body: input.body || null,
    icon: input.icon || "bell",
    type: input.type || "info",
    module: input.module || "system",
    action_url: input.actionUrl || null,
    metadata: input.metadata || {},
    actor_id: input.actorId || null,
    actor_name: input.actorName || null,
  }));

  const { error } = await adminClient.from("notifications").insert(rows);

  if (error) {
    console.error("[Notifications] Error bulk creating:", error.message);
    return { success: false, count: 0, error: error.message };
  }

  return { success: true, count: rows.length };
}

/**
 * Notify all active members of an organization.
 */
export async function notifyOrgMembers(
  adminClient: SupabaseClient,
  input: Omit<CreateBulkNotificationInput, "userIds"> & { excludeUserId?: string }
): Promise<{ success: boolean; count: number }> {
  const { data: members } = await adminClient
    .from("memberships")
    .select("user_id")
    .eq("organization_id", input.organizationId)
    .eq("status", "active");

  if (!members || members.length === 0) {
    return { success: true, count: 0 };
  }

  const userIds = members
    .map((m) => m.user_id)
    .filter((id) => id !== input.excludeUserId);

  if (userIds.length === 0) return { success: true, count: 0 };

  return createBulkNotifications(adminClient, { ...input, userIds });
}
