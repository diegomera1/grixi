import { redirect } from "react-router";
import type { Route } from "./+types/auth.signout";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request, context.cloudflare.env);
  await supabase.auth.signOut();
  return redirect("/login", { headers });
}
