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
  ShoppingCart,
  X,
  Search,
  Bell,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { logLogoutEvent } from "@/lib/actions/audit";
import { useThemeTransition } from "@/lib/hooks/use-theme-transition";
import type { User } from "@supabase/supabase-js";

// Primary tabs shown in bottom bar
const PRIMARY_TABS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, color: "#06B6D4" },
  { label: "Finanzas", href: "/finanzas", icon: DollarSign, color: "#8B5CF6" },
  { label: "Almacenes", href: "/almacenes", icon: Warehouse, color: "#10B981" },
  { label: "Compras", href: "/compras", icon: ShoppingCart, color: "#F97316" },
];

// Secondary items in the "More" drawer
const SECONDARY_ITEMS = [
  { label: "Usuarios", href: "/usuarios", icon: Users, color: "#F59E0B" },
  { label: "Administración", href: "/administracion", icon: Shield, color: "#F43F5E" },
  { label: "GRIXI AI", href: "/ai", icon: Sparkles, color: "#8B5CF6" },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await logLogoutEvent();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isMoreActive = SECONDARY_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuario";
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <>
      {/* ── Bottom Tab Bar ──────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg-surface)]/95 backdrop-blur-xl md:hidden safe-area-bottom">
        <div className="flex items-stretch">
          {PRIMARY_TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 transition-all relative",
                  isActive
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] active:scale-95"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-tab-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full"
                    style={{ backgroundColor: tab.color }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <tab.icon
                  size={20}
                  style={{ color: isActive ? tab.color : undefined }}
                />
                <span className={cn(
                  "text-[9px] font-medium",
                  isActive && "font-semibold"
                )}>
                  {tab.label}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 transition-all relative",
              isMoreActive
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-muted)] active:scale-95"
            )}
          >
            {isMoreActive && (
              <motion.div
                layoutId="mobile-tab-indicator"
                className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-violet-500"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <div className="relative">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
              </svg>
              <span className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--error)]" />
            </div>
            <span className={cn("text-[9px] font-medium", isMoreActive && "font-semibold")}>
              Más
            </span>
          </button>
        </div>
      </nav>

      {/* ── Drawer Overlay ──────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Drawer panel — slides up from bottom */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              className="fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-[var(--border)] bg-[var(--bg-surface)] md:hidden safe-area-bottom"
            >
              {/* Handle bar */}
              <div className="flex justify-center py-3">
                <div className="h-1 w-10 rounded-full bg-[var(--border)]" />
              </div>

              {/* Close button */}
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute right-4 top-4 rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
              >
                <X size={18} />
              </button>

              <div className="px-5 pb-8">
                {/* User info */}
                <div className="mb-5 flex items-center gap-3">
                  {userAvatar ? (
                    <Image src={userAvatar} alt={userName} width={40} height={40} className="rounded-full" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 font-bold text-sm">
                      {userName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{userName}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{user?.email}</p>
                  </div>
                </div>

                {/* Navigation section */}
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Módulos
                </p>
                <div className="space-y-1 mb-5">
                  {SECONDARY_ITEMS.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all",
                          isActive
                            ? "bg-violet-500/10 text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] active:bg-[var(--bg-muted)]"
                        )}
                      >
                        <item.icon size={18} style={{ color: item.color }} />
                        <span className="flex-1">{item.label}</span>
                        <ChevronRight size={14} className="text-[var(--text-muted)]" />
                      </Link>
                    );
                  })}
                </div>

                {/* Actions section */}
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Acciones
                </p>
                <div className="space-y-1 mb-5">
                  <button
                    onClick={() => {
                      setDrawerOpen(false);
                      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[var(--text-secondary)] active:bg-[var(--bg-muted)]"
                  >
                    <Search size={18} className="text-[var(--text-muted)]" />
                    <span className="flex-1 text-left">Buscar</span>
                  </button>
                  <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[var(--text-secondary)] active:bg-[var(--bg-muted)]">
                    <Bell size={18} className="text-[var(--text-muted)]" />
                    <span className="flex-1 text-left">Notificaciones</span>
                    <span className="h-2 w-2 rounded-full bg-[var(--error)]" />
                  </button>
                  {mounted && (
                    <button
                      onClick={(e) => toggleTheme(e)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[var(--text-secondary)] active:bg-[var(--bg-muted)]"
                    >
                      {theme === "dark" ? <Sun size={18} className="text-[var(--text-muted)]" /> : <Moon size={18} className="text-[var(--text-muted)]" />}
                      <span className="flex-1 text-left">{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
                    </button>
                  )}
                </div>

                {/* Sign out */}
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-400 active:bg-red-500/10"
                >
                  <LogOut size={18} />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
