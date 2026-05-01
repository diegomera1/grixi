/**
 * API: Analytics — POST /api/analytics
 * 
 * Receives analytics events from the client.
 * Batched: accepts array of events for efficiency.
 * SECURITY: Requires authentication. user_id is server-enforced.
 */
import type { Route } from "./+types/api.analytics";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const env = context.cloudflare.env;

    // SECURITY: Require authentication
    const { supabase } = createSupabaseServerClient(request, env);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const admin = createSupabaseAdminClient(env);

    // Accept single event or batch
    const events = Array.isArray(body) ? body : [body];

    if (events.length === 0 || events.length > 50) {
      return Response.json({ error: "1-50 events allowed" }, { status: 400 });
    }

    const rows = events.map((e: any) => ({
      event_name: e.eventName?.substring(0, 100) || "unknown",
      event_category: e.category?.substring(0, 50) || "general",
      user_id: user.id, // SECURITY: Server-enforced, not from client
      organization_id: e.organizationId || null,
      properties: e.properties || {},
      session_id: e.sessionId?.substring(0, 100) || null,
      url: e.url?.substring(0, 500) || null,
      route: e.route?.substring(0, 200) || null,
      referrer: e.referrer?.substring(0, 500) || null,
      user_agent: (request.headers.get("user-agent") || "").substring(0, 500),
    }));

    await admin.from("analytics_events").insert(rows);

    return Response.json({ ok: true, count: rows.length }, { status: 201 });
  } catch (err) {
    console.error("[Analytics API]", err);
    return Response.json({ error: "Failed to log event" }, { status: 500 });
  }
}
