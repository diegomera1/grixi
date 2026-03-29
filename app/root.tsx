import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
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

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>() as any;
  const locale = (data?.locale ?? "es") as Locale;
  const theme = data?.theme ?? "dark";

  return (
    <html lang={locale} className={theme === "dark" ? "dark" : ""}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="GRIXI — Plataforma empresarial inteligente" />
        <meta name="theme-color" content="#7c5cfc" />
        <title>GRIXI</title>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : `Error ${error.status}`;
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (error && error instanceof Error) {
    // Always log full error to Workers console for observability
    console.error("[GRIXI Error]", error.message, error.stack);
    details = error.message;
    if (import.meta.env.DEV) stack = error.stack;
  } else {
    console.error("[GRIXI Error]", String(error));
  }

  return (
    <main className="flex min-h-screen items-center justify-center" style={{ background: '#0a0a1a', color: '#e2e8f0' }}>
      <div className="text-center space-y-4 max-w-2xl px-6">
        <h1 className="text-6xl font-bold" style={{ color: '#7C3AED' }}>{message}</h1>
        <p className="text-lg opacity-70">{details}</p>
        {stack && (
          <pre className="mt-4 overflow-x-auto rounded-lg p-4 text-left text-xs" style={{ background: '#1a1a2e', color: '#94a3b8' }}>
            <code>{stack}</code>
          </pre>
        )}
        <a href="/" className="inline-block mt-6 px-6 py-3 rounded-lg text-sm font-medium" style={{ background: '#7C3AED', color: '#fff' }}>
          Volver al inicio
        </a>
      </div>
    </main>
  );
}

