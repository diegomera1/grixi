/**
 * Admin Re-Authentication Page
 *
 * Shown when the admin session has expired due to inactivity.
 * The admin must re-enter credentials to continue.
 */
import { redirect, useSearchParams, useActionData, Form } from "react-router";
import type { Route } from "./+types/admin-reauth";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";
import { startAdminSession } from "~/lib/platform-rbac/admin-session.server";
import { isPlatformTenant } from "~/lib/platform-guard";
import { useState } from "react";
import { Lock, Shield, ArrowRight, AlertTriangle, Eye, EyeOff } from "lucide-react";

// ── Loader: verify we're on admin portal ──
export async function loader({ request, context }: Route.LoaderArgs) {
  if (!isPlatformTenant(context)) {
    return redirect("/");
  }
  return null;
}

// ── Action: handle re-authentication ──
export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const returnTo = (formData.get("returnTo") as string) || "/admin";

  if (!email || !password) {
    return Response.json(
      { error: "Email y contraseña son requeridos" },
      { status: 400, headers }
    );
  }

  // Attempt sign in
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return Response.json(
      { error: "Credenciales inválidas. Intenta de nuevo." },
      { status: 401, headers }
    );
  }

  // Verify this user is actually a platform admin
  const { createSupabaseAdminClient } = await import("~/lib/supabase/client.server");
  const admin = createSupabaseAdminClient(env);
  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!platformAdmin) {
    await supabase.auth.signOut();
    return Response.json(
      { error: "No tienes permisos de administrador." },
      { status: 403, headers }
    );
  }

  // Start fresh admin session
  const kv = (env as any).KV_CACHE as KVNamespace | undefined;
  await startAdminSession(data.user.id, kv);

  // Log re-authentication event
  await admin.from("audit_logs").insert({
    user_id: data.user.id,
    action: "admin.session.reauth",
    entity_type: "platform_admin",
    entity_id: data.user.id,
    ip_address: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for"),
    user_agent: request.headers.get("user-agent"),
    metadata: { returnTo, method: "password" },
  });

  return redirect(returnTo, { headers });
}

// ── Component ──
export default function AdminReauth() {
  const [searchParams] = useSearchParams();
  const actionData = useActionData<typeof action>();
  const returnTo = searchParams.get("returnTo") || "/admin";
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#0A0A0F" }}>
      {/* Background grid effect */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(124,58,237,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative w-full max-w-[420px] px-6">
        {/* Shield Icon */}
        <div className="mb-8 flex flex-col items-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(239,68,68,0.1))",
              border: "1px solid rgba(124,58,237,0.2)",
            }}
          >
            <Lock size={28} style={{ color: "#7c3aed" }} />
          </div>

          <h1
            className="mb-1 text-xl font-bold tracking-tight"
            style={{ color: "#F8FAFC" }}
          >
            Sesión Expirada
          </h1>
          <p className="text-center text-sm" style={{ color: "#94A3B8" }}>
            Tu sesión de administrador ha expirado por inactividad.
            <br />
            Ingresa tus credenciales para continuar.
          </p>
        </div>

        {/* Form Card */}
        <div
          className="rounded-2xl border p-6"
          style={{
            backgroundColor: "rgba(15,15,25,0.8)",
            borderColor: "rgba(124,58,237,0.15)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Security badge */}
          <div className="mb-5 flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(124,58,237,0.08)" }}>
            <Shield size={14} style={{ color: "#7c3aed" }} />
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "#A78BFA" }}>
              Acceso Seguro — admin.grixi.ai
            </span>
          </div>

          {/* Error Message */}
          {actionData?.error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangle size={14} style={{ color: "#EF4444" }} />
              <span className="text-xs font-medium" style={{ color: "#FCA5A5" }}>
                {actionData.error}
              </span>
            </div>
          )}

          <Form method="post" className="space-y-4">
            <input type="hidden" name="returnTo" value={returnTo} />

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="admin@grixi.ai"
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors focus:border-[#7c3aed]/50"
                style={{
                  backgroundColor: "rgba(15,15,25,0.6)",
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "#F8FAFC",
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border px-4 py-3 pr-10 text-sm outline-none transition-colors focus:border-[#7c3aed]/50"
                  style={{
                    backgroundColor: "rgba(15,15,25,0.6)",
                    borderColor: "rgba(255,255,255,0.08)",
                    color: "#F8FAFC",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#64748B" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6D28D9)",
                boxShadow: "0 4px 14px rgba(124,58,237,0.3)",
              }}
            >
              Verificar Identidad
              <ArrowRight size={16} />
            </button>
          </Form>

          {/* Footer info */}
          <div className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(245,158,11,0.06)" }}>
            <AlertTriangle size={11} style={{ color: "#F59E0B" }} />
            <span className="text-[9px]" style={{ color: "#FCD34D" }}>
              Las sesiones de admin expiran tras 30 minutos de inactividad
            </span>
          </div>
        </div>

        {/* GRIXI Branding */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md"
            style={{ background: "linear-gradient(135deg, #7c3aed, #6D28D9)" }}
          >
            <span className="text-[8px] font-black text-white">G</span>
          </div>
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase" style={{ color: "#475569" }}>
            GRIXI ADMIN
          </span>
        </div>
      </div>
    </div>
  );
}
