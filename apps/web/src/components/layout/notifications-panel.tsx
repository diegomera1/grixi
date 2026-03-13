"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bell,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShoppingCart,
  Warehouse,
  DollarSign,
  Users,
  TrendingUp,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ─── Demo notification data ─────────────────────────────

type DemoNotification = {
  id: string;
  title: string;
  message: string;
  module: string;
  moduleColor: string;
  icon: typeof Package;
  priority: "high" | "medium" | "low";
  timeAgo: string;
  read: boolean;
};

const DEMO_NOTIFICATIONS: DemoNotification[] = [
  {
    id: "n1",
    title: "Stock bajo detectado",
    message: "Perfil Aluminio 6063 tiene solo 12 unidades en Rack A-02. Mínimo requerido: 50.",
    module: "Almacenes",
    moduleColor: "#10B981",
    icon: AlertTriangle,
    priority: "high",
    timeAgo: "hace 5 min",
    read: false,
  },
  {
    id: "n2",
    title: "Orden de compra aprobada",
    message: "OC-2026-0847 por $12,450.00 aprobada por Gerencia General.",
    module: "Compras",
    moduleColor: "#F59E0B",
    icon: ShoppingCart,
    priority: "medium",
    timeAgo: "hace 23 min",
    read: false,
  },
  {
    id: "n3",
    title: "Factura vencida",
    message: "Factura FAC-001-8834 de Proveedor ACME S.A. venció hace 3 días. Monto: $8,920.00",
    module: "Finanzas",
    moduleColor: "#3B82F6",
    icon: DollarSign,
    priority: "high",
    timeAgo: "hace 1h",
    read: false,
  },
  {
    id: "n4",
    title: "Nuevo empleado registrado",
    message: "María Fernanda López se unió al departamento de Producción.",
    module: "Usuarios",
    moduleColor: "#7C3AED",
    icon: Users,
    priority: "low",
    timeAgo: "hace 2h",
    read: true,
  },
  {
    id: "n5",
    title: "Lote próximo a vencer",
    message: "LOT-20251108-710 de Motor Eléctrico 5HP vence en 15 días. 84 unidades afectadas.",
    module: "Almacenes",
    moduleColor: "#10B981",
    icon: Clock,
    priority: "medium",
    timeAgo: "hace 3h",
    read: true,
  },
  {
    id: "n6",
    title: "Meta de ventas alcanzada",
    message: "Se alcanzó el 105% de la meta mensual de ventas. Ingresos: $245,800.00",
    module: "Finanzas",
    moduleColor: "#3B82F6",
    icon: TrendingUp,
    priority: "low",
    timeAgo: "hace 5h",
    read: true,
  },
  {
    id: "n7",
    title: "Auditoría de seguridad completada",
    message: "Revisión trimestral completada exitosamente. 0 vulnerabilidades críticas encontradas.",
    module: "Sistema",
    moduleColor: "#6B7280",
    icon: Shield,
    priority: "low",
    timeAgo: "hace 8h",
    read: true,
  },
  {
    id: "n8",
    title: "Transferencia de inventario",
    message: "150 unidades de Cable AWG 12 transferidas de Bodega Principal a Bodega Cross-Dock.",
    module: "Almacenes",
    moduleColor: "#10B981",
    icon: Warehouse,
    priority: "medium",
    timeAgo: "hace 12h",
    read: true,
  },
  {
    id: "n9",
    title: "Orden de compra recibida",
    message: "Despacho de OC-2026-0839 confirmado. 23 artículos ingresados al almacén.",
    module: "Compras",
    moduleColor: "#F59E0B",
    icon: CheckCircle2,
    priority: "low",
    timeAgo: "ayer",
    read: true,
  },
];

const priorityStyles = {
  high: { bg: "bg-red-500/10", dot: "bg-red-500", border: "border-red-500/20" },
  medium: { bg: "bg-amber-500/10", dot: "bg-amber-500", border: "border-amber-500/20" },
  low: { bg: "bg-[var(--bg-muted)]", dot: "bg-[var(--text-muted)]", border: "border-transparent" },
};

// ─── Notifications Panel Component ──────────────────────

type NotificationsPanelProps = {
  open: boolean;
  onClose: () => void;
};

export function NotificationsPanel({ open, onClose }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState(DEMO_NOTIFICATIONS);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />

          {/* Panel — bottom sheet on mobile */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] overflow-hidden rounded-t-[26px] bg-[var(--bg-surface)] shadow-[0_-10px_50px_rgba(0,0,0,0.25)] md:hidden"
            style={{ paddingBottom: "var(--safe-bottom, 0px)" }}
          >
            {/* Pull handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-[4px] w-9 rounded-full bg-[var(--text-muted)]/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand)]/10">
                  <Bell size={16} className="text-[var(--brand)]" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                    Notificaciones
                  </h3>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {unreadCount} sin leer
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-medium text-[var(--brand)] active:opacity-70"
                  >
                    Marcar todo
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)] active:scale-90"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-1 px-5 pb-3">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                    filter === f
                      ? "bg-[var(--brand)] text-white"
                      : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                  )}
                >
                  {f === "all" ? "Todas" : `Sin leer (${unreadCount})`}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="overflow-y-auto px-5 pb-4" style={{ maxHeight: "calc(85vh - 160px)" }}>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <CheckCircle2 size={32} className="text-[var(--success)]" />
                  <p className="text-sm font-medium text-[var(--text-primary)]">¡Todo al día!</p>
                  <p className="text-xs text-[var(--text-muted)]">No tienes notificaciones sin leer.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((notif, i) => {
                    const pStyle = priorityStyles[notif.priority];
                    return (
                      <motion.button
                        key={notif.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => markAsRead(notif.id)}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition-all active:scale-[0.98]",
                          notif.read
                            ? "border-transparent bg-[var(--bg-muted)]/30"
                            : `${pStyle.bg} ${pStyle.border}`
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Icon */}
                          <div
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${notif.moduleColor}15` }}
                          >
                            <notif.icon size={15} style={{ color: notif.moduleColor }} />
                          </div>
                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                "text-[12px] truncate",
                                notif.read
                                  ? "font-medium text-[var(--text-secondary)]"
                                  : "font-semibold text-[var(--text-primary)]"
                              )}>
                                {notif.title}
                              </p>
                              {!notif.read && (
                                <div className={`h-2 w-2 shrink-0 rounded-full ${pStyle.dot}`} />
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)] line-clamp-2">
                              {notif.message}
                            </p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span
                                className="rounded-full px-1.5 py-px text-[8px] font-bold"
                                style={{
                                  backgroundColor: `${notif.moduleColor}15`,
                                  color: notif.moduleColor,
                                }}
                              >
                                {notif.module}
                              </span>
                              <span className="text-[9px] text-[var(--text-muted)]">{notif.timeAgo}</span>
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
