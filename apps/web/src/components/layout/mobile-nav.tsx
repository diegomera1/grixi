"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Bell,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PRIMARY_TABS, SECONDARY_ITEMS } from "@/config/nav-config";
import { createClient } from "@/lib/supabase/client";
import { logLogoutEvent } from "@/lib/actions/audit";
import { useThemeTransition } from "@/lib/hooks/use-theme-transition";
import type { User } from "@supabase/supabase-js";

const MORE_ITEMS = SECONDARY_ITEMS;

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
    PRIMARY_TABS.forEach((tab) => router.prefetch(tab.href));
    MORE_ITEMS.forEach((item) => router.prefetch(item.href));
  }, [router]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const handleSignOut = useCallback(async () => {
    await logLogoutEvent();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  const isMoreActive = MORE_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuario";
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <>
      {/*
        ── Bottom Tab Bar ────────────────────────
        
        NOT position:fixed — this is a flex item inside a flex-col layout.
        The parent layout is: div.h-full.flex.flex-col > main.flex-1 + nav.shrink-0
        Main ENDS where nav BEGINS — zero overlap, zero touch interception.
        
        Safe area: the nav background and spacer extend into the safe area,
        but the icon/label buttons have a fixed height above the safe area.
      */}
      <nav
        className="shrink-0 md:hidden border-t border-[var(--border)] bg-[var(--bg-surface)]"
        style={{
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* Button row — fixed height, icons and labels centered */}
        <div
          className="flex items-stretch"
          style={{ touchAction: "manipulation" }}
        >
          {PRIMARY_TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-[3px] h-[52px] transition-colors relative",
                  isActive
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] active:text-[var(--text-secondary)]"
                )}
              >
                {/* Active indicator line */}
                {isActive && (
                  <motion.div
                    layoutId="tab-active"
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] w-7 rounded-full"
                    style={{ backgroundColor: tab.color }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                {/* Icon */}
                <div className="relative">
                  {isActive && (
                    <div
                      className="absolute inset-0 rounded-full opacity-20 blur-md scale-[2.5]"
                      style={{ backgroundColor: tab.color }}
                    />
                  )}
                  <tab.icon
                    size={21}
                    className="relative"
                    strokeWidth={isActive ? 2.2 : 1.8}
                    style={{ color: isActive ? tab.color : undefined }}
                  />
                </div>
                {/* Label */}
                <span
                  className={cn(
                    "text-[10px] leading-none",
                    isActive ? "font-semibold" : "font-medium"
                  )}
                  style={{ color: isActive ? tab.color : undefined }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* "Más" tab */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-[3px] h-[52px] transition-colors relative",
              isMoreActive || drawerOpen
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-muted)] active:text-[var(--text-secondary)]"
            )}
          >
            {(isMoreActive && !drawerOpen) && (
              <motion.div
                layoutId="tab-active"
                className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] w-7 rounded-full bg-[var(--brand)]"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <div className="relative">
              <MoreHorizontal
                size={21}
                strokeWidth={isMoreActive ? 2.2 : 1.8}
                className={cn(isMoreActive && "text-[var(--brand)]")}
              />
              <span className="absolute -right-1.5 -top-1 h-[6px] w-[6px] rounded-full bg-[var(--error)] ring-2 ring-[var(--bg-surface)]" />
            </div>
            <span
              className={cn(
                "text-[10px] leading-none",
                isMoreActive ? "font-semibold text-[var(--brand)]" : "font-medium"
              )}
            >
              Más
            </span>
          </button>
        </div>

        {/* Safe area spacer — uses JS-detected value with 34px iPhone fallback */}
        <div
          className="bg-[var(--bg-surface)]"
          style={{ height: "var(--safe-bottom, 34px)" }}
        />
      </nav>

      {/* ── "Más" Drawer ──────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] overflow-y-auto rounded-t-[26px] bg-[var(--bg-surface)] shadow-[0_-10px_50px_rgba(0,0,0,0.25)] md:hidden"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 20px)" }}
            >
              {/* Pull handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-[4px] w-9 rounded-full bg-[var(--text-muted)]/30" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <Image src="/brand/icon.png" alt="GRIXI" width={22} height={22} className="rounded-md" />
                  <span className="font-serif text-[13px] font-semibold italic text-[var(--text-primary)]">
                    GRIXI
                  </span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)] active:scale-90"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="px-5 pb-6">
                {/* User card */}
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]/40 p-3">
                  {userAvatar ? (
                    <Image
                      src={userAvatar}
                      alt={userName}
                      width={40}
                      height={40}
                      className="rounded-full ring-2 ring-[var(--brand)]/15"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] text-white font-bold text-sm">
                      {userName.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{userName}</p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">{user?.email}</p>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>

                {/* Navigation modules */}
                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  Módulos
                </p>
                <div className="mb-5 space-y-0.5">
                  {MORE_ITEMS.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium transition-colors active:scale-[0.98]",
                          isActive
                            ? "text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] active:bg-[var(--bg-muted)]"
                        )}
                        style={
                          isActive
                            ? { backgroundColor: `${item.color}12`, boxShadow: `inset 0 0 0 1px ${item.color}20` }
                            : undefined
                        }
                      >
                        <item.icon
                          size={20}
                          style={{ color: isActive ? item.color : "var(--text-muted)" }}
                        />
                        <span className="flex-1">{item.label}</span>
                        {isActive ? (
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        ) : (
                          <ChevronRight size={14} className="text-[var(--text-muted)]" />
                        )}
                      </Link>
                    );
                  })}
                </div>

                {/* Divider */}
                <div className="mb-4 h-px bg-[var(--border)]" />

                {/* Actions */}
                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  Acciones
                </p>
                <div className="mb-4 space-y-0.5">
                  <button
                    onClick={() => {
                      setDrawerOpen(false);
                      setTimeout(() => {
                        document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
                      }, 200);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-[var(--text-secondary)] active:bg-[var(--bg-muted)]"
                  >
                    <Search size={20} className="text-[var(--text-muted)]" />
                    <span className="flex-1 text-left">Buscar</span>
                    <kbd className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--text-muted)]">
                      ⌘K
                    </kbd>
                  </button>
                  <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-[var(--text-secondary)] active:bg-[var(--bg-muted)]">
                    <Bell size={20} className="text-[var(--text-muted)]" />
                    <span className="flex-1 text-left">Notificaciones</span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--error)] text-[9px] font-bold text-white">
                      3
                    </span>
                  </button>
                  {mounted && (
                    <button
                      onClick={(e) => toggleTheme(e)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-[var(--text-secondary)] active:bg-[var(--bg-muted)]"
                    >
                      {theme === "dark" ? (
                        <Sun size={20} className="text-amber-400" />
                      ) : (
                        <Moon size={20} className="text-[var(--text-muted)]" />
                      )}
                      <span className="flex-1 text-left">
                        {theme === "dark" ? "Modo claro" : "Modo oscuro"}
                      </span>
                    </button>
                  )}
                </div>

                {/* Sign out */}
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-red-400 active:bg-red-500/10"
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
