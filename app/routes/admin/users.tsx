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
  Lock, Building2, ChevronDown, KeyRound, Settings2, Check, Minus, Plus,
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
    .select("id, user_id, role_id, scoped_org_ids, granted_by, granted_at, notes, platform_roles(name, display_name, hierarchy_level, is_super_admin, color)")
    .order("granted_at", { ascending: false });

  // Available platform roles + full permission catalog
  const { data: platformRoles } = await admin
    .from("platform_roles")
    .select("id, name, display_name, hierarchy_level, is_super_admin, color, description")
    .order("hierarchy_level", { ascending: false });

  const { data: allPermissions } = await admin
    .from("platform_permissions")
    .select("id, key, module, description")
    .order("module, key");

  // Role → permissions mapping
  const { data: rolePermLinks } = await admin
    .from("platform_role_permissions")
    .select("role_id, permission_id");

  // Per-admin overrides
  const { data: allOverrides } = await admin
    .from("platform_admin_permission_overrides")
    .select("admin_id, permission_id, override_type, notes, granted_by, created_at");

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
      adminRecordId: pa?.id || null,
      adminRoleId: pa?.role_id || null,
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
    allPermissions: allPermissions || [],
    rolePermLinks: rolePermLinks || [],
    allOverrides: allOverrides || [],
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
    // Promote requires admin.users.roles permission
    if (!adminCtx.isSuperAdmin && !adminCtx.permissions.includes("admin.users.roles")) {
      return Response.json({ error: "No tienes permiso para asignar roles" }, { status: 403, headers });
    }
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
    // Update role requires admin.users.roles permission
    if (!adminCtx.isSuperAdmin && !adminCtx.permissions.includes("admin.users.roles")) {
      return Response.json({ error: "No tienes permiso para cambiar roles" }, { status: 403, headers });
    }
    const roleId = formData.get("role_id") as string;
    const scopedOrgIds = formData.get("scoped_org_ids") as string;

    // Cannot update own role (prevents self-escalation)
    if (targetUserId === adminCtx.userId) {
      return Response.json({ error: "No puedes cambiar tu propio rol" }, { status: 400, headers });
    }

    const { data: role } = await admin.from("platform_roles").select("hierarchy_level, is_super_admin, display_name").eq("id", roleId).single();
    if (!role) return Response.json({ error: "Rol no encontrado" }, { status: 400, headers });
    if (role.is_super_admin && !adminCtx.isSuperAdmin) return Response.json({ error: "Solo Super Admins pueden asignar este rol" }, { status: 403, headers });
    // Cannot assign a role at or above own level
    if (!adminCtx.isSuperAdmin && role.hierarchy_level >= adminCtx.role.hierarchy_level) {
      return Response.json({ error: "No puedes asignar un rol de igual o mayor nivel" }, { status: 403, headers });
    }

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

  if (intent === "set_permission_override") {
    if (!adminCtx.isSuperAdmin && !adminCtx.permissions.includes("admin.users.roles")) {
      return Response.json({ error: "No tienes permiso para modificar permisos" }, { status: 403, headers });
    }
    if (targetUserId === adminCtx.userId) {
      return Response.json({ error: "No puedes modificar tus propios permisos" }, { status: 400, headers });
    }

    const adminRecordId = formData.get("admin_record_id") as string;
    const permissionId = formData.get("permission_id") as string;
    const overrideType = formData.get("override_type") as string;
    const overrideNotes = formData.get("notes") as string;

    if (!adminRecordId || !permissionId || !['grant', 'deny'].includes(overrideType)) {
      return Response.json({ error: "Datos inválidos" }, { status: 400, headers });
    }

    // Verify target is not super admin
    const { data: target } = await admin
      .from("platform_admins")
      .select("role_id, platform_roles(is_super_admin, hierarchy_level)")
      .eq("id", adminRecordId).single();
    if ((target as any)?.platform_roles?.is_super_admin) {
      return Response.json({ error: "No se pueden aplicar overrides a Super Admins" }, { status: 403, headers });
    }
    if (!adminCtx.isSuperAdmin && (target as any)?.platform_roles?.hierarchy_level >= adminCtx.role.hierarchy_level) {
      return Response.json({ error: "No puedes modificar permisos de alguien de igual o mayor nivel" }, { status: 403, headers });
    }

    const { error } = await admin.from("platform_admin_permission_overrides").upsert({
      admin_id: adminRecordId,
      permission_id: permissionId,
      override_type: overrideType,
      granted_by: adminCtx.userId,
      notes: overrideNotes || null,
    }, { onConflict: "admin_id,permission_id" });

    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    await invalidatePlatformAdminCache(kv, targetUserId, undefined, adminRecordId);
    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: `platform_admin.permission_override.${overrideType}`,
      entityType: "platform_admin", entityId: targetUserId,
      metadata: { permissionId, overrideType, notes: overrideNotes }, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "remove_permission_override") {
    if (!adminCtx.isSuperAdmin && !adminCtx.permissions.includes("admin.users.roles")) {
      return Response.json({ error: "No tienes permiso" }, { status: 403, headers });
    }
    if (targetUserId === adminCtx.userId) {
      return Response.json({ error: "No puedes modificar tus propios permisos" }, { status: 400, headers });
    }

    const adminRecordId = formData.get("admin_record_id") as string;
    const permissionId = formData.get("permission_id") as string;

    await admin.from("platform_admin_permission_overrides")
      .delete().eq("admin_id", adminRecordId).eq("permission_id", permissionId);

    await invalidatePlatformAdminCache(kv, targetUserId, undefined, adminRecordId);
    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: "platform_admin.permission_override.remove",
      entityType: "platform_admin", entityId: targetUserId,
      metadata: { permissionId }, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

export default function AdminUsers() {
  const { users, platformRoles, allPermissions, rolePermLinks, allOverrides, organizations, canManage, currentAdminCtx } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [filterAdmin, setFilterAdmin] = useState("");
  const [promoteUser, setPromoteUser] = useState<any>(null);
  const [permissionsUser, setPermissionsUser] = useState<any>(null);

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
                          <button onClick={() => setPromoteUser(u)}
                            className="rounded-lg px-2 py-1 text-[10px] font-medium text-brand hover:bg-brand/10">
                            Editar
                          </button>
                          {/* Granular permissions */}
                          {!u.adminRole?.is_super_admin && (
                            <button onClick={() => setPermissionsUser(u)}
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-amber-500 hover:bg-amber-500/10">
                              <KeyRound size={11} /> Permisos
                            </button>
                          )}
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

      {/* Granular Permissions Modal */}
      {permissionsUser && (
        <UserPermissionsModal
          user={permissionsUser}
          allPermissions={allPermissions}
          rolePermLinks={rolePermLinks}
          allOverrides={allOverrides}
          currentAdmin={currentAdminCtx}
          onClose={() => setPermissionsUser(null)}
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

// ── Module labels & icons ──
const MODULE_META: Record<string, { label: string; icon: string }> = {
  dashboard: { label: "Dashboard", icon: "📊" },
  organizations: { label: "Organizaciones", icon: "🏢" },
  users: { label: "Usuarios", icon: "👥" },
  audit: { label: "Auditoría", icon: "📋" },
  billing: { label: "Facturación", icon: "💳" },
  notifications: { label: "Notificaciones", icon: "🔔" },
  feature_flags: { label: "Feature Flags", icon: "🚩" },
  errors: { label: "Errores", icon: "🐛" },
  analytics: { label: "Analytics", icon: "📈" },
  settings: { label: "Configuración", icon: "⚙️" },
  roles: { label: "Roles", icon: "🔑" },
};

// ── Granular Permissions Modal ──
function UserPermissionsModal({ user, allPermissions, rolePermLinks, allOverrides, currentAdmin, onClose }: {
  user: any; allPermissions: any[]; rolePermLinks: any[]; allOverrides: any[];
  currentAdmin: any; onClose: () => void;
}) {
  const fetcher = useFetcher();

  // Permissions this user's role grants
  const rolePermIds = new Set(
    rolePermLinks.filter((rp: any) => rp.role_id === user.adminRoleId).map((rp: any) => rp.permission_id)
  );

  // Current overrides for this admin
  const userOverrides = new Map<string, { override_type: string; notes: string }>();
  (allOverrides || []).forEach((ov: any) => {
    if (ov.admin_id === user.adminRecordId) {
      userOverrides.set(ov.permission_id, { override_type: ov.override_type, notes: ov.notes });
    }
  });

  // Group permissions by module
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    allPermissions.forEach((p: any) => {
      if (!map.has(p.module)) map.set(p.module, []);
      map.get(p.module)!.push(p);
    });
    return map;
  }, [allPermissions]);

  const canEdit = user.id !== currentAdmin.userId && (
    currentAdmin.isSuperAdmin || currentAdmin.hierarchyLevel > (user.adminRole?.hierarchy_level || 0)
  );

  const handleToggle = (permId: string, currentState: "default" | "grant" | "deny") => {
    // Cycle: default → grant → deny → default
    const next = currentState === "default" ? "grant" : currentState === "grant" ? "deny" : "default";

    if (next === "default") {
      fetcher.submit({
        intent: "remove_permission_override",
        user_id: user.id,
        admin_record_id: user.adminRecordId,
        permission_id: permId,
      }, { method: "post" });
    } else {
      fetcher.submit({
        intent: "set_permission_override",
        user_id: user.id,
        admin_record_id: user.adminRecordId,
        permission_id: permId,
        override_type: next,
        notes: "",
      }, { method: "post" });
    }
  };

  const getState = (permId: string): "default" | "grant" | "deny" => {
    const ov = userOverrides.get(permId);
    if (!ov) return "default";
    return ov.override_type as "grant" | "deny";
  };

  const getEffective = (permId: string): boolean => {
    const state = getState(permId);
    const fromRole = rolePermIds.has(permId);
    if (state === "grant") return true;
    if (state === "deny") return false;
    return fromRole;
  };

  const overrideCount = userOverrides.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            {user.avatar ? (
              <img src={user.avatar} className="h-10 w-10 rounded-full ring-2 ring-amber-500/20" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-[12px] font-bold text-amber-500">
                {user.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-[13px] font-bold text-text-primary">{user.name}</p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
                  style={{ backgroundColor: `${user.adminRole?.color}15`, color: user.adminRole?.color }}>
                  <ShieldCheck size={9} /> {user.adminRole?.display_name}
                </span>
                {overrideCount > 0 && (
                  <span className="text-[9px] text-amber-500 font-medium">{overrideCount} override{overrideCount > 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 border-b border-border px-6 py-2.5 bg-muted/30">
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Estado:</span>
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-zinc-400" /><span className="text-[9px] text-text-muted">Hereda del Rol</span></div>
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-[9px] text-text-muted">Otorgado (+)</span></div>
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-red-500" /><span className="text-[9px] text-text-muted">Denegado (−)</span></div>
        </div>

        {/* Permissions List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {Array.from(grouped.entries()).map(([module, perms]) => {
            const meta = MODULE_META[module] || { label: module, icon: "📦" };
            return (
              <div key={module}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[12px]">{meta.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{meta.label}</span>
                  <div className="flex-1 border-t border-border" />
                </div>
                <div className="space-y-1">
                  {perms.map((p: any) => {
                    const state = getState(p.id);
                    const fromRole = rolePermIds.has(p.id);
                    const effective = getEffective(p.id);

                    return (
                      <div key={p.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Effective indicator */}
                          <div className={`flex h-5 w-5 items-center justify-center rounded-md text-white ${
                            effective ? "bg-emerald-500/80" : "bg-zinc-600/50"
                          }`}>
                            {effective ? <Check size={10} /> : <Minus size={10} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-text-primary truncate">{p.description}</p>
                            <p className="text-[9px] text-text-muted font-mono">{p.key}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* From role badge */}
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                            fromRole ? "text-emerald-600 bg-emerald-500/10" : "text-zinc-500 bg-zinc-500/10"
                          }`}>
                            {fromRole ? "Rol ✓" : "Rol ✗"}
                          </span>

                          {/* Override toggle — cycles: default → grant → deny → default */}
                          {canEdit ? (
                            <button
                              onClick={() => handleToggle(p.id, state)}
                              disabled={fetcher.state !== "idle"}
                              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all border ${
                                state === "default"
                                  ? "border-border text-text-muted hover:border-zinc-400 bg-transparent"
                                  : state === "grant"
                                  ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10 hover:border-emerald-500"
                                  : "border-red-500/30 text-red-500 bg-red-500/10 hover:border-red-500"
                              }`}
                            >
                              {state === "default" && <><Settings2 size={10} /> Default</>}
                              {state === "grant" && <><Plus size={10} /> Grant</>}
                              {state === "deny" && <><Minus size={10} /> Deny</>}
                            </button>
                          ) : (
                            <span className="text-[9px] text-text-muted">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-3 flex items-center justify-between">
          <p className="text-[9px] text-text-muted">Los cambios se aplican inmediatamente y se registran en auditoría.</p>
          <button onClick={onClose} className="rounded-lg bg-brand px-4 py-2 text-[11px] font-medium text-white">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
