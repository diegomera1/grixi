import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Strict Action Types ─────────────────────────────────
// Every audit action must be defined here — no arbitrary strings

export type AuditAction =
  // Auth
  | "user.login"
  | "user.logout"
  | "user.session_refresh"
  // Profile
  | "user.profile.update"
  | "user.avatar.upload"
  | "user.theme.change"
  | "user.preference.update"
  // Organization
  | "org.update"
  | "org.logo.upload"
  | "org.settings.update"
  | "org.domain.add"
  | "org.domain.remove"
  // Membership
  | "member.invite"
  | "member.invite.resend"
  | "member.invite.revoke"
  | "member.remove"
  | "member.role.update"
  | "member.accept_invite"
  // Roles & Permissions
  | "role.create"
  | "role.update"
  | "role.delete"
  | "role.permission.assign"
  | "role.permission.revoke"
  // Notifications
  | "notification.push.subscribe"
  | "notification.push.unsubscribe"
  | "notification.send"
  | "notification.mark_read"
  // AI
  | "ai.conversation.create"
  | "ai.message.send"
  // Finance
  | "finance.note.create"
  | "finance.note.update"
  | "finance.note.delete"
  // System
  | "system.health_check"
  | "system.push.cleanup"
  // Page views (only for major sections)
  | "page.view"
  // Escape hatch: allows existing freeform strings while IDE still suggests known actions
  | (string & {});

export type AuditEntityType =
  | "user"
  | "organization"
  | "membership"
  | "invitation"
  | "role"
  | "permission"
  | "notification"
  | "push_subscription"
  | "ai_conversation"
  | "ai_message"
  | "finance_note"
  | "system"
  | "page"
  | "session"
  | "domain_whitelist"
  | (string & {});

export interface AuditEvent {
  actorId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
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
    organization_id: event.organizationId || null,
    metadata: {
      ...event.metadata,
      ...(event.userAgent ? { user_agent: event.userAgent } : {}),
    },
    ip_address: event.ipAddress || null,
  });

  if (error) {
    console.error("[AUDIT] Failed to log event:", error.message, event);
  }
}

/**
 * Helper: Log a page view for the current user.
 * Use sparingly — only for major section entry (dashboard, finance, AI, etc.)
 */
export async function logPageView(
  adminClient: SupabaseClient,
  userId: string,
  orgId: string | undefined,
  path: string,
  ip: string
) {
  return logAuditEvent(adminClient, {
    actorId: userId,
    action: "page.view",
    entityType: "page",
    entityId: path,
    organizationId: orgId,
    metadata: { path },
    ipAddress: ip,
  });
}

/**
 * Helper: Log a profile update action.
 */
export async function logProfileUpdate(
  adminClient: SupabaseClient,
  userId: string,
  field: string,
  ip: string,
  orgId?: string
) {
  return logAuditEvent(adminClient, {
    actorId: userId,
    action: "user.profile.update",
    entityType: "user",
    entityId: userId,
    organizationId: orgId,
    metadata: { field },
    ipAddress: ip,
  });
}

/**
 * Extract client IP from request headers.
 * Prioritizes Cloudflare's CF-Connecting-IP header.
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Parse basic device info from User-Agent string.
 */
export function parseDeviceInfo(userAgent: string | null): {
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
} {
  if (!userAgent) return { browser: "Unknown", os: "Unknown", deviceType: "unknown" };

  // Browser detection
  let browser = "Unknown";
  if (userAgent.includes("Edg/")) browser = "Edge";
  else if (userAgent.includes("OPR/") || userAgent.includes("Opera")) browser = "Opera";
  else if (userAgent.includes("Chrome/") && !userAgent.includes("Edg/")) browser = "Chrome";
  else if (userAgent.includes("Firefox/")) browser = "Firefox";
  else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) browser = "Safari";

  // OS detection
  let os = "Unknown";
  if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac OS X") || userAgent.includes("Macintosh")) os = "macOS";
  else if (userAgent.includes("Linux") && !userAgent.includes("Android")) os = "Linux";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";

  // Device type
  let deviceType: "desktop" | "mobile" | "tablet" | "unknown" = "desktop";
  if (userAgent.includes("iPad") || userAgent.includes("Tablet")) deviceType = "tablet";
  else if (userAgent.includes("Mobile") || userAgent.includes("iPhone") || userAgent.includes("Android")) deviceType = "mobile";

  return { browser, os, deviceType };
}
