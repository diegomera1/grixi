/**
 * Admin — Analytics Dashboard
 * 
 * Product analytics: page views, feature usage, sessions, active users.
 * Visualizes data from analytics_events table.
 */
import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/admin.analytics";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { requirePlatformAdmin, requirePlatformPermission } from "~/lib/platform-rbac/guard.server";
import {
  BarChart3, Eye, Users, Clock, MousePointer, TrendingUp,
  Globe, Monitor, Smartphone, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { useState, useMemo } from "react";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);
  requirePlatformPermission(adminCtx, "admin.analytics.view", headers);

  const admin = createSupabaseAdminClient(env);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const prevWeek = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Get events from last 7 days
  const { data: events } = await admin
    .from("analytics_events")
    .select("event_name, event_category, user_id, organization_id, properties, session_id, route, created_at")
    .gte("created_at", weekAgo)
    .order("created_at", { ascending: false })
    .limit(5000);

  // Previous week for comparison
  const { data: prevEvents } = await admin
    .from("analytics_events")
    .select("event_name, session_id, user_id")
    .gte("created_at", prevWeek)
    .lt("created_at", weekAgo)
    .limit(5000);

  const allEvents = events || [];
  const prevAll = prevEvents || [];

  // Calculate KPIs
  const pageViews = allEvents.filter(e => e.event_name === "page_view").length;
  const prevPageViews = prevAll.filter(e => e.event_name === "page_view").length;
  const uniqueUsers = new Set(allEvents.map(e => e.user_id).filter(Boolean)).size;
  const prevUniqueUsers = new Set(prevAll.map(e => e.user_id).filter(Boolean)).size;
  const sessions = new Set(allEvents.map(e => e.session_id).filter(Boolean)).size;
  const prevSessions = new Set(prevAll.map(e => e.session_id).filter(Boolean)).size;
  const featureEvents = allEvents.filter(e => e.event_name === "feature_used").length;

  // Top pages
  const pageCounts: Record<string, number> = {};
  allEvents.filter(e => e.event_name === "page_view").forEach(e => {
    const route = (e.properties as any)?.path || e.route || "unknown";
    pageCounts[route] = (pageCounts[route] || 0) + 1;
  });
  const topPages = Object.entries(pageCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // Top features
  const featureCounts: Record<string, number> = {};
  allEvents.filter(e => e.event_name === "feature_used").forEach(e => {
    const feature = (e.properties as any)?.feature || (e.properties as any)?.action || "unknown";
    featureCounts[feature] = (featureCounts[feature] || 0) + 1;
  });
  const topFeatures = Object.entries(featureCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([feature, count]) => ({ feature, count }));

  // Daily breakdown (last 7 days)
  const dailyBreakdown: Record<string, { views: number; users: Set<string>; sessions: Set<string> }> = {};
  for (let i = 0; i < 7; i++) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = day.toISOString().split("T")[0];
    dailyBreakdown[key] = { views: 0, users: new Set(), sessions: new Set() };
  }
  allEvents.forEach(e => {
    const day = e.created_at.split("T")[0];
    if (dailyBreakdown[day]) {
      if (e.event_name === "page_view") dailyBreakdown[day].views++;
      if (e.user_id) dailyBreakdown[day].users.add(e.user_id);
      if (e.session_id) dailyBreakdown[day].sessions.add(e.session_id);
    }
  });
  const dailyData = Object.entries(dailyBreakdown)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, d]) => ({
      day,
      label: new Date(day + "T12:00:00Z").toLocaleDateString("es", { weekday: "short", day: "numeric" }),
      views: d.views,
      users: d.users.size,
      sessions: d.sessions.size,
    }));

  // Events by org
  const orgCounts: Record<string, number> = {};
  allEvents.forEach(e => {
    if (e.organization_id) orgCounts[e.organization_id] = (orgCounts[e.organization_id] || 0) + 1;
  });

  // Get org names
  const orgIds = Object.keys(orgCounts);
  let orgData: { name: string; count: number }[] = [];
  if (orgIds.length > 0) {
    const { data: orgs } = await admin.from("organizations").select("id, name").in("id", orgIds);
    orgData = (orgs || []).map((o: any) => ({
      name: o.name,
      count: orgCounts[o.id] || 0,
    })).sort((a: any, b: any) => b.count - a.count);
  }

  // Today's events
  const todayEvents = allEvents.filter(e => e.created_at >= today).length;

  return Response.json({
    kpis: {
      pageViews, prevPageViews,
      uniqueUsers, prevUniqueUsers,
      sessions, prevSessions,
      featureEvents, todayEvents,
    },
    topPages,
    topFeatures,
    dailyData,
    orgData,
  }, { headers });
}

export default function AdminAnalytics() {
  const { kpis, topPages, topFeatures, dailyData, orgData } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState<"pages" | "features" | "orgs">("pages");

  const calcDelta = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
  };

  const kpiCards = [
    {
      label: "Page Views", value: kpis.pageViews, prev: kpis.prevPageViews,
      color: "#6366F1", icon: Eye,
    },
    {
      label: "Usuarios Únicos", value: kpis.uniqueUsers, prev: kpis.prevUniqueUsers,
      color: "#EC4899", icon: Users,
    },
    {
      label: "Sesiones", value: kpis.sessions, prev: kpis.prevSessions,
      color: "#10B981", icon: Globe,
    },
    {
      label: "Feature Events", value: kpis.featureEvents, prev: 0,
      color: "#F59E0B", icon: MousePointer,
    },
  ];

  const maxDailyViews = Math.max(...dailyData.map((d: any) => d.views), 1);

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "#6366F115" }}>
            <BarChart3 size={17} style={{ color: "#6366F1" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">Analytics</h1>
            <p className="text-[11px] text-text-muted">
              Últimos 7 días · {kpis.todayEvents} eventos hoy
            </p>
          </div>
        </div>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          const delta = calcDelta(kpi.value, kpi.prev);
          const isPositive = delta >= 0;
          return (
            <div key={kpi.label} className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${kpi.color}12` }}>
                  <Icon size={15} style={{ color: kpi.color }} />
                </div>
                {kpi.prev > 0 && (
                  <span className={`flex items-center gap-0.5 text-[10px] font-bold ${isPositive ? "text-success" : "text-error"}`}>
                    {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {Math.abs(delta)}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold tabular-nums text-text-primary">{kpi.value.toLocaleString()}</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-text-muted">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* ═══ Daily Chart (CSS-based bar chart) ═══ */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <TrendingUp size={14} className="text-brand" />
          <h2 className="text-[12px] font-bold uppercase tracking-wider text-text-primary">Actividad Diaria</h2>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-2" style={{ height: "160px" }}>
            {dailyData.map((day: any) => {
              const height = maxDailyViews > 0 ? (day.views / maxDailyViews) * 100 : 0;
              return (
                <div key={day.day} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-bold tabular-nums text-text-primary">
                    {day.views}
                  </span>
                  <div className="w-full flex items-end justify-center" style={{ height: "120px" }}>
                    <div
                      className="w-full max-w-[40px] rounded-t-lg transition-all duration-500"
                      style={{
                        height: `${Math.max(height, 4)}%`,
                        background: `linear-gradient(180deg, #6366F1 0%, #8B5CF6 100%)`,
                        opacity: day.views > 0 ? 1 : 0.2,
                      }}
                    />
                  </div>
                  <span className="text-[8px] font-medium text-text-muted">{day.label}</span>
                  <span className="text-[7px] text-text-muted">{day.users}u · {day.sessions}s</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Tabs: Pages / Features / Orgs ═══ */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center border-b border-border">
          {([
            { key: "pages", label: "Top Páginas", icon: Eye },
            { key: "features", label: "Top Features", icon: MousePointer },
            { key: "orgs", label: "Por Organización", icon: Users },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-[11px] font-medium transition-colors ${
                activeTab === key
                  ? "border-brand text-brand"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-border">
          {activeTab === "pages" && (
            topPages.length > 0 ? topPages.map((page: any, i: number) => (
              <div key={page.path} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/20">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-[10px] font-bold text-text-muted">
                  {i + 1}
                </span>
                <code className="min-w-0 flex-1 truncate text-[11px] font-mono text-text-primary">{page.path}</code>
                <span className="tabular-nums text-[12px] font-bold text-text-primary">{page.count}</span>
                <div className="hidden w-32 sm:block">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(page.count / (topPages[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )) : (
              <div className="px-5 py-8 text-center text-[11px] text-text-muted">Sin datos de páginas</div>
            )
          )}

          {activeTab === "features" && (
            topFeatures.length > 0 ? topFeatures.map((feat: any, i: number) => (
              <div key={feat.feature} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/20">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-[10px] font-bold text-text-muted">
                  {i + 1}
                </span>
                <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-text-primary">{feat.feature}</p>
                <span className="tabular-nums text-[12px] font-bold text-text-primary">{feat.count}</span>
                <div className="hidden w-32 sm:block">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(feat.count / (topFeatures[0]?.count || 1)) * 100}%`,
                        backgroundColor: "#F59E0B",
                      }}
                    />
                  </div>
                </div>
              </div>
            )) : (
              <div className="px-5 py-8 text-center text-[11px] text-text-muted">Sin datos de features</div>
            )
          )}

          {activeTab === "orgs" && (
            orgData.length > 0 ? orgData.map((org: any, i: number) => (
              <div key={org.name} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/20">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-[10px] font-bold text-text-muted">
                  {i + 1}
                </span>
                <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-text-primary">{org.name}</p>
                <span className="tabular-nums text-[12px] font-bold text-text-primary">{org.count}</span>
                <div className="hidden w-32 sm:block">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(org.count / (orgData[0]?.count || 1)) * 100}%`,
                        backgroundColor: "#10B981",
                      }}
                    />
                  </div>
                </div>
              </div>
            )) : (
              <div className="px-5 py-8 text-center text-[11px] text-text-muted">Sin datos por organización</div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
