import { useOutletContext } from "react-router";
import { RouteErrorBoundary } from "~/components/route-error-boundary";
import type { TenantContext } from "./authenticated";

export const meta = () => [{ title: "Notificaciones — GRIXI" }];
export const handle = { breadcrumb: "Notificaciones" };
import { useNotifications } from "~/lib/hooks/use-notifications";
import {
  Bell, Check, CheckCheck, Trash2, Inbox, BellOff, BellRing,
  Info, CheckCircle2, AlertTriangle, AlertCircle, Zap,
  DollarSign, Warehouse, ShoppingCart, Users, Truck, Sparkles,
  LayoutDashboard, Shield, Settings, ChevronLeft, ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Notification } from "~/lib/hooks/use-notifications";

// ═══════════════════════════════════════════════════════════
// Notification Center — Centro de notificaciones premium
// Ruta: /notificaciones
// ═══════════════════════════════════════════════════════════

const TYPE_CONFIG: Record<string, { label: string; color: string; Icon: typeof Info }> = {
  info: { label: "Información", color: "#3B82F6", Icon: Info },
  success: { label: "Éxito", color: "#10B981", Icon: CheckCircle2 },
  warning: { label: "Advertencia", color: "#F59E0B", Icon: AlertTriangle },
  error: { label: "Error", color: "#EF4444", Icon: AlertCircle },
  action: { label: "Acción", color: "#8B5CF6", Icon: Zap },
};

const MODULE_CONFIG: Record<string, { label: string; Icon: typeof Info; color: string }> = {
  system: { label: "Sistema", Icon: Settings, color: "#71717A" },
  dashboard: { label: "Dashboard", Icon: LayoutDashboard, color: "#6366F1" },
  finanzas: { label: "Finanzas", Icon: DollarSign, color: "#6366F1" },
  almacenes: { label: "Almacenes", Icon: Warehouse, color: "#10B981" },
  compras: { label: "Compras", Icon: ShoppingCart, color: "#F59E0B" },
  rrhh: { label: "RRHH", Icon: Users, color: "#EC4899" },
  flota: { label: "Flota", Icon: Truck, color: "#06B6D4" },
  ai: { label: "GRIXI AI", Icon: Sparkles, color: "#8B5CF6" },
  audit: { label: "Auditoría", Icon: Shield, color: "#F97316" },
  team: { label: "Equipo", Icon: Users, color: "#3B82F6" },
  admin: { label: "Admin", Icon: Shield, color: "#EF4444" },
};

const FILTER_TABS = [
  { key: "all", label: "Todas", icon: Bell },
  { key: "unread", label: "Sin leer", icon: BellRing },
  { key: "finanzas", label: "Finanzas", icon: DollarSign },
  { key: "team", label: "Equipo", icon: Users },
  { key: "system", label: "Sistema", icon: Settings },
  { key: "ai", label: "AI", icon: Sparkles },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return "Justo ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export default function NotificacionesPage() {
  const ctx = useOutletContext<TenantContext>();
  const orgId = ctx.currentOrg?.id;
  const {
    notifications, unreadCount, loading,
    markAsRead, markAllRead, deleteNotification, deleteAll, isLive,
  } = useNotifications(orgId);

  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  // Filter
  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read_at;
    if (filter === "all") return true;
    return n.module === filter;
  });

  // Group by date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: Notification[] }[] = [];
  const todayItems = filtered.filter((n) => new Date(n.created_at) >= today);
  const yesterdayItems = filtered.filter((n) => {
    const d = new Date(n.created_at);
    return d >= yesterday && d < today;
  });
  const olderItems = filtered.filter((n) => new Date(n.created_at) < yesterday);

  if (todayItems.length > 0) groups.push({ label: "Hoy", items: todayItems });
  if (yesterdayItems.length > 0) groups.push({ label: "Ayer", items: yesterdayItems });
  if (olderItems.length > 0) groups.push({ label: "Anteriores", items: olderItems });

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-24">
      {/* ── Header ─────────────────────────────────── */}
      <div style={{ animation: "enterFade 0.4s ease-out" }}>
        <div className="mb-1 flex items-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted hover:text-text-primary md:hidden"
          >
            <ChevronLeft size={20} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-text-primary">Notificaciones</h1>
              {isLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted">
              {unreadCount > 0
                ? `${unreadCount} sin leer de ${notifications.length} total`
                : `${notifications.length} notificaciones`}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-brand transition-all hover:bg-brand/5 active:scale-95"
              >
                <CheckCheck size={14} />
                <span className="hidden sm:inline">Leer todas</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={deleteAll}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-red-500 transition-all hover:bg-red-500/5 active:scale-95"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Limpiar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Filter Tabs ────────────────────────────── */}
      <div
        className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1 scrollbar-none"
        style={{ animation: "enterFade 0.4s ease-out 0.05s both" }}
      >
        {FILTER_TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                isActive
                  ? "bg-brand text-white shadow-sm"
                  : "text-text-muted hover:bg-muted hover:text-text-primary"
              }`}
            >
              <TabIcon size={12} />
              {tab.label}
              {tab.key === "unread" && unreadCount > 0 && (
                <span className={`rounded-full px-1.5 text-[10px] font-bold ${isActive ? "bg-white/20" : "bg-red-500/10 text-red-500"}`}>
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ────────────────────────────────── */}
      {loading && notifications.length === 0 ? (
        /* Loading skeleton */
        <div className="space-y-3" style={{ animation: "enterFade 0.4s ease-out 0.1s both" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
              <div className="h-9 w-9 animate-pulse rounded-xl bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-3/4 animate-pulse rounded-lg bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded-lg bg-muted" />
                <div className="h-2.5 w-1/4 animate-pulse rounded-lg bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        /* Empty state premium */
        <div
          className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-20"
          style={{ animation: "enterFade 0.5s ease-out 0.1s both" }}
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
            {filter === "unread" ? (
              <BellOff size={28} className="text-text-muted opacity-40" />
            ) : (
              <Inbox size={28} className="text-text-muted opacity-40" />
            )}
          </div>
          <p className="text-sm font-semibold text-text-primary">
            {filter === "unread" ? "Todo al día" : "Sin notificaciones"}
          </p>
          <p className="mt-1 max-w-xs text-center text-xs text-text-muted">
            {filter === "unread"
              ? "No tienes notificaciones pendientes por leer. ¡Excelente!"
              : "Las notificaciones de tus módulos aparecerán aquí en tiempo real"}
          </p>
          {filter !== "all" && (
            <button
              onClick={() => setFilter("all")}
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-brand/5 px-4 py-2 text-xs font-medium text-brand transition-all hover:bg-brand/10"
            >
              <Bell size={13} />
              Ver todas las notificaciones
            </button>
          )}
        </div>
      ) : (
        /* Grouped notification list */
        <div className="space-y-4">
          {groups.map((group, gi) => (
            <div key={group.label} style={{ animation: `enterFade 0.4s ease-out ${0.1 + gi * 0.05}s both` }}>
              <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {group.label}
              </h3>
              <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                {group.items.map((notif, i) => {
                  const typeConfig = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
                  const modConfig = MODULE_CONFIG[notif.module] || MODULE_CONFIG.system;
                  const isUnread = !notif.read_at;
                  const ModIcon = modConfig.Icon;

                  return (
                    <div
                      key={notif.id}
                      className={`group relative flex gap-3 px-4 py-3.5 transition-all ${
                        i < group.items.length - 1 ? "border-b border-border/50" : ""
                      } ${isUnread ? "bg-brand/3" : ""} hover:bg-muted/30`}
                    >
                      {/* Unread indicator */}
                      {isUnread && (
                        <div className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-brand" />
                      )}

                      {/* Module icon */}
                      <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: `color-mix(in oklch, ${modConfig.color} 10%, transparent)` }}
                      >
                        <ModIcon size={16} style={{ color: modConfig.color }} strokeWidth={1.8} />
                      </div>

                      {/* Content */}
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => {
                          if (isUnread) markAsRead(notif.id);
                          if (notif.action_url) navigate(notif.action_url);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-snug ${isUnread ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                            {notif.title}
                          </p>
                          <span
                            className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                            style={{
                              background: `color-mix(in oklch, ${typeConfig.color} 10%, transparent)`,
                              color: typeConfig.color,
                            }}
                          >
                            {modConfig.label}
                          </span>
                        </div>

                        {notif.body && (
                          <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                            {notif.body}
                          </p>
                        )}

                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-text-muted">
                          <span>{formatDate(notif.created_at)}</span>
                          {notif.actor_name && (
                            <>
                              <span>·</span>
                              <span>{notif.actor_name}</span>
                            </>
                          )}
                          {notif.action_url && (
                            <ExternalLink size={9} className="opacity-40" />
                          )}
                        </div>
                      </div>

                      {/* Hover Actions */}
                      <div className="flex shrink-0 flex-col items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {isUnread && (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-brand/10 hover:text-brand"
                            title="Marcar como leída"
                          >
                            <Check size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notif.id)}
                          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Animation keyframes */}
      <style>{`
        @keyframes enterFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  return <RouteErrorBoundary error={error} moduleName="Notificaciones" />;
}
