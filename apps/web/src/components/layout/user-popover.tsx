"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, LogOut, ChevronDown } from "lucide-react";
import type { User } from "@supabase/supabase-js";

type UserPopoverProps = {
  user: User | null;
  collapsed: boolean;
  onSignOut: () => void;
};

export function UserPopover({ user, collapsed, onSignOut }: UserPopoverProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Usuario";
  const userEmail = user?.email || "";
  const userAvatar =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null;
  const userInitial = userName.charAt(0).toUpperCase();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={popoverRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--bg-muted)]"
      >
        <div className="relative h-7 w-7 shrink-0">
          <div className="h-7 w-7 overflow-hidden rounded-full ring-2 ring-[var(--brand)]/30">
            {userAvatar ? (
              <Image
                src={userAvatar}
                alt={userName}
                width={28}
                height={28}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--brand)] text-[10px] font-bold text-white">
                {userInitial}
              </div>
            )}
          </div>
          {/* Online indicator */}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-surface)] bg-emerald-500" />
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">
                {userName}
              </p>
            </div>
            <ChevronDown
              size={12}
              className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl"
            style={{ minWidth: collapsed ? 200 : undefined }}
          >
            {/* User info */}
            <div className="px-3 py-3">
              <div className="flex items-center gap-2.5">
                <div className="relative h-10 w-10 shrink-0">
                  <div className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-[var(--brand)]/20">
                    {userAvatar ? (
                      <Image
                        src={userAvatar}
                        alt={userName}
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[var(--brand)] text-sm font-bold text-white">
                        {userInitial}
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-surface)] bg-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                    {userName}
                  </p>
                  <p className="truncate text-[11px] text-[var(--text-muted)]">
                    {userEmail}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--border)]" />

            {/* Actions */}
            <div className="p-1.5">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
              >
                <Settings size={14} />
                Configuración
              </Link>
              <button
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-red-500/10 hover:text-red-500"
              >
                <LogOut size={14} />
                Cerrar sesión
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
