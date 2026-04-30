import { redirect, useLoaderData, useFetcher, Link } from "react-router";
import type { Route } from "./+types/admin.organizations";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { requirePlatformAdmin, requirePlatformPermission } from "~/lib/platform-rbac/guard.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { exportCSV } from "~/lib/export";
import { Plus, Search, Download } from "lucide-react";
import { useState, useMemo } from "react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.orgs.view", headers);


  // Platform admin routes ONLY accessible from grixi.grixi.ai

  const admin = createSupabaseAdminClient(env);
  const { data: platformAdmin } = await admin
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!platformAdmin) return redirect("/dashboard", { headers });

  const { data: organizations } = await admin
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: memberCounts } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("status", "active");

  const orgMemberMap: Record<string, number> = {};
  memberCounts?.forEach((m: any) => {
    orgMemberMap[m.organization_id] = (orgMemberMap[m.organization_id] || 0) + 1;
  });

  return Response.json({ organizations: organizations || [], orgMemberMap }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.orgs.create", headers);


  // CRITICAL: Block mutations from non-platform tenants

  const admin = createSupabaseAdminClient(env);
  const { data: platformAdmin } = await admin
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!platformAdmin) return Response.json({ error: "Unauthorized" }, { status: 403, headers });

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const ip = getClientIP(request);

  if (intent === "create") {
    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const plan = formData.get("plan") as string || "demo";

    if (!name || !slug) return Response.json({ error: "Nombre y slug son requeridos" }, { status: 400, headers });

    const { data: org, error } = await admin
      .from("organizations")
      .insert({
        name,
        slug,
        status: "active",
        settings: {
          plan,
          max_users: plan === "enterprise" ? 100 : plan === "professional" ? 50 : plan === "starter" ? 20 : 5,
          enabled_modules: ["dashboard"],
        },
      })
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    // Create system roles with hierarchy_level
    const { data: newRoles } = await admin.from("roles").insert([
      { organization_id: org.id, name: "owner", description: "Propietario", is_system: true, hierarchy_level: 100, is_default: false },
      { organization_id: org.id, name: "admin", description: "Administrador", is_system: true, hierarchy_level: 80, is_default: false },
      { organization_id: org.id, name: "member", description: "Miembro", is_system: true, hierarchy_level: 20, is_default: true },
      { organization_id: org.id, name: "viewer", description: "Solo lectura", is_system: true, hierarchy_level: 10, is_default: false },
    ]).select();

    // Auto-assign default permissions to each role
    if (newRoles) {
      const { data: allPerms } = await admin.from("permissions").select("id, key");
      if (allPerms) {
        // Permission sets by role
        const viewPerms = allPerms.filter((p: any) => p.key.endsWith(".view"));
        const memberPerms = allPerms.filter((p: any) => ["dashboard.view", "ai.chat", "profile.manage"].includes(p.key));

        const rolePermInserts: { role_id: string; permission_id: string }[] = [];
        for (const role of newRoles) {
          let permsForRole: any[] = [];
          if (role.name === "owner" || role.name === "admin") permsForRole = allPerms;
          else if (role.name === "member") permsForRole = memberPerms;
          else if (role.name === "viewer") permsForRole = viewPerms;

          permsForRole.forEach((p: any) => rolePermInserts.push({ role_id: role.id, permission_id: p.id }));
        }

        if (rolePermInserts.length > 0) {
          await admin.from("role_permissions").insert(rolePermInserts);
        }
      }
    }

    await logAuditEvent(admin, { actorId: user.id, action: "organization.create", entityType: "organization", entityId: org.id, metadata: { name, slug, plan }, ipAddress: ip, organizationId: org.id });
    return Response.json({ success: true, org }, { headers });
  }

  if (intent === "toggle_status") {
    const orgId = formData.get("org_id") as string;
    const newStatus = formData.get("new_status") as string;
    const updatePayload: Record<string, any> = { status: newStatus };
    if (newStatus === "suspended") {
      updatePayload.suspended_at = new Date().toISOString();
      updatePayload.suspended_by = user.id;
    } else {
      updatePayload.suspended_at = null;
      updatePayload.suspended_by = null;
    }
    await admin.from("organizations").update(updatePayload).eq("id", orgId);
    await logAuditEvent(admin, { actorId: user.id, action: `organization.${newStatus === "suspended" ? "suspend" : "activate"}`, entityType: "organization", entityId: orgId, metadata: { newStatus }, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

export default function AdminOrganizations() {
  const { organizations, orgMemberMap } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newPlan, setNewPlan] = useState("demo");
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filtered = useMemo(() => {
    return organizations.filter((org: any) => {
      const matchSearch = !search || org.name.toLowerCase().includes(search.toLowerCase()) || org.slug.toLowerCase().includes(search.toLowerCase());
      const matchPlan = !filterPlan || (org.plan || org.settings?.plan) === filterPlan;
      const matchStatus = !filterStatus || org.status === filterStatus;
      return matchSearch && matchPlan && matchStatus;
    });
  }, [organizations, search, filterPlan, filterStatus]);

  const handleCreate = () => {
    fetcher.submit({ intent: "create", name: newName, slug: newSlug, plan: newPlan }, { method: "post" });
    setShowCreate(false);
    setNewName("");
    setNewSlug("");
    setNewPlan("demo");
  };

  const handleToggle = (orgId: string, currentStatus: string) => {
    fetcher.submit(
      { intent: "toggle_status", org_id: orgId, new_status: currentStatus === "active" ? "suspended" : "active" },
      { method: "post" }
    );
  };

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Organizaciones</h1>
          <p className="mt-0.5 text-[11px] text-text-muted">Gestionar tenants de la plataforma · {filtered.length} de {organizations.length}</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-[12px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.97]"
          style={{ boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}
        >
          <Plus size={14} />
          Crear Organización
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o slug…"
            className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-brand"
          />
        </div>
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} className="appearance-none rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary outline-none transition-all focus:border-brand">
          <option value="">Todos los planes</option>
          <option value="demo">Demo</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="appearance-none rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary outline-none transition-all focus:border-brand">
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="suspended">Suspendido</option>
        </select>
        <button
          onClick={() => {
            const headers = ["Nombre", "Slug", "Plan", "Status", "Miembros", "Creado"];
            const rows = filtered.map((org: any) => [
              org.name, org.slug, org.settings?.plan || "demo", org.status, String(orgMemberMap[org.id] || 0), new Date(org.created_at).toLocaleDateString("es")
            ]);
            exportCSV("organizaciones", headers, rows);
          }}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-medium text-text-secondary transition-all hover:border-brand hover:text-brand"
        >
          <Download size={12} /> CSV
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-4 text-[13px] font-semibold text-text-primary">Nueva Organización</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-text-muted">Nombre</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")); }}
                className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                placeholder="Empresa X"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-text-muted">Slug</label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                placeholder="empresa-x"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-text-muted">Plan</label>
              <select
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
              >
                <option value="demo">Demo</option>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={handleCreate} className="rounded-xl bg-brand px-4 py-2 text-xs font-medium text-white">Crear</button>
            <button onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2 text-xs font-medium text-text-muted hover:bg-muted">Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Organización", "Slug", "Plan", "Estado", "Usuarios", "Acciones"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((org: any) => (
              <tr key={org.id} className="border-b border-border last:border-b-0 transition-colors hover:bg-muted/50">
                <td className="px-5 py-3.5">
                  <Link to={`/admin/organizations/${org.id}`} className="flex items-center gap-3 group">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>
                      {org.name.charAt(0)}
                    </div>
                    <span className="text-[12px] font-medium text-text-primary group-hover:underline">{org.name}</span>
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <code className="font-mono text-[11px] text-text-muted">{org.slug}</code>
                </td>
                <td className="px-5 py-3.5">
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{
                    backgroundColor: (org.settings?.plan || org.plan) === "enterprise" ? "#F59E0B20" : (org.settings?.plan || org.plan) === "professional" ? "#8B5CF620" : "#71717A20",
                    color: (org.settings?.plan || org.plan) === "enterprise" ? "#F59E0B" : (org.settings?.plan || org.plan) === "professional" ? "#8B5CF6" : "#A1A1AA",
                  }}>{org.settings?.plan || org.plan || "demo"}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{
                    backgroundColor: org.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                    color: org.status === "active" ? "var(--success)" : "var(--error)",
                  }}>{org.status}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-mono text-[12px] font-bold text-text-primary tabular-nums">{orgMemberMap[org.id] || 0}</span>
                </td>
                <td className="px-5 py-3.5">
                  <button onClick={() => handleToggle(org.id, org.status)} className="rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-text-muted transition-colors hover:bg-muted hover:text-text-primary">
                    {org.status === "active" ? "Suspender" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
