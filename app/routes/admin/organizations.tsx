import { redirect, useLoaderData, useFetcher, Link } from "react-router";
import type { Route } from "./+types/admin.organizations";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { exportCSV } from "~/lib/export";
import { Plus, Search, Download } from "lucide-react";
import { useState, useMemo } from "react";

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
  const { supabase, headers } = createSupabaseServerClient(request, env);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);
  const { data: platformAdmin } = await admin
    .from("platform_admins")
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
      .insert({ name, slug, plan, status: "active" })
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    await admin.from("roles").insert([
      { organization_id: org.id, name: "owner", description: "Propietario", is_system: true },
      { organization_id: org.id, name: "admin", description: "Administrador", is_system: true },
      { organization_id: org.id, name: "member", description: "Miembro", is_system: true },
      { organization_id: org.id, name: "viewer", description: "Solo lectura", is_system: true },
    ]);

    await logAuditEvent(admin, { actorId: user.id, action: "organization.create", entityType: "organization", entityId: org.id, metadata: { name, slug }, ipAddress: ip });
    return Response.json({ success: true, org }, { headers });
  }

  if (intent === "toggle_status") {
    const orgId = formData.get("org_id") as string;
    const newStatus = formData.get("new_status") as string;
    await admin.from("organizations").update({ status: newStatus }).eq("id", orgId);
    await logAuditEvent(admin, { actorId: user.id, action: "organization.toggle_status", entityType: "organization", entityId: orgId, metadata: { newStatus }, ipAddress: ip });
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
    <div className="animate-in fade-in duration-500">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Organizaciones</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>Gestionar tenants de la plataforma · {filtered.length} de {organizations.length}</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.97]"
          style={{ backgroundColor: "#7c3aed" }}
        >
          <Plus size={16} />
          Crear Organización
        </button>
      </div>

      {/* Search + Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o slug…"
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:ring-1"
            style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
        </div>
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} className="rounded-lg border px-3 py-2 text-xs outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
          <option value="">Todos los planes</option>
          <option value="demo">Demo</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-xs outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
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
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-white/5"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <Download size={13} /> CSV
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <h3 className="mb-4 font-semibold" style={{ color: "var(--foreground)" }}>Nueva Organización</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Nombre</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")); }}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                placeholder="Empresa X"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Slug</label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                placeholder="empresa-x"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Plan</label>
              <select
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                <option value="demo">Demo</option>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={handleCreate} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: "#7c3aed" }}>Crear</button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-white/5" style={{ color: "var(--muted-foreground)" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              {["Organización", "Slug", "Plan", "Estado", "Usuarios", "Acciones"].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((org: any) => (
              <tr key={org.id} className="border-b last:border-b-0 transition-colors hover:bg-white/2" style={{ borderColor: "var(--border)" }}>
                <td className="px-6 py-4">
                  <Link to={`/admin/organizations/${org.id}`} className="flex items-center gap-3 group">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>
                      {org.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium group-hover:underline" style={{ color: "var(--foreground)" }}>{org.name}</span>
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <code className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>{org.slug}</code>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{
                    backgroundColor: org.plan === "enterprise" ? "#F59E0B20" : org.plan === "professional" ? "#8B5CF620" : "#71717A20",
                    color: org.plan === "enterprise" ? "#F59E0B" : org.plan === "professional" ? "#8B5CF6" : "#A1A1AA",
                  }}>{org.plan}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{
                    backgroundColor: org.status === "active" ? "#16A34A20" : "#EF444420",
                    color: org.status === "active" ? "#16A34A" : "#EF4444",
                  }}>{org.status}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm" style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{orgMemberMap[org.id] || 0}</span>
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => handleToggle(org.id, org.status)} className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5" style={{ color: "var(--muted-foreground)" }}>
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
