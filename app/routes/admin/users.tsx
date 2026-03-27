import { redirect, useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/admin.users";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import { exportCSV } from "~/lib/export";
import { Shield, ShieldOff, Search, Download } from "lucide-react";
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
    <div className="animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Usuarios</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>Gestión global de usuarios · {filtered.length} de {users.length}</p>
      </div>

      {/* Search + Filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none"
            style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
        </div>
        <select value={filterAdmin} onChange={(e) => setFilterAdmin(e.target.value)} className="rounded-lg border px-3 py-2 text-xs outline-none" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
          <option value="">Todos</option>
          <option value="admin">Platform Admins</option>
          <option value="user">Usuarios</option>
        </select>
        <button
          onClick={() => {
            const headers = ["Nombre", "Email", "Admin", "Creado"];
            const rows = filtered.map((u: any) => [
              u.name || "", u.email || "", u.isPlatformAdmin ? "Sí" : "No", new Date(u.created_at).toLocaleDateString("es")
            ]);
            exportCSV("usuarios", headers, rows);
          }}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-white/5"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <Download size={13} /> CSV
        </button>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              {["Usuario", "Organizaciones", "Último acceso", "Platform Admin", "Acciones"].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u: any) => (
              <tr key={u.id} className="border-b last:border-b-0 transition-colors hover:bg-white/[0.02]" style={{ borderColor: "var(--border)" }}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="h-9 w-9 rounded-full ring-2 ring-white/10" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}>
                        {u.name?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{u.name}</p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {u.memberships?.length > 0 ? u.memberships.map((m: any, i: number) => (
                      <span key={i} className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "#6366F115", color: "#6366F1" }}>
                        {m.orgName} ({m.roleName})
                      </span>
                    )) : (
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Sin organización</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs" style={{ color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>
                    {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {u.isPlatformAdmin ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "#F59E0B20", color: "#F59E0B" }}>
                      <Shield size={12} /> Admin
                    </span>
                  ) : <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>—</span>}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggleAdmin(u.id, u.isPlatformAdmin)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
                    style={{ color: u.isPlatformAdmin ? "#EF4444" : "#16A34A" }}
                  >
                    {u.isPlatformAdmin ? <><ShieldOff size={14} /> Revocar</> : <><Shield size={14} /> Promover</>}
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
