import { redirect } from "react-router";
import type { Route } from "./+types/auth.callback";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return redirect("/?error=generic");
  }

  const { supabase, headers } = createSupabaseServerClient(request, env);

  // Exchange code for session (PKCE: code_verifier cookie must be on same origin)
  const { data: sessionData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

  if (authError || !sessionData.user) {
    console.error("Auth callback error:", authError);
    return redirect("/?error=auth_failed");
  }

  const userEmail = sessionData.user.email;
  if (!userEmail) {
    return redirect("/?error=no_email");
  }

  // Check whitelist access using admin client (bypasses RLS)
  const admin = createSupabaseAdminClient(env);

  // 1. Check existing memberships
  const { data: existingMemberships } = await admin
    .from("memberships")
    .select("organization_id, organizations(slug, name)")
    .eq("user_id", sessionData.user.id);

  if (existingMemberships && existingMemberships.length > 0) {
    // User already has access — route to dashboard
    if (existingMemberships.length === 1) {
      return redirect("/dashboard", { headers });
    }
    return redirect("/select-org", { headers });
  }

  // 2. Verify whitelist (invitations + domain whitelists)
  const { data: whitelistAccess, error: whitelistError } = await admin.rpc(
    "verify_whitelist_access",
    { user_email: userEmail }
  );

  if (whitelistError || !whitelistAccess || whitelistAccess.length === 0) {
    // No access — sign out and redirect
    await supabase.auth.signOut();
    return redirect("/?error=unauthorized");
  }

  // 3. Create memberships for each whitelisted org
  for (const access of whitelistAccess) {
    // Find the role
    const { data: role } = await admin
      .from("roles")
      .select("id")
      .eq("name", access.role_name)
      .eq("organization_id", access.organization_id)
      .single();

    if (role) {
      await admin.from("memberships").upsert(
        {
          user_id: sessionData.user.id,
          organization_id: access.organization_id,
          role_id: role.id,
        },
        { onConflict: "user_id,organization_id" }
      );
    }

    // Mark invitation as accepted if source is invitation
    if (access.source === "invitation") {
      await admin
        .from("invitations")
        .update({ status: "accepted" })
        .eq("email", userEmail)
        .eq("organization_id", access.organization_id)
        .eq("status", "pending");
    }
  }

  // Route based on number of orgs
  if (whitelistAccess.length === 1) {
    return redirect("/dashboard", { headers });
  }

  return redirect("/select-org", { headers });
}
