import { redirect, useLoaderData, useFetcher, Link } from "react-router";
import type { Route } from "./+types/admin.organizations.$id";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { isPlatformTenant } from "~/lib/platform-guard";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { ArrowLeft, Users, Puzzle, Mail, Globe, Settings, Save, Shield, Trash2, Plus } from "lucide-react";
import { useState } from "react";

const ALL_MODULES = [
  { id: "dashboard", name: "Dashboard", color: "#6366F1" },
  { id: "almacenes", name: "Almacenes", color: "#16A34A" },
  { id: "compras", name: "Compras", color: "#F59E0B" },
  { id: "finanzas", name: "Finanzas", color: "#3B82F6" },
  { id: "rrhh", name: "RRHH", color: "#EC4899" },
  { id: "flota", name: "Flota", color: "#06B6D4" },
  { id: "ai", name: "GRIXI AI", color: "#8B5CF6" },
  { id: "usuarios", name: "Usuarios", color: "#EF4444" },
  { id: "reportes", name: "Reportes", color: "#14B8A6" },
  { id: "notificaciones", name: "Notificaciones", color: "#F97316" },
  { id: "admin", name: "Administración", color: "#6D28D9" },
];

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  // Platform admin routes ONLY accessible from grixi.grixi.ai
  if (!isPlatformTenant(context)) return redirect("/dashboard", { headers });

  const admin = createSupabaseAdminClient(env);
  const { data: pa } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!pa) return redirect("/dashboard", { headers });

  const orgId = params.id;

  const [orgRes, membersRes, invitationsRes, domainsRes, rolesRes, permsRes] = await Promise.all([
    admin.from("organizations").select("*").eq("id", orgId).single(),
    admin.from("memberships").select("*, profiles(id, full_name, avatar_url), roles(name, hierarchy_level)")
      .eq("organization_id", orgId).eq("status", "active"),
    admin.from("invitations").select("*, roles(name)").eq("organization_id", orgId).order("created_at", { ascending: false }),
    admin.from("domain_whitelists").select("*").eq("organization_id", orgId),
    admin.from("roles").select("id, name, hierarchy_level, is_system, is_default, description, role_permissions(permission_id, permissions(id, key, description, category, min_plan))").eq("organization_id", orgId).order("hierarchy_level", { ascending: false }),
    admin.from("permissions").select("id, key, description, category, min_plan").order("category").order("key"),
  ]);

  if (!orgRes.data) return redirect("/admin/organizations", { headers });

  // Get auth user data for members
  const memberUsers: Record<string, any> = {};
  if (membersRes.data) {
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
    authData?.users?.forEach((u: any) => {
      memberUsers[u.id] = { email: u.email, name: u.user_metadata?.full_name || u.email, avatar: u.user_metadata?.avatar_url };
    });
  }

  return Response.json({
    org: orgRes.data,
    members: (membersRes.data || []).map((m: any) => ({
      ...m,
      user: memberUsers[m.user_id] || { email: "—", name: "—" },
    })),
    invitations: invitationsRes.data || [],
    domains: domainsRes.data || [],
    roles: rolesRes.data || [],
    allPermissions: permsRes.data || [],
  }, { headers });
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  // CRITICAL: Block mutations from non-platform tenants
  if (!isPlatformTenant(context)) return Response.json({ error: "Forbidden" }, { status: 403, headers });

  const admin = createSupabaseAdminClient(env);
  const { data: pa } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!pa) return Response.json({ error: "Unauthorized" }, { status: 403, headers });

  const orgId = params.id;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const ip = getClientIP(request);

  if (intent === "invite") {
    const email = formData.get("email") as string;
    const roleId = formData.get("role_id") as string;
    if (!email || !roleId) return Response.json({ error: "Email y rol requeridos" }, { status: 400, headers });

    const { error } = await admin.from("invitations").insert({
      organization_id: orgId,
      email,
      role_id: roleId,
      invited_by: user.id,
      status: "pending",
    });
    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    await logAuditEvent(admin, { actorId: user.id, action: "invitation.create", entityType: "invitation", metadata: { email, orgId }, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "cancel_invitation") {
    const invId = formData.get("invitation_id") as string;
    await admin.from("invitations").update({ status: "cancelled" }).eq("id", invId);
    await logAuditEvent(admin, { actorId: user.id, action: "invitation.cancel", entityType: "invitation", entityId: invId, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "update_modules") {
    const modulesStr = formData.get("modules") as string;
    const modules = JSON.parse(modulesStr);
    const { data: org } = await admin.from("organizations").select("settings").eq("id", orgId).single();
    const settings = { ...(org?.settings || {}), enabled_modules: modules };
    await admin.from("organizations").update({ settings }).eq("id", orgId);
    await logAuditEvent(admin, { actorId: user.id, action: "organization.update_modules", entityType: "organization", entityId: orgId, metadata: { modules }, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "update_settings") {
    const plan = formData.get("plan") as string;
    const maxUsers = parseInt(formData.get("max_users") as string) || 10;
    const primaryColor = formData.get("primary_color") as string;
    const billingEmail = formData.get("billing_email") as string;
    const { data: org } = await admin.from("organizations").select("settings").eq("id", orgId).single();
    const settings = { ...(org?.settings || {}), plan, max_users: maxUsers, primary_color: primaryColor, billing_email: billingEmail };
    await admin.from("organizations").update({ settings }).eq("id", orgId);
    await logAuditEvent(admin, { actorId: user.id, action: "organization.update_settings", entityType: "organization", entityId: orgId, metadata: { plan, maxUsers }, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "add_domain") {
    const domain = formData.get("domain") as string;
    const autoRole = formData.get("auto_role") as string;
    if (!domain) return Response.json({ error: "Dominio requerido" }, { status: 400, headers });
    const { error } = await admin.from("domain_whitelists").insert({ organization_id: orgId, domain, auto_role: autoRole || "member", created_by: user.id });
    if (error) return Response.json({ error: error.message }, { status: 400, headers });
    await logAuditEvent(admin, { actorId: user.id, action: "domain.add", entityType: "domain_whitelist", metadata: { domain, orgId }, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "remove_domain") {
    const domainId = formData.get("domain_id") as string;
    await admin.from("domain_whitelists").delete().eq("id", domainId);
    await logAuditEvent(admin, { actorId: user.id, action: "domain.remove", entityType: "domain_whitelist", entityId: domainId, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "create_role") {
    const roleName = formData.get("role_name") as string;
    const roleDesc = formData.get("role_desc") as string;
    const hierarchyLevel = parseInt(formData.get("hierarchy_level") as string) || 30;
    if (!roleName) return Response.json({ error: "Nombre requerido" }, { status: 400, headers });
    const { data: newRole, error } = await admin.from("roles").insert({
      organization_id: orgId, name: roleName.toLowerCase().replace(/\s+/g, "_"),
      description: roleDesc || roleName, is_system: false, hierarchy_level: hierarchyLevel, is_default: false,
    }).select().single();
    if (error) return Response.json({ error: error.message }, { status: 400, headers });
    await logAuditEvent(admin, { actorId: user.id, action: "role.create", entityType: "role", entityId: newRole.id, metadata: { roleName, hierarchyLevel }, ipAddress: ip, organizationId: orgId });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "update_role_permissions") {
    const roleId = formData.get("role_id") as string;
    const permissionIds = JSON.parse(formData.get("permission_ids") as string) as string[];
    // Delete existing role_permissions, then re-insert
    await admin.from("role_permissions").delete().eq("role_id", roleId);
    if (permissionIds.length > 0) {
      await admin.from("role_permissions").insert(permissionIds.map((pid: string) => ({ role_id: roleId, permission_id: pid })));
    }
    await logAuditEvent(admin, { actorId: user.id, action: "role.update_permissions", entityType: "role", entityId: roleId, metadata: { permissionCount: permissionIds.length }, ipAddress: ip, organizationId: orgId });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "delete_role") {
    const roleId = formData.get("role_id") as string;
    await admin.from("role_permissions").delete().eq("role_id", roleId);
    await admin.from("roles").delete().eq("id", roleId).eq("is_system", false);
    await logAuditEvent(admin, { actorId: user.id, action: "role.delete", entityType: "role", entityId: roleId, ipAddress: ip, organizationId: orgId });
    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

const TABS = [
  { id: "members", label: "Miembros", icon: <Users size={16} /> },
  { id: "roles", label: "Roles & Permisos", icon: <Shield size={16} /> },
  { id: "modules", label: "Módulos", icon: <Puzzle size={16} /> },
  { id: "invitations", label: "Invitaciones", icon: <Mail size={16} /> },
  { id: "domains", label: "Dominios", icon: <Globe size={16} /> },
  { id: "settings", label: "Configuración", icon: <Settings size={16} /> },
];

export default function OrgDetail() {
  const { org, members, invitations, domains, roles, allPermissions } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [activeTab, setActiveTab] = useState("members");
  const settings = org.settings || {};

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link to="/admin/organizations" className="rounded-lg p-2 hover:bg-white/5 transition-colors" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold" style={{ backgroundColor: (settings.primary_color || "#6366F1") + "20", color: settings.primary_color || "#6366F1" }}>
              {org.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{org.name}</h1>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{org.slug}.grixi.ai</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: org.status === "active" ? "#16A34A20" : "#EF444420", color: org.status === "active" ? "#16A34A" : "#EF4444" }}>{org.status}</span>
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>{settings.plan || "demo"}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${activeTab === tab.id ? "border-purple-500 text-white" : "border-transparent hover:text-white/70"}`}
            style={{ color: activeTab === tab.id ? "var(--foreground)" : "var(--muted-foreground)" }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "members" && <MembersTab members={members} roles={roles} fetcher={fetcher} />}
      {activeTab === "roles" && <RolesTab roles={roles} allPermissions={allPermissions} settings={settings} fetcher={fetcher} />}
      {activeTab === "modules" && <ModulesTab settings={settings} fetcher={fetcher} />}
      {activeTab === "invitations" && <InvitationsTab invitations={invitations} roles={roles} fetcher={fetcher} />}
      {activeTab === "domains" && <DomainsTab domains={domains} fetcher={fetcher} />}
      {activeTab === "settings" && <SettingsTab settings={settings} fetcher={fetcher} />}
    </div>
  );
}

function MembersTab({ members, roles, fetcher }: { members: any[]; roles: any[]; fetcher: any }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <table className="w-full">
        <thead><tr className="border-b" style={{ borderColor: "var(--border)" }}>
          {["Usuario", "Rol", "Nivel", "Desde"].map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {members.map((m: any) => (
            <tr key={m.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  {m.user.avatar ? <img src={m.user.avatar} className="h-8 w-8 rounded-full ring-2 ring-white/10" referrerPolicy="no-referrer" /> : <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}>{m.user.name?.charAt(0)?.toUpperCase()}</div>}
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{m.user.name}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{m.user.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4"><span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>{m.roles?.name || "—"}</span></td>
              <td className="px-6 py-4"><span className="font-mono text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>{m.roles?.hierarchy_level ?? "—"}</span></td>
              <td className="px-6 py-4"><span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{new Date(m.joined_at || m.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}</span></td>
            </tr>
          ))}
          {members.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Sin miembros</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ModulesTab({ settings, fetcher }: { settings: any; fetcher: any }) {
  const [modules, setModules] = useState<string[]>(settings.enabled_modules || ["dashboard"]);

  const toggle = (id: string) => {
    if (id === "dashboard") return; // dashboard always on
    setModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const save = () => {
    fetcher.submit({ intent: "update_modules", modules: JSON.stringify(modules) }, { method: "post" });
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {ALL_MODULES.map((mod) => {
          const enabled = modules.includes(mod.id);
          return (
            <button key={mod.id} onClick={() => toggle(mod.id)} disabled={mod.id === "dashboard"}
              className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${enabled ? "ring-2" : "opacity-50"}`}
              style={{ backgroundColor: "var(--card)", borderColor: enabled ? mod.color : "var(--border)", boxShadow: enabled ? `0 0 12px ${mod.color}15` : "none" }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold" style={{ backgroundColor: `${mod.color}20`, color: mod.color }}>{mod.name.charAt(0)}</div>
              <div className="text-left"><p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{mod.name}</p><p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{enabled ? "Activo" : "Inactivo"}</p></div>
            </button>
          );
        })}
      </div>
      <button onClick={save} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white" style={{ backgroundColor: "#7c3aed" }}>
        <Save size={16} /> Guardar Módulos
      </button>
    </div>
  );
}

function InvitationsTab({ invitations, roles, fetcher }: { invitations: any[]; roles: any[]; fetcher: any }) {
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id || "");

  const invite = () => {
    if (!email) return;
    fetcher.submit({ intent: "invite", email, role_id: roleId }, { method: "post" });
    setEmail("");
  };

  return (
    <div>
      <div className="mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Rol</label>
          <select value={roleId} onChange={e => setRoleId(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
            {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <button onClick={invite} className="rounded-lg px-4 py-2 text-sm font-medium text-white whitespace-nowrap" style={{ backgroundColor: "#7c3aed" }}>
          <Mail size={16} className="inline mr-1.5" />Invitar
        </button>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <table className="w-full">
          <thead><tr className="border-b" style={{ borderColor: "var(--border)" }}>
            {["Email", "Rol", "Estado", "Fecha", ""].map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {invitations.map((inv: any) => (
              <tr key={inv.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <td className="px-6 py-4 text-sm" style={{ color: "var(--foreground)" }}>{inv.email}</td>
                <td className="px-6 py-4"><span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>{inv.roles?.name || "—"}</span></td>
                <td className="px-6 py-4"><span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{
                  backgroundColor: inv.status === "pending" ? "#F59E0B20" : inv.status === "accepted" ? "#16A34A20" : "#EF444420",
                  color: inv.status === "pending" ? "#F59E0B" : inv.status === "accepted" ? "#16A34A" : "#EF4444",
                }}>{inv.status}</span></td>
                <td className="px-6 py-4 text-xs" style={{ color: "var(--muted-foreground)" }}>{new Date(inv.created_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}</td>
                <td className="px-6 py-4">{inv.status === "pending" && (
                  <button onClick={() => fetcher.submit({ intent: "cancel_invitation", invitation_id: inv.id }, { method: "post" })} className="text-xs hover:bg-white/5 rounded px-2 py-1" style={{ color: "#EF4444" }}>Cancelar</button>
                )}</td>
              </tr>
            ))}
            {invitations.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Sin invitaciones</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DomainsTab({ domains, fetcher }: { domains: any[]; fetcher: any }) {
  const [domain, setDomain] = useState("");
  const [autoRole, setAutoRole] = useState("member");

  const add = () => {
    if (!domain) return;
    fetcher.submit({ intent: "add_domain", domain, auto_role: autoRole }, { method: "post" });
    setDomain("");
  };

  return (
    <div>
      <div className="mb-4 rounded-xl border p-4" style={{ backgroundColor: "#6366F108", borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Los dominios configurados auto-aprueban usuarios al registrarse con un email que coincida.
        </p>
      </div>
      <div className="mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Dominio</label>
          <input type="text" value={domain} onChange={e => setDomain(e.target.value)} placeholder="empresa.com"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Rol auto-asignado</label>
          <select value={autoRole} onChange={e => setAutoRole(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
            <option value="member">member</option><option value="viewer">viewer</option><option value="admin">admin</option><option value="owner">owner</option>
          </select>
        </div>
        <button onClick={add} className="rounded-lg px-4 py-2 text-sm font-medium text-white whitespace-nowrap" style={{ backgroundColor: "#7c3aed" }}>Agregar</button>
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <table className="w-full">
          <thead><tr className="border-b" style={{ borderColor: "var(--border)" }}>
            {["Dominio", "Rol", "Fecha", ""].map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {domains.map((d: any) => (
              <tr key={d.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <td className="px-6 py-4"><code className="text-sm font-mono" style={{ color: "var(--foreground)" }}>@{d.domain}</code></td>
                <td className="px-6 py-4"><span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>{d.auto_role}</span></td>
                <td className="px-6 py-4 text-xs" style={{ color: "var(--muted-foreground)" }}>{new Date(d.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td className="px-6 py-4"><button onClick={() => fetcher.submit({ intent: "remove_domain", domain_id: d.id }, { method: "post" })} className="text-xs hover:bg-white/5 rounded px-2 py-1" style={{ color: "#EF4444" }}>Eliminar</button></td>
              </tr>
            ))}
            {domains.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Sin dominios configurados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab({ settings, fetcher }: { settings: any; fetcher: any }) {
  const [plan, setPlan] = useState(settings.plan || "demo");
  const [maxUsers, setMaxUsers] = useState(settings.max_users || 10);
  const [primaryColor, setPrimaryColor] = useState(settings.primary_color || "#7c3aed");
  const [billingEmail, setBillingEmail] = useState(settings.billing_email || "");

  const save = () => {
    fetcher.submit({ intent: "update_settings", plan, max_users: String(maxUsers), primary_color: primaryColor, billing_email: billingEmail }, { method: "post" });
  };

  return (
    <div className="rounded-xl border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Plan</label>
          <select value={plan} onChange={e => setPlan(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
            <option value="demo">Demo</option><option value="starter">Starter</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Máximo de usuarios</label>
          <input type="number" value={maxUsers} onChange={e => setMaxUsers(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Color primario</label>
          <div className="flex items-center gap-3">
            <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-10 rounded cursor-pointer border-0" />
            <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1 rounded-lg border px-3 py-2 text-sm font-mono outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Email de facturación</label>
          <input type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} placeholder="billing@empresa.com" className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
        </div>
      </div>
      <button onClick={save} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white" style={{ backgroundColor: "#7c3aed" }}>
        <Save size={16} /> Guardar Configuración
      </button>
    </div>
  );
}
