import { redirect, useLoaderData, useNavigate, Outlet } from "react-router";
import { useState, useEffect, useCallback, type ComponentType } from "react";
import type { Route } from "./+types/authenticated";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { BottomTabBar } from "~/components/layout/bottom-tab-bar";
import { PWASplash } from "~/components/pwa/pwa-splash";
import { InstallPrompt } from "~/components/pwa/install-prompt";
import { PushPermissionBanner } from "~/components/notifications/push-permission-banner";
import { useLastRoute, getLastRoute } from "~/lib/hooks/use-last-route";
import { useNotifications } from "~/lib/hooks/use-notifications";
import { usePushNotifications } from "~/lib/hooks/use-push-notifications";
import { ToastProvider } from "~/components/shared/toast";
import { Breadcrumbs } from "~/components/shared/breadcrumbs";
import { SessionTimeout } from "~/components/shared/session-timeout";
import { PullToRefresh } from "~/components/pwa/pull-to-refresh";

// Client-only wrapper to avoid SSR issues with framer-motion + browser APIs  
function ClientOnlyOrb({ data, notifs }: { data: any; notifs: any }) {
  const [Orb, setOrb] = useState<ComponentType<{ data: any; notifs?: any }> | null>(null);
  useEffect(() => {
    import("~/components/layout/grixi-orb").then((m) => setOrb(() => m.GrixiOrb));
  }, []);
  if (!Orb) return null;
  return <Orb data={data} notifs={notifs} />;
}

export interface TenantContext {
  user: { id: string; email: string; name: string; avatar?: string };
  isPlatformAdmin: boolean;
  /** True when accessed from admin.grixi.ai */
  isPlatformAdminPortal?: boolean;
  currentOrg: {
    id: string; name: string; slug: string; role: string;
    status: string; settings: any; hierarchyLevel: number;
    logoUrl?: string | null;
  } | null;
  /** User's permission keys for the current org (e.g. ['dashboard.view', 'finance.manage']) */
  permissions: string[];
  organizations: Array<{ id: string; name: string; slug: string; role: string; status: string }>;
  /** Subdomain slug from URL, e.g. "empresa-x" from empresa-x.grixi.ai */
  tenantSlug: string | null;
  /** Public env vars for client-side Supabase */
  env: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const tenantSlug = (context as any).tenantSlug as string | null;
  const isPlatformAdminPortal = (context as any).isPlatformAdminPortal === true;
  const { supabase, headers } = createSupabaseServerClient(request, env);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);

  // Platform admin check
  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Resolve user's organizations via memberships
  const { data: memberships } = await admin
    .from("memberships")
    .select("organization_id, status, roles(name, hierarchy_level), organizations(id, name, slug, status, settings, logo_url)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const organizations = (memberships || []).map((m: any) => ({
    id: m.organizations?.id,
    name: m.organizations?.name,
    slug: m.organizations?.slug,
    role: m.roles?.name || "member",
    status: m.organizations?.status || "active",
    settings: m.organizations?.settings,
    hierarchyLevel: m.roles?.hierarchy_level || 0,
    logoUrl: m.organizations?.logo_url || null,
  })).filter((o: any) => o.id);

  // Resolve current org: subdomain > URL ?org= > cookie > first membership
  const url = new URL(request.url);
  const orgParam = url.searchParams.get("org");
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieOrgId = cookieHeader.match(/grixi_org=([^;]+)/)?.[1];

  let currentOrg: TenantContext["currentOrg"] = null;

  // 1. Subdomain slug takes highest priority
  if (tenantSlug) {
    currentOrg = organizations.find((o: any) => o.slug === tenantSlug) || null;
    if (!currentOrg && platformAdmin) {
      const { data: orgBySlug } = await admin
        .from("organizations")
        .select("id, name, slug, status, settings, logo_url")
        .eq("slug", tenantSlug)
        .maybeSingle();
      if (orgBySlug) {
        currentOrg = { ...orgBySlug, role: "platform_admin", hierarchyLevel: 999, logoUrl: orgBySlug.logo_url || null };
      }
    }
    if (!currentOrg && !platformAdmin) {
      return redirect("/unauthorized", { headers });
    }
  }

  // 2. URL param
  if (!currentOrg && orgParam) {
    currentOrg = organizations.find((o: any) => o.id === orgParam || o.slug === orgParam) || null;
  }

  // 3. Cookie
  if (!currentOrg && cookieOrgId) {
    currentOrg = organizations.find((o: any) => o.id === cookieOrgId) || null;
  }

  // 4. First membership
  if (!currentOrg && organizations.length > 0) {
    currentOrg = organizations[0];
  }

  // ── RBAC Enforcement: org.status check ──
  if (currentOrg && currentOrg.status === "suspended" && !platformAdmin) {
    return redirect("/suspended", { headers });
  }

  // ── Fetch user permissions for current org ──
  let permissions: string[] = [];
  if (currentOrg) {
    if (platformAdmin) {
      const { data: allPerms } = await admin.from("permissions").select("key");
      permissions = (allPerms || []).map((p: any) => p.key);
    } else {
      const { data: userPerms } = await admin
        .from("memberships")
        .select("roles(role_permissions(permissions(key)))")
        .eq("user_id", user.id)
        .eq("organization_id", currentOrg.id)
        .eq("status", "active")
        .maybeSingle();
      
      const rolePerms = (userPerms as any)?.roles?.role_permissions || [];
      permissions = rolePerms.map((rp: any) => rp.permissions?.key).filter(Boolean);
    }
  }

  // Set org cookie for persistence
  const responseCookies: string[] = [];
  if (currentOrg) {
    responseCookies.push(`grixi_org=${currentOrg.id}; Path=/; SameSite=Lax; Secure; Max-Age=31536000`);
  }

  const responseHeaders = new Headers(headers);
  responseCookies.forEach(c => responseHeaders.append("Set-Cookie", c));

  return Response.json(
    {
      user: {
        id: user.id,
        email: user.email || "",
        name: user.user_metadata?.full_name || user.email || "Usuario",
        avatar: user.user_metadata?.avatar_url,
      },
      isPlatformAdmin: !!platformAdmin,
      currentOrg,
      permissions,
      organizations,
      tenantSlug,
      env: {
        SUPABASE_URL: env.SUPABASE_URL,
        SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
      },
    } satisfies TenantContext,
    { headers: responseHeaders }
  );
}

export default function AuthenticatedLayout() {
  const data = useLoaderData<typeof loader>() as TenantContext;
  const navigate = useNavigate();

  // Track last visited route for PWA
  useLastRoute();

  // Notifications — per-tenant, realtime
  const notifs = useNotifications(data.currentOrg?.id);

  // Push notifications
  const push = usePushNotifications();

  // Dynamic favicon: swap to org logo if available
  useEffect(() => {
    if (data.currentOrg?.logoUrl) {
      const link = document.querySelector('link[rel="icon"][sizes="32x32"]') as HTMLLinkElement;
      if (link) { link.href = data.currentOrg.logoUrl; link.type = "image/png"; }
    }
  }, [data.currentOrg?.logoUrl]);

  // ── Banner coordination: only one bottom banner at a time ──
  const [activeBannerId, setActiveBannerId] = useState<string | null>(null);
  const handleBannerChange = useCallback((id: string | null) => setActiveBannerId(id), []);

  // PWA Smart Start: redirect to last page if opened from home screen
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      const lastRoute = getLastRoute();
      if (lastRoute && lastRoute !== window.location.pathname) {
        navigate(lastRoute, { replace: true });
      }
    }
  }, []);

  // Trigger local notification when new one arrives via Realtime and tab is hidden
  useEffect(() => {
    if (!push.status.subscribed || notifs.notifications.length === 0) return;
    
    const latest = notifs.notifications[0];
    if (!latest || latest.read_at) return;
    
    // Only show if created within the last 5 seconds (new arrival)
    const age = Date.now() - new Date(latest.created_at).getTime();
    if (age < 5000 && document.hidden) {
      push.sendLocalNotification(latest.title, {
        body: latest.body || undefined,
        data: { url: latest.action_url || "/notificaciones" },
      });
    }
  }, [notifs.notifications[0]?.id]);

  return (
    <ToastProvider>
    <div className="relative h-screen overflow-hidden bg-bg-primary">
      {/* PWA Splash (standalone only) */}
      <PWASplash />

      {/* Main content — full screen with bottom nav spacing on mobile */}
      <PullToRefresh>
        <main className="platform-dot-grid relative h-screen overflow-y-auto overflow-x-hidden px-4 pb-6 pt-4 has-bottom-nav md:px-6 md:pb-6 lg:px-8">
          <div className="relative z-10 enter-fade">
            <Breadcrumbs />
            <Outlet context={data} />
          </div>
        </main>
      </PullToRefresh>

      {/* Bottom Tab Bar — mobile only */}
      <BottomTabBar unreadCount={notifs.unreadCount} />

      {/* GRIXI Orb — desktop floating navigation + AI (client-only) */}
      <div className="hidden md:block">
        <ClientOnlyOrb data={data} notifs={notifs} />
      </div>

      {/* Push Permission Banner — bottom-right, priority 1 (5s delay) */}
      <PushPermissionBanner
        push={push}
        activeBannerId={activeBannerId}
        onBannerChange={handleBannerChange}
      />

      {/* A2HS Install Prompt — bottom-left, priority 2 (8s delay) */}
      <InstallPrompt
        activeBannerId={activeBannerId}
        onBannerChange={handleBannerChange}
      />

      {/* Session timeout warning */}
      <SessionTimeout
        supabaseUrl={data.env.SUPABASE_URL}
        supabaseAnonKey={data.env.SUPABASE_ANON_KEY}
      />
    </div>
    </ToastProvider>
  );
}
