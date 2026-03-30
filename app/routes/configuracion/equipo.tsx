import { useOutletContext, useFetcher, useLoaderData, redirect } from "react-router";
import type { Route } from "./+types/configuracion.equipo";
import type { ConfigContext } from "../configuracion";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { Users, UserMinus, UserCheck, Clock, Search, MoreHorizontal, ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);
  const tenantSlug = (context as any).tenantSlug as string | null;
  if (!tenantSlug) return redirect("/dashboard", { headers });

  const { data: org } = await admin.from("organizations")
    .select("id").eq("slug", tenantSlug).maybeSingle();
  if (!org) return redirect("/dashboard", { headers });

  // Members with their roles
  const { data: members } = await admin.from("memberships")
    .select("id, user_id, status, joined_at, created_at, roles(id, name, hierarchy_level)")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: true });

  // Roles for this org (for the role change dropdown)
  const { data: roles } = await admin.from("roles")
    .select("id, name, hierarchy_level, is_system")
    .eq("organization_id", org.id)
    .order("hierarchy_level", { ascending: false });

  // Get auth user data
  const memberUsers: Record<string, any> = {};
  if (members && members.length > 0) {
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
    authData?.users?.forEach((u: any) => {
      memberUsers[u.id] = {
        email: u.email,
        name: u.user_metadata?.full_name || u.email,
        avatar: u.user_metadata?.avatar_url,
      };
    });
  }

  // Pending invitations count
  const { count: pendingInvitations } = await admin.from("invitations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("status", "pending");

  return Response.json({
    orgId: org.id,
    members: (members || []).map((m: any) => ({
      ...m,
      user: memberUsers[m.user_id] || { email: "—", name: "—" },
    })),
    roles: roles || [],
    stats: {
      total: members?.length || 0,
      active: members?.filter((m: any) => m.status === "active").length || 0,
      suspended: members?.filter((m: any) => m.status === "suspended").length || 0,
      pendingInvitations: pendingInvitations || 0,
    },
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

  if (intent === "change_role") {
    const membershipId = formData.get("membership_id") as string;
    const newRoleId = formData.get("role_id") as string;
    if (!membershipId || !newRoleId) return Response.json({ error: "Datos incompletos" }, { status: 400, headers });

    const { error } = await admin.from("memberships")
      .update({ role_id: newRoleId })
      .eq("id", membershipId);
    if (error) return Response.json({ error: error.message }, { status: 400, headers });

    await logAuditEvent(admin, {
      actorId: user.id, action: "member.change_role", entityType: "membership",
      entityId: membershipId, organizationId: org.id,
      metadata: { newRoleId }, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "suspend") {
    const membershipId = formData.get("membership_id") as string;
    await admin.from("memberships").update({ status: "suspended" }).eq("id", membershipId);
    await logAuditEvent(admin, {
      actorId: user.id, action: "member.suspend", entityType: "membership",
      entityId: membershipId, organizationId: org.id, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "reactivate") {
    const membershipId = formData.get("membership_id") as string;
    await admin.from("memberships").update({ status: "active" }).eq("id", membershipId);
    await logAuditEvent(admin, {
      actorId: user.id, action: "member.reactivate", entityType: "membership",
      entityId: membershipId, organizationId: org.id, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "remove") {
    const membershipId = formData.get("membership_id") as string;
    const userId = formData.get("user_id") as string;
    if (!confirm) {
      await admin.from("memberships").delete().eq("id", membershipId);
      await logAuditEvent(admin, {
        actorId: user.id, action: "member.remove", entityType: "membership",
        entityId: membershipId, organizationId: org.id,
        metadata: { removedUserId: userId }, ipAddress: ip,
      });
    }
    // Actually delete
    await admin.from("memberships").delete().eq("id", membershipId);
    await logAuditEvent(admin, {
      actorId: user.id, action: "member.remove", entityType: "membership",
      entityId: membershipId, organizationId: org.id,
      metadata: { removedUserId: userId }, ipAddress: ip,
    });
    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

const STAT_CARDS = [
  { key: "total", label: "Total Miembros", icon: Users, color: "#6366F1" },
  { key: "active", label: "Activos", icon: UserCheck, color: "#16A34A" },
  { key: "suspended", label: "Suspendidos", icon: UserMinus, color: "#EF4444" },
  { key: "pendingInvitations", label: "Invitaciones pendientes", icon: Clock, color: "#F59E0B" },
];

export default function EquipoTab() {
  const { members, roles, stats, orgId } = useLoaderData<typeof loader>() as any;
  const config = useOutletContext<ConfigContext>();
  const fetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter((m: any) =>
      m.user.name?.toLowerCase().includes(q) ||
      m.user.email?.toLowerCase().includes(q) ||
      m.roles?.name?.toLowerCase().includes(q)
    );
  }, [members, search]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CARDS.map((s) => (
          <div key={s.key} className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: s.color + "15", color: s.color }}>
                <s.icon size={18} />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
                  {(stats as any)[s.key]}
                </p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar miembro por nombre, email o rol..."
          className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:ring-2 focus:ring-purple-500/20"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        />
      </div>

      {/* Members Table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              {["Usuario", "Rol", "Nivel", "Estado", "Desde", "Acciones"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m: any) => (
              <tr key={m.id} className="border-b last:border-b-0 transition-colors hover:bg-white/[0.02]" style={{ borderColor: "var(--border)" }}>
                {/* User */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {m.user.avatar ? (
                      <img src={m.user.avatar} className="h-9 w-9 rounded-full ring-2 ring-white/10" referrerPolicy="no-referrer" alt="" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                        style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}>
                        {m.user.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{m.user.name}</p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{m.user.email}</p>
                    </div>
                  </div>
                </td>

                {/* Role */}
                <td className="px-5 py-4">
                  {editingRole === m.id ? (
                    <select
                      defaultValue={m.roles?.id || ""}
                      onChange={(e) => {
                        fetcher.submit(
                          { intent: "change_role", membership_id: m.id, role_id: e.target.value },
                          { method: "post" }
                        );
                        setEditingRole(null);
                      }}
                      onBlur={() => setEditingRole(null)}
                      autoFocus
                      className="rounded-lg border px-2 py-1 text-xs outline-none"
                      style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                    >
                      {roles.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingRole(m.id)}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:bg-purple-500/10"
                      style={{ backgroundColor: "#6366F115", color: "#6366F1" }}
                    >
                      {m.roles?.name || "—"} <ChevronDown size={10} />
                    </button>
                  )}
                </td>

                {/* Hierarchy Level */}
                <td className="px-5 py-4">
                  <span className="font-mono text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                    {m.roles?.hierarchy_level ?? "—"}
                  </span>
                </td>

                {/* Status */}
                <td className="px-5 py-4">
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{
                    backgroundColor: m.status === "active" ? "#16A34A15" : "#EF444415",
                    color: m.status === "active" ? "#16A34A" : "#EF4444",
                  }}>
                    {m.status === "active" ? "Activo" : "Suspendido"}
                  </span>
                </td>

                {/* Joined */}
                <td className="px-5 py-4">
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(m.joined_at || m.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1">
                    {m.status === "active" ? (
                      <button
                        onClick={() => {
                          if (confirm(`¿Suspender a ${m.user.name}?`))
                            fetcher.submit({ intent: "suspend", membership_id: m.id }, { method: "post" });
                        }}
                        className="rounded-lg px-2 py-1 text-xs transition-colors hover:bg-red-500/10"
                        style={{ color: "#EF4444" }}
                      >
                        Suspender
                      </button>
                    ) : (
                      <button
                        onClick={() => fetcher.submit({ intent: "reactivate", membership_id: m.id }, { method: "post" })}
                        className="rounded-lg px-2 py-1 text-xs transition-colors hover:bg-green-500/10"
                        style={{ color: "#16A34A" }}
                      >
                        Reactivar
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar a ${m.user.name} de la organización? Esta acción no se puede deshacer.`))
                          fetcher.submit({ intent: "remove", membership_id: m.id, user_id: m.user_id }, { method: "post" });
                      }}
                      className="rounded-lg px-2 py-1 text-xs transition-colors hover:bg-red-500/10"
                      style={{ color: "#EF4444" }}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredMembers.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                {search ? "Sin resultados para la búsqueda" : "Sin miembros en esta organización"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
