import { useOutletContext, useFetcher, useLoaderData, redirect } from "react-router";
import type { Route } from "./+types/configuracion.roles";
import type { ConfigContext } from "../configuracion";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { Shield, Plus, Save, Trash2, ChevronRight, Users } from "lucide-react";
import { useState } from "react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);
  const tenantSlug = (context as any).tenantSlug as string | null;
  if (!tenantSlug) return redirect("/dashboard", { headers });

  const { data: org } = await admin.from("organizations")
    .select("id, settings").eq("slug", tenantSlug).maybeSingle();
  if (!org) return redirect("/dashboard", { headers });

  const [rolesRes, permsRes, membershipsRes] = await Promise.all([
    admin.from("roles")
      .select("id, name, hierarchy_level, is_system, is_default, description, role_permissions(permission_id, permissions(id, key, description, category, min_plan))")
      .eq("organization_id", org.id)
      .order("hierarchy_level", { ascending: false }),
    admin.from("permissions")
      .select("id, key, description, category, min_plan")
      .order("category").order("key"),
    admin.from("memberships")
      .select("role_id")
      .eq("organization_id", org.id)
      .eq("status", "active"),
  ]);

  // Count members per role
  const memberCounts: Record<string, number> = {};
  (membershipsRes.data || []).forEach((m: any) => {
    memberCounts[m.role_id] = (memberCounts[m.role_id] || 0) + 1;
  });

  return Response.json({
    orgId: org.id,
    orgPlan: org.settings?.plan || "demo",
    roles: rolesRes.data || [],
    allPermissions: permsRes.data || [],
    memberCounts,
  }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const ip = getClientIP(request);
  const tenantSlug = (context as any).tenantSlug as string | null;

  const { data: org } = await admin.from("organizations")
    .select("id").eq("slug", tenantSlug).maybeSingle();
  if (!org) return Response.json({ error: "Org not found" }, { status: 404, headers });

  if (intent === "create_role") {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const hierarchyLevel = parseInt(formData.get("hierarchy_level") as string) || 30;
    if (!name) return Response.json({ error: "Nombre requerido" }, { status: 400, headers });

    const { data: newRole, error } = await admin.from("roles").insert({
      organization_id: org.id,
      name: name.toLowerCase().replace(/\s+/g, "_"),
      description: description || name,
      is_system: false,
      hierarchy_level: hierarchyLevel,
      is_default: false,
    }).select().single();

    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    await logAuditEvent(admin, {
      actorId: user.id, action: "role.create", entityType: "role",
      entityId: newRole.id, organizationId: org.id,
      metadata: { name, hierarchyLevel }, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "update_permissions") {
    const roleId = formData.get("role_id") as string;
    const permissionIds = JSON.parse(formData.get("permission_ids") as string) as string[];

    await admin.from("role_permissions").delete().eq("role_id", roleId);
    if (permissionIds.length > 0) {
      await admin.from("role_permissions").insert(
        permissionIds.map((pid) => ({ role_id: roleId, permission_id: pid }))
      );
    }

    await logAuditEvent(admin, {
      actorId: user.id, action: "role.update_permissions", entityType: "role",
      entityId: roleId, organizationId: org.id,
      metadata: { permissionCount: permissionIds.length }, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "delete_role") {
    const roleId = formData.get("role_id") as string;
    await admin.from("role_permissions").delete().eq("role_id", roleId);
    const { error } = await admin.from("roles").delete().eq("id", roleId).eq("is_system", false);
    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    await logAuditEvent(admin, {
      actorId: user.id, action: "role.delete", entityType: "role",
      entityId: roleId, organizationId: org.id, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

const PLAN_COLORS: Record<string, string> = {
  starter: "#3B82F6", professional: "#8B5CF6", enterprise: "#F59E0B",
};
const PLAN_HIERARCHY: Record<string, number> = {
  demo: 0, starter: 1, professional: 2, enterprise: 3,
};

export default function RolesTab() {
  const { roles, allPermissions, orgPlan, memberCounts } = useLoaderData<typeof loader>() as any;
  const config = useOutletContext<ConfigContext>();
  const fetcher = useFetcher();
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newLevel, setNewLevel] = useState("30");
  const [editedPerms, setEditedPerms] = useState<Record<string, string[]>>({});

  const orgPlanLevel = PLAN_HIERARCHY[orgPlan] || 0;

  const permsByCategory = allPermissions.reduce((acc: Record<string, any[]>, p: any) => {
    const cat = p.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, any[]>);

  const getPermsForRole = (role: any): string[] => {
    if (editedPerms[role.id]) return editedPerms[role.id];
    return (role.role_permissions || []).map((rp: any) => rp.permission_id);
  };

  const togglePerm = (roleId: string, permId: string, currentPerms: string[]) => {
    const newPerms = currentPerms.includes(permId)
      ? currentPerms.filter((id) => id !== permId)
      : [...currentPerms, permId];
    setEditedPerms((prev) => ({ ...prev, [roleId]: newPerms }));
  };

  const savePerms = (roleId: string) => {
    const perms = editedPerms[roleId];
    if (!perms) return;
    fetcher.submit(
      { intent: "update_permissions", role_id: roleId, permission_ids: JSON.stringify(perms) },
      { method: "post" }
    );
    setEditedPerms((prev) => {
      const next = { ...prev };
      delete next[roleId];
      return next;
    });
  };

  const createRole = () => {
    if (!newName) return;
    fetcher.submit(
      { intent: "create_role", name: newName, description: newDesc, hierarchy_level: newLevel },
      { method: "post" }
    );
    setNewName(""); setNewDesc(""); setNewLevel("30"); setShowCreate(false);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Roles de la Organización</h3>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Gestionar roles y permisos granulares · Plan actual: <span className="font-semibold">{orgPlan}</span>
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "#7c3aed" }}
        >
          <Plus size={14} /> Crear Rol Custom
        </button>
      </div>

      {/* Create Role Form */}
      {showCreate && (
        <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <h4 className="mb-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>Nuevo Rol</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Nombre</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="supervisor"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Descripción</label>
              <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Supervisor de área"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Nivel Jerárquico (10-79)</label>
              <input type="number" min={10} max={79} value={newLevel} onChange={(e) => setNewLevel(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createRole} className="rounded-lg px-4 py-2 text-xs font-medium text-white" style={{ backgroundColor: "#7c3aed" }}>Crear</button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Roles List */}
      <div className="space-y-2">
        {(roles as any[]).map((role: any) => {
          const isExpanded = expandedRole === role.id;
          const currentPerms = getPermsForRole(role);
          const hasEdits = !!editedPerms[role.id];
          const count = memberCounts[role.id] || 0;

          return (
            <div key={role.id} className="rounded-xl border overflow-hidden transition-colors"
              style={{ backgroundColor: "var(--card)", borderColor: isExpanded ? "#7c3aed" : "var(--border)" }}>
              {/* Role Header */}
              <button
                onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold"
                    style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>
                    {role.hierarchy_level}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{role.name}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {role.description || "—"} · {currentPerms.length} permisos · <Users size={10} className="inline" /> {count} miembros
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {role.is_system && (
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>Sistema</span>
                  )}
                  {role.is_default && (
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: "#16A34A15", color: "#16A34A" }}>Default</span>
                  )}
                  <ChevronRight size={14} style={{
                    color: "var(--muted-foreground)",
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }} />
                </div>
              </button>

              {/* Expanded: Permission Matrix */}
              {isExpanded && (
                <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: "var(--border)" }}>
                  {Object.entries(permsByCategory).map(([category, perms]) => (
                    <div key={category} className="mb-5">
                      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--muted-foreground)" }}>{category}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {(perms as any[]).map((perm: any) => {
                          const permPlanLevel = PLAN_HIERARCHY[perm.min_plan || "starter"] || 0;
                          const isAvailable = permPlanLevel <= orgPlanLevel;
                          const isChecked = currentPerms.includes(perm.id);
                          return (
                            <label key={perm.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer ${
                              !isAvailable ? "opacity-30 cursor-not-allowed" : "hover:bg-white/[0.03]"
                            }`}>
                              <input
                                type="checkbox" checked={isChecked} disabled={!isAvailable}
                                onChange={() => togglePerm(role.id, perm.id, currentPerms)}
                                className="h-3.5 w-3.5 rounded border accent-purple-500"
                              />
                              <span style={{ color: "var(--foreground)" }}>{perm.key}</span>
                              {perm.min_plan && perm.min_plan !== "starter" && (
                                <span className="rounded-full px-1.5 py-0 text-[8px] font-bold uppercase"
                                  style={{ backgroundColor: (PLAN_COLORS[perm.min_plan] || "#999") + "20", color: PLAN_COLORS[perm.min_plan] || "#999" }}>
                                  {perm.min_plan}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                    <button
                      onClick={() => savePerms(role.id)}
                      disabled={!hasEdits}
                      className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white transition-all ${
                        hasEdits ? "" : "opacity-40 cursor-not-allowed"
                      }`}
                      style={{ backgroundColor: "#7c3aed" }}
                    >
                      <Save size={13} /> Guardar Permisos
                    </button>
                    {!role.is_system && (
                      <button
                        onClick={() => {
                          if (confirm("¿Eliminar este rol? Los usuarios asignados deberán ser reasignados."))
                            fetcher.submit({ intent: "delete_role", role_id: role.id }, { method: "post" });
                        }}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-red-500/10"
                        style={{ color: "#EF4444" }}
                      >
                        <Trash2 size={13} /> Eliminar Rol
                      </button>
                    )}
                    <span className="ml-auto text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                      {currentPerms.length} de {allPermissions.length} permisos asignados
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
