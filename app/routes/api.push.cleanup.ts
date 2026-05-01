import type { Route } from "./+types/api.push.cleanup";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { requirePlatformAdmin, requirePlatformPermission } from "~/lib/platform-rbac/guard.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const env = context.cloudflare.env;

  // SECURITY: Full RBAC check
  let adminCtx;
  let headers: HeadersInit;
  try {
    const result = await requirePlatformAdmin(request, env, context);
    adminCtx = result.adminCtx;
    headers = result.supabaseHeaders;
    requirePlatformPermission(adminCtx, "admin.settings.manage", headers);
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient(env);

  // Get all push subscriptions
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, user_id");
  if (!subs || subs.length === 0) {
    return Response.json({ cleaned: 0, total: 0, message: "No subscriptions found" }, { headers });
  }

  const expired: string[] = [];

  for (const sub of subs) {
    try {
      // Attempt a lightweight HEAD-like fetch to the push endpoint
      const res = await fetch(sub.endpoint, { method: "POST", body: "" }).catch(() => null);
      if (res && (res.status === 404 || res.status === 410)) {
        expired.push(sub.id);
      }
    } catch {
      // Network error — don't delete, might be temporary
    }
  }

  // Delete expired subscriptions
  if (expired.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expired);
  }

  const ip = getClientIP(request);
  await logAuditEvent(admin, {
    actorId: adminCtx.userId,
    action: "system.push_cleanup",
    entityType: "system",
    metadata: { total: subs.length, cleaned: expired.length },
    ipAddress: ip,
  });

  return Response.json({
    cleaned: expired.length,
    total: subs.length,
    message: `Cleaned ${expired.length} expired subscriptions out of ${subs.length} total`,
  }, { headers });
}
