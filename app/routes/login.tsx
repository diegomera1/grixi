import { redirect, useLoaderData } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/login";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { AnimatedNodes } from "~/components/login/animated-nodes";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const tenantSlug = (context as any).tenantSlug as string | null;
  const { supabase } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Admin portal → /admin, tenant portal → /dashboard
    const host = request.headers.get("host") || "";
    const isAdmin = host.startsWith("admin.") || host.startsWith("admin.grixi.ai");
    return redirect(isAdmin ? "/admin" : "/dashboard");
  }

  let tenantBranding: { name: string; logoUrl: string | null; primaryColor: string } | null = null;
  if (tenantSlug) {
    const admin = createSupabaseAdminClient(env);
    const { data: org } = await admin
      .from("organizations")
      .select("name, logo_url, settings")
      .eq("slug", tenantSlug)
      .eq("status", "active")
      .maybeSingle();
    if (org) {
      tenantBranding = {
        name: org.name,
        logoUrl: org.logo_url,
        primaryColor: org.settings?.primary_color || "#7c3aed",
      };
    }
  }

  return {
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    tenantBranding,
    tenantSlug,
  };
}

export default function LoginPage() {
  const { supabaseUrl, supabaseAnonKey, tenantBranding, tenantSlug } = useLoaderData<typeof loader>();

  const logoSrc = tenantBranding?.logoUrl || "/grixi-logo.png";
  const brandName = tenantBranding?.name || "GRIXI";
  const brandColor = tenantBranding?.primaryColor || "#7c3aed";
  const isGrixi = !tenantBranding;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <AnimatedNodes />

      <div className="relative z-10 w-full max-w-[340px] px-6 login-card-enter">
        <div className="flex flex-col items-center">

          {/* Logo — clean, no duplicate text */}
          <div className="logo-enter mb-2 relative">
            <img
              src={logoSrc}
              alt={brandName}
              className="relative h-14 w-auto rounded-2xl"
              style={{ filter: `drop-shadow(0 0 12px ${brandColor}25)` }}
              draggable={false}
            />
          </div>

          {/* Tenant name (only for tenants, GRIXI logo already has the name) */}
          <div className="mb-6 text-center brand-enter">
            {!isGrixi && (
              <h1 className="text-lg font-semibold tracking-tight text-white/90 mb-1">
                {brandName}
              </h1>
            )}
            <p className="text-[10px] tracking-[0.18em] text-white/18 uppercase">
              La interconexión inteligente
            </p>
            {tenantSlug && (
              <p className="mt-1 text-[10px] text-white/12">{tenantSlug}.grixi.ai</p>
            )}
          </div>

          {/* Google */}
          <div className="w-full button-enter">
            <GoogleSignInButton supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey} />
          </div>

          {/* Microsoft */}
          <div className="w-full mt-2.5 button-enter" style={{ animationDelay: "0.58s" }}>
            <MicrosoftSignInButton supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey} />
          </div>

          {/* Divider */}
          <div className="my-4 w-full button-enter" style={{ animationDelay: "0.62s" }}>
            <div className="login-divider">
              <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/18 whitespace-nowrap">
                o continúa con
              </span>
            </div>
          </div>

          {/* Email — full width */}
          <div className="w-full button-enter" style={{ animationDelay: "0.66s" }}>
            <EmailSignInButton supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey} />
          </div>

          {/* Email expandable form */}
          <div className="w-full">
            <EmailFormPanel supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey} />
          </div>

          {/* Passkey — full width */}
          <div className="w-full mt-2.5 button-enter" style={{ animationDelay: "0.70s" }}>
            <PasskeySignInButton supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey} />
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-[9px] text-white/12 footer-enter">
            © {new Date().getFullYear()} GRIXI · Powered by GRIXI Platform
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeLogo {
          from { opacity: 0; transform: scale(0.88); filter: blur(8px); }
          to { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .login-card-enter { animation: fadeSlideUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both; }
        .logo-enter { animation: fadeLogo 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both; }
        .brand-enter { animation: fadeSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both; }
        .button-enter { animation: fadeSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.55s both; }
        .footer-enter { animation: fadeIn 1s ease 1.2s both; }


      `}</style>
    </div>
  );
}

/* ── Shared button style helper ── */
const BTN_PRIMARY = "btn-auth btn-auth-primary flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-[13px] font-medium text-white/85";
const BTN_SECONDARY = "btn-auth btn-auth-secondary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium text-white/55 hover:text-white/85";


/* ═══ Google ═══ */
function GoogleSignInButton({ supabaseUrl, supabaseAnonKey }: { supabaseUrl: string; supabaseAnonKey: string }) {
  const handleSignIn = async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
  };
  return (
    <button onClick={handleSignIn} className={BTN_PRIMARY}>
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      <span>Iniciar sesión con Google</span>
    </button>
  );
}

/* ═══ Microsoft ═══ */
function MicrosoftSignInButton({ supabaseUrl, supabaseAnonKey }: { supabaseUrl: string; supabaseAnonKey: string }) {
  const handleSignIn = async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    await supabase.auth.signInWithOAuth({ provider: "azure", options: { redirectTo: `${window.location.origin}/auth/callback`, scopes: "email profile openid" } });
  };
  return (
    <button onClick={handleSignIn} className={BTN_SECONDARY}>
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 21 21" fill="none">
        <rect x="1" y="1" width="9" height="9" fill="#F25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
        <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
        <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
      </svg>
      <span>Iniciar sesión con Microsoft</span>
    </button>
  );
}

/* ═══ Email trigger button ═══ */
function EmailSignInButton({ supabaseUrl, supabaseAnonKey }: { supabaseUrl: string; supabaseAnonKey: string }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsOpen((v) => !v);
    window.addEventListener("grixi:toggle-email-form", handler);
    return () => window.removeEventListener("grixi:toggle-email-form", handler);
  }, []);

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("grixi:toggle-email-form"));
  };
  return (
    <button onClick={handleClick} className={`${BTN_SECONDARY} ${isOpen ? 'btn-auth-email-open' : ''}`}>
      <svg className={`h-3.5 w-3.5 shrink-0 transition-opacity duration-200 ${isOpen ? 'opacity-80' : 'opacity-50'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
      <span>Correo y contraseña</span>
    </button>
  );
}

/* ═══ Email form panel — slides down below the row ═══ */
function EmailFormPanel({ supabaseUrl, supabaseAnonKey }: { supabaseUrl: string; supabaseAnonKey: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setOpen((v) => !v);
    window.addEventListener("grixi:toggle-email-form", handler);
    return () => window.removeEventListener("grixi:toggle-email-form", handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);
    setLoading(true);
    try {
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message === "Invalid login credentials" ? "Credenciales inválidas" : err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full overflow-hidden transition-all duration-350 ease-out"
      style={{
        maxHeight: open ? '220px' : '0px',
        opacity: open ? 1 : 0,
        marginTop: open ? '10px' : '0px',
        transition: 'max-height 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.25s ease, margin-top 0.35s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@empresa.com"
          autoFocus={open}
          required
          className="w-full rounded-lg bg-white/[0.05] border border-white/[0.07] px-3 py-2 text-[12px] text-white/85 placeholder-white/20
            outline-none focus:border-purple-500/30 focus:ring-1 focus:ring-purple-500/15 transition-all duration-200"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          required
          className="w-full rounded-lg bg-white/[0.05] border border-white/[0.07] px-3 py-2 text-[12px] text-white/85 placeholder-white/20
            outline-none focus:border-purple-500/30 focus:ring-1 focus:ring-purple-500/15 transition-all duration-200"
        />
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="btn-auth btn-auth-primary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-white/85 disabled:opacity-30"
        >
          {loading ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-white/25 border-t-white/80" />
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" x2="3" y1="12" y2="12" />
            </svg>
          )}
          <span>{loading ? "Ingresando..." : "Ingresar"}</span>
        </button>
        {error && <p className="text-center text-[10px] text-red-400/70">{error}</p>}
      </form>
    </div>
  );
}

/* ═══ Passkey ═══ */
function PasskeySignInButton({ supabaseUrl, supabaseAnonKey }: { supabaseUrl: string; supabaseAnonKey: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (typeof window === "undefined" || !window.PublicKeyCredential) return;
        const a = await PublicKeyCredential.isConditionalMediationAvailable?.();
        const p = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
        setSupported(!!(a || p));
      } catch { /* noop */ }
    })();
  }, []);

  const handlePasskeySignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const optRes = await fetch("/api/auth/passkey/auth-options", { method: "POST", headers: { "X-GRIXI-Client": "1" } });
      if (!optRes.ok) throw new Error("No se pudieron obtener opciones");
      const options = await optRes.json();
      const assertion = await startAuthentication({ optionsJSON: options });
      const verRes = await fetch("/api/auth/passkey/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-GRIXI-Client": "1" },
        body: JSON.stringify({ assertion, challenge: options.challenge }),
      });
      if (!verRes.ok) { const err = await verRes.json(); throw new Error(err.error || "Verificación fallida"); }
      const { tokenHash } = await verRes.json();
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
      const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (otpError) throw new Error(otpError.message);
      window.location.href = "/dashboard";
    } catch (err: any) {
      if (err.name !== "NotAllowedError") setError(err.message || "Error con passkey");
    } finally { setLoading(false); }
  };

  if (!supported) return null;

  return (
    <>
      <button onClick={handlePasskeySignIn} disabled={loading}
        className={`${BTN_SECONDARY} btn-auth-passkey disabled:opacity-40`}>
        {loading ? (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-white/25 border-t-emerald-400/80" />
        ) : (
          <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
            <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
            <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
            <path d="M2 12a10 10 0 0 1 18-6" /><path d="M2 16h.01" />
            <path d="M21.8 16c.2-2 .131-5.354 0-6" />
            <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
            <path d="M8.65 22c.21-.66.45-1.32.57-2" />
            <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
          </svg>
        )}
        <span>{loading ? "Verificando..." : "Iniciar con Passkey"}</span>
      </button>
      {error && <p className="mt-1.5 text-center text-[10px] text-red-400/70">{error}</p>}
    </>
  );
}
