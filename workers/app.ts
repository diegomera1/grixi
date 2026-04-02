import { createRequestHandler } from "react-router";

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
} satisfies ExportedHandler<Env>;
