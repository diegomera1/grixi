import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase env vars in auth callback");
      return NextResponse.redirect(`${origin}/login?error=config`);
    }

    // Debug: log all cookies arriving at the callback
    const allCookies = request.cookies.getAll();
    console.log("[auth/callback] Cookies received:", allCookies.map(c => c.name));
    const hasCodeVerifier = allCookies.some(c => c.name.includes("code-verifier"));
    console.log("[auth/callback] Has PKCE code verifier:", hasCodeVerifier);

    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] Exchange error:", error.message);
      // If PKCE verifier is missing, it's likely a stale cookie issue —
      // redirect cleanly so the user can retry with a fresh flow.
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }

    // Sync profile data from Google + log the login event
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // ── EMAIL ALLOWLIST CHECK ──────────────────────
      // Verify the user's email is in the allowed_emails table
      const { data: allowedEntry } = await supabase
        .from("allowed_emails")
        .select("id")
        .eq("email", user.email?.toLowerCase() || "")
        .maybeSingle();

      if (!allowedEntry) {
        // Email not in allowlist — revoke the session and redirect
        console.warn(`Unauthorized login attempt: ${user.email}`);
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=unauthorized`);
      }

      // Sync Google avatar and full name to profiles table
      // Only update avatar if profile doesn't have a custom (non-Google) one
      const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
      const googleName = user.user_metadata?.full_name || user.user_metadata?.name;
      
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      
      const hasCustomAvatar = currentProfile?.avatar_url && 
        !currentProfile.avatar_url.includes("googleusercontent.com") &&
        !currentProfile.avatar_url.includes("randomuser.me");

      const updateData: Record<string, string> = {};
      if (googleAvatar && !hasCustomAvatar) updateData.avatar_url = googleAvatar;
      if (googleName) updateData.full_name = googleName;
      updateData.last_active_at = new Date().toISOString();
      await supabase.from("profiles").update(updateData).eq("id", user.id);

      // Ensure user is a member of the org
      await supabase.from("organization_members").upsert({
        user_id: user.id,
        org_id: "a0000000-0000-0000-0000-000000000001",
      }, { onConflict: "org_id,user_id" });

      // Log the login audit event
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        org_id: "a0000000-0000-0000-0000-000000000001",
        action: "login",
        resource_type: "session",
        new_data: {
          description: "Inició sesión con Google",
          email: user.email,
          provider: user.app_metadata?.provider || "google",
        },
      });
    }

    return response;
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
