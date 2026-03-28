import { redirect, useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/admin.users";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { isPlatformTenant } from "~/lib/platform-guard";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { exportCSV } from "~/lib/export";
import { Shield, ShieldOff, Search, Download } from "lucide-react";
import { useState, useMemo } from "react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  // Platform admin routes ONLY accessible from grixi.grixi.ai
  if (!isPlatformTenant(context)) return redirect("/dashboard", { headers });

  const admin = createSupabaseAdminClient(env);
  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!platformAdmin) return redirect("/dashboard", { headers });

  const { data: profiles } = await admin.from("profiles").select("*").order("created_at", { ascending: false });

  const { data: memberships } = await admin
    .from("memberships")
    .select("user_id, organization_id, status, roles(name), organizations(name)")
    .eq("status", "active");

  const { data: platformAdmins } = await admin.from("platform_admins").select("user_id");

  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });

  const platformAdminIds = new Set(platformAdmins?.map((pa: any) => pa.user_id) || []);

  const usersMap = new Map<string, any>();
  authData?.users?.forEach((u: any) => {
    usersMap.set(u.id, {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.full_name || u.email,
      avatar: u.user_metadata?.avatar_url,
      lastSignIn: u.last_sign_in_at,
      isPlatformAdmin: platformAdminIds.has(u.id),
      memberships: [] as any[],
    });
  });

  memberships?.forEach((m: any) => {
    const usr = usersMap.get(m.user_id);
    if (usr) {
      usr.memberships.push({
        orgName: (m as any).organizations?.name || "—",
        roleName: (m as any).roles?.name || "—",
      });
    }
  });

  return Response.json({ users: Array.from(usersMap.values()) }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  // CRITICAL: Block mutations from non-platform tenants
  if (!isPlatformTenant(context)) return Response.json({ error: "Forbidden" }, { status: 403, headers });

  const admin = createSupabaseAdminClient(env);
  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!platformAdmin) return Response.json({ error: "Unauthorized" }, { status: 403, headers });

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const targetUserId = formData.get("user_id") as string;
  const ip = getClientIP(request);

  if (intent === "promote") {
    await admin.from("platform_admins").insert({ user_id: targetUserId });
    await logAuditEvent(admin, { actorId: user.id, action: "user.promote", entityType: "user", entityId: targetUserId, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  if (intent === "demote") {
    if (targetUserId === user.id) return Response.json({ error: "No puedes removerte como admin" }, { status: 400, headers });
    await admin.from("platform_admins").delete().eq("user_id", targetUserId);
    await logAuditEvent(admin, { actorId: user.id, action: "user.demote", entityType: "user", entityId: targetUserId, ipAddress: ip });
    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

export default function AdminUsers() {
  const { users } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [filterAdmin, setFilterAdmin] = useState("");

  const filtered = useMemo(() => {
    return users.filter((u: any) => {
      const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
      const matchAdmin = !filterAdmin || (filterAdmin === "admin" ? u.isPlatformAdmin : !u.isPlatformAdmin);
      return matchSearch && matchAdmin;
    });
  }, [users, search, filterAdmin]);

  const handleToggleAdmin = (userId: string, isAdmin: boolean) => {
    fetcher.submit({ intent: isAdmin ? "demote" : "promote", user_id: userId }, { method: "post" });
  };

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Usuarios</h1>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Gestión global de usuarios · {filtered.length} de {users.length}</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-[var(--brand)]"
          />
        </div>
        <select value={filterAdmin} onChange={(e) => setFilterAdmin(e.target.value)} className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] outline-none transition-all focus:border-[var(--brand)]">
          <option value="">Todos</option>
          <option value="admin">Platform Admins</option>
          <option value="user">Usuarios</option>
        </select>
        <button
          onClick={() => {
            const headers = ["Nombre", "Email", "Admin", "Último acceso"];
            const rows = filtered.map((u: any) => [
              u.name || "", u.email || "", u.isPlatformAdmin ? "Sí" : "No", u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString("es") : "—"
            ]);
            exportCSV("usuarios", headers, rows);
          }}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-[11px] font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--brand)] hover:text-[var(--brand)]"
        >
          <Download size={12} /> CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["Usuario", "Organizaciones", "Último acceso", "Platform Admin", "Acciones"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u: any) => (
              <tr key={u.id} className="border-b border-[var(--border)] last:border-b-0 transition-colors hover:bg-[var(--bg-muted)]/50">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="h-8 w-8 rounded-full ring-2 ring-white/10" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[10px] font-bold text-[var(--text-secondary)]">
                        {u.name?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                    )}
                    <div>
                      <p className="text-[12px] font-medium text-[var(--text-primary)]">{u.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    {u.memberships?.length > 0 ? u.memberships.map((m: any, i: number) => (
                      <span key={i} className="rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>
                        {m.orgName} ({m.roleName})
                      </span>
                    )) : (
                      <span className="text-[10px] text-[var(--text-muted)]">Sin organización</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                    {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {u.isPlatformAdmin ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "#F59E0B20", color: "#F59E0B" }}>
                      <Shield size={11} /> Admin
                    </span>
                  ) : <span className="text-[10px] text-[var(--text-muted)]">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => handleToggleAdmin(u.id, u.isPlatformAdmin)}
                    className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-medium transition-colors hover:bg-[var(--bg-muted)]"
                    style={{ color: u.isPlatformAdmin ? "#EF4444" : "#16A34A" }}
                  >
                    {u.isPlatformAdmin ? <><ShieldOff size={13} /> Revocar</> : <><Shield size={13} /> Promover</>}
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
