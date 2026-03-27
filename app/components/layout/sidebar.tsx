import { Link, useLocation } from "react-router";
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
} from "lucide-react";
import { useState, createContext, useContext } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={20} /> },
  { label: "Almacenes", href: "/almacenes", icon: <Warehouse size={20} /> },
  { label: "Compras", href: "/compras", icon: <ShoppingCart size={20} /> },
  { label: "Finanzas", href: "/finanzas", icon: <DollarSign size={20} /> },
  { label: "RRHH", href: "/rrhh", icon: <Users size={20} /> },
  { label: "Flota", href: "/flota", icon: <Truck size={20} /> },
  { label: "GRIXI AI", href: "/ai", icon: <Bot size={20} /> },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: "Admin", href: "/admin", icon: <Shield size={20} />, adminOnly: true },
  { label: "Organizaciones", href: "/admin/organizations", icon: <Building2 size={20} />, adminOnly: true },
  { label: "Usuarios", href: "/admin/users", icon: <UserCog size={20} />, adminOnly: true },
];

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

export function Sidebar({ isPlatformAdmin }: { isPlatformAdmin: boolean }) {
  const location = useLocation();
  const { collapsed, setCollapsed } = useSidebar();

  const isActive = (href: string) => {
    if (href === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(href);
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-30 flex h-screen flex-col border-r transition-all duration-300 ease-out ${collapsed ? "w-[68px]" : "w-[240px]"}`}
      style={{ backgroundColor: "#0d0b1a", borderColor: "var(--border)" }}
    >
      {/* Logo */}
      <div
        className="flex h-16 items-center gap-3 px-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <img
          src="/grixi-logo.png"
          alt="GRIXI"
          className={`${collapsed ? "h-7" : "h-8"} w-auto transition-all`}
          draggable={false}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
        ))}

        {isPlatformAdmin && (
          <>
            <div className="my-4 mx-2 border-t" style={{ borderColor: "var(--border)" }} />
            {!collapsed && (
              <div className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
                Plataforma
              </div>
            )}
            {ADMIN_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t px-3 py-3" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 transition-colors hover:bg-white/5"
          style={{ color: "var(--muted-foreground)" }}
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      to={item.href}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
        ${active ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:bg-white/5 hover:text-white/80"}
        ${collapsed ? "justify-center px-2" : ""}
      `}
      title={collapsed ? item.label : undefined}
    >
      <span className={`shrink-0 ${active ? "text-purple-400" : "text-white/40 group-hover:text-white/60"}`}>
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
