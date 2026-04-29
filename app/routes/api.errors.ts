/**
 * API: Error Tracking — POST /api/errors
 * 
 * Receives client-side errors and logs them to error_logs table.
 * Uses service_role to bypass RLS (errors don't need user auth).
 */
import type { Route } from "./+types/api.errors";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const env = context.cloudflare.env;
    const body = await request.json();
    const admin = createSupabaseAdminClient(env);

    const {
      message,
      stack,
      source = "client",
      level = "error",
      url,
      route,
      userAgent,
      metadata = {},
      userId,
      organizationId,
    } = body;

    if (!message) {
      return Response.json({ error: "message required" }, { status: 400 });
    }

    // Generate fingerprint for grouping
    const { data: fp } = await admin.rpc("generate_error_fingerprint", {
      p_message: message?.substring(0, 200) || "",
      p_source: source,
      p_route: route || "",
    });

    // Parse user agent
    const ua = userAgent || request.headers.get("user-agent") || "";
    const browser = parseBrowser(ua);
    const os = parseOS(ua);

    await admin.from("error_logs").insert({
      message: message?.substring(0, 2000),
      stack: stack?.substring(0, 10000),
      source,
      level,
      user_id: userId || null,
      organization_id: organizationId || null,
      url: url?.substring(0, 500),
      route: route?.substring(0, 200),
      user_agent: ua.substring(0, 500),
      browser,
      os,
      metadata,
      fingerprint: fp || null,
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[Error Tracking API]", err);
    return Response.json({ error: "Failed to log error" }, { status: 500 });
  }
}

function parseBrowser(ua: string): string {
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "Unknown";
}

function parseOS(ua: string): string {
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "Unknown";
}
