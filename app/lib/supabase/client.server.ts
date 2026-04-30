import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Detect if the request is coming from admin.grixi.ai
 */
function isAdminPortal(request: Request): boolean {
  const host = request.headers.get("host") || "";
  return host.startsWith("admin.grixi.ai") || host.startsWith("admin.");
}

/**
 * Create a Supabase server client for use in loaders/actions.
 * Handles cookie-based auth automatically via @supabase/ssr.
 *
 * SECURITY: Cookies are scoped to the exact hostname (no domain= attribute).
 * This ensures tenant session isolation: acme.grixi.ai cookies are NOT
 * visible to empresa-x.grixi.ai or any other subdomain.
 *
 * ADMIN SECURITY: On admin.grixi.ai, cookies are session-only (no maxAge),
 * meaning closing the browser kills the session. SameSite=Strict prevents
 * CSRF attacks on the admin panel.
 */
export function createSupabaseServerClient(
  request: Request,
  env: Env
): { supabase: SupabaseClient; headers: Headers } {
  const headers = new Headers();
  const isAdmin = isAdminPortal(request);

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "")
          .filter((c): c is { name: string; value: string } => c.value != null);
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Build cookie options based on portal type
          const cookieOptions: Record<string, any> = {
            ...options,
            // SECURITY: No domain= → cookie scoped to exact hostname only
            // DO NOT set domain here — omitting it means the browser
            // restricts the cookie to the exact hostname.
          };

          if (isAdmin) {
            // ═══ ADMIN PORTAL SECURITY ═══
            // 1. Remove maxAge → session cookie (dies when browser closes)
            delete cookieOptions.maxAge;
            delete cookieOptions.expires;
            // 2. SameSite=Strict → no CSRF on admin panel
            //    (OAuth login happens on the main portal, not admin)
            cookieOptions.sameSite = "strict";
            // 3. Always secure in production
            cookieOptions.secure = true;
          }
          // Tenant portals: keep Supabase defaults (Lax + persistent)

          headers.append(
            "Set-Cookie",
            serializeCookieHeader(name, value, cookieOptions)
          );
        });
      },
    },
  });

  return { supabase, headers };
}

/**
 * Create a Supabase admin client (bypasses RLS).
 * Use ONLY for platform admin operations.
 */
export function createSupabaseAdminClient(env: Env): SupabaseClient {
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}
