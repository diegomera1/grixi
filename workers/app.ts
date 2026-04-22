import { createRequestHandler } from "react-router";
import { createClient } from "@supabase/supabase-js";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    /** Subdomain tenant slug, e.g. "empresa-x" from "empresa-x.grixi.ai". Null on root domain or admin portal. */
    tenantSlug: string | null;
    /** True when accessed from admin.grixi.ai — the dedicated platform admin portal */
    isPlatformAdminPortal: boolean;
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

/**
 * Extract tenant slug from subdomain.
 * - "empresa-x.grixi.ai" → "empresa-x"
 * - "grixi.ai" → null (root domain = platform admin)
 * - "grixi-app.grixi.workers.dev" → null (dev domain)
 */
function getTenantSlug(request: Request, appDomain: string): string | null {
  const hostname = new URL(request.url).hostname;

  // Skip workers.dev domain
  if (hostname.endsWith(".workers.dev")) return null;

  // Check if it's a subdomain of the app domain
  const suffix = `.${appDomain}`;
  if (hostname.endsWith(suffix)) {
    const sub = hostname.slice(0, -suffix.length);
    // Ignore empty subdomain (root domain) or "www"
    if (sub && sub !== "www") return sub;
  }

  return null;
}

/**
 * SECURITY: Clear stale cookies that were previously set with domain=.grixi.ai.
 * These cookies could leak sessions across tenants. By setting them to expire
 * with the old domain, we ensure browsers discard them.
 */
function getStaleSessionCleanupHeaders(request: Request, appDomain: string): string[] {
  const hostname = new URL(request.url).hostname;
  const isProduction = hostname.endsWith(appDomain) && !hostname.endsWith(".workers.dev");
  if (!isProduction) return [];

  const cookieHeader = request.headers.get("Cookie") || "";
  const cleanupHeaders: string[] = [];

  // Find Supabase auth cookies (sb-*-auth-token*)
  const supabaseCookiePattern = /sb-[a-z0-9]+-auth-token[^=]*/g;
  const matches = cookieHeader.match(supabaseCookiePattern) || [];

  for (const cookieName of matches) {
    // Expire the old domain-scoped cookie
    cleanupHeaders.push(
      `${cookieName}=; Domain=.${appDomain}; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; Secure; HttpOnly`
    );
  }

  // Also clear the old grixi_org cookie from the shared domain
  cleanupHeaders.push(
    `grixi_org=; Domain=.${appDomain}; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; Secure; HttpOnly`
  );

  return cleanupHeaders;
}

// ─── Security Headers ─────────────────────────────────────

function getSecurityHeaders(): Record<string, string> {
  return {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://*.supabase.co https://*.grixi.ai",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://accounts.google.com",
      "frame-src https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  };
}

// ─── Cache Headers ────────────────────────────────────────

function getCacheControl(pathname: string): string | null {
  // Static assets (hashed filenames) — cache forever
  if (/\.(js|css|woff2?|ttf|eot)$/.test(pathname) || pathname.startsWith("/assets/")) {
    return "public, max-age=31536000, immutable";
  }
  // Images — cache for 1 week
  if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/.test(pathname)) {
    return "public, max-age=604800, stale-while-revalidate=86400";
  }
  // API routes — no caching
  if (pathname.startsWith("/api/")) {
    return "no-store";
  }
  // HTML pages — revalidate
  return "no-cache, no-store, must-revalidate";
}

// ─── Scheduled Maintenance Tasks ──────────────────────────

interface CronResult {
  task: string;
  affected: number;
  error?: string;
}

async function runMaintenanceTasks(env: Env): Promise<CronResult[]> {
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results: CronResult[] = [];
  const now = new Date().toISOString();

  // ── 1. Expire stale invitations ──
  // Invitations past expires_at that are still 'pending' → mark as 'expired'
  try {
    const { data, error } = await admin
      .from("invitations")
      .update({ status: "expired", updated_at: now })
      .eq("status", "pending")
      .lt("expires_at", now)
      .select("id");

    results.push({
      task: "expire_invitations",
      affected: data?.length || 0,
      ...(error && { error: error.message }),
    });
  } catch (e: any) {
    results.push({ task: "expire_invitations", affected: 0, error: e.message });
  }

  // ── 2. Clean stale push subscriptions ──
  // Subscriptions not used in 90 days are likely dead browsers
  try {
    const staleDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("push_subscriptions")
      .delete()
      .lt("last_used_at", staleDate)
      .select("id");

    results.push({
      task: "clean_push_subscriptions",
      affected: data?.length || 0,
      ...(error && { error: error.message }),
    });
  } catch (e: any) {
    results.push({ task: "clean_push_subscriptions", affected: 0, error: e.message });
  }

  // ── 3. Mark old notifications as read ──
  // Notifications older than 30 days that are still unread → mark as read
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("notifications")
      .update({ read: true })
      .eq("read", false)
      .lt("created_at", thirtyDaysAgo)
      .select("id");

    results.push({
      task: "auto_read_old_notifications",
      affected: data?.length || 0,
      ...(error && { error: error.message }),
    });
  } catch (e: any) {
    results.push({ task: "auto_read_old_notifications", affected: 0, error: e.message });
  }

  // ── 4. Log maintenance run in audit_logs ──
  try {
    const totalAffected = results.reduce((sum, r) => sum + r.affected, 0);
    const hasErrors = results.some((r) => r.error);

    await admin.from("audit_logs").insert({
      actor_id: null,
      action: "system.cron_maintenance",
      entity_type: "system",
      entity_id: "cron",
      metadata: {
        results,
        total_affected: totalAffected,
        has_errors: hasErrors,
        ran_at: now,
      },
      ip_address: "cron-worker",
    });
  } catch {
    // Don't fail the whole cron if audit logging fails
  }

  return results;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const tenantSlug = getTenantSlug(request, env.APP_DOMAIN);

    // Detect admin.grixi.ai → platform admin portal
    const isPlatformAdminPortal = tenantSlug === "admin";

    // Rate limit admin routes AND admin portal: 30 req/min per IP
    const shouldRateLimit = (
      url.pathname.startsWith("/admin") || isPlatformAdminPortal
    ) && env.ADMIN_RATE_LIMITER;

    if (shouldRateLimit) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const { success } = await env.ADMIN_RATE_LIMITER.limit({
        key: `admin_${ip}`,
      });
      if (!success) {
        return new Response(
          JSON.stringify({ error: "Too Many Requests" }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60",
            },
          }
        );
      }
    }
    // ── CSRF Protection: mutation API routes require X-GRIXI-Client header ──
    const isMutationApi = url.pathname.startsWith("/api/") &&
      ["POST", "PUT", "DELETE", "PATCH"].includes(request.method);

    if (isMutationApi) {
      const hasClientHeader = request.headers.get("X-GRIXI-Client") === "1";
      const isFormSubmission = request.headers.get("Content-Type")?.includes("multipart/form-data");
      // Allow form submissions from same-origin (file uploads) + require header for JSON APIs
      if (!hasClientHeader && !isFormSubmission) {
        return new Response(
          JSON.stringify({ error: "Forbidden — missing client header" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              ...getSecurityHeaders(),
            },
          }
        );
      }
    }

    try {
      const response = await requestHandler(request, {
        cloudflare: { env, ctx },
        tenantSlug: isPlatformAdminPortal ? null : tenantSlug,
        isPlatformAdminPortal,
      } as any);

      // Build enhanced response with security + cache headers
      const newResponse = new Response(response.body, response);

      // Security headers
      const secHeaders = getSecurityHeaders();
      for (const [key, value] of Object.entries(secHeaders)) {
        newResponse.headers.set(key, value);
      }

      // Cache headers
      const cacheControl = getCacheControl(url.pathname);
      if (cacheControl && !newResponse.headers.has("Cache-Control")) {
        newResponse.headers.set("Cache-Control", cacheControl);
      }

      // Stale cookie cleanup
      const cleanupHeaders = getStaleSessionCleanupHeaders(request, env.APP_DOMAIN);
      for (const header of cleanupHeaders) {
        newResponse.headers.append("Set-Cookie", header);
      }

      return newResponse;
    } catch (error: any) {
      // ── Structured error logging (appears in CF Workers Observability) ──
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      console.error(JSON.stringify({
        level: "error",
        message: error.message || "Unhandled error",
        stack: error.stack,
        path: url.pathname,
        method: request.method,
        hostname,
        ip,
        tenantSlug,
        timestamp: new Date().toISOString(),
      }));

      return new Response(
        JSON.stringify({ error: "Internal Server Error" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...getSecurityHeaders(),
          },
        }
      );
    }
  },

  // ─── Cron: Automated Maintenance ──────────────────────────
  // Runs daily at 03:00 UTC (22:00 ECT) to clean up stale data
  async scheduled(event, env, ctx) {
    const results = await runMaintenanceTasks(env);
    const totalAffected = results.reduce((sum, r) => sum + r.affected, 0);
    const hasErrors = results.some((r) => r.error);

    console.log(JSON.stringify({
      level: hasErrors ? "warn" : "info",
      message: `Cron maintenance completed: ${totalAffected} records affected`,
      results,
      trigger: event.cron,
      scheduledTime: new Date(event.scheduledTime).toISOString(),
    }));
  },
} satisfies ExportedHandler<Env>;
