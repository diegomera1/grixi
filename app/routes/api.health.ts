/**
 * Health Check — /api/health
 * Validates Supabase connection, environment variables, and R2 availability.
 * Used for monitoring and CI/CD validation.
 */
import type { Route } from "./+types/api.health";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
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

  // 2. Environment variables
  const requiredVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY"];
  const missingVars = requiredVars.filter((v) => !(env as Record<string, string>)[v]);
  checks.env = {
    status: missingVars.length === 0 ? "ok" : "degraded",
    ...(missingVars.length > 0 && { error: `Missing: ${missingVars.join(", ")}` }),
  };

  // 3. R2 bucket
  try {
    checks.r2 = {
      status: env.ASSETS_BUCKET ? "ok" : "unavailable",
    };
  } catch {
    checks.r2 = { status: "unavailable" };
  }

  // Overall status
  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const hasDegraded = Object.values(checks).some((c) => c.status === "degraded");

  return Response.json(
    {
      status: allOk ? "ok" : hasDegraded ? "degraded" : "error",
      version: env.APP_ENV || "development",
      timestamp: new Date().toISOString(),
      uptime: `${Date.now() - start}ms`,
      services: checks,
    },
    {
      status: allOk ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    }
  );
}
