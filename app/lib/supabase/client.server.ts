import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Create a Supabase server client for use in loaders/actions.
 * Handles cookie-based auth automatically via @supabase/ssr.
 */
export function createSupabaseServerClient(
  request: Request,
  env: Env
): { supabase: SupabaseClient; headers: Headers } {
  const headers = new Headers();

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          headers.append("Set-Cookie", serializeCookieHeader(name, value, options));
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
