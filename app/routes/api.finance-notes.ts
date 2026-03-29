import { createSupabaseServerClient } from "~/lib/supabase/client.server";

/**
 * GRIXI Finance Notes — Resource route
 * POST: Update notes on a financial transaction
 */
export async function action({ request, context }: { request: Request; context: { cloudflare: { env: Env } } }) {
  const env = context.cloudflare.env;
  const { supabase } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id, notes } = (await request.json()) as { id: string; notes: string };

  if (!id) {
    return Response.json({ error: "Missing transaction ID" }, { status: 400 });
  }

  const { error } = await supabase
    .from("finance_transactions")
    .update({ notes })
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
