"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Shield,
  Warehouse,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Module-specific accent colors
const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    color: "#06B6D4", // cyan
    bgActive: "rgba(6,182,212,0.08)",
    borderActive: "rgba(6,182,212,0.3)",
  },
  {
    label: "Usuarios",
    href: "/usuarios",
    icon: Users,
    color: "#F59E0B", // amber
    bgActive: "rgba(245,158,11,0.08)",
    borderActive: "rgba(245,158,11,0.3)",
  },
  {
    label: "Administración",
    href: "/administracion",
    icon: Shield,
    color: "#F43F5E", // rose
    bgActive: "rgba(244,63,94,0.08)",
    borderActive: "rgba(244,63,94,0.3)",
  },
  {
    label: "Almacenes",
    href: "/almacenes",
    icon: Warehouse,
    color: "#10B981", // emerald
    bgActive: "rgba(16,185,129,0.08)",
    borderActive: "rgba(16,185,129,0.3)",
  },
  {
    label: "Grixi AI",
    href: "/ai",
    icon: Sparkles,
    color: "#8B5CF6", // violet
    bgActive: "rgba(139,92,246,0.08)",
    borderActive: "rgba(139,92,246,0.3)",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 56 : 220 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-screen flex-col border-r border-[var(--border)] bg-[var(--bg-surface)]"
    >
      {/* Logo — compact */}
      <div className="flex h-12 items-center gap-2.5 border-b border-[var(--border)] px-3">
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <Image
            src="/brand/icon.png"
            alt="Grixi"
            width={24}
            height={24}
            className="h-6 w-6 shrink-0"
          />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap text-sm font-semibold text-[var(--text-primary)]"
              >
                Grixi
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navigation — compact with module colors */}
      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)]/60 hover:text-[var(--text-secondary)]"
              )}
              style={
                isActive
                  ? {
                      backgroundColor: item.bgActive,
                      border: `1px solid ${item.borderActive}`,
                    }
                  : { border: "1px solid transparent" }
              }
            >
              {/* Active indicator bar */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute -left-2 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: item.color }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}

              <item.icon
                size={16}
                className="shrink-0 transition-colors"
                style={{ color: isActive ? item.color : undefined }}
              />
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
      </nav>

      {/* Bottom section — compact */}
      <div className="border-t border-[var(--border)] px-2 py-2">
        {/* Settings */}
        <Link
          href="/dashboard"
          className="group mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-muted)] transition-all hover:bg-[var(--bg-muted)]/60 hover:text-[var(--text-secondary)]"
        >
          <Settings size={16} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Configuración
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* User card — minimal */}
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-[var(--border)]">
            <Image
              src="https://randomuser.me/api/portraits/women/20.jpg"
              alt="Admin"
              width={24}
              height={24}
              className="h-full w-full object-cover"
            />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 overflow-hidden"
              >
                <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">
                  Mariana Solís
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Link
                  href="/login"
                  className="rounded p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--error)]"
                >
                  <LogOut size={13} />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Collapse toggle — smaller */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-2.5 top-16 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] shadow-sm transition-all hover:bg-[var(--bg-muted)]"
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>
    </motion.aside>
  );
}
