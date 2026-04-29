/**
 * Admin — Error Tracking
 * 
 * Dashboard de errores capturados en producción.
 * Muestra errores agrupados por fingerprint, con filtros y resolución.
 */
import { redirect, useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/admin.errors";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { isPlatformTenant } from "~/lib/platform-guard";
import {
  Bug, AlertTriangle, Monitor, Server, Globe, Clock,
  CheckCircle2, ChevronDown, ChevronRight, Search, RefreshCw, X,
} from "lucide-react";
import { useState, useMemo } from "react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });
  if (!isPlatformTenant(context)) return redirect("/dashboard", { headers });

  const admin = createSupabaseAdminClient(env);
  const { data: pa } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!pa) return redirect("/dashboard", { headers });

  // Get recent errors (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: errors } = await admin
    .from("error_logs")
    .select("*")
    .gte("created_at", weekAgo)
    .order("created_at", { ascending: false })
    .limit(200);

  // Stats
  const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const now1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const allErrors = errors || [];
  const last24h = allErrors.filter(e => e.created_at >= now24h).length;
  const last1h = allErrors.filter(e => e.created_at >= now1h).length;
  const unresolved = allErrors.filter(e => !e.resolved_at).length;
  const clientErrors = allErrors.filter(e => e.source === "client").length;
  const serverErrors = allErrors.filter(e => e.source === "server").length;

  return Response.json({
    errors: allErrors,
    stats: { total: allErrors.length, last24h, last1h, unresolved, clientErrors, serverErrors },
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

  if (intent === "resolve") {
    const id = formData.get("id") as string;
    await admin.from("error_logs").update({
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    }).eq("id", id);
    return Response.json({ success: true }, { headers });
  }

  if (intent === "resolve_group") {
    const fingerprint = formData.get("fingerprint") as string;
    await admin.from("error_logs").update({
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    }).eq("fingerprint", fingerprint).is("resolved_at", null);
    return Response.json({ success: true }, { headers });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400, headers });
}

export default function AdminErrors() {
  const { errors, stats } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "client" | "server">("all");
  const [showResolved, setShowResolved] = useState(false);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  // Group by fingerprint
  const grouped = useMemo(() => {
    let filtered = errors.filter((e: any) => {
      if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
      if (!showResolved && e.resolved_at) return false;
      if (search) {
        const s = search.toLowerCase();
        return e.message?.toLowerCase().includes(s) || e.route?.toLowerCase().includes(s);
      }
      return true;
    });

    const groups: Record<string, any[]> = {};
    for (const err of filtered) {
      const key = err.fingerprint || err.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(err);
    }

    return Object.entries(groups)
      .map(([fingerprint, errs]) => ({
        fingerprint,
        message: errs[0].message,
        source: errs[0].source,
        level: errs[0].level,
        route: errs[0].route,
        count: errs.length,
        lastSeen: errs[0].created_at,
        firstSeen: errs[errs.length - 1].created_at,
        resolved: errs.every((e: any) => e.resolved_at),
        errors: errs,
      }))
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
  }, [errors, search, sourceFilter, showResolved]);

  const handleResolveGroup = (fingerprint: string) => {
    fetcher.submit({ intent: "resolve_group", fingerprint }, { method: "post" });
  };

  const getSourceIcon = (source: string) => source === "client" ? Monitor : Server;
  const getLevelColor = (level: string) => {
    if (level === "fatal") return "#EF4444";
    if (level === "warning") return "#F59E0B";
    return "#EF4444";
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "#EF444415" }}>
          <Bug size={17} style={{ color: "#EF4444" }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-primary">Error Tracking</h1>
          <p className="text-[11px] text-text-muted">
            {stats.total} errores (7 días) · {stats.unresolved} sin resolver
          </p>
        </div>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Última hora", value: stats.last1h, color: stats.last1h > 5 ? "#EF4444" : "#10B981", icon: Clock },
          { label: "Últimas 24h", value: stats.last24h, color: "#F59E0B", icon: AlertTriangle },
          { label: "Client-side", value: stats.clientErrors, color: "#3B82F6", icon: Monitor },
          { label: "Server-side", value: stats.serverErrors, color: "#8B5CF6", icon: Server },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${kpi.color}12` }}>
                  <Icon size={13} style={{ color: kpi.color }} />
                </div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">{kpi.label}</p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-text-primary">{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* ═══ Filters ═══ */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por mensaje o ruta..."
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-4 text-[12px] text-text-primary outline-none placeholder:text-text-muted focus:border-brand"
          />
        </div>
        <div className="flex items-center rounded-xl border border-border bg-surface">
          {(["all", "client", "server"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`px-3 py-2 text-[10px] font-medium transition-colors ${
                sourceFilter === s ? "bg-brand/10 text-brand" : "text-text-muted hover:text-text-primary"
              }`}
            >
              {s === "all" ? "Todos" : s === "client" ? "Client" : "Server"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowResolved(!showResolved)}
          className={`rounded-xl border px-3 py-2 text-[10px] font-medium transition-colors ${
            showResolved ? "border-brand bg-brand/10 text-brand" : "border-border text-text-muted hover:text-text-primary"
          }`}
        >
          {showResolved ? "Ocultar resueltos" : "Mostrar resueltos"}
        </button>
      </div>

      {/* ═══ Error Groups ═══ */}
      <div className="space-y-2">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-16">
            <CheckCircle2 size={40} className="mb-3 text-success" />
            <p className="text-[13px] font-medium text-text-primary">Sin errores</p>
            <p className="text-[11px] text-text-muted">No se encontraron errores con estos filtros</p>
          </div>
        ) : (
          grouped.map((group) => {
            const SourceIcon = getSourceIcon(group.source);
            const levelColor = getLevelColor(group.level);
            const isExpanded = expandedError === group.fingerprint;

            return (
              <div key={group.fingerprint} className="rounded-xl border border-border bg-surface overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20">
                  <button
                    onClick={() => setExpandedError(isExpanded ? null : group.fingerprint)}
                    className="shrink-0 text-text-muted"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${levelColor}12` }}>
                    <SourceIcon size={12} style={{ color: levelColor }} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-text-primary">
                      {group.message}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[9px] text-text-muted">
                      {group.route && <span className="font-mono">{group.route}</span>}
                      <span>·</span>
                      <span>{timeAgo(group.lastSeen)}</span>
                    </div>
                  </div>

                  {/* Count badge */}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                    group.count > 10 ? "bg-error/10 text-error" :
                    group.count > 3 ? "bg-warning/10 text-warning" :
                    "bg-muted text-text-muted"
                  }`}>
                    {group.count}×
                  </span>

                  {/* Resolve */}
                  {!group.resolved && (
                    <button
                      onClick={() => handleResolveGroup(group.fingerprint)}
                      className="rounded-lg bg-success/10 px-2.5 py-1 text-[9px] font-medium text-success hover:bg-success/20"
                    >
                      Resolver
                    </button>
                  )}
                  {group.resolved && (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[9px] font-bold text-success">✓</span>
                  )}
                </div>

                {/* Expanded: Stack trace & details */}
                {isExpanded && (
                  <div className="border-t border-border/50 bg-muted/10 px-5 py-4 space-y-3">
                    {group.errors[0].stack && (
                      <div>
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-text-muted">Stack Trace</p>
                        <pre className="max-h-40 overflow-auto rounded-lg bg-bg-primary p-3 text-[10px] font-mono text-text-secondary leading-relaxed">
                          {group.errors[0].stack}
                        </pre>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {[
                        { label: "Source", value: group.source },
                        { label: "Browser", value: group.errors[0].browser || "—" },
                        { label: "OS", value: group.errors[0].os || "—" },
                        { label: "URL", value: group.errors[0].url || "—" },
                      ].map((d) => (
                        <div key={d.label}>
                          <p className="text-[8px] font-bold uppercase tracking-wider text-text-muted">{d.label}</p>
                          <p className="mt-0.5 truncate text-[10px] font-mono text-text-secondary">{d.value}</p>
                        </div>
                      ))}
                    </div>
                    {group.count > 1 && (
                      <div>
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-text-muted">
                          Ocurrencias ({group.count})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {group.errors.slice(0, 20).map((e: any) => (
                            <span key={e.id} className="rounded bg-muted px-1.5 py-0.5 text-[8px] font-mono text-text-muted">
                              {timeAgo(e.created_at)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
