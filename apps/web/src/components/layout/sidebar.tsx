"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Shield,
  Warehouse,
  Bot,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Usuarios",
    href: "/usuarios",
    icon: Users,
  },
  {
    label: "Administración",
    href: "/administracion",
    icon: Shield,
  },
  {
    label: "Almacenes",
    href: "/almacenes",
    icon: Warehouse,
  },
  {
    label: "Asistente IA",
    href: "/asistente",
    icon: Bot,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 flex flex-col transition-all duration-300 z-30",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
      style={{
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      {/* Logo */}
      <div
        className={cn(
          "h-16 flex items-center px-5 shrink-0",
          collapsed ? "justify-center" : "gap-3"
        )}
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <div className="w-8 h-8 rounded-lg bg-[var(--color-brand)] flex items-center justify-center text-white font-bold text-sm shrink-0">
          G
        </div>
        {!collapsed && (
          <span
            className="text-lg font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Grixi
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                collapsed && "justify-center px-0",
                isActive
                  ? "text-white"
                  : "hover:opacity-80"
              )}
              style={{
                background: isActive ? "var(--color-brand)" : "transparent",
                color: isActive ? "#FFFFFF" : "var(--text-secondary)",
              }}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 shrink-0" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 hover:opacity-80",
            collapsed && "justify-center px-0"
          )}
          style={{ color: "var(--text-tertiary)" }}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span>Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}
