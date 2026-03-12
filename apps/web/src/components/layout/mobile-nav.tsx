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

// All navigation modules
const ALL_MODULES = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, color: "#06B6D4", category: "PRINCIPAL" },
  { label: "Finanzas", href: "/finanzas", icon: DollarSign, color: "#8B5CF6", category: "OPERACIONES" },
  { label: "Almacenes", href: "/almacenes", icon: Warehouse, color: "#10B981", category: "OPERACIONES" },
  { label: "Compras", href: "/compras", icon: ShoppingCart, color: "#F97316", category: "OPERACIONES" },
  { label: "Usuarios", href: "/usuarios", icon: Users, color: "#F59E0B", category: "EQUIPO" },
  { label: "Administración", href: "/administracion", icon: Shield, color: "#F43F5E", category: "EQUIPO" },
  { label: "GRIXI AI", href: "/ai", icon: Sparkles, color: "#A855F7", category: "INTELIGENCIA" },
];

const CATEGORIES = [...new Set(ALL_MODULES.map((m) => m.category))];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
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

  // Close on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await logLogoutEvent();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuario";
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const activeModule = ALL_MODULES.find((m) => pathname === m.href || pathname.startsWith(m.href + "/"));
  const activeColor = activeModule?.color || "#7C3AED";

  return (
    <>
      {/* ── Floating Orb Button (bottom-right corner) ──── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-5 right-5 z-50 md:hidden relative flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl"
            style={{
              boxShadow: `0 0 20px ${activeColor}20, 0 4px 12px rgba(0,0,0,0.15)`,
            }}
          >
            {/* Rotating conic-gradient glow ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, ${activeColor}40, transparent, ${activeColor}20, transparent, ${activeColor}40)`,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            {/* Inner circle with module icon */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-surface)]">
              <AnimatePresence mode="wait">
                {activeModule ? (
                  <motion.div
                    key={activeModule.label}
                    initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.6, rotate: 30 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    className="relative"
                  >
                    <activeModule.icon size={20} style={{ color: activeModule.color }} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="grixi-logo"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  >
                    <Image src="/brand/icon.png" alt="GRIXI" width={22} height={22} className="relative" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Active module dot */}
            {activeModule && (
              <motion.span
                className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-surface)]"
                style={{ backgroundColor: activeModule.color }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Full-Screen Drawer ──────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md md:hidden"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel — slides up from bottom */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-[70] max-h-[92vh] overflow-y-auto rounded-t-[28px] bg-[var(--bg-surface)] md:hidden safe-area-bottom"
              style={{
                boxShadow: `0 -20px 60px ${activeColor}15, 0 -4px 20px rgba(0,0,0,0.3)`,
              }}
            >
              {/* Handle bar + close */}
              <div className="sticky top-0 z-10 flex items-center justify-between bg-[var(--bg-surface)] px-5 pt-3 pb-2">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Image src="/brand/icon.png" alt="GRIXI" width={24} height={24} />
                  </div>
                  <div>
                    <span className="font-serif text-sm font-semibold italic text-[var(--text-primary)]">
                      GRIXI
                    </span>
                    <p className="text-[8px] font-medium text-[var(--text-muted)]">
                      Enterprise Platform
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)] active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 pb-8">
                {/* User card */}
                <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]/50 p-3.5">
                  {userAvatar ? (
                    <Image src={userAvatar} alt={userName} width={44} height={44} className="rounded-full ring-2 ring-[var(--brand)]/20" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] text-white font-bold text-sm">
                      {userName.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{userName}</p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">{user?.email}</p>
                  </div>
                  <div
                    className="flex h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: "#10B981" }}
                  />
                </div>

                {/* Modules by category */}
                {CATEGORIES.map((category) => (
                  <div key={category} className="mb-4">
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                      {category}
                    </p>
                    <div className="space-y-1">
                      {ALL_MODULES.filter((m) => m.category === category).map((mod) => {
                        const isActive = pathname === mod.href || pathname.startsWith(mod.href + "/");
                        return (
                          <Link
                            key={mod.href}
                            href={mod.href}
                            className={cn(
                              "flex items-center gap-3.5 rounded-xl px-3.5 py-3.5 text-[14px] font-medium transition-all active:scale-[0.98]",
                              isActive
                                ? "text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)]"
                            )}
                            style={
                              isActive
                                ? {
                                    backgroundColor: `${mod.color}12`,
                                    boxShadow: `inset 0 0 0 1px ${mod.color}25`,
                                  }
                                : undefined
                            }
                          >
                            <div className="relative">
                              {isActive && (
                                <motion.div
                                  layoutId="mobile-active-glow"
                                  className="absolute inset-0 rounded-lg opacity-30 blur-md"
                                  style={{ backgroundColor: mod.color }}
                                />
                              )}
                              <mod.icon
                                size={20}
                                className="relative"
                                style={{ color: isActive ? mod.color : undefined }}
                              />
                            </div>
                            <span className="flex-1">{mod.label}</span>
                            {isActive && (
                              <motion.div
                                layoutId="mobile-nav-check"
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: mod.color }}
                              />
                            )}
                            {!isActive && (
                              <ChevronRight size={14} className="text-[var(--text-muted)]" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Divider */}
                <div className="my-4 h-px bg-[var(--border)]" />

                {/* Quick actions */}
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  ACCIONES
                </p>
                <div className="space-y-1 mb-4">
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
                    }}
                    className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3.5 text-[14px] font-medium text-[var(--text-secondary)] active:bg-[var(--bg-muted)]"
                  >
                    <Search size={20} className="text-[var(--text-muted)]" />
                    <span className="flex-1 text-left">Buscar</span>
                    <kbd className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--text-muted)]">
                      ⌘K
                    </kbd>
                  </button>
                  <button className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3.5 text-[14px] font-medium text-[var(--text-secondary)] active:bg-[var(--bg-muted)]">
                    <Bell size={20} className="text-[var(--text-muted)]" />
                    <span className="flex-1 text-left">Notificaciones</span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--error)] text-[9px] font-bold text-white">
                      3
                    </span>
                  </button>
                  {mounted && (
                    <button
                      onClick={(e) => toggleTheme(e)}
                      className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3.5 text-[14px] font-medium text-[var(--text-secondary)] active:bg-[var(--bg-muted)]"
                    >
                      {theme === "dark" ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-[var(--text-muted)]" />}
                      <span className="flex-1 text-left">{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
                    </button>
                  )}
                </div>

                {/* Sign out */}
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3.5 text-[14px] font-medium text-red-400 active:bg-red-500/10"
                >
                  <LogOut size={20} />
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
