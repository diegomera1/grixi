import {
  DollarSign,
  Warehouse,
  ShoppingCart,
  Users,
  Truck,
  Sparkles,
  BarChart3,
  Bell,
  ArrowRight,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";

interface QuickAccessProps {
  enabledModules: string[];
  t: (key: string) => string;
}

interface ModuleDef {
  key: string;
  icon: LucideIcon;
  color: string;
  route: string | null;
}

const ALL_MODULES: ModuleDef[] = [
  { key: "finanzas", icon: DollarSign, color: "#6366F1", route: "/finanzas" },
  { key: "almacenes", icon: Warehouse, color: "#10B981", route: null },
  { key: "compras", icon: ShoppingCart, color: "#F59E0B", route: null },
  { key: "rrhh", icon: Users, color: "#EC4899", route: null },
  { key: "flota", icon: Truck, color: "#06B6D4", route: null },
  { key: "ai", icon: Sparkles, color: "#8B5CF6", route: null },
  { key: "reportes", icon: BarChart3, color: "#3B82F6", route: null },
  { key: "notificaciones", icon: Bell, color: "#EF4444", route: "/notificaciones" },
];

const NAV_KEYS: Record<string, string> = {
  finanzas: "nav.finanzas",
  almacenes: "nav.almacenes",
  compras: "nav.compras",
  rrhh: "nav.rrhh",
  flota: "nav.flota",
  ai: "nav.ai",
  reportes: "Reportes",
  notificaciones: "Notificaciones",
};

export function QuickAccess({ enabledModules, t }: QuickAccessProps) {
  const modules = ALL_MODULES.filter((m) => enabledModules.includes(m.key));

  return (
    <div className="enter-fade stagger-8 rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("dash.quick.title")}
        </h3>
        <span className="text-[10px] text-text-muted">
          {modules.filter(m => m.route).length} activos
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const isActive = mod.route !== null;
          const label = NAV_KEYS[mod.key] ? t(NAV_KEYS[mod.key]) || mod.key : mod.key;

          const inner = (
            <div
              className={`group relative flex items-center gap-3 rounded-xl border p-3.5 transition-all duration-300 ${
                isActive
                  ? "border-border cursor-pointer hover:border-border-hover hover:shadow-md"
                  : "border-dashed border-border/50 cursor-default"
              }`}
              style={isActive ? {
                background: `linear-gradient(135deg, var(--bg-surface), color-mix(in oklch, ${mod.color} 4%, var(--bg-surface)))`,
              } : undefined}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                  isActive ? "group-hover:scale-110 group-hover:shadow-lg" : ""
                }`}
                style={{
                  background: `color-mix(in oklch, ${mod.color} ${isActive ? "12" : "6"}%, transparent)`,
                }}
              >
                <Icon
                  size={18}
                  style={{ color: isActive ? mod.color : "var(--text-muted)" }}
                  strokeWidth={1.8}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium truncate capitalize ${
                  isActive ? "text-text-primary" : "text-text-muted"
                }`}>
                  {label}
                </p>
                <p className="text-[10px] text-text-muted">
                  {isActive ? t("dash.modules.active") : t("dash.modules.coming")}
                </p>
              </div>
              {isActive && (
                <ArrowRight
                  size={14}
                  className="shrink-0 text-text-muted transition-all duration-300 group-hover:translate-x-1 group-hover:text-text-secondary"
                />
              )}
              {!isActive && (
                <Lock size={12} className="shrink-0 text-text-muted/40" />
              )}
            </div>
          );

          return isActive && mod.route ? (
            <Link key={mod.key} to={mod.route} prefetch="intent">
              {inner}
            </Link>
          ) : (
            <div key={mod.key}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
