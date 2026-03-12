"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, X, RotateCcw } from "lucide-react";
import { create } from "zustand";

// ─── Store ──────────────────────────────────────────────

type MobilePreviewStore = {
  isActive: boolean;
  toggle: () => void;
  deactivate: () => void;
};

export const useMobilePreview = create<MobilePreviewStore>((set) => ({
  isActive: false,
  toggle: () => set((s) => ({ isActive: !s.isActive })),
  deactivate: () => set({ isActive: false }),
}));

// ─── iPhone Frame Wrapper ──────────────────────────────

const IPHONE_WIDTH = 393;
const IPHONE_HEIGHT = 852;

export function MobilePreviewWrapper({ children }: { children: React.ReactNode }) {
  const { isActive, deactivate } = useMobilePreview();

  if (!isActive) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      {/* Controls */}
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <span className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white/70 backdrop-blur-md ring-1 ring-white/10">
          📱 Vista Móvil — iPhone 15 Pro
        </span>
        <button
          onClick={deactivate}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md ring-1 ring-white/10 transition-all hover:bg-white/20 hover:text-white"
          title="Salir de vista móvil"
        >
          <X size={18} />
        </button>
      </div>

      {/* iPhone Frame */}
      <div className="relative">
        {/* Phone outer body */}
        <div
          className="relative overflow-hidden rounded-[48px] border-[3px] border-slate-700 bg-black shadow-2xl shadow-black/50"
          style={{
            width: IPHONE_WIDTH + 24,
            height: IPHONE_HEIGHT + 24,
            padding: 12,
          }}
        >
          {/* Dynamic Island */}
          <div className="absolute left-1/2 top-3 z-50 -translate-x-1/2">
            <div className="h-[34px] w-[126px] rounded-full bg-black" />
          </div>

          {/* Screen content */}
          <div
            className="relative overflow-hidden rounded-[36px] bg-white"
            style={{
              width: IPHONE_WIDTH,
              height: IPHONE_HEIGHT,
            }}
          >
            <iframe
              src={typeof window !== "undefined" ? window.location.href : "/dashboard"}
              className="h-full w-full border-0"
              style={{
                width: IPHONE_WIDTH,
                height: IPHONE_HEIGHT,
              }}
              title="Vista móvil GRIXI"
            />
          </div>

          {/* Home indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <div className="h-[5px] w-[134px] rounded-full bg-slate-600" />
          </div>
        </div>

        {/* Side buttons */}
        <div className="absolute -left-[5px] top-[140px] h-[32px] w-[4px] rounded-l-sm bg-slate-700" />
        <div className="absolute -left-[5px] top-[190px] h-[60px] w-[4px] rounded-l-sm bg-slate-700" />
        <div className="absolute -left-[5px] top-[260px] h-[60px] w-[4px] rounded-l-sm bg-slate-700" />
        <div className="absolute -right-[5px] top-[200px] h-[80px] w-[4px] rounded-r-sm bg-slate-700" />
      </div>
    </div>
  );
}

// ─── Toggle Button (for sidebar) ────────────────────────

export function MobilePreviewToggle() {
  const { isActive, toggle } = useMobilePreview();

  return (
    <button
      onClick={toggle}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
        isActive
          ? "bg-[var(--brand)]/10 text-[var(--brand)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
      }`}
    >
      <Smartphone size={15} />
      <span>Vista Móvil</span>
      {isActive && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="ml-auto h-2 w-2 rounded-full bg-[var(--brand)]"
        />
      )}
    </button>
  );
}
