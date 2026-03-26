import { redirect, useLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/login";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";
import { AnimatedNodes } from "~/components/login/animated-nodes";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request, context.cloudflare.env);
  const { data: { user } } = await supabase.auth.getUser();

  // If already logged in, redirect to dashboard
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
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Animated background */}
      <AnimatedNodes />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="glass-strong rounded-2xl p-8 shadow-xl">
          {/* GRIXI Icon */}
          <div className="flex justify-center mb-6">
            <GrixiIcon className="h-16 w-16" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white text-center mb-1">
            GRIXI
          </h1>
          <p className="text-[var(--muted-foreground)] text-center text-sm mb-8">
            Plataforma empresarial inteligente
          </p>

          {/* Error message */}
          {error === "unauthorized" && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
              <p className="text-sm text-red-400">
                No tienes acceso a GRIXI. Contacta al administrador de tu organización.
              </p>
            </div>
          )}

          {error === "generic" && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
              <p className="text-sm text-red-400">
                Ocurrió un error. Intenta de nuevo.
              </p>
            </div>
          )}

          {/* Google Sign-In */}
          <GoogleSignInButton supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey} />

          {/* Language Selector */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <LanguageOption code="es" label="ES" />
            <span className="text-[var(--muted-foreground)] text-xs">•</span>
            <LanguageOption code="en" label="EN" />
            <span className="text-[var(--muted-foreground)] text-xs">•</span>
            <LanguageOption code="pt" label="PT" />
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
          © {new Date().getFullYear()} GRIXI. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}

function GoogleSignInButton({ supabaseUrl, supabaseAnonKey }: { supabaseUrl: string; supabaseAnonKey: string }) {
  const handleSignIn = async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <button
      onClick={handleSignIn}
      className="group flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      <span>Continuar con Google</span>
    </button>
  );
}

function LanguageOption({ code, label }: { code: string; label: string }) {
  return (
    <button className="text-xs text-[var(--muted-foreground)] hover:text-white transition-colors duration-200 font-medium">
      {label}
    </button>
  );
}

/** GRIXI Node Icon — SVG version of the logo's network graph */
function GrixiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Network lines */}
      <line x1="30" y1="20" x2="70" y2="20" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
      <line x1="30" y1="20" x2="20" y2="50" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
      <line x1="30" y1="20" x2="50" y2="50" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
      <line x1="70" y1="20" x2="80" y2="50" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
      <line x1="70" y1="20" x2="50" y2="50" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
      <line x1="20" y1="50" x2="50" y2="50" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
      <line x1="50" y1="50" x2="80" y2="50" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
      <line x1="20" y1="50" x2="35" y2="80" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
      <line x1="50" y1="50" x2="35" y2="80" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
      <line x1="50" y1="50" x2="65" y2="80" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
      <line x1="80" y1="50" x2="65" y2="80" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
      <line x1="35" y1="80" x2="65" y2="80" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
      {/* Nodes */}
      <circle cx="30" cy="20" r="5" fill="#8B5CF6" />
      <circle cx="70" cy="20" r="5" fill="#8B5CF6" />
      <circle cx="20" cy="50" r="5" fill="#7C3AED" />
      <circle cx="50" cy="50" r="6" fill="#6D28D9" />
      <circle cx="80" cy="50" r="5" fill="#7C3AED" />
      <circle cx="35" cy="80" r="5" fill="#8B5CF6" />
      <circle cx="65" cy="80" r="5" fill="#8B5CF6" />
      {/* Center glow */}
      <circle cx="50" cy="50" r="15" fill="url(#centerGlow)" />
      <defs>
        <radialGradient id="centerGlow">
          <stop offset="0%" stopColor="rgba(139,92,246,0.2)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0)" />
        </radialGradient>
      </defs>
    </svg>
  );
}
