import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/admin";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { Building2, Users, Activity, TrendingUp } from "lucide-react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);
  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!platformAdmin) return redirect("/dashboard", { headers });

  const [orgsResult, usersResult, membershipsResult] = await Promise.all([
    admin.from("organizations").select("id, name, slug, plan, status, created_at", { count: "exact" }),
    admin.from("profiles").select("id", { count: "exact" }),
    admin.from("memberships").select("id", { count: "exact" }).eq("status", "active"),
  ]);

  return Response.json(
    {
      stats: {
        organizations: orgsResult.count || 0,
        users: usersResult.count || 0,
        activeMemberships: membershipsResult.count || 0,
      },
      recentOrgs: orgsResult.data?.slice(0, 5) || [],
    },
    { headers }
  );
}

export default function AdminDashboard() {
  const { stats, recentOrgs } = useLoaderData<typeof loader>();

  const kpis = [
    { label: "Organizaciones", value: stats.organizations, icon: <Building2 size={22} />, color: "#6366F1" },
    { label: "Usuarios", value: stats.users, icon: <Users size={22} />, color: "#EC4899" },
    { label: "Membresías Activas", value: stats.activeMemberships, icon: <Activity size={22} />, color: "#16A34A" },
    { label: "Plan Activo", value: "Enterprise", icon: <TrendingUp size={22} />, color: "#F59E0B" },
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "#8b5cf620" }}>
            <span className="text-lg">⚡</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Panel de Administración
          </h1>
        </div>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Vista global de la plataforma GRIXI
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                  {kpi.label}
                </p>
                <p className="mt-1 text-3xl font-bold" style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>
                  {kpi.value}
                </p>
              </div>
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${kpi.color}15`, color: kpi.color }}
              >
                {kpi.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Organizations */}
      <div className="rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>Organizaciones</h2>
        </div>
        <div>
          {recentOrgs.map((org: any) => (
            <div key={org.id} className="flex items-center justify-between px-6 py-4 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>
                  {org.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{org.name}</p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{org.slug}.grixi.ai</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{
                  backgroundColor: org.status === "active" ? "#16A34A20" : "#F59E0B20",
                  color: org.status === "active" ? "#16A34A" : "#F59E0B",
                }}>
                  {org.status || "active"}
                </span>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>
                  {org.plan || "enterprise"}
                </span>
              </div>
            </div>
          ))}
          {recentOrgs.length === 0 && (
            <div className="px-6 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No hay organizaciones aún.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
