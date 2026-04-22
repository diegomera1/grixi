import { redirect, useLoaderData, Outlet } from "react-router";
import { RouteErrorBoundary } from "~/components/route-error-boundary";
import type { Route } from "./+types/admin-layout";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { isPlatformTenant } from "~/lib/platform-guard";
import { AdminSidebar } from "~/components/admin/admin-sidebar";
import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { createBrowserClient } from "@supabase/ssr";

// ── Context for admin data shared across all admin pages ──
export interface AdminContext {
  user: { id: string; email: string; name: string; avatar?: string };
  stats: {
    orgs: number;
    users: number;
    activeMemberships: number;
    invitations: number;
    audit24h: number;
  };
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const AdminCtx = createContext<AdminContext | null>(null);
export function useAdminContext() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error("useAdminContext must be used within AdminLayout");
  return ctx;
}

// ── Loader: platform admin guard + global stats ──
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  // Must be accessed from admin.grixi.ai
  if (!isPlatformTenant(context)) return redirect("/dashboard", { headers });

  const admin = createSupabaseAdminClient(env);

  // Platform admin check
  const { data: pa } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!pa) return redirect("/unauthorized", { headers });

  // Global stats for sidebar
  const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [orgsRes, usersRes, membRes, invRes, auditRes] = await Promise.all([
    admin.from("organizations").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("memberships").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin.from("invitations").select("id", { count: "exact", head: true }),
    admin.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", now24h),
  ]);

  return Response.json({
    user: {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.full_name || user.email || "Admin",
      avatar: user.user_metadata?.avatar_url,
    },
    stats: {
      orgs: orgsRes.count || 0,
      users: usersRes.count || 0,
      activeMemberships: membRes.count || 0,
      invitations: invRes.count || 0,
      audit24h: auditRes.count || 0,
    },
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
  }, { headers });
}

// ── Realtime Hook ──
function useRealtimeStatus(supabaseUrl: string, supabaseAnonKey: string) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    // We check connectivity via a simple channel subscription
    const client = createBrowserClient(supabaseUrl, supabaseAnonKey);
    const channel = client.channel("admin-heartbeat");

    channel.subscribe((status) => {
      setIsConnected(status === "SUBSCRIBED");
    });

    return () => {
      channel.unsubscribe();
    };
  }, [supabaseUrl, supabaseAnonKey]);

  return isConnected;
}

// ── Layout Component ──
export default function AdminLayout() {
  const data = useLoaderData<typeof loader>();
  const isRealtimeConnected = useRealtimeStatus(data.supabaseUrl, data.supabaseAnonKey);

  const adminCtx: AdminContext = {
    user: data.user,
    stats: data.stats,
    supabaseUrl: data.supabaseUrl,
    supabaseAnonKey: data.supabaseAnonKey,
  };

  return (
    <AdminCtx.Provider value={adminCtx}>
      <div className="flex h-screen overflow-hidden bg-bg-primary">
        {/* ═══ Sidebar ═══ */}
        <AdminSidebar
          user={data.user}
          isRealtimeConnected={isRealtimeConnected}
          stats={{
            orgs: data.stats.orgs,
            users: data.stats.users,
            audit24h: data.stats.audit24h,
          }}
        />

        {/* ═══ Main Content ═══ */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-[1400px] px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </AdminCtx.Provider>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  return <RouteErrorBoundary error={error} moduleName="Panel Admin" />;
}
