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
              // No domain= → browser scopes cookie to exact hostname only
              // This is the key multi-tenant security measure
              ...options,
              sameSite: "strict",
              secure: true,
              httpOnly: true,
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
