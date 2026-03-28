import { redirect, useLoaderData, Link } from "react-router";
import type { Route } from "./+types/admin";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { isPlatformTenant } from "~/lib/platform-guard";
import {
  Building2, Users, Activity, TrendingUp, History,
  ArrowUpRight, Shield, Zap, FileText
} from "lucide-react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { motion } from "framer-motion";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  // Platform admin routes ONLY accessible from grixi.grixi.ai
  if (!isPlatformTenant(context)) return redirect("/dashboard", { headers });

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

const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
    color: "var(--text-primary)",
    boxShadow: "var(--shadow-lg)",
  },
  cursor: { fill: "var(--brand-surface)" },
};

export default function AdminDashboard() {
  const { stats, planData, orgBarData, growthData, invStats, recentAudit, recentOrgs } = useLoaderData<typeof loader>();

  const kpis = [
    { label: "Organizaciones", value: stats.organizations, icon: Building2, color: "#6366F1", trend: "+4.2%", href: "/admin/organizations" },
    { label: "Usuarios", value: stats.users, icon: Users, color: "#EC4899", trend: "+12.5%" , href: "/admin/users" },
    { label: "Membresías Activas", value: stats.activeMemberships, icon: Activity, color: "#10B981", trend: "+8.3%" },
    { label: "Invitaciones", value: stats.invitations, icon: FileText, color: "#F59E0B", trend: "+3.2%" },
  ];

  return (
    <div className="w-full space-y-5">
      {/* ── Hero Header ─────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-surface)] via-[var(--bg-surface)] to-[var(--brand-surface)]"
      >
        {/* Decorative dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, var(--brand) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[var(--brand)] opacity-[0.06] blur-[100px]" />

        <div className="relative px-5 py-5">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand)] shadow-md" style={{ boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Panel de Administración
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Vista global de la plataforma GRIXI
              </p>
            </div>
          </div>

          {/* Hero KPI Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="card-elevated rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-3 backdrop-blur-sm"
                >
                  {kpi.href ? (
                    <Link to={kpi.href} className="block">
                      <div className="flex items-center justify-between">
                        <Icon size={13} style={{ color: kpi.color }} />
                        <span className="flex items-center gap-0.5 text-[9px] font-semibold text-[var(--success)]">
                          <TrendingUp size={9} />
                          {kpi.trend}
                        </span>
                      </div>
                      <p className="mt-2 text-lg font-bold tabular-nums text-[var(--text-primary)]">{kpi.value}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{kpi.label}</p>
                    </Link>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <Icon size={13} style={{ color: kpi.color }} />
                        <span className="flex items-center gap-0.5 text-[9px] font-semibold text-[var(--success)]">
                          <TrendingUp size={9} />
                          {kpi.trend}
                        </span>
                      </div>
                      <p className="mt-2 text-lg font-bold tabular-nums text-[var(--text-primary)]">{kpi.value}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{kpi.label}</p>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ── Charts Row 1: Growth + Plan Distribution ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Membership Growth — Area */}
        <div className="col-span-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Crecimiento de Membresías</h3>
              <p className="text-[10px] text-[var(--text-muted)]">Nuevas membresías — últimos 7 días</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-muted)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
              <Activity size={10} />
              En vivo
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" />
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} width={35} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Area type="monotone" dataKey="nuevos" stroke="var(--brand)" strokeWidth={2.5} fill="url(#brandGradient)" name="Nuevos" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution — Donut */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Distribución de Planes</h3>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none">
                  {planData.map((entry: any, i: number) => <Cell key={i} fill={PLAN_COLORS[entry.name] || "#6366F1"} />)}
                </Pie>
                <Tooltip {...CHART_TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-1">
            {planData.map((p: any) => (
              <div key={p.name} className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLAN_COLORS[p.name] || "#6366F1" }} />
                {p.name} ({p.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts Row 2: Members Bar + Invitations ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Members per Org — Bar */}
        <div className="col-span-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 lg:col-span-2">
          <div className="mb-3">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Miembros por Organización</h3>
            <p className="text-[10px] text-[var(--text-muted)]">Distribución de miembros activos</p>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orgBarData} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} width={35} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="miembros" fill="var(--brand)" radius={[6, 6, 0, 0]} name="Miembros" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Invitation Stats */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Estado de Invitaciones</h3>
          <div className="space-y-4 py-2">
            {[
              { label: "Pendientes", value: invStats.pending, color: "var(--warning)" },
              { label: "Aceptadas", value: invStats.accepted, color: "var(--success)" },
              { label: "Canceladas", value: invStats.cancelled, color: "var(--error)" },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between text-[12px] mb-1.5">
                  <span className="text-[var(--text-secondary)]">{s.label}</span>
                  <span className="font-mono font-bold" style={{ color: s.color }}>{s.value}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-[var(--bg-muted)]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (s.value / Math.max(stats.invitations, 1)) * 100)}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom: Recent Audit + Recent Orgs ─────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Audit */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Actividad Reciente</h3>
            <Link to="/admin/audit" className="flex items-center gap-1 text-[11px] font-medium text-[var(--brand)] hover:underline">
              <History size={12} /> Ver todo
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {recentAudit.slice(0, 5).map((log: any) => (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--bg-muted)]/50">
                <div className="h-2.5 w-2.5 rounded-full shrink-0 bg-[var(--brand)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate text-[var(--text-primary)]">{log.action}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {new Date(log.created_at).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {recentAudit.length === 0 && (
              <div className="px-5 py-8 text-center text-[12px] text-[var(--text-muted)]">Sin actividad registrada</div>
            )}
          </div>
        </div>

        {/* Recent Orgs */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Organizaciones</h3>
            <Link to="/admin/organizations" className="flex items-center gap-1 text-[11px] font-medium text-[var(--brand)] hover:underline">
              <ArrowUpRight size={12} /> Todas
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {recentOrgs.map((org: any) => (
              <Link
                key={org.id}
                to={`/admin/organizations/${org.id}`}
                className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[var(--bg-muted)]/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold"
                    style={{
                      backgroundColor: `${org.settings?.primary_color || "#6366F1"}20`,
                      color: org.settings?.primary_color || "#6366F1",
                    }}
                  >
                    {org.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-[var(--text-primary)]">{org.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{org.slug}.grixi.ai</p>
                  </div>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: org.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                    color: org.status === "active" ? "var(--success)" : "var(--error)",
                  }}
                >
                  {org.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
