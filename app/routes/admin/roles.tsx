/**
 * Admin — Platform Roles Management
 *
 * CRUD for platform roles with permission matrix.
 * Only Super Admins and users with admin.roles.manage can modify roles.
 * System roles (is_system=true) can have permissions modified but cannot be deleted.
 */
import { useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/admin.roles";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import {
  requirePlatformAdmin,
  requirePlatformPermission,
} from "~/lib/platform-rbac/guard.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import {
  ShieldCheck, Shield, Plus, Pencil, Trash2, Save, X,
  Lock, Users, Check, ChevronDown, ChevronRight,
} from "lucide-react";
import { useState } from "react";

// ── Permission modules for grouping in the matrix ──
const PERMISSION_MODULES = [
  { key: "dashboard", label: "Dashboard", color: "#6366F1" },
  { key: "organizations", label: "Organizaciones", color: "#8B5CF6" },
  { key: "users", label: "Usuarios", color: "#EC4899" },
  { key: "roles", label: "Roles Admin", color: "#F97316" },
  { key: "audit", label: "Auditoría", color: "#10B981" },
  { key: "billing", label: "Planes & Billing", color: "#F59E0B" },
  { key: "notifications", label: "Notificaciones", color: "#3B82F6" },
  { key: "feature_flags", label: "Feature Flags", color: "#14B8A6" },
  { key: "errors", label: "Errores", color: "#EF4444" },
  { key: "analytics", label: "Analytics", color: "#06B6D4" },
  { key: "settings", label: "Configuración", color: "#71717A" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.roles.view", headers);

  const admin = createSupabaseAdminClient(env);

  // Load all roles with their permission count
  const { data: roles } = await admin
    .from("platform_roles")
    .select("*, platform_role_permissions(permission_id)")
    .order("hierarchy_level", { ascending: false });

  // Load all permissions
  const { data: permissions } = await admin
    .from("platform_permissions")
    .select("*")
    .order("module")
    .order("key");

  // Load role-permission mappings
  const { data: rolePerms } = await admin
    .from("platform_role_permissions")
    .select("role_id, permission_id");

  // Count admins per role
  const { data: adminCounts } = await admin
    .from("platform_admins")
    .select("role_id");

  const roleCounts: Record<string, number> = {};
  (adminCounts || []).forEach((a: any) => {
    roleCounts[a.role_id] = (roleCounts[a.role_id] || 0) + 1;
  });

  return Response.json({
    roles: (roles || []).map((r: any) => ({
      ...r,
      permissionCount: r.platform_role_permissions?.length || 0,
      adminCount: roleCounts[r.id] || 0,
      platform_role_permissions: undefined,
    })),
    permissions: permissions || [],
    rolePerms: rolePerms || [],
    canManage: adminCtx.isSuperAdmin || adminCtx.permissions.includes("admin.roles.manage"),
  }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.roles.manage", headers);

  const admin = createSupabaseAdminClient(env);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const ip = getClientIP(request);

  if (intent === "create_role") {
    const name = (formData.get("name") as string).toLowerCase().replace(/\s+/g, "_");
    const displayName = formData.get("displayName") as string;
    const description = formData.get("description") as string;
    const hierarchyLevel = parseInt(formData.get("hierarchyLevel") as string) || 40;
    const color = formData.get("color") as string || "#6366F1";
    const permissionIds = JSON.parse(formData.get("permissionIds") as string || "[]");

    const { data: role, error } = await admin
      .from("platform_roles")
      .insert({ name, display_name: displayName, description, hierarchy_level: hierarchyLevel, color, is_system: false, is_super_admin: false })
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    // Assign permissions
    if (permissionIds.length > 0) {
      await admin.from("platform_role_permissions").insert(
        permissionIds.map((pid: string) => ({ role_id: role.id, permission_id: pid }))
      );
    }

    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: "platform_role.create", entityType: "platform_role",
      entityId: role.id, metadata: { name: displayName, permissionCount: permissionIds.length }, ipAddress: ip,
    });

    return Response.json({ success: true }, { headers });
  }

  if (intent === "update_permissions") {
    const roleId = formData.get("roleId") as string;
    const permissionIds = JSON.parse(formData.get("permissionIds") as string || "[]");

    // Check role exists and is not super_admin
    const { data: role } = await admin.from("platform_roles").select("is_super_admin, display_name").eq("id", roleId).single();
    if (role?.is_super_admin) return Response.json({ error: "No se pueden modificar permisos de Super Admin" }, { status: 403, headers });

    // Replace all permissions
    await admin.from("platform_role_permissions").delete().eq("role_id", roleId);
    if (permissionIds.length > 0) {
      await admin.from("platform_role_permissions").insert(
        permissionIds.map((pid: string) => ({ role_id: roleId, permission_id: pid }))
      );
    }

    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: "platform_role.update_permissions", entityType: "platform_role",
      entityId: roleId, metadata: { name: role?.display_name, newPermissionCount: permissionIds.length }, ipAddress: ip,
    });

    return Response.json({ success: true }, { headers });
  }

  if (intent === "delete_role") {
    const roleId = formData.get("roleId") as string;

    const { data: role } = await admin.from("platform_roles").select("is_system, display_name").eq("id", roleId).single();
    if (role?.is_system) return Response.json({ error: "No se pueden eliminar roles del sistema" }, { status: 403, headers });

    // Check no admins use this role
    const { count } = await admin.from("platform_admins").select("id", { count: "exact", head: true }).eq("role_id", roleId);
    if ((count || 0) > 0) return Response.json({ error: "Hay administradores asignados a este rol. Reasígnalos primero." }, { status: 400, headers });

    await admin.from("platform_role_permissions").delete().eq("role_id", roleId);
    await admin.from("platform_roles").delete().eq("id", roleId);

    await logAuditEvent(admin, {
      actorId: adminCtx.userId, action: "platform_role.delete", entityType: "platform_role",
      entityId: roleId, metadata: { name: role?.display_name }, ipAddress: ip,
    });

    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

export default function AdminRoles() {
  const { roles, permissions, rolePerms, canManage } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Build role -> permission ID set
  const rolePermMap: Record<string, Set<string>> = {};
  roles.forEach((r: any) => { rolePermMap[r.id] = new Set(); });
  rolePerms.forEach((rp: any) => {
    if (rolePermMap[rp.role_id]) rolePermMap[rp.role_id].add(rp.permission_id);
  });

  // Group permissions by module
  const permsByModule: Record<string, any[]> = {};
  permissions.forEach((p: any) => {
    if (!permsByModule[p.module]) permsByModule[p.module] = [];
    permsByModule[p.module].push(p);
  });

  const handleTogglePermission = (roleId: string, permId: string, currentPerms: Set<string>) => {
    const newPerms = new Set(currentPerms);
    if (newPerms.has(permId)) newPerms.delete(permId);
    else newPerms.add(permId);

    fetcher.submit(
      { intent: "update_permissions", roleId, permissionIds: JSON.stringify([...newPerms]) },
      { method: "post" }
    );
  };

  const handleToggleModule = (roleId: string, modulePerms: any[], currentPerms: Set<string>) => {
    const allSelected = modulePerms.every((p: any) => currentPerms.has(p.id));
    const newPerms = new Set(currentPerms);
    modulePerms.forEach((p: any) => {
      if (allSelected) newPerms.delete(p.id);
      else newPerms.add(p.id);
    });

    fetcher.submit(
      { intent: "update_permissions", roleId, permissionIds: JSON.stringify([...newPerms]) },
      { method: "post" }
    );
  };

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "#8B5CF615" }}>
            <ShieldCheck size={17} style={{ color: "#8B5CF6" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">Roles de Plataforma</h1>
            <p className="text-[11px] text-text-muted">
              {roles.length} roles · {permissions.length} permisos disponibles
            </p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[12px] font-medium text-white shadow-lg shadow-brand/20 transition-all hover:shadow-xl hover:shadow-brand/30"
          >
            <Plus size={14} />
            Crear Rol
          </button>
        )}
      </div>

      {/* ═══ Create Role Form ═══ */}
      {showCreate && <CreateRoleForm permissions={permissions} permsByModule={permsByModule} onClose={() => setShowCreate(false)} />}

      {/* ═══ Roles List with Permission Matrix ═══ */}
      <div className="space-y-3">
        {roles.map((role: any) => {
          const isExpanded = expandedRole === role.id;
          const currentPerms = rolePermMap[role.id] || new Set<string>();

          return (
            <div key={role.id} className="overflow-hidden rounded-2xl border border-border bg-surface transition-all">
              {/* Role header */}
              <button
                onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/20"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${role.color}15` }}>
                  {role.is_super_admin ? (
                    <Lock size={16} style={{ color: role.color }} />
                  ) : (
                    <Shield size={16} style={{ color: role.color }} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-text-primary">{role.display_name}</span>
                    {role.is_system && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-text-muted">Sistema</span>
                    )}
                    {role.is_super_admin && (
                      <span className="rounded-full bg-error/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-error">Irrevocable</span>
                    )}
                  </div>
                  <p className="text-[10px] text-text-muted">{role.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-sm font-bold tabular-nums text-text-primary">{role.permissionCount}</p>
                    <p className="text-[8px] font-medium uppercase text-text-muted">Permisos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold tabular-nums text-text-primary">{role.adminCount}</p>
                    <p className="text-[8px] font-medium uppercase text-text-muted">Admins</p>
                  </div>
                  <div
                    className="rounded-full px-2.5 py-1 text-[9px] font-bold"
                    style={{ backgroundColor: `${role.color}15`, color: role.color }}
                  >
                    Nivel {role.hierarchy_level}
                  </div>
                  {isExpanded ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                </div>
              </button>

              {/* Permission matrix (expanded) */}
              {isExpanded && !role.is_super_admin && (
                <div className="border-t border-border">
                  <div className="divide-y divide-border">
                    {PERMISSION_MODULES.map((mod) => {
                      const modulePerms = permsByModule[mod.key] || [];
                      if (modulePerms.length === 0) return null;
                      const allSelected = modulePerms.every((p: any) => currentPerms.has(p.id));
                      const someSelected = modulePerms.some((p: any) => currentPerms.has(p.id));

                      return (
                        <div key={mod.key} className="px-5 py-3">
                          <div className="mb-2 flex items-center gap-2">
                            {canManage && (
                              <button
                                onClick={() => handleToggleModule(role.id, modulePerms, currentPerms)}
                                className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                                  allSelected
                                    ? "border-brand bg-brand text-white"
                                    : someSelected
                                    ? "border-brand/50 bg-brand/20"
                                    : "border-border"
                                }`}
                              >
                                {allSelected && <Check size={10} />}
                                {someSelected && !allSelected && <span className="h-1.5 w-1.5 rounded-sm bg-brand" />}
                              </button>
                            )}
                            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: mod.color }}>
                              {mod.label}
                            </span>
                            <span className="text-[9px] text-text-muted">
                              {modulePerms.filter((p: any) => currentPerms.has(p.id)).length}/{modulePerms.length}
                            </span>
                          </div>
                          <div className="ml-6 flex flex-wrap gap-2">
                            {modulePerms.map((perm: any) => {
                              const isSelected = currentPerms.has(perm.id);
                              const action = perm.key.split(".").pop() || "";
                              return (
                                <button
                                  key={perm.id}
                                  disabled={!canManage}
                                  onClick={() => handleTogglePermission(role.id, perm.id, currentPerms)}
                                  className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition-all ${
                                    isSelected
                                      ? "border-brand/30 bg-brand/10 text-brand"
                                      : "border-border text-text-muted hover:border-brand/20 hover:text-text-secondary"
                                  } ${!canManage ? "cursor-default opacity-60" : ""}`}
                                  title={perm.description}
                                >
                                  {isSelected && <Check size={8} className="mr-1 inline" />}
                                  {action}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Delete role (non-system only) */}
                  {canManage && !role.is_system && (
                    <div className="border-t border-border px-5 py-3">
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar rol "${role.display_name}"? Esta acción no se puede deshacer.`)) {
                            fetcher.submit({ intent: "delete_role", roleId: role.id }, { method: "post" });
                          }
                        }}
                        className="flex items-center gap-1.5 text-[10px] font-medium text-error/60 transition-colors hover:text-error"
                      >
                        <Trash2 size={11} />
                        Eliminar rol
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Super admin — all permissions indicator */}
              {isExpanded && role.is_super_admin && (
                <div className="border-t border-border px-5 py-6 text-center">
                  <Lock size={20} className="mx-auto mb-2 text-error/50" />
                  <p className="text-[12px] font-medium text-text-secondary">
                    Super Admin tiene acceso total e irrevocable
                  </p>
                  <p className="text-[10px] text-text-muted">
                    Los permisos de este rol no pueden ser modificados
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Create Role Form Component ──
function CreateRoleForm({
  permissions,
  permsByModule,
  onClose,
}: {
  permissions: any[];
  permsByModule: Record<string, any[]>;
  onClose: () => void;
}) {
  const fetcher = useFetcher();
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [hierarchyLevel, setHierarchyLevel] = useState(40);
  const [color, setColor] = useState("#6366F1");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  const handleSubmit = () => {
    if (!name || !displayName) return;
    fetcher.submit(
      {
        intent: "create_role",
        name,
        displayName,
        description,
        hierarchyLevel: String(hierarchyLevel),
        color,
        permissionIds: JSON.stringify([...selectedPerms]),
      },
      { method: "post" }
    );
    onClose();
  };

  const COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899", "#06B6D4", "#71717A"];

  return (
    <div className="rounded-2xl border border-brand/20 bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-text-primary">Crear Nuevo Rol</h2>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X size={16} />
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Nombre (slug)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
            placeholder="custom_admin"
            className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-[12px] text-text-primary outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Nombre Visible</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Custom Admin"
            className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-[12px] text-text-primary outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Descripción</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Acceso limitado a..."
            className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-[12px] text-text-primary outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Nivel Jerárquico</label>
          <input
            type="number"
            value={hierarchyLevel}
            onChange={(e) => setHierarchyLevel(parseInt(e.target.value) || 0)}
            min={1}
            max={99}
            className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-[12px] text-text-primary outline-none focus:border-brand"
          />
        </div>
      </div>

      {/* Color picker */}
      <div className="mb-4">
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Color</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-offset-surface" : ""}`}
              style={{ backgroundColor: c, ringColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Permission selection */}
      <div className="mb-4">
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-text-muted">
          Permisos ({selectedPerms.size} seleccionados)
        </label>
        <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
          {PERMISSION_MODULES.map((mod) => {
            const modulePerms = permsByModule[mod.key] || [];
            if (modulePerms.length === 0) return null;

            return (
              <div key={mod.key}>
                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: mod.color }}>
                  {mod.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {modulePerms.map((p: any) => {
                    const sel = selectedPerms.has(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          const ns = new Set(selectedPerms);
                          sel ? ns.delete(p.id) : ns.add(p.id);
                          setSelectedPerms(ns);
                        }}
                        className={`rounded px-2 py-1 text-[9px] font-medium transition-all ${
                          sel ? "bg-brand/10 text-brand" : "bg-muted text-text-muted hover:text-text-secondary"
                        }`}
                      >
                        {p.key.split(".").pop()}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-[11px] text-text-muted hover:text-text-primary">
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name || !displayName}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[11px] font-medium text-white disabled:opacity-50"
        >
          <Save size={12} />
          Crear Rol
        </button>
      </div>
    </div>
  );
}
