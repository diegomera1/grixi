import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/login";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";
import { AnimatedNodes } from "~/components/login/animated-nodes";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request, context.cloudflare.env);
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return redirect("/dashboard");
  }

  return {
    supabaseUrl: context.cloudflare.env.SUPABASE_URL,
    supabaseAnonKey: context.cloudflare.env.SUPABASE_ANON_KEY,
  };
}

export default function LoginPage() {
  const { supabaseUrl, supabaseAnonKey } = useLoaderData<typeof loader>();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Animated background */}
      <AnimatedNodes />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm px-6 login-card-enter">
        <div className="flex flex-col items-center">
          {/* GRIXI Logo */}
          <div className="logo-enter mb-12">
            <img
              src="/grixi-logo.png"
              alt="GRIXI"
              className="h-20 w-auto drop-shadow-[0_0_40px_rgba(139,92,246,0.25)]"
              draggable={false}
            />
          </div>

          {/* Google Sign-In */}
          <div className="w-full button-enter">
            <GoogleSignInButton
              supabaseUrl={supabaseUrl}
              supabaseAnonKey={supabaseAnonKey}
            />
          </div>

          {/* Footer */}
          <p className="mt-10 text-center text-[11px] text-white/20 footer-enter">
            © {new Date().getFullYear()} GRIXI
          </p>
        </div>
      </div>

      {/* Entrance animation styles */}
      <style>{`
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeLogo {
          from {
            opacity: 0;
            transform: scale(0.9);
            filter: blur(8px);
          }
          to {
            opacity: 1;
            transform: scale(1);
            filter: blur(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .login-card-enter {
          animation: fadeSlideUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
        }

        .logo-enter {
          animation: fadeLogo 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
        }

        .button-enter {
          animation: fadeSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.55s both;
        }

        .footer-enter {
          animation: fadeIn 1s ease 1.2s both;
        }
      `}</style>
    </div>
  );
}

function GoogleSignInButton({
  supabaseUrl,
  supabaseAnonKey,
}: {
  supabaseUrl: string;
  supabaseAnonKey: string;
}) {
  const handleSignIn = async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

    // Always redirect OAuth to root domain (grixi.ai) for centralized auth.
    // Preserve the current subdomain origin via return_to param so we can
    // redirect back to the correct tenant subdomain after authentication.
    const currentOrigin = window.location.origin;
    const isSubdomain = window.location.hostname !== "grixi.ai" &&
                        window.location.hostname.endsWith(".grixi.ai");
    const callbackUrl = isSubdomain
      ? `https://grixi.ai/auth/callback?return_to=${encodeURIComponent(currentOrigin)}`
      : `${currentOrigin}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    });
  };

  return (
    <button
      onClick={handleSignIn}
      className="group flex w-full items-center justify-center gap-3 rounded-xl
        bg-white/[0.07] backdrop-blur-md border border-white/[0.08]
        px-5 py-3.5 text-sm font-medium text-white/90
        transition-all duration-300 ease-out
        hover:bg-white/[0.12] hover:border-white/[0.15] hover:shadow-[0_0_40px_rgba(139,92,246,0.15)]
        active:scale-[0.97]"
    >
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
        <path
          fill="#fff"
          fillOpacity="0.9"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        />
        <path
          fill="#fff"
          fillOpacity="0.7"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#fff"
          fillOpacity="0.5"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#fff"
          fillOpacity="0.6"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      <span className="tracking-wide">Iniciar sesión con Google</span>
    </button>
  );
}
