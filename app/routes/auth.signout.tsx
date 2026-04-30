import { redirect } from "react-router";
import type { Route } from "./+types/auth.signout";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";
import { clearAdminSession } from "~/lib/platform-rbac/admin-session.server";

/**
 * Shared signout logic — clears Supabase session + admin KV session
 */
async function performSignOut(request: Request, env: any) {
  const { supabase, headers } = createSupabaseServerClient(request, env);

  // Get user before signing out (needed for KV cleanup)
  const { data: { user } } = await supabase.auth.getUser();

  // Clear admin session from KV (if applicable)
  if (user) {
    const kv = (env as any).KV_CACHE as KVNamespace | undefined;
    await clearAdminSession(user.id, kv);
  }

  // Sign out from Supabase (global = all devices)
  await supabase.auth.signOut({ scope: "global" });

  return headers;
}

/**
 * POST handler — used by <Form method="post"> (sidebar logout button)
 */
export async function action({ request, context }: Route.ActionArgs) {
  const headers = await performSignOut(request, context.cloudflare.env);
  return redirect("/", { headers });
}

/**
 * GET fallback — direct navigation to /auth/signout
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const headers = await performSignOut(request, context.cloudflare.env);
  return redirect("/", { headers });
}
