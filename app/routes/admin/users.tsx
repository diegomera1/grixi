/**
 * Admin — Platform Users & Admin Management
 *
 * Granular RBAC: promote users with specific roles + org scope.
 * Super admins cannot be degraded from UI.
 * Four-eyes: role changes require confirmation.
 */
import { useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/admin.users";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { requirePlatformAdmin, requirePlatformPermission, invalidatePlatformAdminCache } from "~/lib/platform-rbac/guard.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { exportCSV } from "~/lib/export";
import {
  Shield, ShieldOff, Search, Download, ShieldCheck, X,
  Lock, Building2, ChevronDown,
} from "lucide-react";
import { useState, useMemo } from "react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.users.view", headers);

  const admin = createSupabaseAdminClient(env);

  const { data: profiles } = await admin.from("profiles").select("*").order("created_at", { ascending: false });
  const { data: memberships } = await admin
    .from("memberships")
    .select("user_id, organization_id, status, roles(name), organizations(name)")
    .eq("status", "active");

  // Platform admins with role details
  const { data: platformAdmins } = await admin
    .from("platform_admins")
    .select("user_id, role_id, scoped_org_ids, granted_by, granted_at, notes, platform_roles(name, display_name, hierarchy_level, is_super_admin, color)")
    .order("granted_at", { ascending: false });

  // Available platform roles
  const { data: platformRoles } = await admin
    .from("platform_roles")
    .select("id, name, display_name, hierarchy_level, is_super_admin, color, description")
    .order("hierarchy_level", { ascending: false });

  // All organizations for scope selection
  const { data: organizations } = await admin
    .from("organizations")
    .select("id, name, slug, status")
    .order("name");

  // All auth users
  const allAuthUsers: any[] = [];
  let page = 1;
  while (true) {
    const { data: authData } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (!authData?.users?.length) break;
    allAuthUsers.push(...authData.users);
    if (authData.users.length < 1000) break;
    page++;
  }

  const paMap = new Map<string, any>();
  (platformAdmins || []).forEach((pa: any) => paMap.set(pa.user_id, pa));

  const usersMap = new Map<string, any>();
  allAuthUsers.forEach((u: any) => {
    const pa = paMap.get(u.id);
    usersMap.set(u.id, {
      id: u.id, email: u.email,
      name: u.user_metadata?.full_name || u.email,
      avatar: u.user_metadata?.avatar_url,
      lastSignIn: u.last_sign_in_at,
      isPlatformAdmin: !!pa,
      adminRole: pa ? (pa as any).platform_roles : null,
      scopedOrgIds: pa?.scoped_org_ids || null,
      memberships: [] as any[],
    });
  });

  memberships?.forEach((m: any) => {
    const usr = usersMap.get(m.user_id);
    if (usr) usr.memberships.push({ orgName: (m as any).organizations?.name || "—", roleName: (m as any).roles?.name || "—" });
  });

  return Response.json({
    users: Array.from(usersMap.values()),
    platformRoles: platformRoles || [],
    organizations: organizations || [],
    canManage: adminCtx.isSuperAdmin || adminCtx.permissions.includes("admin.users.manage"),
    currentAdminCtx: { userId: adminCtx.userId, isSuperAdmin: adminCtx.isSuperAdmin, hierarchyLevel: adminCtx.role.hierarchy_level },
  }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.users.manage", headers);

  const admin = createSupabaseAdminClient(env);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const targetUserId = formData.get("user_id") as string;
  const ip = getClientIP(request);
  const kv = (env as any).KV_CACHE as KVNamespace | undefined;

  if (intent === "promote") {
    const roleId = formData.get("role_id") as string;
    const scopedOrgIds = formData.get("scoped_org_ids") as string;
    const notes = formData.get("notes") as string;

    // Verify role exists and actor can assign it
    const { data: role } = await admin.from("platform_roles").select("hierarchy_level, is_super_admin, display_name").eq("id", roleId).single();
    if (!role) return Response.json({ error: "Rol no encontrado" }, { status: 400, headers });
    if (role.is_super_admin && !adminCtx.isSuperAdmin) return Response.json({ error: "Solo Super Admins pueden asignar este rol" }, { status: 403, headers });
    if (!adminCtx.isSuperAdmin && role.hierarchy_level >= adminCtx.role.hierarchy_level) {
      return Response.json({ error: "No puedes asignar un rol de igual o mayor nivel" }, { status: 403, headers });
    }

    const parsedScope = scopedOrgIds ? JSON.parse(scopedOrgIds) : null;
    const { error } = await admin.from("platform_admins").upsert({
      user_id: targetUserId, role_id: roleId,
      scoped_org_ids: parsedScope?.length > 0 ? parsedScope : null,
      granted_by: adminCtx.userId, notes: notes || null,
    }, { onConflict: "user_id" });

    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    await invalidatePlatformAdminCache(kv, targetUserId, roleId);
    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: "platform_admin.promote", entityType: "platform_admin",
      entityId: targetUserId, metadata: { role: role.display_name, scopedOrgs: parsedScope?.length || "all", notes }, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "demote") {
    if (targetUserId === adminCtx.userId) return Response.json({ error: "No puedes removerte como admin" }, { status: 400, headers });

    // Check target is not super admin
    const { data: target } = await admin
      .from("platform_admins")
      .select("role_id, platform_roles(is_super_admin, hierarchy_level)")
      .eq("user_id", targetUserId)
      .single();

    if ((target as any)?.platform_roles?.is_super_admin) {
      return Response.json({ error: "Los Super Admins no pueden ser degradados desde la UI" }, { status: 403, headers });
    }
    if (!adminCtx.isSuperAdmin && (target as any)?.platform_roles?.hierarchy_level >= adminCtx.role.hierarchy_level) {
      return Response.json({ error: "No puedes revocar a alguien de igual o mayor nivel" }, { status: 403, headers });
    }

    await admin.from("platform_admins").delete().eq("user_id", targetUserId);
    await invalidatePlatformAdminCache(kv, targetUserId);
    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: "platform_admin.demote", entityType: "platform_admin",
      entityId: targetUserId, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "update_role") {
    const roleId = formData.get("role_id") as string;
    const scopedOrgIds = formData.get("scoped_org_ids") as string;

    const { data: role } = await admin.from("platform_roles").select("hierarchy_level, is_super_admin, display_name").eq("id", roleId).single();
    if (role?.is_super_admin && !adminCtx.isSuperAdmin) return Response.json({ error: "Solo Super Admins pueden asignar este rol" }, { status: 403, headers });

    const parsedScope = scopedOrgIds ? JSON.parse(scopedOrgIds) : null;
    await admin.from("platform_admins").update({
      role_id: roleId,
      scoped_org_ids: parsedScope?.length > 0 ? parsedScope : null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", targetUserId);

    await invalidatePlatformAdminCache(kv, targetUserId, roleId);
    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: "platform_admin.update_role", entityType: "platform_admin",
      entityId: targetUserId, metadata: { role: role?.display_name, scopedOrgs: parsedScope?.length || "all" }, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

export default function AdminUsers() {
  const { users, platformRoles, organizations, canManage, currentAdminCtx } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [filterAdmin, setFilterAdmin] = useState("");
  const [promoteUser, setPromoteUser] = useState<any>(null);

  const filtered = useMemo(() => {
    return users.filter((u: any) => {
      const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
      const matchAdmin = !filterAdmin || (filterAdmin === "admin" ? u.isPlatformAdmin : !u.isPlatformAdmin);
      return matchSearch && matchAdmin;
    });
  }, [users, search, filterAdmin]);

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Usuarios</h1>
          <p className="mt-0.5 text-[11px] text-text-muted">Gestión global · {filtered.length} de {users.length}</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o email…"
            className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand" />
        </div>
        <select value={filterAdmin} onChange={(e) => setFilterAdmin(e.target.value)}
          className="appearance-none rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary outline-none focus:border-brand">
          <option value="">Todos</option>
          <option value="admin">Platform Admins</option>
          <option value="user">Usuarios</option>
        </select>
        <button onClick={() => {
          const h = ["Nombre", "Email", "Admin", "Rol", "Último acceso"];
          const rows = filtered.map((u: any) => [u.name, u.email, u.isPlatformAdmin ? "Sí" : "No", u.adminRole?.display_name || "—", u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString("es") : "—"]);
          exportCSV("usuarios", h, rows);
        }} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-medium text-text-secondary hover:border-brand hover:text-brand">
          <Download size={12} /> CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Usuario", "Organizaciones", "Último acceso", "Rol Admin", "Acciones"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u: any) => (
              <tr key={u.id} className="border-b border-border last:border-b-0 transition-colors hover:bg-muted/50">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="h-8 w-8 rounded-full ring-2 ring-white/10" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-text-secondary">
                        {u.name?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                    )}
                    <div>
                      <p className="text-[12px] font-medium text-text-primary">{u.name}</p>
                      <p className="text-[10px] text-text-muted">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    {u.memberships?.length > 0 ? u.memberships.slice(0, 3).map((m: any, i: number) => (
                      <span key={i} className="rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>
                        {m.orgName}
                      </span>
                    )) : <span className="text-[10px] text-text-muted">—</span>}
                    {u.memberships?.length > 3 && <span className="text-[9px] text-text-muted">+{u.memberships.length - 3}</span>}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-[11px] tabular-nums text-text-muted">
                    {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {u.isPlatformAdmin && u.adminRole ? (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: `${u.adminRole.color}15`, color: u.adminRole.color }}>
                        {u.adminRole.is_super_admin ? <Lock size={9} /> : <ShieldCheck size={9} />}
                        {u.adminRole.display_name}
                      </span>
                      {u.scopedOrgIds && (
                        <span className="text-[9px] text-text-muted">{u.scopedOrgIds.length} orgs</span>
                      )}
                    </div>
                  ) : <span className="text-[10px] text-text-muted">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  {canManage && (
                    <div className="flex items-center gap-1">
                      {u.isPlatformAdmin ? (
                        <>
                          {/* Edit role */}
                          <button onClick={() => setPromoteUser(u)}
                            className="rounded-lg px-2 py-1 text-[10px] font-medium text-brand hover:bg-brand/10">
                            Editar
                          </button>
                          {/* Revoke — only if not super admin and actor has higher level */}
                          {!u.adminRole?.is_super_admin && (
                            currentAdminCtx.isSuperAdmin || currentAdminCtx.hierarchyLevel > (u.adminRole?.hierarchy_level || 0)
                          ) && u.id !== currentAdminCtx.userId && (
                            <button onClick={() => {
                              if (confirm(`¿Revocar acceso admin de ${u.name}?`)) {
                                fetcher.submit({ intent: "demote", user_id: u.id }, { method: "post" });
                              }
                            }} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-error/70 hover:bg-error/10 hover:text-error">
                              <ShieldOff size={11} /> Revocar
                            </button>
                          )}
                        </>
                      ) : (
                        <button onClick={() => setPromoteUser(u)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-success hover:bg-success/10">
                          <Shield size={11} /> Promover
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Promote/Edit Modal */}
      {promoteUser && (
        <PromoteModal
          user={promoteUser}
          roles={platformRoles}
          organizations={organizations}
          currentAdmin={currentAdminCtx}
          onClose={() => setPromoteUser(null)}
        />
      )}
    </div>
  );
}

// ── Promote/Edit Admin Modal ──
function PromoteModal({ user, roles, organizations, currentAdmin, onClose }: {
  user: any; roles: any[]; organizations: any[]; currentAdmin: any; onClose: () => void;
}) {
  const fetcher = useFetcher();
  const isEditing = user.isPlatformAdmin;
  const [selectedRoleId, setSelectedRoleId] = useState(user.adminRole ? roles.find((r: any) => r.name === user.adminRole.name)?.id || "" : "");
  const [scopedOrgs, setScopedOrgs] = useState<string[]>(user.scopedOrgIds || []);
  const [allOrgs, setAllOrgs] = useState(!user.scopedOrgIds);
  const [notes, setNotes] = useState("");
  const [showOrgPicker, setShowOrgPicker] = useState(false);

  // Filter roles actor can assign
  const assignableRoles = roles.filter((r: any) => {
    if (currentAdmin.isSuperAdmin) return true;
    return r.hierarchy_level < currentAdmin.hierarchyLevel && !r.is_super_admin;
  });

  const selectedRole = roles.find((r: any) => r.id === selectedRoleId);

  const handleSubmit = () => {
    const confirmMsg = isEditing
      ? `¿Cambiar rol de ${user.name} a ${selectedRole?.display_name}?`
      : `¿Promover a ${user.name} como ${selectedRole?.display_name}?`;

    if (!confirm(confirmMsg)) return;

    fetcher.submit({
      intent: isEditing ? "update_role" : "promote",
      user_id: user.id,
      role_id: selectedRoleId,
      scoped_org_ids: allOrgs ? "" : JSON.stringify(scopedOrgs),
      notes,
    }, { method: "post" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user.avatar ? (
              <img src={user.avatar} className="h-10 w-10 rounded-full ring-2 ring-brand/20" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-[12px] font-bold text-brand">
                {user.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-[13px] font-bold text-text-primary">{user.name}</p>
              <p className="text-[10px] text-text-muted">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
        </div>

        {/* Role Selection */}
        <div className="mb-4">
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Rol de Plataforma</label>
          <div className="grid grid-cols-2 gap-2">
            {assignableRoles.map((r: any) => (
              <button key={r.id} onClick={() => setSelectedRoleId(r.id)}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all ${
                  selectedRoleId === r.id ? "border-brand bg-brand/5" : "border-border hover:border-brand/30"
                }`}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${r.color}15` }}>
                  {r.is_super_admin ? <Lock size={13} style={{ color: r.color }} /> : <ShieldCheck size={13} style={{ color: r.color }} />}
                </div>
                <div>
                  <p className="text-[11px] font-bold text-text-primary">{r.display_name}</p>
                  <p className="text-[9px] text-text-muted">Nivel {r.hierarchy_level}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Org Scope */}
        {selectedRole && !selectedRole.is_super_admin && (
          <div className="mb-4">
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Alcance de Organizaciones</label>
            <div className="flex gap-2 mb-2">
              <button onClick={() => { setAllOrgs(true); setScopedOrgs([]); }}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-medium ${allOrgs ? "bg-brand text-white" : "border border-border text-text-muted"}`}>
                Todas las orgs
              </button>
              <button onClick={() => setAllOrgs(false)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-medium ${!allOrgs ? "bg-brand text-white" : "border border-border text-text-muted"}`}>
                Orgs específicas
              </button>
            </div>
            {!allOrgs && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {organizations.map((org: any) => (
                  <label key={org.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/30">
                    <input type="checkbox" checked={scopedOrgs.includes(org.id)}
                      onChange={(e) => {
                        if (e.target.checked) setScopedOrgs([...scopedOrgs, org.id]);
                        else setScopedOrgs(scopedOrgs.filter((id) => id !== org.id));
                      }}
                      className="rounded border-border" />
                    <Building2 size={12} className="text-text-muted" />
                    <span className="text-[11px] text-text-primary">{org.name}</span>
                    <span className="text-[9px] text-text-muted">{org.slug}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="mb-5">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Notas (opcional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Razón del cambio..."
            className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-[11px] text-text-primary outline-none focus:border-brand" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-[11px] text-text-muted hover:text-text-primary">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={!selectedRoleId}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[11px] font-medium text-white shadow-lg shadow-brand/20 disabled:opacity-50">
            <ShieldCheck size={12} />
            {isEditing ? "Actualizar Rol" : "Promover Admin"}
          </button>
        </div>
      </div>
    </div>
  );
}
