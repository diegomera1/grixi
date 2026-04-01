import { useLocation, Link } from "react-router";
import { LayoutDashboard, DollarSign, Sparkles, Settings, User } from "lucide-react";

interface TabItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: (pathname: string) => boolean;
}

const TABS: TabItem[] = [
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    match: (p) => p === "/dashboard",
  },
  {
    path: "/finanzas",
    label: "Finanzas",
    icon: DollarSign,
    match: (p) => p.startsWith("/finanzas"),
  },
  {
    path: "/ai",
    label: "GRIXI AI",
    icon: Sparkles,
    match: (p) => p === "/ai",
  },
  {
    path: "/configuracion",
    label: "Config",
    icon: Settings,
    match: (p) => p.startsWith("/configuracion"),
  },
];

export function BottomTabBar() {
  const location = useLocation();

  return (
    <nav
      className="bottom-tab-bar fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl md:hidden"
      style={{
        background: "rgba(var(--bg-surface-rgb, 17, 17, 19), 0.92)",
        borderColor: "var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      role="navigation"
      aria-label="Navegación principal"
    >
      <div className="flex h-16 items-stretch">
        {TABS.map((tab) => {
          const isActive = tab.match(location.pathname);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors active:scale-95"
              aria-current={isActive ? "page" : undefined}
              style={{
                color: isActive ? "var(--brand)" : "var(--text-muted)",
              }}
              onClick={() => {
                // Haptic feedback
                try { navigator.vibrate?.(10); } catch { /* noop */ }
              }}
            >
              {/* Active indicator bar */}
              <div
                className="absolute top-0 h-0.5 w-8 rounded-b-full transition-all duration-300"
                style={{
                  backgroundColor: isActive ? "var(--brand)" : "transparent",
                  transform: isActive ? "scaleX(1)" : "scaleX(0)",
                }}
              />

              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 1.8}
                className="transition-all duration-200"
                style={{
                  transform: isActive ? "scale(1.1)" : "scale(1)",
                }}
              />
              <span
                className="text-[10px] font-medium leading-none transition-all duration-200"
                style={{
                  opacity: isActive ? 1 : 0.7,
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
