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
    const tenantSlug = getTenantSlug(request, env.APP_DOMAIN);

    return requestHandler(request, {
      cloudflare: { env, ctx },
      tenantSlug,
    });
  },
} satisfies ExportedHandler<Env>;
