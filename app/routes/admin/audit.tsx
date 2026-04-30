import { redirect, useLoaderData, useSearchParams, useNavigate } from "react-router";
import type { Route } from "./+types/admin.audit";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { requirePlatformAdmin, requirePlatformPermission } from "~/lib/platform-rbac/guard.server";
import { exportCSV } from "~/lib/export";
import { useAuditRealtime } from "~/components/admin/audit-realtime";
import { useAdminContext } from "~/routes/admin-layout";
import {
  History, Filter, Search, Download, Radio, Pause, Play,
  ChevronDown, ChevronUp, X, BarChart3,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  INSERT: { label: "Crear", color: "#16A34A" },
  UPDATE: { label: "Actualizar", color: "#F59E0B" },
  DELETE: { label: "Eliminar", color: "#EF4444" },
  "organization.create": { label: "Org creada", color: "#6366F1" },
  "organization.suspend": { label: "Org suspendida", color: "#EF4444" },
  "organization.activate": { label: "Org activada", color: "#16A34A" },
  "organization.toggle_status": { label: "Org status", color: "#F59E0B" },
  "organization.update_modules": { label: "Módulos", color: "#6366F1" },
  "organization.update_settings": { label: "Config", color: "#3B82F6" },
  "invitation.create": { label: "Invitación", color: "#EC4899" },
  "invitation.cancel": { label: "Inv. cancelada", color: "#EF4444" },
  "domain.add": { label: "Dominio +", color: "#06B6D4" },
  "domain.remove": { label: "Dominio -", color: "#EF4444" },
  "user.promote": { label: "Promovido", color: "#16A34A" },
  "user.demote": { label: "Revocado", color: "#EF4444" },
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.audit.view", headers);

  const admin = createSupabaseAdminClient(env);

  const url = new URL(request.url);
  const actionFilter = url.searchParams.get("action") || "";
  const orgFilter = url.searchParams.get("org") || "";
  const actorFilter = url.searchParams.get("actor") || "";
  const searchQ = url.searchParams.get("q") || "";
  const dateFrom = url.searchParams.get("from") || "";
  const dateTo = url.searchParams.get("to") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const perPage = 50;

  let query = admin.from("audit_logs").select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (actionFilter) query = query.eq("action", actionFilter);
  if (orgFilter) query = query.eq("organization_id", orgFilter);
  if (actorFilter) query = query.eq("actor_id", actorFilter);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59Z");

  const { data: logs, count } = await query;

  // Full-text search on metadata (client-side filter after fetch)
  let filteredLogs = logs || [];
  if (searchQ) {
    const q = searchQ.toLowerCase();
    filteredLogs = filteredLogs.filter((l: any) =>
      JSON.stringify(l.metadata || {}).toLowerCase().includes(q) ||
      (l.action || "").toLowerCase().includes(q) ||
      (l.entity_type || "").toLowerCase().includes(q)
    );
  }

  // Actor info
  const actorIds = [...new Set(filteredLogs.map((l: any) => l.actor_id).filter(Boolean))];
  const actorMap: Record<string, any> = {};
  if (actorIds.length > 0) {
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    authData?.users?.forEach((u: any) => {
      actorMap[u.id] = { name: u.user_metadata?.full_name || u.email, avatar: u.user_metadata?.avatar_url, email: u.email };
    });
  }

  // Get lists for filter dropdowns
  const [orgsRes, allActions] = await Promise.all([
    admin.from("organizations").select("id, name").order("name"),
    admin.from("audit_logs").select("action").limit(500),
  ]);

  const uniqueActions = [...new Set((allActions.data || []).map((l: any) => l.action))];

  // Hourly activity chart (last 24h)
  const now = Date.now();
  const hourlyData: { hour: string; count: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const h = new Date(now - i * 60 * 60 * 1000);
    const label = h.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    const hourStart = new Date(h); hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(h); hourEnd.setMinutes(59, 59, 999);
    const c = filteredLogs.filter((l: any) => {
      const t = new Date(l.created_at).getTime();
      return t >= hourStart.getTime() && t <= hourEnd.getTime();
    }).length;
    hourlyData.push({ hour: label, count: c });
  }

  return Response.json({
    logs: filteredLogs,
    actorMap,
    totalCount: count || 0,
    page,
    perPage,
    filters: { actionFilter, orgFilter, actorFilter, searchQ, dateFrom, dateTo },
    organizations: orgsRes.data || [],
    uniqueActions,
    hourlyData,
    allActors: Object.entries(actorMap).map(([id, a]) => ({ id, name: (a as any).name })),
  }, { headers });
}

export default function AuditLog() {
  const {
    logs, actorMap, totalCount, page, perPage, filters,
    organizations, uniqueActions, hourlyData, allActors,
  } = useLoaderData<typeof loader>();

  const adminCtx = useAdminContext();
  const { newEvents, isConnected, isPaused, eventCount, pause, resume, clear } = useAuditRealtime(
    adminCtx.supabaseUrl, adminCtx.supabaseAnonKey,
  );

  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page"); // Reset to page 1
    navigate(`/admin/audit?${params.toString()}`);
  }, [searchParams, navigate]);

  const clearFilters = useCallback(() => navigate("/admin/audit"), [navigate]);

  const totalPages = Math.ceil(totalCount / perPage);
  const hasActiveFilters = Object.values(filters).some(Boolean);

  // Combine realtime events + server-loaded events
  const allLogs = useMemo(() => {
    const serverIds = new Set(logs.map((l: any) => l.id));
    const uniqueNew = newEvents.filter((e) => !serverIds.has(e.id));
    return [...uniqueNew, ...logs];
  }, [logs, newEvents]);

  const handleExport = () => {
    const headers = ["Fecha", "Acción", "Actor", "Entidad", "Entity ID", "IP", "Metadata"];
    const rows = allLogs.map((l: any) => [
      new Date(l.created_at).toLocaleString("es"),
      l.action,
      actorMap[l.actor_id]?.name || l.actor_id || "Sistema",
      l.entity_type || "",
      l.entity_id || "",
      l.ip_address || "",
      JSON.stringify(l.metadata || {}),
    ]);
    exportCSV("audit_logs", headers, rows);
  };

  return (
    <div className="space-y-5">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "#8B5CF615" }}>
            <History size={17} style={{ color: "#8B5CF6" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">Audit Log</h1>
            <p className="text-[11px] text-text-muted">
              {totalCount} eventos totales · Página {page} de {totalPages || 1}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Realtime Indicator */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
            <Radio size={12} className={isConnected ? "animate-pulse text-success" : "text-error"} />
            <span className="text-[10px] font-medium text-text-muted">{isConnected ? "Live" : "Offline"}</span>
            {isConnected && (
              <button
                onClick={isPaused ? resume : pause}
                className="ml-1 rounded-lg p-1 transition-colors hover:bg-muted"
                title={isPaused ? "Reanudar" : "Pausar"}
              >
                {isPaused ? <Play size={11} className="text-success" /> : <Pause size={11} className="text-text-muted" />}
              </button>
            )}
            {eventCount > 0 && (
              <button onClick={clear} className="ml-1 rounded-lg p-1 transition-colors hover:bg-muted" title="Limpiar">
                <X size={11} className="text-text-muted" />
              </button>
            )}
          </div>
          {/* New events badge */}
          {eventCount > 0 && (
            <div className="rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold text-white animate-pulse">
              {eventCount} nuevos
            </div>
          )}
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-medium transition-all ${
              hasActiveFilters
                ? "border-brand bg-brand/5 text-brand"
                : "border-border text-text-secondary hover:border-brand hover:text-brand"
            }`}
          >
            <Filter size={12} />
            Filtros
            {hasActiveFilters && <span className="rounded-full bg-brand px-1.5 text-[9px] text-white">!</span>}
          </button>
          <button onClick={handleExport} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-medium text-text-secondary transition-all hover:border-brand hover:text-brand">
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {/* ═══ Filters Panel ═══ */}
      {showFilters && (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {/* Action */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-muted">Acción</label>
              <select
                value={filters.actionFilter}
                onChange={(e) => updateFilter("action", e.target.value)}
                className="w-full appearance-none rounded-xl border border-border bg-bg-primary px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
              >
                <option value="">Todas</option>
                {uniqueActions.map((a: string) => (
                  <option key={a} value={a}>{ACTION_LABELS[a]?.label || a}</option>
                ))}
              </select>
            </div>
            {/* Organization */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-muted">Organización</label>
              <select
                value={filters.orgFilter}
                onChange={(e) => updateFilter("org", e.target.value)}
                className="w-full appearance-none rounded-xl border border-border bg-bg-primary px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
              >
                <option value="">Todas</option>
                {organizations.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            {/* Actor */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-muted">Actor</label>
              <select
                value={filters.actorFilter}
                onChange={(e) => updateFilter("actor", e.target.value)}
                className="w-full appearance-none rounded-xl border border-border bg-bg-primary px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
              >
                <option value="">Todos</option>
                {allActors.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {/* Date From */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-muted">Desde</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter("from", e.target.value)}
                className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
              />
            </div>
            {/* Date To */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-muted">Hasta</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter("to", e.target.value)}
                className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
              />
            </div>
            {/* Search */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-muted">Buscar</label>
              <div className="relative">
                <Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  defaultValue={filters.searchQ}
                  onKeyDown={(e) => { if (e.key === "Enter") updateFilter("q", (e.target as HTMLInputElement).value); }}
                  placeholder="Buscar en metadata…"
                  className="w-full rounded-xl border border-border bg-bg-primary py-2 pl-8 pr-3 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-3 flex items-center gap-1 text-[11px] font-medium text-brand hover:underline">
              <X size={12} /> Limpiar todos los filtros
            </button>
          )}
        </div>
      )}

      {/* ═══ Activity Chart ═══ */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 size={14} className="text-text-muted" />
          <h3 className="text-[12px] font-bold text-text-primary">Actividad por Hora (24h)</h3>
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 8, fill: "var(--text-muted)" }} interval={2} />
              <YAxis tick={{ fontSize: 8, fill: "var(--text-muted)" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: 12, fontSize: 11, color: "var(--text-primary)",
                }}
              />
              <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══ Events Timeline ═══ */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        {allLogs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <History size={28} className="mx-auto mb-3 text-text-muted opacity-50" />
            <p className="text-[12px] text-text-muted">No hay eventos registrados</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {allLogs.map((log: any) => {
              const actor = actorMap[log.actor_id] || {};
              const meta = ACTION_LABELS[log.action] || { label: log.action, color: "#71717A" };
              const time = new Date(log.created_at);
              const isNew = newEvents.some((e) => e.id === log.id);
              const isExpanded = expandedId === log.id;

              return (
                <div key={log.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className={`flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-muted/30 ${isNew ? "bg-brand/5 border-l-2 border-brand" : ""}`}
                  >
                    {/* Avatar */}
                    {actor.avatar ? (
                      <img src={actor.avatar} className="h-8 w-8 shrink-0 rounded-full ring-1 ring-white/10" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-text-muted">
                        {(actor.name || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-medium text-text-primary">{actor.name || "Sistema"}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                          style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        {isNew && <span className="rounded-full bg-brand px-1.5 py-0.5 text-[8px] font-bold text-white">NEW</span>}
                      </div>
                      <p className="truncate text-[10px] text-text-muted">
                        {log.entity_type}
                        {log.metadata?.email ? ` → ${log.metadata.email}` : ""}
                        {log.metadata?.name ? ` → ${log.metadata.name}` : ""}
                        {log.metadata?.domain ? ` → @${log.metadata.domain}` : ""}
                      </p>
                    </div>
                    {/* Time + expand */}
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] tabular-nums text-text-muted">
                          {time.toLocaleDateString("es", { day: "2-digit", month: "short" })} {time.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </p>
                        {log.ip_address && <p className="text-[9px] font-mono text-text-muted opacity-60">{log.ip_address}</p>}
                      </div>
                      {isExpanded ? <ChevronUp size={13} className="text-text-muted" /> : <ChevronDown size={13} className="text-text-muted" />}
                    </div>
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/20 px-5 py-4">
                      <div className="grid grid-cols-2 gap-4 text-[11px] lg:grid-cols-4">
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">ID</span>
                          <p className="mt-0.5 font-mono text-[10px] text-text-secondary">{log.id}</p>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Entity</span>
                          <p className="mt-0.5 text-text-secondary">{log.entity_type} / {log.entity_id || "—"}</p>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Org ID</span>
                          <p className="mt-0.5 font-mono text-[10px] text-text-secondary">{log.organization_id || "—"}</p>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">IP</span>
                          <p className="mt-0.5 font-mono text-text-secondary">{log.ip_address || "—"}</p>
                        </div>
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-3">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Metadata</span>
                          <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-bg-primary p-3 text-[10px] text-text-secondary">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                      {(log.old_data || log.new_data) && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {log.old_data && (
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-error">Old Data</span>
                              <pre className="mt-1 max-h-28 overflow-auto rounded-lg bg-error/5 p-3 text-[10px] text-text-secondary">
                                {JSON.stringify(log.old_data, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_data && (
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-success">New Data</span>
                              <pre className="mt-1 max-h-28 overflow-auto rounded-lg bg-success/5 p-3 text-[10px] text-text-secondary">
                                {JSON.stringify(log.new_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <span className="text-[11px] text-text-muted">Mostrando {Math.min(perPage, allLogs.length)} de {totalCount}</span>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <button
                  onClick={() => { const p = new URLSearchParams(searchParams); p.set("page", String(page - 1)); navigate(`/admin/audit?${p.toString()}`); }}
                  className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-text-secondary hover:bg-muted"
                >
                  ← Anterior
                </button>
              )}
              <span className="text-[11px] font-medium text-text-muted">{page} / {totalPages}</span>
              {page < totalPages && (
                <button
                  onClick={() => { const p = new URLSearchParams(searchParams); p.set("page", String(page + 1)); navigate(`/admin/audit?${p.toString()}`); }}
                  className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-text-secondary hover:bg-muted"
                >
                  Siguiente →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
