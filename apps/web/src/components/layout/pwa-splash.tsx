"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export function PWASplash() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Only show splash in standalone PWA mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (!isStandalone) {
      setVisible(false);
      return;
    }

    // Start fade out after 1.2s
    const fadeTimer = setTimeout(() => setFadeOut(true), 1200);
    // Remove from DOM after fade animation
    const removeTimer = setTimeout(() => setVisible(false), 1800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0f] transition-opacity duration-500 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Logo */}
      <div className="relative animate-pulse">
        <Image
          src="/brand/icon-512.png"
          alt="GRIXI"
          width={80}
          height={80}
          className="rounded-2xl"
          priority
        />
      </div>

      {/* Brand text */}
      <p className="mt-4 font-serif text-lg font-semibold italic tracking-wide text-white/90">
        GRIXI
      </p>
      <p className="mt-1 text-[11px] text-white/40">
        La interconexión inteligente
      </p>

      {/* Loading indicator */}
      <div className="mt-8 h-0.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-full animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      </div>
    </div>
  );
}
