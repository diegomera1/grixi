import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bell, Check, CheckCheck, Trash2, X, ExternalLink,
  Info, CheckCircle2, AlertTriangle, AlertCircle, Zap,
  DollarSign, Warehouse, ShoppingCart, Users, Truck, Sparkles,
  LayoutDashboard, Shield, Settings, Bot,
} from "lucide-react";
import type { Notification } from "~/lib/hooks/use-notifications";

// ═══════════════════════════════════════════════════════════
// NotificationBell — Campana con dropdown de notificaciones
// ═══════════════════════════════════════════════════════════

const TYPE_CONFIG: Record<string, { color: string; Icon: typeof Info }> = {
  info: { color: "#3B82F6", Icon: Info },
  success: { color: "#10B981", Icon: CheckCircle2 },
  warning: { color: "#F59E0B", Icon: AlertTriangle },
  error: { color: "#EF4444", Icon: AlertCircle },
  action: { color: "#8B5CF6", Icon: Zap },
};

const MODULE_ICONS: Record<string, typeof Info> = {
  system: Settings,
  dashboard: LayoutDashboard,
  finanzas: DollarSign,
  almacenes: Warehouse,
  compras: ShoppingCart,
  rrhh: Users,
  flota: Truck,
  ai: Sparkles,
  audit: Shield,
  team: Users,
  admin: Shield,
};

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}sem`;
}

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  loading,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const displayNotifs = notifications.slice(0, 8);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-xl p-2 text-text-muted transition-all hover:bg-muted hover:text-text-primary active:scale-95"
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
        title="Notificaciones"
      >
        <Bell size={18} strokeWidth={1.8} />
        
        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl sm:w-96"
          style={{ animation: "fadeIn 0.15s ease-out" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">Notificaciones</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => { onMarkAllRead(); }}
                  className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted hover:text-text-primary"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted hover:text-text-primary"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto overscroll-contain">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              </div>
            ) : displayNotifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                <Bell size={28} className="mb-2 opacity-30" />
                <p className="text-xs">Sin notificaciones</p>
              </div>
            ) : (
              displayNotifs.map((notif) => {
                const typeConfig = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
                const ModuleIcon = MODULE_ICONS[notif.module] || Bell;
                const isUnread = !notif.read_at;

                return (
                  <div
                    key={notif.id}
                    className={`group relative flex gap-3 border-b border-border/50 px-4 py-3 transition-colors last:border-0 ${
                      isUnread ? "bg-brand/[0.03]" : ""
                    } hover:bg-muted/50`}
                  >
                    {/* Unread dot */}
                    {isUnread && (
                      <div className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand" />
                    )}

                    {/* Icon */}
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `color-mix(in oklch, ${typeConfig.color} 12%, transparent)` }}
                    >
                      <ModuleIcon size={14} style={{ color: typeConfig.color }} strokeWidth={2} />
                    </div>

                    {/* Content */}
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => {
                        if (isUnread) onMarkRead(notif.id);
                        if (notif.action_url) {
                          navigate(notif.action_url);
                          setOpen(false);
                        }
                      }}
                    >
                      <p className={`text-xs leading-snug ${isUnread ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                        {notif.title}
                      </p>
                      {notif.body && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-text-muted">
                          {notif.body}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-text-muted">
                          {formatTimeAgo(notif.created_at)}
                        </span>
                        {notif.actor_name && (
                          <span className="text-[10px] text-text-muted">
                            · {notif.actor_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-col items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {isUnread && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onMarkRead(notif.id); }}
                          className="rounded-md p-1 text-text-muted hover:bg-muted hover:text-brand"
                          title="Marcar como leída"
                        >
                          <Check size={12} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
                        className="rounded-md p-1 text-text-muted hover:bg-red-500/10 hover:text-red-500"
                        title="Eliminar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border px-4 py-2.5">
              <Link
                to="/notificaciones"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/5"
              >
                Ver todas las notificaciones
                <ExternalLink size={11} />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
