/**
 * POST /api/push/cleanup — Cleans expired push subscriptions
 * Admin-only endpoint that attempts to send a test push to each subscription
 * and removes any that return 404/410 (expired/unsubscribed)
 */
import type { Route } from "./+types/api.push.cleanup";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers });

  const admin = createSupabaseAdminClient(env);

  // Check platform admin
  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!platformAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers });
  }

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
    actorId: user.id,
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
