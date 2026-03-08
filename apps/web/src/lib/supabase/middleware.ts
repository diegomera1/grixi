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

  // Refresh session if it exists
  await supabase.auth.getUser();

  // For demo mode: skip auth protection — all routes are public
  // When Google OAuth is configured, uncomment the protection logic below:
  
  // const { data: { user } } = await supabase.auth.getUser();
  // const protectedPaths = ["/dashboard", "/usuarios", "/administracion", "/almacenes"];
  // const isProtectedRoute = protectedPaths.some((path) =>
  //   request.nextUrl.pathname.startsWith(path)
  // );
  // if (isProtectedRoute && !user) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = "/login";
  //   return NextResponse.redirect(url);
  // }
  // if (request.nextUrl.pathname === "/login" && user) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = "/dashboard";
  //   return NextResponse.redirect(url);
  // }

  return supabaseResponse;
}
