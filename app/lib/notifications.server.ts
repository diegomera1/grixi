import type { SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════
// Notification Server Utilities — Create + Push for any module
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
//     sendPush: true,
//   }, env);
//
// ═══════════════════════════════════════════════════════════

export type NotificationType = "info" | "success" | "warning" | "error" | "action";

export type NotificationModule = 
  | "system" | "dashboard" | "finanzas" | "almacenes" | "compras"
  | "rrhh" | "flota" | "ai" | "audit" | "team" | "admin";

export interface NotificationEnv {
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT?: string;
}

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

// ─── VAPID Utilities (CF Workers compatible) ─────────────

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function createVapidToken(
  subject: string,
  audience: string,
  privateKeyBase64: string
): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signingInput = `${headerB64}.${payloadB64}`;

  const keyData = base64UrlToArrayBuffer(privateKeyBase64);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = arrayBufferToBase64Url(signature);
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

/**
 * Send push notification directly to a user's registered devices.
 * Server-side VAPID signing — works in Cloudflare Workers.
 */
async function sendPushToUser(
  adminClient: SupabaseClient,
  userId: string,
  orgId: string,
  title: string,
  body: string | null,
  url: string | null,
  env: NotificationEnv
): Promise<{ sent: number; cleaned: number }> {
  const { data: subscriptions } = await adminClient
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("organization_id", orgId);

  if (!subscriptions || subscriptions.length === 0) return { sent: 0, cleaned: 0 };

  const payload = JSON.stringify({
    title,
    body: body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    url: url || "/notificaciones",
    tag: `grixi-${Date.now()}`,
  });

  const vapidSubject = env.VAPID_SUBJECT || "mailto:notifications@grixi.ai";
  let sent = 0;
  let cleaned = 0;

  for (const sub of subscriptions) {
    try {
      const audience = new URL(sub.endpoint).origin;
      const vapidToken = await createVapidToken(vapidSubject, audience, env.VAPID_PRIVATE_KEY);

      const response = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Encoding": "aes128gcm",
          "Authorization": `vapid t=${vapidToken}, k=${env.VAPID_PUBLIC_KEY}`,
          "TTL": "86400",
          "Urgency": "normal",
        },
        body: payload,
      });

      if (response.status === 201 || response.status === 200) {
        sent++;
        await adminClient.from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id);
      } else if (response.status === 410 || response.status === 404) {
        // Expired subscription — purge
        await adminClient.from("push_subscriptions").delete().eq("id", sub.id);
        cleaned++;
      } else {
        console.warn(`[Push] Error ${response.status} for sub ${sub.id}`);
      }
    } catch (err) {
      console.warn("[Push] Send error (best-effort):", err);
    }
  }

  return { sent, cleaned };
}

// ─── Public API ──────────────────────────────────────────

/**
 * Create a single in-app notification for a user.
 * Uses the admin client (bypasses RLS) for server-side insertion.
 * Optionally sends push notification if `sendPush: true` and `env` is provided.
 */
export async function createNotification(
  adminClient: SupabaseClient,
  input: CreateNotificationInput,
  env?: NotificationEnv
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

  // Best-effort push notification
  if (input.sendPush && env?.VAPID_PUBLIC_KEY && env?.VAPID_PRIVATE_KEY) {
    try {
      const pushResult = await sendPushToUser(
        adminClient,
        input.userId,
        input.organizationId,
        input.title,
        input.body || null,
        input.actionUrl || null,
        env
      );
      console.log(`[Notifications] Push sent=${pushResult.sent}, cleaned=${pushResult.cleaned}`);
    } catch (e) {
      console.warn("[Notifications] Push send failed (best-effort):", e);
    }
  }

  return { success: true, id: data?.id };
}

/**
 * Create notifications for multiple users (batch insert).
 * Push is sent per-user if `sendPush: true` and `env` is provided.
 */
export async function createBulkNotifications(
  adminClient: SupabaseClient,
  input: CreateBulkNotificationInput,
  env?: NotificationEnv
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

  // Best-effort push to each user
  if (input.sendPush && env?.VAPID_PUBLIC_KEY && env?.VAPID_PRIVATE_KEY) {
    for (const userId of input.userIds) {
      sendPushToUser(
        adminClient, userId, input.organizationId,
        input.title, input.body || null, input.actionUrl || null, env
      ).catch(() => {});
    }
  }

  return { success: true, count: rows.length };
}

/**
 * Notify all active members of an organization.
 */
export async function notifyOrgMembers(
  adminClient: SupabaseClient,
  input: Omit<CreateBulkNotificationInput, "userIds"> & { excludeUserId?: string },
  env?: NotificationEnv
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

  return createBulkNotifications(adminClient, { ...input, userIds }, env);
}
