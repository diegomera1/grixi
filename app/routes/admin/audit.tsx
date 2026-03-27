import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/admin.audit";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { History, Filter } from "lucide-react";
import { useState } from "react";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "organization.create": { label: "Org creada", color: "#16A34A" },
  "organization.toggle_status": { label: "Org status", color: "#F59E0B" },
  "organization.update_modules": { label: "Módulos actualizados", color: "#6366F1" },
  "organization.update_settings": { label: "Config actualizada", color: "#3B82F6" },
  "invitation.create": { label: "Invitación enviada", color: "#EC4899" },
  "invitation.cancel": { label: "Invitación cancelada", color: "#EF4444" },
  "domain.add": { label: "Dominio agregado", color: "#06B6D4" },
  "domain.remove": { label: "Dominio eliminado", color: "#EF4444" },
  "user.promote": { label: "Admin promovido", color: "#16A34A" },
  "user.demote": { label: "Admin revocado", color: "#EF4444" },
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);
  const { data: pa } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!pa) return redirect("/dashboard", { headers });

  const url = new URL(request.url);
  const actionFilter = url.searchParams.get("action") || "";

  let query = admin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
  if (actionFilter) query = query.eq("action", actionFilter);

  const { data: logs } = await query;

  // Get actor info
  const actorIds = [...new Set((logs || []).map((l: any) => l.actor_id).filter(Boolean))];
  const actorMap: Record<string, any> = {};
  if (actorIds.length > 0) {
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
    authData?.users?.forEach((u: any) => {
      actorMap[u.id] = { name: u.user_metadata?.full_name || u.email, avatar: u.user_metadata?.avatar_url, email: u.email };
    });
  }

  return Response.json({ logs: logs || [], actorMap, actionFilter }, { headers });
}

export default function AuditLog() {
  const { logs, actorMap, actionFilter } = useLoaderData<typeof loader>();
  const [filter, setFilter] = useState(actionFilter || "");

  const uniqueActions = [...new Set(logs.map((l: any) => l.action))];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "#8b5cf620" }}>
            <History size={18} style={{ color: "#8B5CF6" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Audit Log</h1>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Historial de acciones administrativas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: "var(--muted-foreground)" }} />
          <select
            value={filter}
            onChange={e => { setFilter(e.target.value); window.location.href = e.target.value ? `/admin/audit?action=${e.target.value}` : "/admin/audit"; }}
            className="rounded-lg border px-3 py-1.5 text-xs outline-none"
            style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <option value="">Todas las acciones</option>
            {uniqueActions.map(a => <option key={a} value={a}>{ACTION_LABELS[a]?.label || a}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        {logs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <History size={32} className="mx-auto mb-3" style={{ color: "var(--muted-foreground)", opacity: 0.5 }} />
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No hay eventos registrados</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {logs.map((log: any) => {
              const actor = actorMap[log.actor_id] || {};
              const actionMeta = ACTION_LABELS[log.action] || { label: log.action, color: "#71717A" };
              const time = new Date(log.created_at);

              return (
                <div key={log.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/[0.02]">
                  {/* Actor Avatar */}
                  {actor.avatar ? (
                    <img src={actor.avatar} className="h-8 w-8 rounded-full ring-2 ring-white/10 shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0" style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}>
                      {(actor.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Event Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{actor.name || "Sistema"}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${actionMeta.color}20`, color: actionMeta.color }}>{actionMeta.label}</span>
                    </div>
                    <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                      {log.entity_type}{log.metadata?.email ? ` → ${log.metadata.email}` : ""}{log.metadata?.domain ? ` → @${log.metadata.domain}` : ""}
                    </p>
                  </div>

                  {/* Time + IP */}
                  <div className="text-right shrink-0">
                    <p className="text-xs" style={{ color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>
                      {time.toLocaleDateString("es", { day: "2-digit", month: "short" })} {time.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {log.ip_address && <p className="text-[10px] font-mono" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>{log.ip_address}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
