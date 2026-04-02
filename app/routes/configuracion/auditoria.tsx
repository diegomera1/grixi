import { useOutletContext, useLoaderData, redirect, useSearchParams, Link } from "react-router";
import type { Route } from "./+types/configuracion.auditoria";
import type { ConfigContext } from "../configuracion";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { ScrollText, Filter, ChevronLeft, ChevronRight, User, Clock, Globe } from "lucide-react";
import { useState } from "react";

const PAGE_SIZE = 25;

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

  // Parse filters from URL
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const actionFilter = url.searchParams.get("action") || "";
  const actorFilter = url.searchParams.get("actor") || "";
  const entityFilter = url.searchParams.get("entity") || "";

  // Build query
  let query = admin.from("audit_logs")
    .select("*", { count: "exact" })
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (actionFilter) query = query.ilike("action", `%${actionFilter}%`);
  if (entityFilter) query = query.ilike("entity_type", `%${entityFilter}%`);

  const { data: logs, count } = await query;

  // Get unique actor IDs to fetch names
  const actorIds = [...new Set((logs || []).map((l: any) => l.actor_id).filter(Boolean))];
  const actorMap: Record<string, { name: string; avatar?: string; email: string }> = {};

  if (actorIds.length > 0) {
    // Fetch auth users in batches — supports any platform size
    const batchSize = 50;
    for (let i = 0; i < actorIds.length; i += batchSize) {
      const batch = actorIds.slice(i, i + batchSize);
      const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      authData?.users?.forEach((u: any) => {
        if (batch.includes(u.id)) {
          actorMap[u.id] = {
            name: u.user_metadata?.full_name || u.email || "—",
            avatar: u.user_metadata?.avatar_url,
            email: u.email || "",
          };
        }
      });
    }
    // Fill any missing actors with fallback
    actorIds.forEach(id => {
      if (!actorMap[id]) {
        actorMap[id] = { name: "Usuario eliminado", email: "", avatar: undefined };
      }
    });
  }

  // Unique actions and entities for filter dropdowns
  const { data: actionsData } = await admin.from("audit_logs")
    .select("action").eq("organization_id", org.id);
  const uniqueActions = [...new Set((actionsData || []).map((a: any) => a.action))].sort();

  const { data: entitiesData } = await admin.from("audit_logs")
    .select("entity_type").eq("organization_id", org.id);
  const uniqueEntities = [...new Set((entitiesData || []).map((e: any) => e.entity_type))].sort();

  return Response.json({
    logs: (logs || []).map((l: any) => ({
      ...l,
      actor: actorMap[l.actor_id] || { name: "Sistema", email: "" },
    })),
    totalCount: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / PAGE_SIZE),
    filters: { action: actionFilter, actor: actorFilter, entity: entityFilter },
    uniqueActions,
    uniqueEntities,
  }, { headers });
}

const ACTION_COLORS: Record<string, string> = {
  create: "#16A34A",
  update: "#3B82F6",
  delete: "#EF4444",
  cancel: "#F59E0B",
  suspend: "#EF4444",
  reactivate: "#16A34A",
  change_role: "#8B5CF6",
  resend: "#06B6D4",
};

function getActionColor(action: string): string {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return color;
  }
  return "#6B7280";
}

export default function AuditoriaTab() {
  const { logs, totalCount, page, totalPages, filters, uniqueActions, uniqueEntities } = useLoaderData<typeof loader>() as any;
  const config = useOutletContext<ConfigContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set("page", "1");
    setSearchParams(params);
  };

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(p));
    setSearchParams(params);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Registro de Auditoría</h3>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {totalCount} eventos registrados en esta organización
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: "var(--muted-foreground)" }} />
          <select
            value={filters.action}
            onChange={(e) => setFilter("action", e.target.value)}
            className="rounded-lg border px-3 py-2 text-xs outline-none"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <option value="">Todas las acciones</option>
            {uniqueActions.map((a: string) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <select
            value={filters.entity}
            onChange={(e) => setFilter("entity", e.target.value)}
            className="rounded-lg border px-3 py-2 text-xs outline-none"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <option value="">Todas las entidades</option>
            {uniqueEntities.map((e: string) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        {(filters.action || filters.entity) && (
          <button
            onClick={() => {
              const params = new URLSearchParams();
              params.set("page", "1");
              setSearchParams(params);
            }}
            className="text-xs px-3 py-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: "#EF4444" }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Audit Log Timeline */}
      <div className="space-y-1.5">
        {(logs as any[]).map((log: any) => {
          const color = getActionColor(log.action);
          const isExpanded = expandedLog === log.id;

          return (
            <div key={log.id}>
              <button
                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                className="flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all hover:bg-white/[0.02]"
                style={{ backgroundColor: "var(--card)", borderColor: isExpanded ? color : "var(--border)" }}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {log.actor.avatar ? (
                    <img src={log.actor.avatar} className="h-8 w-8 rounded-full ring-2 ring-white/10" referrerPolicy="no-referrer" alt="" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: color + "15", color }}>
                      <User size={14} />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "var(--foreground)" }}>
                    <span className="font-medium">{log.actor.name}</span>{" "}
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: color + "15", color }}>
                      {log.action}
                    </span>{" "}
                    {log.entity_type && (
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        en {log.entity_type}
                        {log.entity_id && ` (${log.entity_id.substring(0, 8)}…)`}
                      </span>
                    )}
                  </p>
                </div>

                {/* Timestamp + IP */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-[11px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(log.created_at).toLocaleString("es", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  {log.ip_address && (
                    <p className="text-[10px] flex items-center gap-1 justify-end" style={{ color: "var(--muted-foreground)" }}>
                      <Globe size={9} /> {log.ip_address}
                    </p>
                  )}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && log.metadata && Object.keys(log.metadata).length > 0 && (
                <div className="ml-12 mt-1 rounded-lg border px-4 py-3"
                  style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                    Metadata
                  </p>
                  <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}

        {logs.length === 0 && (
          <div className="rounded-xl border px-5 py-16 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <ScrollText size={32} className="mx-auto mb-3" style={{ color: "var(--muted-foreground)" }} />
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Sin registros de auditoría</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Las acciones realizadas en esta organización aparecerán aquí</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Página {page} de {totalPages} · {totalCount} eventos
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-30"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-30"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
