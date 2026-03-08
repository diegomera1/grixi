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
      console.error("Auth callback error:", error.message);
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }

    // Log the login event to audit
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
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
