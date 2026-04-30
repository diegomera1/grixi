import { redirect, useLoaderData, Outlet, useNavigate } from "react-router";
import { RouteErrorBoundary } from "~/components/route-error-boundary";
import type { Route } from "./+types/admin-layout";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { requirePlatformAdmin } from "~/lib/platform-rbac/guard.server";
import type { PlatformAdminContext } from "~/lib/platform-rbac/types";
import type { AdminLayoutContext } from "~/lib/platform-rbac/hooks";
import { AdminSidebar } from "~/components/admin/admin-sidebar";
import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { requireAdminSession, startAdminSession } from "~/lib/platform-rbac/admin-session.server";
import { Lock, Clock, X } from "lucide-react";

// ── Context for admin data shared across all admin pages ──
const AdminCtx = createContext<AdminLayoutContext | null>(null);
export function useAdminContext() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error("useAdminContext must be used within AdminLayout");
  return ctx;
}

// ═══════════════════════════════════════════════════════════════
// ██ LOADER — Platform Admin Guard + Session Guard + Stats
// ═══════════════════════════════════════════════════════════════
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const kv = (env as any).KV_CACHE as KVNamespace | undefined;

  // Centralized guard — loads role, permissions, scope
  const { adminCtx, supabaseHeaders: headers } = await requirePlatformAdmin(request, env, context);

  // ═══ ADMIN SESSION GUARD ═══
  // Check KV-based inactivity timeout (30 min)
  const url = new URL(request.url);
  await requireAdminSession(adminCtx.userId, kv, headers, url.pathname);

  // Start/refresh admin session on successful access
  await startAdminSession(adminCtx.userId, kv);

  const admin = createSupabaseAdminClient(env);

  // Log admin access (lightweight — only once per session start)
  const sessionKey = `admin_access_logged:${adminCtx.userId}`;
  const alreadyLogged = kv ? await kv.get(sessionKey) : null;
  if (!alreadyLogged) {
    await admin.from("audit_logs").insert({
      user_id: adminCtx.userId,
      action: "admin.session.verified",
      entity_type: "platform_admin",
      entity_id: adminCtx.userId,
      ip_address: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for"),
      user_agent: request.headers.get("user-agent"),
      metadata: { path: url.pathname },
    });
    // Only log once per 10 minutes
    if (kv) await kv.put(sessionKey, "1", { expirationTtl: 600 });
  }

  // Global stats for sidebar
  const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [orgsRes, usersRes, membRes, invRes, auditRes] = await Promise.all([
    admin.from("organizations").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("memberships").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin.from("invitations").select("id", { count: "exact", head: true }),
    admin.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", now24h),
  ]);

  // Get user info
  const { data: { user } } = await (await import("~/lib/supabase/client.server")).createSupabaseServerClient(request, env).supabase.auth.getUser();

  return Response.json({
    user: {
      id: adminCtx.userId,
      email: user?.email || "",
      name: user?.user_metadata?.full_name || user?.email || "Admin",
      avatar: user?.user_metadata?.avatar_url,
    },
    adminCtx,
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

// ═══════════════════════════════════════════════════════════════
// ██ HOOKS
// ═══════════════════════════════════════════════════════════════

// ── Realtime Connection Status ──
function useRealtimeStatus(supabaseUrl: string, supabaseAnonKey: string) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) return;
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

// ── Realtime Permission Invalidation ──
function usePlatformAdminRealtime(supabaseUrl: string, supabaseAnonKey: string, userId: string) {
  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    const client = createBrowserClient(supabaseUrl, supabaseAnonKey);

    const channel = client
      .channel("platform-admin-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_admins", filter: `user_id=eq.${userId}` },
        () => {
          window.location.reload();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [supabaseUrl, supabaseAnonKey, userId]);
}

// ── Client-Side Inactivity Monitor ──
const INACTIVITY_WARNING_MS = 25 * 60 * 1000; // 25 minutes → show warning
const INACTIVITY_LOGOUT_MS = 30 * 60 * 1000;  // 30 minutes → redirect

function useAdminInactivityMonitor() {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);

    // Clear existing timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Set warning timer (25 min)
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingSeconds(300); // 5 min countdown

      // Start countdown
      countdownRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
    }, INACTIVITY_WARNING_MS);

    // Set logout timer (30 min)
    logoutTimerRef.current = setTimeout(() => {
      const returnTo = encodeURIComponent(window.location.pathname);
      navigate(`/admin/reauth?returnTo=${returnTo}`);
    }, INACTIVITY_LOGOUT_MS);
  }, [navigate]);

  const dismissWarning = useCallback(() => {
    resetTimers(); // User interacted → reset everything
  }, [resetTimers]);

  useEffect(() => {
    // Events that count as "activity"
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];

    const handleActivity = () => {
      // Only reset if we're NOT in warning mode
      // (during warning, only the "Continue" button resets)
      if (!showWarning) {
        resetTimers();
      }
    };

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    resetTimers(); // Initialize

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [resetTimers, showWarning]);

  return { showWarning, remainingSeconds, dismissWarning };
}

// ═══════════════════════════════════════════════════════════════
// ██ INACTIVITY WARNING MODAL
// ═══════════════════════════════════════════════════════════════
function InactivityWarningModal({
  remainingSeconds,
  onDismiss,
}: {
  remainingSeconds: number;
  onDismiss: () => void;
}) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div
        className="relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl"
        style={{
          backgroundColor: "#0F0F19",
          borderColor: "rgba(245,158,11,0.3)",
        }}
      >
        <button onClick={onDismiss} className="absolute right-4 top-4" style={{ color: "#64748B" }}>
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(245,158,11,0.1)" }}
          >
            <Clock size={24} style={{ color: "#F59E0B" }} />
          </div>

          <h2 className="mb-1 text-lg font-bold" style={{ color: "#F8FAFC" }}>
            Sesión por expirar
          </h2>
          <p className="mb-4 text-sm" style={{ color: "#94A3B8" }}>
            Tu sesión de administrador se cerrará automáticamente por inactividad.
          </p>

          {/* Countdown */}
          <div
            className="mb-5 flex items-center gap-2 rounded-xl px-5 py-3"
            style={{
              backgroundColor: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}
          >
            <Lock size={14} style={{ color: "#F59E0B" }} />
            <span className="font-mono text-2xl font-bold tabular-nums" style={{ color: "#FBBF24" }}>
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
          </div>

          {/* Action */}
          <button
            onClick={onDismiss}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6D28D9)",
              boxShadow: "0 4px 14px rgba(124,58,237,0.3)",
            }}
          >
            Continuar Trabajando
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ██ LAYOUT COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function AdminLayout() {
  const data = useLoaderData<typeof loader>();
  const isRealtimeConnected = useRealtimeStatus(data.supabaseUrl, data.supabaseAnonKey);
  const { showWarning, remainingSeconds, dismissWarning } = useAdminInactivityMonitor();

  // Listen for permission changes in real-time
  usePlatformAdminRealtime(data.supabaseUrl, data.supabaseAnonKey, data.user.id);

  const layoutCtx: AdminLayoutContext = {
    user: data.user,
    adminCtx: data.adminCtx as PlatformAdminContext,
    stats: data.stats,
    supabaseUrl: data.supabaseUrl,
    supabaseAnonKey: data.supabaseAnonKey,
  };

  return (
    <AdminCtx.Provider value={layoutCtx}>
      <div className="flex h-screen overflow-hidden bg-bg-primary">
        {/* ═══ Sidebar ═══ */}
        <AdminSidebar
          user={data.user}
          isRealtimeConnected={isRealtimeConnected}
          adminCtx={data.adminCtx as PlatformAdminContext}
          stats={{
            orgs: data.stats.orgs,
            users: data.stats.users,
            audit24h: data.stats.audit24h,
          }}
        />

        {/* ═══ Main Content ═══ */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-[1400px] px-6 py-6">
            <Outlet context={layoutCtx} />
          </div>
        </main>
      </div>

      {/* ═══ Inactivity Warning Modal ═══ */}
      {showWarning && (
        <InactivityWarningModal
          remainingSeconds={remainingSeconds}
          onDismiss={dismissWarning}
        />
      )}
    </AdminCtx.Provider>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  return <RouteErrorBoundary error={error} moduleName="Panel Admin" />;
}
