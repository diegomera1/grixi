import { redirect, useLoaderData, Form } from "react-router";
import { ShieldX, LogOut, ArrowLeft, Home } from "lucide-react";
import type { Route } from "./+types/unauthorized";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";

export const meta = () => [{ title: "Acceso Denegado — GRIXI" }];

/**
 * Loader — detect context (admin portal vs tenant) and get user info
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const host = request.headers.get("host") || "";
  const isAdmin = host.startsWith("admin.") || host.startsWith("admin.grixi.ai");

  const { supabase } = createSupabaseServerClient(request, context.cloudflare.env);
  const { data: { user } } = await supabase.auth.getUser();

  return {
    isAdmin,
    userEmail: user?.email || null,
    hasSession: !!user,
  };
}

/**
 * Action — handle signout from unauthorized page
 */
export async function action({ request, context }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request, context.cloudflare.env);
  await supabase.auth.signOut({ scope: "global" });

  const host = request.headers.get("host") || "";
  const isAdmin = host.startsWith("admin.") || host.startsWith("admin.grixi.ai");

  return redirect(isAdmin ? "/login" : "/", { headers });
}

export default function Unauthorized() {
  const { isAdmin, userEmail, hasSession } = useLoaderData<typeof loader>();

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ background: "#09090B", color: "#FAFAFA" }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle, #27272A 0.5px, transparent 0.5px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 80%)",
        }}
      />

      {/* Glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full blur-[100px]"
        style={{ backgroundColor: "rgba(239, 68, 68, 0.12)" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        {/* Icon */}
        <div className="relative">
          <div className="absolute inset-0 scale-150 rounded-2xl blur-2xl" style={{ backgroundColor: "rgba(239, 68, 68, 0.15)" }} />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            <ShieldX className="h-8 w-8 text-red-400" />
          </div>
        </div>

        {/* Error code */}
        <p className="text-7xl font-bold tracking-tight" style={{ color: "#EF4444" }}>403</p>

        {/* Title + details */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Acceso Denegado</h1>
          <p className="max-w-sm text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
            {isAdmin
              ? "Esta cuenta no tiene permisos de administrador de plataforma."
              : "No tienes membresía en esta organización. Contacta al administrador si necesitas acceso."}
          </p>
          {userEmail && (
            <p className="text-xs" style={{ color: "#52525B" }}>
              Sesión activa: {userEmail}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Primary: Sign out (especially important for admin portal) */}
          {hasSession && (
            <Form method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95"
                style={{ backgroundColor: "#7C3AED", boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)" }}
              >
                <LogOut size={16} /> Cerrar Sesión
              </button>
            </Form>
          )}

          {/* Secondary: different target based on context */}
          {!isAdmin && (
            <a
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:opacity-80"
              style={{ border: "1px solid #27272A", color: "#A1A1AA" }}
            >
              <ArrowLeft size={16} /> Iniciar Sesión
            </a>
          )}

          {!hasSession && (
            <a
              href={isAdmin ? "/login" : "/"}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: "#7C3AED", boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)" }}
            >
              <Home size={16} /> Iniciar Sesión
            </a>
          )}
        </div>

        {/* Brand */}
        <p className="mt-8 text-[10px]" style={{ color: "#3F3F46" }}>
          GRIXI — La interconexión inteligente
        </p>
      </div>
    </main>
  );
}
