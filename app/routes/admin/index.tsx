import { redirect, useLoaderData, Link } from "react-router";
import type { Route } from "./+types/admin";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { Building2, Users, Activity, TrendingUp, History, ArrowUpRight } from "lucide-react";
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);
  const { data: pa } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!pa) return redirect("/dashboard", { headers });

  const [orgsRes, usersRes, membershipsRes, invitationsRes, auditRes, allOrgs] = await Promise.all([
    admin.from("organizations").select("id, name, slug, status, settings, created_at", { count: "exact" }),
    admin.from("profiles").select("id, created_at", { count: "exact" }),
    admin.from("memberships").select("id, organization_id, created_at", { count: "exact" }).eq("status", "active"),
    admin.from("invitations").select("id, status, created_at", { count: "exact" }),
    admin.from("audit_logs").select("id, action, created_at").order("created_at", { ascending: false }).limit(10),
    admin.from("organizations").select("id, name, settings"),
  ]);

  // Build plan distribution for PieChart
  const planDist: Record<string, number> = {};
  allOrgs.data?.forEach((org: any) => {
    const plan = org.settings?.plan || "demo";
    planDist[plan] = (planDist[plan] || 0) + 1;
  });
  const planData = Object.entries(planDist).map(([name, value]) => ({ name, value }));

  // Build org member bar chart
  const orgMemberMap: Record<string, number> = {};
  membershipsRes.data?.forEach((m: any) => {
    orgMemberMap[m.organization_id] = (orgMemberMap[m.organization_id] || 0) + 1;
  });
  const orgBarData = allOrgs.data?.map((org: any) => ({
    name: org.name.length > 10 ? org.name.substring(0, 10) + "…" : org.name,
    miembros: orgMemberMap[org.id] || 0,
  })) || [];

  // Build membership growth (last 7 days)
  const now = new Date();
  const growthData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("es", { day: "2-digit", month: "short" });
    const count = membershipsRes.data?.filter((m: any) => {
      const created = new Date(m.created_at);
      return created.toDateString() === d.toDateString();
    }).length || 0;
    growthData.push({ date: label, nuevos: count });
  }

  // Invitation stats
  const invStats = { pending: 0, accepted: 0, cancelled: 0 };
  invitationsRes.data?.forEach((inv: any) => {
    if (inv.status in invStats) invStats[inv.status as keyof typeof invStats]++;
  });

  return Response.json({
    stats: {
      organizations: orgsRes.count || 0,
      users: usersRes.count || 0,
      activeMemberships: membershipsRes.count || 0,
      invitations: invitationsRes.count || 0,
    },
    planData,
    orgBarData,
    growthData,
    invStats,
    recentAudit: auditRes.data || [],
    recentOrgs: orgsRes.data?.slice(0, 5) || [],
  }, { headers });
}

const PLAN_COLORS: Record<string, string> = {
  demo: "#71717A",
  starter: "#3B82F6",
  professional: "#8B5CF6",
  enterprise: "#F59E0B",
};

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#1a1625",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    fontSize: 12,
    color: "#e2e8f0",
  },
};

export default function AdminDashboard() {
  const { stats, planData, orgBarData, growthData, invStats, recentAudit, recentOrgs } = useLoaderData<typeof loader>();

  const kpis = [
    { label: "Organizaciones", value: stats.organizations, icon: <Building2 size={22} />, color: "#6366F1", href: "/admin/organizations" },
    { label: "Usuarios", value: stats.users, icon: <Users size={22} />, color: "#EC4899", href: "/admin/users" },
    { label: "Membresías Activas", value: stats.activeMemberships, icon: <Activity size={22} />, color: "#16A34A" },
    { label: "Invitaciones", value: stats.invitations, icon: <TrendingUp size={22} />, color: "#F59E0B" },
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "#8b5cf620" }}>
            <span className="text-lg">⚡</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Panel de Administración</h1>
        </div>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Vista global de la plataforma GRIXI</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="group rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            {kpi.href ? (
              <Link to={kpi.href} className="block">
                <KPIContent kpi={kpi} />
              </Link>
            ) : (
              <KPIContent kpi={kpi} />
            )}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Membership Growth — Area */}
        <ChartCard title="Crecimiento (7 días)" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={growthData}>
              <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} /><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="nuevos" stroke="#8B5CF6" strokeWidth={2} fill="url(#areaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Plan Distribution — Donut */}
        <ChartCard title="Distribución de Planes">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={planData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                {planData.map((entry: any, i: number) => <Cell key={i} fill={PLAN_COLORS[entry.name] || "#6366F1"} />)}
              </Pie>
              <Tooltip {...CHART_TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-1">
            {planData.map((p: any) => (
              <div key={p.name} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLAN_COLORS[p.name] || "#6366F1" }} />
                {p.name} ({p.value})
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Second Row: Bar + Invitations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Members per Org — Bar */}
        <ChartCard title="Miembros por Organización" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={orgBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Bar dataKey="miembros" fill="#6366F1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Invitation Stats */}
        <ChartCard title="Estado de Invitaciones">
          <div className="space-y-4 py-2">
            {[
              { label: "Pendientes", value: invStats.pending, color: "#F59E0B" },
              { label: "Aceptadas", value: invStats.accepted, color: "#16A34A" },
              { label: "Canceladas", value: invStats.cancelled, color: "#EF4444" },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span style={{ color: "var(--muted-foreground)" }}>{s.label}</span>
                  <span className="font-medium" style={{ color: s.color }}>{s.value}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (s.value / Math.max(stats.invitations, 1)) * 100)}%`, backgroundColor: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Bottom: Recent Audit + Orgs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Audit */}
        <div className="rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Actividad Reciente</h3>
            <Link to="/admin/audit" className="flex items-center gap-1 text-xs hover:underline" style={{ color: "#8B5CF6" }}><History size={12} /> Ver todo</Link>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {recentAudit.slice(0, 5).map((log: any) => (
              <div key={log.id} className="flex items-center gap-3 px-6 py-3">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: "#8B5CF6" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate" style={{ color: "var(--foreground)" }}>{log.action}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{new Date(log.created_at).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
            {recentAudit.length === 0 && <div className="px-6 py-6 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>Sin actividad</div>}
          </div>
        </div>

        {/* Recent Orgs */}
        <div className="rounded-xl border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Organizaciones</h3>
            <Link to="/admin/organizations" className="flex items-center gap-1 text-xs hover:underline" style={{ color: "#6366F1" }}><ArrowUpRight size={12} /> Todas</Link>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {recentOrgs.map((org: any) => (
              <Link key={org.id} to={`/admin/organizations/${org.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold" style={{ backgroundColor: `${org.settings?.primary_color || "#6366F1"}20`, color: org.settings?.primary_color || "#6366F1" }}>{org.name.charAt(0)}</div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{org.name}</p>
                    <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{org.slug}.grixi.ai</p>
                  </div>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: org.status === "active" ? "#16A34A20" : "#EF444420", color: org.status === "active" ? "#16A34A" : "#EF4444" }}>{org.status}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPIContent({ kpi }: { kpi: any }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>{kpi.label}</p>
        <p className="mt-1 text-3xl font-bold" style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{kpi.value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${kpi.color}15`, color: kpi.color }}>{kpi.icon}</div>
    </div>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border p-5 ${className || ""}`} style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>{title}</h3>
      {children}
    </div>
  );
}
