import { createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    /** Subdomain tenant slug, e.g. "empresa-x" from "empresa-x.grixi.ai". Null on root domain. */
    tenantSlug: string | null;
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const tenantSlug = getTenantSlug(request, env.APP_DOMAIN);

    // Rate limit admin routes: 30 req/min per IP
    if (url.pathname.startsWith("/admin") && env.ADMIN_RATE_LIMITER) {
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

    const response = await requestHandler(request, {
      cloudflare: { env, ctx },
      tenantSlug,
    });

    // SECURITY: Append stale cookie cleanup headers to every response
    const cleanupHeaders = getStaleSessionCleanupHeaders(request, env.APP_DOMAIN);
    if (cleanupHeaders.length > 0) {
      // Clone response to add headers
      const newResponse = new Response(response.body, response);
      for (const header of cleanupHeaders) {
        newResponse.headers.append("Set-Cookie", header);
      }
      return newResponse;
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
