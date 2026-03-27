import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/admin.billing";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { DollarSign, Users, Building2, Activity, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);
  const { data: pa } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!pa) return redirect("/dashboard", { headers });

  // Fetch all orgs with settings for billing overview
  const { data: orgs } = await admin.from("organizations").select("id, name, slug, settings, status, created_at");
  const { data: memberships } = await admin.from("memberships").select("organization_id").eq("status", "active");

  // Build per-org member count
  const orgMemberCount: Record<string, number> = {};
  memberships?.forEach((m: any) => {
    orgMemberCount[m.organization_id] = (orgMemberCount[m.organization_id] || 0) + 1;
  });

  // Plan pricing (monthly)
  const planPricing: Record<string, number> = { demo: 0, starter: 29, professional: 99, enterprise: 299 };

  const orgBilling = orgs?.map((org: any) => {
    const plan = org.settings?.plan || "demo";
    const maxUsers = org.settings?.max_users || 5;
    const members = orgMemberCount[org.id] || 0;
    const price = planPricing[plan] || 0;
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan,
      status: org.status,
      maxUsers,
      currentUsers: members,
      usagePercent: Math.round((members / maxUsers) * 100),
      monthlyPrice: price,
      created: org.created_at,
    };
  }) || [];

  // Aggregate stats
  const totalMRR = orgBilling.reduce((sum, o) => sum + o.monthlyPrice, 0);
  const avgUsage = orgBilling.length ? Math.round(orgBilling.reduce((s, o) => s + o.usagePercent, 0) / orgBilling.length) : 0;

  // Plan breakdown for bar chart
  const planBreakdown: Record<string, { count: number; revenue: number }> = {};
  orgBilling.forEach((o) => {
    if (!planBreakdown[o.plan]) planBreakdown[o.plan] = { count: 0, revenue: 0 };
    planBreakdown[o.plan].count++;
    planBreakdown[o.plan].revenue += o.monthlyPrice;
  });
  const planChart = Object.entries(planBreakdown).map(([plan, d]) => ({ plan, orgs: d.count, revenue: d.revenue }));

  return Response.json({ orgBilling, totalMRR, avgUsage, planChart }, { headers });
}

const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: "#1a1625",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    fontSize: 12,
    color: "#e2e8f0",
  },
};

export default function AdminBilling() {
  const { orgBilling, totalMRR, avgUsage, planChart } = useLoaderData<typeof loader>();

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Billing & Usage</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Tracking de suscripciones y uso por organización</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "MRR Estimado", value: `$${totalMRR}`, icon: <DollarSign size={20} />, color: "#16A34A" },
          { label: "Organizaciones", value: orgBilling.length, icon: <Building2 size={20} />, color: "#6366F1" },
          { label: "Uso Promedio", value: `${avgUsage}%`, icon: <Activity size={20} />, color: "#F59E0B" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>{kpi.label}</p>
                <p className="mt-1 text-3xl font-bold" style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{kpi.value}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${kpi.color}15`, color: kpi.color }}>{kpi.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue by Plan Chart */}
      <div className="rounded-xl border p-5 mb-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>Revenue por Plan</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={planChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="plan" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip {...CHART_TOOLTIP} />
            <Bar dataKey="revenue" fill="#16A34A" radius={[6, 6, 0, 0]} name="$ Revenue" />
            <Bar dataKey="orgs" fill="#6366F1" radius={[6, 6, 0, 0]} name="Orgs" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Org Usage Table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Organización</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Plan</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Usuarios</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Uso</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>$/Mes</th>
            </tr>
          </thead>
          <tbody>
            {orgBilling.map((org: any) => (
              <tr key={org.id} className="border-b last:border-b-0 hover:bg-white/2 transition-colors" style={{ borderColor: "var(--border)" }}>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>{org.name}</p>
                    <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{org.slug}.grixi.ai</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: org.plan === "enterprise" ? "#F59E0B20" : org.plan === "professional" ? "#8B5CF620" : org.plan === "starter" ? "#3B82F620" : "#71717A20", color: org.plan === "enterprise" ? "#F59E0B" : org.plan === "professional" ? "#8B5CF6" : org.plan === "starter" ? "#3B82F6" : "#71717A" }}>
                    {org.plan}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm" style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{org.currentUsers} / {org.maxUsers}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, org.usagePercent)}%`, backgroundColor: org.usagePercent > 80 ? "#EF4444" : org.usagePercent > 50 ? "#F59E0B" : "#16A34A" }} />
                    </div>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{org.usagePercent}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-semibold" style={{ color: org.monthlyPrice > 0 ? "#16A34A" : "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>
                  ${org.monthlyPrice}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
