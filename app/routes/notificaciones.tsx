import { useOutletContext } from "react-router";
import type { TenantContext } from "./authenticated";
import { useNotifications } from "~/lib/hooks/use-notifications";
import {
  Bell, Check, CheckCheck, Trash2, Filter, Inbox,
  Info, CheckCircle2, AlertTriangle, AlertCircle, Zap,
  DollarSign, Warehouse, ShoppingCart, Users, Truck, Sparkles,
  LayoutDashboard, Shield, Settings, ChevronLeft,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Notification } from "~/lib/hooks/use-notifications";

// ═══════════════════════════════════════════════════════════
// Notification Center — Página completa de notificaciones
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
  { key: "all", label: "Todas" },
  { key: "unread", label: "Sin leer" },
  { key: "finanzas", label: "Finanzas" },
  { key: "team", label: "Equipo" },
  { key: "system", label: "Sistema" },
  { key: "ai", label: "AI" },
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

  // Filter notifications
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
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      {/* Header */}
      <div className="enter-fade">
        <div className="flex items-center gap-3 mb-1">
          <Link to="/dashboard" className="rounded-lg p-1.5 text-text-muted hover:bg-muted hover:text-text-primary transition-colors md:hidden">
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

          {/* Actions */}
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/5"
              >
                <CheckCheck size={14} />
                <span className="hidden sm:inline">Leer todas</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={deleteAll}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/5"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Limpiar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="enter-fade stagger-1 flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 scrollbar-none">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              filter === tab.key
                ? "bg-brand text-white shadow-sm"
                : "text-text-muted hover:bg-muted hover:text-text-primary"
            }`}
          >
            {tab.label}
            {tab.key === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-[10px]">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification Groups */}
      {loading && notifications.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="enter-fade stagger-2 flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-20">
          <Inbox size={40} className="mb-3 text-text-muted opacity-30" />
          <p className="text-sm font-medium text-text-muted">
            {filter === "unread" ? "No hay notificaciones sin leer" : "No hay notificaciones"}
          </p>
          <p className="mt-1 text-xs text-text-muted/60">
            Las notificaciones de tus módulos aparecerán aquí
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label} className="enter-fade stagger-2">
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
                      className={`group relative flex gap-3 px-4 py-3.5 transition-colors ${
                        i < group.items.length - 1 ? "border-b border-border/50" : ""
                      } ${isUnread ? "bg-brand/[0.03]" : ""} hover:bg-muted/30`}
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
    </div>
  );
}
