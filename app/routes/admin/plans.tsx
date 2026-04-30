import { redirect, useLoaderData, useFetcher, Link } from "react-router";
import type { Route } from "./+types/admin.plans";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { requirePlatformAdmin, requirePlatformPermission } from "~/lib/platform-rbac/guard.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import {
  CreditCard, Building2, Users, Puzzle, Crown, Zap, Rocket, Star,
  ArrowUpRight, CheckCircle2, Search, Download,
} from "lucide-react";
import { exportCSV } from "~/lib/export";
import { useState, useMemo } from "react";

const PLAN_META: Record<string, { label: string; color: string; icon: any; maxUsers: number; features: string[] }> = {
  demo: {
    label: "Demo", color: "#71717A", icon: Star, maxUsers: 5,
    features: ["Dashboard básico", "1 usuario", "Sin módulos avanzados"],
  },
  starter: {
    label: "Starter", color: "#3B82F6", icon: Zap, maxUsers: 20,
    features: ["Dashboard completo", "Hasta 20 usuarios", "Almacenes básico", "Compras básico"],
  },
  professional: {
    label: "Professional", color: "#8B5CF6", icon: Rocket, maxUsers: 50,
    features: ["Todos los módulos estándar", "Hasta 50 usuarios", "GRIXI AI", "Finanzas completo", "Reportes"],
  },
  enterprise: {
    label: "Enterprise", color: "#F59E0B", icon: Crown, maxUsers: 100,
    features: ["Todos los módulos", "Hasta 100 usuarios", "AI avanzado", "API access", "Soporte prioritario", "Custom branding"],
  },
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.billing.view", headers);

  const admin = createSupabaseAdminClient(env);

  const [orgsRes, membRes] = await Promise.all([
    admin.from("organizations").select("id, name, slug, status, settings, created_at").order("name"),
    admin.from("memberships").select("organization_id").eq("status", "active"),
  ]);

  const orgMemberMap: Record<string, number> = {};
  membRes.data?.forEach((m: any) => { orgMemberMap[m.organization_id] = (orgMemberMap[m.organization_id] || 0) + 1; });

  // Count per plan
  const planCounts: Record<string, number> = { demo: 0, starter: 0, professional: 0, enterprise: 0 };
  orgsRes.data?.forEach((o: any) => {
    const plan = o.settings?.plan || "demo";
    planCounts[plan] = (planCounts[plan] || 0) + 1;
  });

  return Response.json({
    organizations: orgsRes.data || [],
    orgMemberMap,
    planCounts,
  }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.billing.manage", headers);

  const admin = createSupabaseAdminClient(env);
  if (!pa) return Response.json({ error: "Unauthorized" }, { status: 403, headers });

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const ip = getClientIP(request);

  if (intent === "change_plan") {
    const orgId = formData.get("org_id") as string;
    const newPlan = formData.get("new_plan") as string;
    const maxUsers = PLAN_META[newPlan]?.maxUsers || 5;

    // Get current settings
    const { data: org } = await admin.from("organizations").select("settings, name").eq("id", orgId).single();
    const oldPlan = org?.settings?.plan || "demo";

    // Update plan in settings
    const newSettings = { ...(org?.settings || {}), plan: newPlan, max_users: maxUsers };
    await admin.from("organizations").update({ settings: newSettings }).eq("id", orgId);

    // Recalculate permissions for roles in this org
    const { data: roles } = await admin.from("roles").select("id, name").eq("organization_id", orgId);
    const { data: allPerms } = await admin.from("permissions").select("id, key");

    if (roles && allPerms) {
      for (const role of roles) {
        // Delete existing, re-assign
        await admin.from("role_permissions").delete().eq("role_id", role.id);

        let permsForRole: any[] = [];
        if (role.name === "owner" || role.name === "admin") permsForRole = allPerms;
        else if (role.name === "member") permsForRole = allPerms.filter((p: any) => ["dashboard.view", "ai.chat", "profile.manage"].includes(p.key));
        else if (role.name === "viewer") permsForRole = allPerms.filter((p: any) => p.key.endsWith(".view"));

        const inserts = permsForRole.map((p: any) => ({ role_id: role.id, permission_id: p.id }));
        if (inserts.length > 0) await admin.from("role_permissions").insert(inserts);
      }
    }

    await logAuditEvent(admin, {
      actorId: user.id, action: "organization.change_plan", entityType: "organization",
      entityId: orgId, metadata: { name: org?.name, oldPlan, newPlan }, ipAddress: ip, organizationId: orgId,
    });

    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

export default function AdminPlans() {
  const { organizations, orgMemberMap, planCounts } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const [changingOrg, setChangingOrg] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("");

  const filtered = useMemo(() => {
    return organizations.filter((o: any) => {
      const plan = o.settings?.plan || "demo";
      const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase());
      const matchPlan = !filterPlan || plan === filterPlan;
      return matchSearch && matchPlan;
    });
  }, [organizations, search, filterPlan]);

  const handleChangePlan = (orgId: string) => {
    if (!selectedPlan) return;
    fetcher.submit({ intent: "change_plan", org_id: orgId, new_plan: selectedPlan }, { method: "post" });
    setChangingOrg(null);
    setSelectedPlan("");
  };

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <div>
        <h1 className="text-lg font-bold text-text-primary">Planes & Billing</h1>
        <p className="mt-0.5 text-[11px] text-text-muted">Gestión de planes y asignación a organizaciones</p>
      </div>

      {/* ═══ Plan Cards ═══ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Object.entries(PLAN_META).map(([key, plan]) => {
          const Icon = plan.icon;
          const count = planCounts[key] || 0;
          return (
            <div
              key={key}
              className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 transition-all hover:border-opacity-50"
              style={{ borderColor: `${plan.color}30` }}
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.06]" style={{ backgroundColor: plan.color }} />
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${plan.color}15` }}>
                  <Icon size={18} style={{ color: plan.color }} />
                </div>
                <span className="text-xl font-bold tabular-nums text-text-primary">{count}</span>
              </div>
              <h3 className="mt-3 text-[13px] font-bold text-text-primary">{plan.label}</h3>
              <p className="text-[10px] text-text-muted">Hasta {plan.maxUsers} usuarios</p>
              <ul className="mt-3 space-y-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                    <CheckCircle2 size={10} style={{ color: plan.color }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ═══ Filters ═══ */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar organización…"
            className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand"
          />
        </div>
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}
          className="appearance-none rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary outline-none focus:border-brand"
        >
          <option value="">Todos los planes</option>
          {Object.entries(PLAN_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button
          onClick={() => {
            const headers = ["Organización", "Slug", "Plan", "Usuarios", "Max", "Estado", "Creado"];
            const rows = filtered.map((o: any) => [
              o.name, o.slug, o.settings?.plan || "demo",
              String(orgMemberMap[o.id] || 0), String(PLAN_META[o.settings?.plan || "demo"]?.maxUsers || 5),
              o.status, new Date(o.created_at).toLocaleDateString("es"),
            ]);
            exportCSV("planes_organizaciones", headers, rows);
          }}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-medium text-text-secondary hover:border-brand hover:text-brand"
        >
          <Download size={12} /> CSV
        </button>
      </div>

      {/* ═══ Table ═══ */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Organización", "Plan Actual", "Usuarios", "Capacidad", "Estado", "Acciones"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((org: any) => {
              const plan = org.settings?.plan || "demo";
              const meta = PLAN_META[plan] || PLAN_META.demo;
              const members = orgMemberMap[org.id] || 0;
              const capacityPct = Math.round((members / meta.maxUsers) * 100);
              const isChanging = changingOrg === org.id;

              return (
                <tr key={org.id} className="border-b border-border last:border-b-0 transition-colors hover:bg-muted/30">
                  <td className="px-5 py-3.5">
                    <Link to={`/admin/organizations/${org.id}`} className="group flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold" style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
                        {org.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-text-primary group-hover:underline">{org.name}</p>
                        <p className="text-[10px] font-mono text-text-muted">{org.slug}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[12px] font-bold tabular-nums text-text-primary">{members}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{
                          width: `${Math.min(capacityPct, 100)}%`,
                          backgroundColor: capacityPct > 90 ? "#EF4444" : capacityPct > 70 ? "#F59E0B" : meta.color,
                        }} />
                      </div>
                      <span className="text-[10px] tabular-nums text-text-muted">{members}/{meta.maxUsers}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{
                      backgroundColor: org.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                      color: org.status === "active" ? "#10B981" : "#EF4444",
                    }}>{org.status}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    {isChanging ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}
                          className="appearance-none rounded-lg border border-border bg-bg-primary px-2 py-1 text-[11px] outline-none focus:border-brand"
                        >
                          <option value="">Seleccionar…</option>
                          {Object.entries(PLAN_META).filter(([k]) => k !== plan).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                        <button onClick={() => handleChangePlan(org.id)} disabled={!selectedPlan}
                          className="rounded-lg bg-brand px-2 py-1 text-[10px] font-medium text-white disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button onClick={() => { setChangingOrg(null); setSelectedPlan(""); }}
                          className="text-[10px] text-text-muted hover:text-text-primary"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setChangingOrg(org.id)}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-text-muted transition-colors hover:bg-muted hover:text-text-primary"
                      >
                        <ArrowUpRight size={11} /> Cambiar Plan
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
