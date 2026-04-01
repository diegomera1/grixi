import { redirect, useLoaderData, useOutletContext, useRouteLoaderData } from "react-router";
import { useState, useCallback, useEffect, useRef } from "react";
import type { Route } from "./+types/dashboard";
import type { TenantContext } from "./authenticated";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { DashboardHero } from "~/components/dashboard/hero";
import { ActivityChart } from "~/components/dashboard/activity-chart";
import { OrgInfoCard } from "~/components/dashboard/org-info-card";
import { ActivityTimeline } from "~/components/dashboard/activity-timeline";
import { QuickAccess } from "~/components/dashboard/quick-access";
import { useRealtimeSubscription, initRealtimeClient } from "~/lib/hooks/use-realtime";

// ─── Types ─────────────────────────────────────────────
interface DashboardData {
  kpis: {
    members: number;
    roles: number;
    permissions: number;
    pendingInvites: number;
  };
  orgSettings: {
    plan?: string;
    primary_color?: string;
    enabled_modules?: string[];
    max_users?: number;
    billing_email?: string;
  };
  orgLanguage: string;
  auditLogs: Array<{
    id: string;
    action: string;
    entity_type: string;
    actor_id: string;
    metadata: Record<string, any> | null;
    created_at: string;
  }>;
  currentOrgId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

// ─── Loader ────────────────────────────────────────────
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const tenantSlug = (context as any).tenantSlug as string | null;
  const isPlatformAdminPortal = (context as any).isPlatformAdminPortal === true;
  const { supabase, headers } = createSupabaseServerClient(request, env);

  // admin.grixi.ai has no tenant dashboard — redirect to admin panel
  if (isPlatformAdminPortal) return redirect("/admin", { headers });

  const admin = createSupabaseAdminClient(env);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  // Get the user's active memberships
  const { data: memberships } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  const orgIds = (memberships || []).map((m: any) => m.organization_id);

  // If user has no orgs, return empty state
  if (orgIds.length === 0) {
    return Response.json({
      kpis: { members: 0, roles: 0, permissions: 0, pendingInvites: 0 },
      orgSettings: {},
      orgLanguage: "es",
      auditLogs: [],
      currentOrgId: "",
      supabaseUrl: env.SUPABASE_URL,
      supabaseAnonKey: env.SUPABASE_ANON_KEY,
    } satisfies DashboardData, { headers });
  }

  // ── SECURITY: Resolve current org with tenant enforcement ──
  let currentOrgId: string;

  if (tenantSlug) {
    // Subdomain mode: MUST resolve to the tenant's org
    const { data: orgBySlug } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", tenantSlug)
      .maybeSingle();

    if (!orgBySlug) {
      // Tenant slug doesn't match any org
      return redirect("/unauthorized", { headers });
    }

    // Check if user is a platform admin
    const { data: platformAdmin } = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Only allow if user belongs to this org OR is platform admin
    if (!orgIds.includes(orgBySlug.id) && !platformAdmin) {
      return redirect("/unauthorized", { headers });
    }

    currentOrgId = orgBySlug.id;
  } else {
    // Root domain or dev: use cookie fallback or first membership
    const cookieHeader = request.headers.get("cookie") || "";
    const cookieOrgId = cookieHeader.match(/grixi_org=([^;]+)/)?.[1];
    currentOrgId = cookieOrgId && orgIds.includes(cookieOrgId)
      ? cookieOrgId
      : orgIds[0];
  }

  // ── Parallel queries scoped to currentOrgId ──────────
  const [membersRes, rolesRes, permsRes, invRes, orgRes, auditRes] = await Promise.all([
    admin.from("memberships").select("id", { count: "exact", head: true })
      .eq("organization_id", currentOrgId)
      .eq("status", "active"),

    admin.from("roles").select("id", { count: "exact", head: true })
      .eq("organization_id", currentOrgId),

    admin.from("role_permissions").select("id, roles!inner(organization_id)", { count: "exact", head: true })
      .eq("roles.organization_id", currentOrgId),

    admin.from("invitations").select("id", { count: "exact", head: true })
      .eq("organization_id", currentOrgId)
      .eq("status", "pending"),

    admin.from("organizations").select("settings, default_language")
      .eq("id", currentOrgId)
      .maybeSingle(),

    admin.from("audit_logs").select("id, action, entity_type, actor_id, metadata, created_at")
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  return Response.json({
    kpis: {
      members: membersRes.count ?? 0,
      roles: rolesRes.count ?? 0,
      permissions: permsRes.count ?? 0,
      pendingInvites: invRes.count ?? 0,
    },
    orgSettings: (orgRes.data?.settings as DashboardData["orgSettings"]) ?? {},
    orgLanguage: orgRes.data?.default_language ?? "es",
    auditLogs: auditRes.data ?? [],
    currentOrgId,
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
  } satisfies DashboardData, { headers });
}

// ─── Translation helper ────────────────────────────────
function useTranslations() {
  const rootData = useRouteLoaderData("root") as { translations: Record<string, string> } | undefined;
  const translations = rootData?.translations ?? {};

  return (key: string, params?: Record<string, string | number>): string => {
    let text = translations[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };
}

// ─── Component ─────────────────────────────────────────
export default function DashboardPage() {
  const data = useLoaderData<typeof loader>() as DashboardData;
  const ctx = useOutletContext<TenantContext>();
  const t = useTranslations();
  const initRef = useRef(false);

  // Initialize realtime client with env vars from server
  useEffect(() => {
    if (!initRef.current && data.supabaseUrl && data.supabaseAnonKey) {
      initRealtimeClient(data.supabaseUrl, data.supabaseAnonKey);
      initRef.current = true;
    }
  }, [data.supabaseUrl, data.supabaseAnonKey]);

  // ── Realtime state (overlaid on SSR data) ──────────────
  const [kpis, setKpis] = useState(data.kpis);
  const [auditLogs, setAuditLogs] = useState(data.auditLogs);
  const [isLive, setIsLive] = useState(false);
  const orgId = data.currentOrgId;
  const brandColor = data.orgSettings.primary_color ?? "#7C3AED";
  const enabledModules = data.orgSettings.enabled_modules ?? ["dashboard", "finanzas"];

  // Reset state when SSR data changes (navigating back)
  useEffect(() => {
    setKpis(data.kpis);
    setAuditLogs(data.auditLogs);
  }, [data]);

  // ── Realtime: Memberships ──────────────────────────────
  useRealtimeSubscription({
    table: "memberships",
    filter: `organization_id=eq.${orgId}`,
    enabled: !!orgId && initRef.current,
    onChange: useCallback(() => {
      setIsLive(true);
      // Increment/decrement members count heuristically
      setKpis((prev) => ({ ...prev, members: prev.members + 1 }));
    }, []),
  });

  // ── Realtime: Audit Logs ───────────────────────────────
  useRealtimeSubscription({
    table: "audit_logs",
    filter: `organization_id=eq.${orgId}`,
    enabled: !!orgId && initRef.current,
    onInsert: useCallback((payload: any) => {
      setIsLive(true);
      const newLog = payload.new;
      if (newLog) {
        setAuditLogs((prev) => [newLog, ...prev].slice(0, 15));
      }
    }, []),
  });

  // ── Realtime: Invitations ──────────────────────────────
  useRealtimeSubscription({
    table: "invitations",
    filter: `organization_id=eq.${orgId}`,
    enabled: !!orgId && initRef.current,
    onChange: useCallback((payload: any) => {
      setIsLive(true);
      const record = payload.new || payload.old;
      if (payload.eventType === "INSERT" && record?.status === "pending") {
        setKpis((prev) => ({ ...prev, pendingInvites: prev.pendingInvites + 1 }));
      } else if (payload.eventType === "UPDATE" && record?.status !== "pending") {
        setKpis((prev) => ({ ...prev, pendingInvites: Math.max(0, prev.pendingInvites - 1) }));
      }
    }, []),
  });

  // ── Realtime: Roles ────────────────────────────────────
  useRealtimeSubscription({
    table: "roles",
    filter: `organization_id=eq.${orgId}`,
    enabled: !!orgId && initRef.current,
    onChange: useCallback(() => {
      setIsLive(true);
      setKpis((prev) => ({ ...prev, roles: prev.roles + 1 }));
    }, []),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Hero + KPIs */}
      <DashboardHero
        userName={ctx.user.name}
        orgName={ctx.currentOrg?.name ?? "GRIXI"}
        orgColor={brandColor}
        kpis={kpis}
        isLive={isLive}
        t={t}
      />

      {/* Charts row: Activity Chart (2/3) + Org Info (1/3) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityChart
            logs={auditLogs}
            brandColor={brandColor}
            t={t}
          />
        </div>
        <div>
          <OrgInfoCard
            name={ctx.currentOrg?.name ?? "GRIXI"}
            slug={ctx.currentOrg?.slug ?? "grixi"}
            plan={data.orgSettings.plan ?? "starter"}
            color={brandColor}
            language={data.orgLanguage}
            logoUrl={undefined}
            t={t}
          />
        </div>
      </div>

      {/* Bottom row: Timeline (1/2) + Quick Access (1/2) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActivityTimeline
          logs={auditLogs}
          isLive={isLive}
          t={t}
        />
        <QuickAccess
          enabledModules={enabledModules}
          t={t}
        />
      </div>
    </div>
  );
}
