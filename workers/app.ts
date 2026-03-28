import { createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    /** Subdomain tenant slug, e.g. "empresa-x" from "empresa-x.grixi.ai". Null on root domain. */
    tenantSlug: string | null;
  };
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

    return requestHandler(request, {
      cloudflare: { env, ctx },
      tenantSlug,
    });
  },
} satisfies ExportedHandler<Env>;
