import { redirect } from "react-router";
import type { Route } from "./+types/auth.callback";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return redirect("/login?error=generic");
  }

  // Determine return URL (subdomain that initiated the OAuth flow)
  const returnTo = url.searchParams.get("return_to");
  // Security: only allow redirects to *.grixi.ai subdomains
  const isValidReturn = returnTo &&
    (new URL(returnTo).hostname.endsWith(".grixi.ai") || new URL(returnTo).hostname === "grixi.ai");
  const baseUrl = isValidReturn ? returnTo : "";

  const { supabase, headers } = createSupabaseServerClient(request, env);

  // Exchange code for session
  const { data: sessionData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

  if (authError || !sessionData.user) {
    console.error("Auth callback error:", authError);
    return redirect(`${baseUrl}/login?error=generic`);
  }

  const userEmail = sessionData.user.email;
  if (!userEmail) {
    return redirect(`${baseUrl}/login?error=generic`);
  }

  // Check whitelist access using admin client (bypasses RLS)
  const admin = createSupabaseAdminClient(env);

  // 1. Check existing memberships
  const { data: existingMemberships } = await admin
    .from("memberships")
    .select("organization_id, organizations(slug, name)")
    .eq("user_id", sessionData.user.id);

  if (existingMemberships && existingMemberships.length > 0) {
    // User already has access — route to org
    if (existingMemberships.length === 1) {
      return redirect(`${baseUrl}/dashboard`, { headers });
    }
    return redirect(`${baseUrl}/select-org`, { headers });
  }

  // 2. Verify whitelist (invitations + domain whitelists)
  const { data: whitelistAccess, error: whitelistError } = await admin.rpc(
    "verify_whitelist_access",
    { user_email: userEmail }
  );

  if (whitelistError || !whitelistAccess || whitelistAccess.length === 0) {
    // No access — sign out and redirect
    await supabase.auth.signOut();
    return redirect(`${baseUrl}/login?error=unauthorized`);
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
    return redirect(`${baseUrl}/dashboard`, { headers });
  }

  return redirect(`${baseUrl}/select-org`, { headers });
}
