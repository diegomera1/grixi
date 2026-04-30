/**
 * Health Check — /api/health
 * Validates Supabase connection and environment.
 * 
 * SECURITY: Requires X-Health-Secret header matching env.HEALTH_SECRET.
 * If no secret is configured, returns minimal "ok" status only.
 */
import type { Route } from "./+types/api.health";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const healthSecret = (env as any).HEALTH_SECRET as string | undefined;
  const providedSecret = request.headers.get("X-Health-Secret");

  // If no secret configured or secret doesn't match → minimal response only
  if (!healthSecret || providedSecret !== healthSecret) {
    return Response.json(
      { status: "ok", timestamp: new Date().toISOString() },
      {
        status: 200,
        headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
      }
    );
  }

  // Full health check (authenticated)
  const start = Date.now();
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // 1. Supabase connectivity
  try {
    const t0 = Date.now();
    const admin = createSupabaseAdminClient(env);
    const { error } = await admin.from("organizations").select("id", { count: "exact", head: true });
    checks.supabase = {
      status: error ? "degraded" : "ok",
      latency: Date.now() - t0,
      ...(error && { error: error.message }),
    };
  } catch (e: any) {
    checks.supabase = { status: "error", error: e.message };
  }

  // 2. Environment variables (only report missing count, not names)
  const requiredVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY"];
  const missingCount = requiredVars.filter((v) => !(env as Record<string, string>)[v]).length;
  checks.env = {
    status: missingCount === 0 ? "ok" : "degraded",
    ...(missingCount > 0 && { error: `${missingCount} variable(s) missing` }),
  };

  // 3. R2 bucket
  checks.r2 = { status: env.ASSETS_BUCKET ? "ok" : "unavailable" };

  // Overall status
  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return Response.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: `${Date.now() - start}ms`,
      services: checks,
    },
    {
      status: allOk ? 200 : 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
    }
  );
}
