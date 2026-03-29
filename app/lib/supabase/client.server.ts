import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Create a Supabase server client for use in loaders/actions.
 * Handles cookie-based auth automatically via @supabase/ssr.
 *
 * SECURITY: Cookies are scoped to the exact hostname (no domain= attribute).
 * This ensures tenant session isolation: acme.grixi.ai cookies are NOT
 * visible to empresa-x.grixi.ai or any other subdomain.
 */
export function createSupabaseServerClient(
  request: Request,
  env: Env
): { supabase: SupabaseClient; headers: Headers } {
  const headers = new Headers();

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "")
          .filter((c): c is { name: string; value: string } => c.value != null);
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          headers.append(
            "Set-Cookie",
            serializeCookieHeader(name, value, {
              ...options,
              // SECURITY: No domain= → cookie scoped to exact hostname only
              // This is the key multi-tenant isolation measure.
              // DO NOT set domain here — omitting it means the browser
              // restricts the cookie to the exact hostname (acme.grixi.ai
              // cookies are invisible to empresa-x.grixi.ai).
              //
              // DO NOT override sameSite to "strict" — OAuth callback 
              // redirects from Google are cross-site navigations that
              // need "lax" (Supabase default) to work.
              //
              // DO NOT set httpOnly — Supabase SSR needs client-side 
              // cookie access for token refresh.
            })
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
