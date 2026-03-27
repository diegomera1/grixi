import { Link, useLocation } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Warehouse,
  ShoppingCart,
  DollarSign,
  Users,
  Truck,
  Bot,
  Shield,
  Building2,
  UserCog,
  ChevronLeft,
  ChevronRight,
  History,
  CreditCard,
  Search,
  Bell,
} from "lucide-react";
import { useState, createContext, useContext } from "react";

/* ─── Types ─────────────────────────────────────────── */

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  color: string;
  glowColor: string;
  moduleKey?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
};

/* ─── Navigation Config ─────────────────────────────── */

const NAV_GROUPS: NavGroup[] = [
  {
    label: "PRINCIPAL",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, color: "#06B6D4", glowColor: "rgba(6,182,212,0.25)" },
    ],
  },
  {
    label: "OPERACIONES",
    items: [
      { label: "Almacenes", href: "/almacenes", icon: Warehouse, color: "#10B981", glowColor: "rgba(16,185,129,0.25)", moduleKey: "almacenes" },
      { label: "Compras", href: "/compras", icon: ShoppingCart, color: "#F59E0B", glowColor: "rgba(245,158,11,0.25)", moduleKey: "compras" },
      { label: "Finanzas", href: "/finanzas", icon: DollarSign, color: "#8B5CF6", glowColor: "rgba(139,92,246,0.25)", moduleKey: "finanzas" },
      { label: "Flota", href: "/flota", icon: Truck, color: "#0EA5E9", glowColor: "rgba(14,165,233,0.25)", moduleKey: "flota" },
    ],
  },
  {
    label: "EQUIPO",
    items: [
      { label: "Recursos Humanos", href: "/rrhh", icon: Users, color: "#06B6D4", glowColor: "rgba(6,182,212,0.25)", moduleKey: "rrhh" },
      { label: "GRIXI AI", href: "/ai", icon: Bot, color: "#8B5CF6", glowColor: "rgba(139,92,246,0.25)", moduleKey: "ai" },
    ],
  },
];

const ADMIN_GROUP: NavGroup = {
  label: "PLATAFORMA",
  adminOnly: true,
  items: [
    { label: "Admin", href: "/admin", icon: Shield, color: "#F43F5E", glowColor: "rgba(244,63,94,0.25)" },
    { label: "Organizaciones", href: "/admin/organizations", icon: Building2, color: "#6366F1", glowColor: "rgba(99,102,241,0.25)" },
    { label: "Usuarios", href: "/admin/users", icon: UserCog, color: "#F59E0B", glowColor: "rgba(245,158,11,0.25)" },
    { label: "Billing", href: "/admin/billing", icon: CreditCard, color: "#10B981", glowColor: "rgba(16,185,129,0.25)" },
    { label: "Audit Log", href: "/admin/audit", icon: History, color: "#8B5CF6", glowColor: "rgba(139,92,246,0.25)" },
  ],
};

/* ─── Context ────────────────────────────────────────── */

const SidebarContext = createContext<{
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}>({ collapsed: false, setCollapsed: () => {} });

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

/* ─── Sidebar Component ──────────────────────────────── */

interface SidebarProps {
  isPlatformAdmin: boolean;
  enabledModules?: Record<string, boolean>;
}

export function Sidebar({ isPlatformAdmin, enabledModules }: SidebarProps) {
  const location = useLocation();
  const { collapsed, setCollapsed } = useSidebar();

  const isActive = (href: string) => {
    if (href === "/admin") return location.pathname === "/admin";
    if (href === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(href);
  };

  // Filter modules by org settings
  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (!item.moduleKey) return true;
      if (!enabledModules) return true;
      return enabledModules[item.moduleKey] !== false;
    });

  const groups = isPlatformAdmin ? [...NAV_GROUPS, ADMIN_GROUP] : NAV_GROUPS;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 230 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative m-2 hidden md:flex h-[calc(100vh-16px)] flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg z-30"
    >
      {/* ── Logo / Brand ──────────────────────── */}
      <div className="flex h-14 items-center gap-2.5 border-b border-[var(--border)] px-3.5">
        <Link to="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-lg bg-[var(--brand)] opacity-10 blur-md" />
            <img
              src="/grixi-logo.png"
              alt="GRIXI"
              className="relative h-7 w-7 rounded-lg"
              draggable={false}
            />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <span className="whitespace-nowrap font-display text-base font-semibold italic text-[var(--text-primary)]">
                  GRIXI
                </span>
                <p className="text-[9px] font-medium text-[var(--text-muted)]">
                  Enterprise Platform
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* ── Navigation Groups ────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-hide">
        {groups.map((group, gi) => {
          const items = filterItems(group.items);
          if (items.length === 0) return null;

          return (
            <div key={group.label} className={gi > 0 ? "mt-4" : undefined}>
              {/* Category label */}
              <AnimatePresence>
                {!collapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mb-1.5 px-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]"
                  >
                    {group.label}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-all duration-200 ${
                        active
                          ? "text-[var(--text-primary)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      } ${collapsed ? "justify-center" : ""}`}
                      style={
                        active
                          ? {
                              backgroundColor: `${item.color}10`,
                              boxShadow: `inset 0 0 0 1px ${item.color}25`,
                            }
                          : undefined
                      }
                      title={collapsed ? item.label : undefined}
                    >
                      {/* Active indicator bar */}
                      {active && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
                          style={{ backgroundColor: item.color }}
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}

                      {/* Icon with hover glow */}
                      <div className="relative shrink-0">
                        <div
                          className="absolute inset-0 rounded-md opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"
                          style={{ backgroundColor: item.glowColor }}
                        />
                        <Icon
                          size={16}
                          className="relative transition-all duration-200 group-hover:rotate-3"
                          style={{ color: active ? item.color : undefined }}
                        />
                      </div>

                      {/* Label with animation */}
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden whitespace-nowrap"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Bottom Actions ────────────────────── */}
      <div className="border-t border-[var(--border)] px-2 py-2">
        <div className={`flex items-center ${collapsed ? "flex-col gap-1" : "gap-1"}`}>
          {/* Notifications */}
          <button
            className="relative rounded-lg p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
            title="Notificaciones"
          >
            <Bell size={14} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--error)]" />
          </button>
        </div>
      </div>

      {/* ── Collapse Toggle ─────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] shadow-md transition-all hover:bg-[var(--bg-muted)] hover:scale-110"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}
