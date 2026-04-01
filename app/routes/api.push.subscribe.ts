import type { Route } from "./+types/api.push.subscribe";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";

/**
 * POST /api/push/subscribe — Save a push subscription
 * DELETE /api/push/subscribe — Remove a push subscription
 */
export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401, headers });
  }

  const admin = createSupabaseAdminClient(env);

  // Get current org from cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const orgId = cookieHeader.match(/grixi_org=([^;]+)/)?.[1];

  if (!orgId) {
    return Response.json({ error: "Sin organización activa" }, { status: 400, headers });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return Response.json({ error: "Datos de subscription incompletos" }, { status: 400, headers });
    }

    const { error } = await admin.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        organization_id: orgId,
        endpoint,
        keys_p256dh: keys.p256dh,
        keys_auth: keys.auth,
        user_agent: request.headers.get("user-agent") || undefined,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      console.error("[Push Subscribe]", error);
      return Response.json({ error: "Error al guardar subscription" }, { status: 500, headers });
    }

    // Ensure notification preferences exist
    await admin.from("notification_preferences").upsert(
      {
        user_id: user.id,
        organization_id: orgId,
      },
      { onConflict: "user_id,organization_id" }
    );

    return Response.json({ success: true }, { headers });
  }

  if (request.method === "DELETE") {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return Response.json({ error: "Endpoint requerido" }, { status: 400, headers });
    }

    await admin.from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Método no soportado" }, { status: 405, headers });
}
