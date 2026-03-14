import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Safety: if env vars not set, pass through without crashing
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session and get user
  const { data: { user } } = await supabase.auth.getUser();

  // ── Route protection ──────────────────────────────
  const protectedPaths = ["/dashboard", "/command-center", "/usuarios", "/administracion", "/almacenes", "/finanzas", "/compras", "/ai"];
  const isProtectedRoute = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Redirect unauthenticated users to login (page routes only, NOT API routes)
  if (isProtectedRoute && !user && !request.nextUrl.pathname.startsWith("/api")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login page
  if (request.nextUrl.pathname === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
