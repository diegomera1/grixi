import type { Route } from "./+types/api.notifications";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";

/**
 * GET /api/notifications — Lista notificaciones del usuario
 * POST /api/notifications — Acciones (read, readAll, delete, deleteAll)
 */

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401, headers });
  }

  const url = new URL(request.url);
  const orgId = url.searchParams.get("orgId");
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const module = url.searchParams.get("module");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  if (!orgId) {
    return Response.json({ error: "orgId requerido" }, { status: 400, headers });
  }

  // Query uses RLS — only returns user's own notifications
  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }
  if (module) {
    query = query.eq("module", module);
  }

  const { data, count, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers });
  }

  // Also get unread count
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .is("read_at", null)
    .is("archived_at", null);

  return Response.json({
    notifications: data || [],
    total: count || 0,
    unreadCount: unreadCount || 0,
  }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401, headers });
  }

  const body = await request.json();
  const { action: act, notificationId, orgId } = body;

  if (!act) {
    return Response.json({ error: "action requerido" }, { status: 400, headers });
  }

  const now = new Date().toISOString();

  switch (act) {
    case "read": {
      if (!notificationId) {
        return Response.json({ error: "notificationId requerido" }, { status: 400, headers });
      }
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("id", notificationId)
        .is("read_at", null);

      if (error) return Response.json({ error: error.message }, { status: 500, headers });
      return Response.json({ success: true }, { headers });
    }

    case "readAll": {
      if (!orgId) {
        return Response.json({ error: "orgId requerido" }, { status: 400, headers });
      }
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("organization_id", orgId)
        .is("read_at", null);

      if (error) return Response.json({ error: error.message }, { status: 500, headers });
      return Response.json({ success: true }, { headers });
    }

    case "delete": {
      if (!notificationId) {
        return Response.json({ error: "notificationId requerido" }, { status: 400, headers });
      }
      const { error } = await supabase
        .from("notifications")
        .update({ archived_at: now })
        .eq("id", notificationId);

      if (error) return Response.json({ error: error.message }, { status: 500, headers });
      return Response.json({ success: true }, { headers });
    }

    case "deleteAll": {
      if (!orgId) {
        return Response.json({ error: "orgId requerido" }, { status: 400, headers });
      }
      const { error } = await supabase
        .from("notifications")
        .update({ archived_at: now })
        .eq("organization_id", orgId);

      if (error) return Response.json({ error: error.message }, { status: 500, headers });
      return Response.json({ success: true }, { headers });
    }

    default:
      return Response.json({ error: "Acción no soportada" }, { status: 400, headers });
  }
}
