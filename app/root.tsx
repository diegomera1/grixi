import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useNavigation,
} from "react-router";
import { useEffect, useState, useRef } from "react";
import type { Route } from "./+types/root";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";
import { detectLocale, loadTranslations, type Locale } from "~/lib/i18n";
import "./app.css";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Detect locale from user pref > Accept-Language > default
  const acceptLanguage = request.headers.get("Accept-Language");
  const locale = detectLocale({ acceptLanguage });
  const translations = await loadTranslations(locale);

  // Read theme preference from cookie (default: dark)
  const cookieHeader = request.headers.get("cookie") || "";
  const theme = cookieHeader.match(/grixi_theme=(light|dark)/)?.[1] ?? "dark";

  return Response.json(
    {
      locale,
      translations,
      theme,
      user: user ? { id: user.id, email: user.email } : null,
      env: {
        SUPABASE_URL: env.SUPABASE_URL,
        SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
      },
    },
    { headers }
  );
}

// ─── Navigation Progress Bar ──────────────────────────
function NavigationProgress() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (isNavigating) {
      setProgress(0);
      setVisible(true);
      // Animate to ~90% over time
      let p = 0;
      intervalRef.current = setInterval(() => {
        p += (90 - p) * 0.08;
        setProgress(Math.min(p, 90));
      }, 50);
    } else if (visible) {
      // Complete and fade
      clearInterval(intervalRef.current);
      setProgress(100);
      const t = setTimeout(() => { setVisible(false); setProgress(0); }, 300);
      return () => clearTimeout(t);
    }
    return () => clearInterval(intervalRef.current);
  }, [isNavigating]);

  if (!visible) return null;
  return (
    <div
      className="fixed inset-x-0 top-0 z-[9999] h-[2.5px] pointer-events-none"
      style={{ opacity: progress >= 100 ? 0 : 1, transition: "opacity 300ms ease" }}
    >
      <div
        className="h-full rounded-r-full"
        style={{
          width: `${progress}%`,
          background: "linear-gradient(90deg, var(--brand, #7C3AED), var(--brand-light, #A78BFA))",
          boxShadow: "0 0 10px var(--brand, #7C3AED), 0 0 5px var(--brand, #7C3AED)",
          transition: progress >= 100 ? "width 200ms ease" : "width 50ms linear",
        }}
      />
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>() as any;
  const locale = (data?.locale ?? "es") as Locale;
  const theme = data?.theme ?? "dark";

  return (
    <html lang={locale} className={theme === "dark" ? "dark" : ""}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
        <meta name="description" content="GRIXI — Plataforma empresarial inteligente" />
        <meta name="theme-color" content="#0a0a0f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <title>GRIXI</title>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen antialiased">
        <NavigationProgress />
        {children}
        <ScrollRestoration />
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let code = "500";
  let title = "Algo salió mal";
  let details = "Ocurrió un error inesperado. Estamos trabajando para resolverlo.";
  let stack: string | undefined;
  let isOffline = false;

  if (isRouteErrorResponse(error)) {
    code = String(error.status);
    if (error.status === 404) {
      title = "Página no encontrada";
      details = "La página que buscas no existe o fue movida.";
    } else if (error.status === 403) {
      title = "Sin acceso";
      details = "No tienes permisos para ver esta página.";
    } else {
      title = `Error ${error.status}`;
      details = error.statusText || details;
    }
  } else if (error && error instanceof Error) {
    console.error("[GRIXI Error]", error.message, error.stack);
    if (error.message.includes("fetch") || error.message.includes("network")) {
      isOffline = true;
      code = "⚡";
      title = "Sin conexión";
      details = "Revisa tu conexión a internet e intenta de nuevo.";
    } else {
      details = error.message;
    }
    if (import.meta.env.DEV) stack = error.stack;
  } else {
    console.error("[GRIXI Error]", String(error));
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ background: '#09090B', color: '#FAFAFA' }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle, #27272A 0.5px, transparent 0.5px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 80%)',
        }}
      />

      {/* Glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full blur-[100px]"
        style={{ backgroundColor: 'rgba(124, 58, 237, 0.15)' }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        {/* Logo */}
        <div className="relative">
          <div className="absolute inset-0 scale-150 rounded-2xl blur-2xl" style={{ backgroundColor: 'rgba(124, 58, 237, 0.2)' }} />
          <img src="/icon-192.png" alt="GRIXI" width={56} height={56} className="relative rounded-2xl" />
        </div>

        {/* Error code */}
        <p className="text-7xl font-bold tracking-tight" style={{ color: '#7C3AED' }}>
          {code}
        </p>

        {/* Title + details */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="max-w-sm text-sm leading-relaxed" style={{ color: '#A1A1AA' }}>
            {details}
          </p>
        </div>

        {/* Stack trace (dev only) */}
        {stack && (
          <details className="w-full max-w-lg text-left">
            <summary className="cursor-pointer text-xs font-medium" style={{ color: '#71717A' }}>
              Ver detalles técnicos
            </summary>
            <pre
              className="mt-2 max-h-48 overflow-auto rounded-lg p-3 text-[10px] leading-relaxed"
              style={{ background: '#111113', color: '#71717A', border: '1px solid #27272A' }}
            >
              <code>{stack}</code>
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: '#7C3AED', boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)' }}
          >
            Volver al Dashboard
          </a>
          {isOffline && (
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:opacity-80"
              style={{ border: '1px solid #27272A', color: '#A1A1AA' }}
            >
              Reintentar
            </button>
          )}
        </div>

        {/* Brand */}
        <p className="mt-8 text-[10px]" style={{ color: '#3F3F46' }}>
          GRIXI — La interconexión inteligente
        </p>
      </div>
    </main>
  );
}

