import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Skip middleware for auth callback — the route handler needs
  // the PKCE code verifier cookie intact (middleware's getUser()
  // can consume it before exchangeCodeForSession runs).
  if (request.nextUrl.pathname.startsWith("/auth/callback")) {
    return NextResponse.next();
  }

  try {
    // Dynamic import to prevent Edge Runtime crash if module has issues
    const { updateSession } = await import("@/lib/supabase/middleware");
    return await updateSession(request);
  } catch {
    // If middleware fails for any reason, don't block the request
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (build assets)
     * - favicon.ico, brand/, textures/, api/ (public static assets)
     * - / (root landing page)
     */
    "/((?!_next/static|_next/image|favicon.ico|brand/|textures/|api/).*)",
  ],
};
