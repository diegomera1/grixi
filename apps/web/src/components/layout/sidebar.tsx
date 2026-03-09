"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Shield,
  Warehouse,
  Sparkles,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { logLogoutEvent } from "@/lib/actions/audit";
import { useThemeTransition } from "@/lib/hooks/use-theme-transition";
import { UserPopover } from "./user-popover";
import type { User } from "@supabase/supabase-js";

// Navigation grouped by category
type NavGroup = {
  label: string;
  items: NavItem[];
};

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  color: string;
  glowColor: string;
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "PRINCIPAL",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        color: "#06B6D4",
        glowColor: "rgba(6,182,212,0.25)",
      },
    ],
  },
  {
    label: "OPERACIONES",
    items: [
      {
        label: "Finanzas",
        href: "/finanzas",
        icon: DollarSign,
        color: "#8B5CF6",
        glowColor: "rgba(139,92,246,0.25)",
      },
      {
        label: "Almacenes",
        href: "/almacenes",
        icon: Warehouse,
        color: "#10B981",
        glowColor: "rgba(16,185,129,0.25)",
      },
    ],
  },
  {
    label: "EQUIPO",
    items: [
      {
        label: "Usuarios",
        href: "/usuarios",
        icon: Users,
        color: "#F59E0B",
        glowColor: "rgba(245,158,11,0.25)",
      },
      {
        label: "Administración",
        href: "/administracion",
        icon: Shield,
        color: "#F43F5E",
        glowColor: "rgba(244,63,94,0.25)",
      },
    ],
  },
  {
    label: "INTELIGENCIA",
    items: [
      {
        label: "GRIXI AI",
        href: "/ai",
        icon: Sparkles,
        color: "#8B5CF6",
        glowColor: "rgba(139,92,246,0.25)",
      },
    ],
  },
];

// Emit ⌘K open event
function openCommandPalette() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const { theme, toggleTheme } = useThemeTransition();

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });
  }, []);

  const handleSignOut = async () => {
    await logLogoutEvent();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 230 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative m-2 flex h-[calc(100vh-16px)] flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg"
    >
      {/* ── Logo / Brand ──────────────────────── */}
      <div className="flex h-14 items-center gap-2.5 border-b border-[var(--border)] px-3.5">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          {/* Logo with glow */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-lg bg-[var(--brand)] opacity-10 blur-md" />
            <Image
              src="/brand/icon.png"
              alt="GRIXI"
              width={28}
              height={28}
              className="relative h-7 w-7"
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
                <span className="whitespace-nowrap font-serif text-base font-semibold italic text-[var(--text-primary)]">
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
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && "mt-4")}>
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
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-all duration-200",
                      isActive
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    )}
                    style={
                      isActive
                        ? {
                            backgroundColor: `${item.color}10`,
                            boxShadow: `inset 0 0 0 1px ${item.color}25`,
                          }
                        : undefined
                    }
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
                        style={{ backgroundColor: item.color }}
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 30,
                        }}
                      />
                    )}

                    {/* Icon with hover glow */}
                    <div className="relative shrink-0">
                      <div
                        className="absolute inset-0 rounded-md opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"
                        style={{ backgroundColor: item.glowColor }}
                      />
                      <item.icon
                        size={16}
                        className="relative transition-all duration-200 group-hover:rotate-3"
                        style={{ color: isActive ? item.color : undefined }}
                      />
                    </div>

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
        ))}
      </nav>

      {/* ── Action Buttons (Search, Notif, Theme) ── */}
      <div className="border-t border-[var(--border)] px-2 py-2">
        <div className={cn("flex items-center", collapsed ? "flex-col gap-1" : "gap-1")}>
          {/* Search trigger */}
          <button
            onClick={openCommandPalette}
            className={cn(
              "flex items-center gap-2 rounded-lg text-[var(--text-muted)] transition-all hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]",
              collapsed ? "p-2" : "flex-1 px-2.5 py-1.5"
            )}
            title="Buscar (⌘K)"
          >
            <Search size={14} />
            {!collapsed && (
              <>
                <span className="flex-1 text-left text-[11px]">Buscar...</span>
                <kbd className="rounded border border-[var(--border)] bg-[var(--bg-muted)] px-1 py-px text-[9px] font-medium">
                  ⌘K
                </kbd>
              </>
            )}
          </button>

          {/* Notifications */}
          <button
            className="relative rounded-lg p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
            title="Notificaciones"
          >
            <Bell size={14} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--error)]" />
          </button>

          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={(e) => toggleTheme(e)}
              className="rounded-lg p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
              title="Cambiar tema"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* ── User Popover ─────────────────────── */}
      <div className="border-t border-[var(--border)] px-2 py-2">
        <UserPopover
          user={user}
          collapsed={collapsed}
          onSignOut={handleSignOut}
        />
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
