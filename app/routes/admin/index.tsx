import { useLoaderData, Link, redirect } from "react-router";
import type { Route } from "./+types/admin";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { isPlatformTenant } from "~/lib/platform-guard";
import {
  Building2, Users, Activity, FileText, TrendingUp,
  ArrowUpRight, Plus, Send, History, Zap, AlertTriangle,
  CheckCircle2, Clock, XCircle,
} from "lucide-react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });
  if (!isPlatformTenant(context)) return redirect("/dashboard", { headers });

  const admin = createSupabaseAdminClient(env);
  const { data: pa } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!pa) return redirect("/dashboard", { headers });

  const now = new Date();
  const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [orgsRes, usersRes, membRes, invRes, auditRes, allOrgs, recentAudit, memberships30d] = await Promise.all([
    admin.from("organizations").select("id, name, slug, status, settings, created_at", { count: "exact" }),
    admin.from("profiles").select("id, created_at", { count: "exact" }),
    admin.from("memberships").select("id, organization_id, created_at", { count: "exact" }).eq("status", "active"),
    admin.from("invitations").select("id, status, created_at", { count: "exact" }),
    admin.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", now24h),
    admin.from("organizations").select("id, name, status, settings"),
    admin.from("audit_logs").select("id, action, actor_id, entity_type, metadata, created_at")
      .order("created_at", { ascending: false }).limit(8),
    admin.from("memberships").select("id, created_at").gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  // Plan distribution
  const planDist: Record<string, number> = {};
  const statusDist = { active: 0, suspended: 0 };
  allOrgs.data?.forEach((org: any) => {
    const plan = org.settings?.plan || "demo";
    planDist[plan] = (planDist[plan] || 0) + 1;
    if (org.status === "active") statusDist.active++;
    else statusDist.suspended++;
  });
  const planData = Object.entries(planDist).map(([name, value]) => ({ name, value }));

  // Org member bar chart (top 8)
  const orgMemberMap: Record<string, number> = {};
  membRes.data?.forEach((m: any) => { orgMemberMap[m.organization_id] = (orgMemberMap[m.organization_id] || 0) + 1; });
  const orgBarData = allOrgs.data
    ?.map((org: any) => ({ name: org.name.length > 12 ? org.name.substring(0, 12) + "…" : org.name, miembros: orgMemberMap[org.id] || 0 }))
    .sort((a: any, b: any) => b.miembros - a.miembros)
    .slice(0, 8) || [];

  // 30-day growth chart
  const growthData = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("es", { day: "2-digit", month: "short" });
    const count = memberships30d.data?.filter((m: any) => new Date(m.created_at).toDateString() === d.toDateString()).length || 0;
    growthData.push({ date: label, nuevos: count });
  }

  // Invitation stats
  const invStats = { pending: 0, accepted: 0, cancelled: 0 };
  invRes.data?.forEach((inv: any) => { if (inv.status in invStats) invStats[inv.status as keyof typeof invStats]++; });

  // Actor map for recent audit
  const actorIds = [...new Set((recentAudit.data || []).map((l: any) => l.actor_id).filter(Boolean))];
  const actorMap: Record<string, any> = {};
  if (actorIds.length > 0) {
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
    authData?.users?.forEach((u: any) => {
      actorMap[u.id] = { name: u.user_metadata?.full_name || u.email, avatar: u.user_metadata?.avatar_url, email: u.email };
    });
  }

  return Response.json({
    stats: {
      organizations: orgsRes.count || 0,
      users: usersRes.count || 0,
      activeMemberships: membRes.count || 0,
      invitations: invRes.count || 0,
      audit24h: auditRes.count || 0,
    },
    statusDist,
    planData,
    orgBarData,
    growthData,
    invStats,
    recentAudit: recentAudit.data || [],
    actorMap,
  }, { headers });
}

const PLAN_COLORS: Record<string, string> = {
  demo: "#71717A", starter: "#3B82F6", professional: "#8B5CF6", enterprise: "#F59E0B",
};

const ACTION_COLORS: Record<string, string> = {
  INSERT: "#16A34A", UPDATE: "#F59E0B", DELETE: "#EF4444",
  "organization.create": "#6366F1", "invitation.create": "#EC4899",
  "user.promote": "#16A34A", "user.demote": "#EF4444",
};

const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: 12, fontSize: 12, color: "var(--text-primary)", boxShadow: "var(--shadow-lg)",
  },
  cursor: { fill: "var(--brand-surface)" },
};

export default function AdminDashboard() {
  const { stats, statusDist, planData, orgBarData, growthData, invStats, recentAudit, actorMap } = useLoaderData<typeof loader>();

  const kpis = [
    { label: "Organizaciones", value: stats.organizations, icon: Building2, color: "#6366F1", sub: `${statusDist.active} activas · ${statusDist.suspended} susp.`, href: "/admin/organizations" },
    { label: "Usuarios", value: stats.users, icon: Users, color: "#EC4899", sub: `${stats.activeMemberships} membresías`, href: "/admin/users" },
    { label: "Eventos 24h", value: stats.audit24h, icon: Activity, color: "#10B981", sub: "Audit logs", href: "/admin/audit" },
    { label: "Invitaciones", value: stats.invitations, icon: FileText, color: "#F59E0B", sub: `${invStats.pending} pendientes`, href: "/admin/organizations" },
  ];

  return (
    <div className="space-y-6">
      {/* ═══════ KPI Cards ═══════ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              to={kpi.href}
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:border-brand/30 hover:shadow-lg"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.06]" style={{ backgroundColor: kpi.color }} />
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${kpi.color}15` }}>
                  <Icon size={18} style={{ color: kpi.color }} />
                </div>
                <ArrowUpRight size={14} className="text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="mt-4 text-2xl font-bold tabular-nums text-text-primary">{kpi.value}</p>
              <p className="mt-0.5 text-[11px] font-medium text-text-secondary">{kpi.label}</p>
              <p className="mt-1 text-[10px] text-text-muted">{kpi.sub}</p>
            </Link>
          );
        })}
      </div>

      {/* ═══════ Charts Row 1 ═══════ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Growth 30d */}
        <div className="col-span-2 rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-text-primary">Crecimiento de Membresías</h3>
              <p className="text-[10px] text-text-muted">Últimos 30 días</p>
            </div>
            <TrendingUp size={14} className="text-text-muted" />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Area type="monotone" dataKey="nuevos" stroke="#7C3AED" strokeWidth={2} fill="url(#growthGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4">
            <h3 className="text-[13px] font-bold text-text-primary">Distribución de Planes</h3>
            <p className="text-[10px] text-text-muted">{stats.organizations} organizaciones</p>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planData} innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value" cx="50%" cy="50%">
                  {planData.map((entry: any) => (
                    <Cell key={entry.name} fill={PLAN_COLORS[entry.name] || "#71717A"} />
                  ))}
                </Pie>
                <Tooltip {...CHART_TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 justify-center">
            {planData.map((p: any) => (
              <div key={p.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLAN_COLORS[p.name] || "#71717A" }} />
                <span className="text-[10px] font-medium capitalize text-text-muted">{p.name} ({p.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════ Charts Row 2 ═══════ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Org Bar */}
        <div className="col-span-2 rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4">
            <h3 className="text-[13px] font-bold text-text-primary">Usuarios por Organización</h3>
            <p className="text-[10px] text-text-muted">Top 8 organizaciones</p>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orgBarData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 9, fill: "var(--text-muted)" }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={100} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="miembros" fill="#6366F1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Health */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4">
            <h3 className="text-[13px] font-bold text-text-primary">Salud del Sistema</h3>
            <p className="text-[10px] text-text-muted">Indicadores clave</p>
          </div>
          <div className="space-y-3">
            <HealthItem icon={CheckCircle2} label="Orgs Activas" value={statusDist.active} total={stats.organizations} color="#10B981" />
            <HealthItem icon={AlertTriangle} label="Suspendidas" value={statusDist.suspended} total={stats.organizations} color="#EF4444" />
            <HealthItem icon={Clock} label="Invitaciones Pendientes" value={invStats.pending} total={stats.invitations || 1} color="#F59E0B" />
            <HealthItem icon={Zap} label="Eventos Auditoría 24h" value={stats.audit24h} total={100} color="#8B5CF6" />
          </div>
        </div>
      </div>

      {/* ═══════ Bottom Row ═══════ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="col-span-2 rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <History size={14} className="text-text-muted" />
              <h3 className="text-[13px] font-bold text-text-primary">Actividad Reciente</h3>
            </div>
            <Link to="/admin/audit" className="text-[11px] font-medium text-brand hover:underline">Ver todo →</Link>
          </div>
          <div className="divide-y divide-border">
            {recentAudit.length === 0 ? (
              <div className="px-5 py-8 text-center text-[11px] text-text-muted">Sin actividad reciente</div>
            ) : recentAudit.map((log: any) => {
              const actor = actorMap[log.actor_id] || {};
              const time = new Date(log.created_at);
              const actionColor = ACTION_COLORS[log.action] || "#71717A";
              return (
                <div key={log.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30">
                  {actor.avatar ? (
                    <img src={actor.avatar} className="h-7 w-7 rounded-full ring-1 ring-white/10" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-text-muted">
                      {(actor.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-text-primary">{actor.name || "Sistema"}</span>
                      <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${actionColor}15`, color: actionColor }}>
                        {log.action}
                      </span>
                    </div>
                    <p className="truncate text-[10px] text-text-muted">
                      {log.entity_type}{log.metadata?.name ? ` → ${log.metadata.name}` : ""}{log.metadata?.email ? ` → ${log.metadata.email}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[9px] tabular-nums text-text-muted">
                    {time.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="mb-4 text-[13px] font-bold text-text-primary">Acciones Rápidas</h3>
          <div className="space-y-2">
            {[
              { label: "Crear Organización", icon: Plus, color: "#6366F1", href: "/admin/organizations" },
              { label: "Broadcast Notificación", icon: Send, color: "#EC4899", href: "/admin/notifications" },
              { label: "Ver Auditoría Live", icon: Activity, color: "#10B981", href: "/admin/audit" },
              { label: "Gestionar Planes", icon: FileText, color: "#F59E0B", href: "/admin/plans" },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  to={a.href}
                  className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-all hover:bg-muted"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${a.color}12` }}>
                    <Icon size={15} style={{ color: a.color }} />
                  </div>
                  <span className="text-[12px] font-medium text-text-secondary group-hover:text-text-primary">{a.label}</span>
                  <ArrowUpRight size={12} className="ml-auto text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Health Indicator Component ──
function HealthItem({ icon: Icon, label, value, total, color }: { icon: any; label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}12` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-text-secondary">{label}</span>
          <span className="text-[11px] font-bold tabular-nums text-text-primary">{value}</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-muted">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}
