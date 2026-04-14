"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function loginWithGoogle() {
  const supabase = await createClient();
  const headerStore = await headers();

  // Build origin: use the Origin header (e.g. "http://localhost:3000"),
  // fall back to x-forwarded-host with protocol, or default to localhost.
  const originHeader = headerStore.get("origin");
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") || "http";
  const origin = originHeader || (host ? `${proto}://${host}` : "http://localhost:3000");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("[loginWithGoogle] OAuth error:", error.message);
    redirect("/login?error=auth");
  }

  if (data.url) {
    redirect(data.url);
  }

  redirect("/login?error=auth");
}
