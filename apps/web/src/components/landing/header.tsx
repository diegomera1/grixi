"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { GrixiLogo } from "@/components/ui/grixi-logo";

export function LandingHeader() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-out",
        scrolled ? "py-3" : "py-5"
      )}
    >
      {/* Blur backdrop */}
      <div
        className={cn(
          "absolute inset-0 transition-all duration-700",
          scrolled ? "backdrop-blur-xl" : "backdrop-blur-none",
          scrolled && isDark && "bg-black/30",
          scrolled && !isDark && "bg-white/60"
        )}
      />

      <nav className="relative z-10 mx-auto flex max-w-[1800px] items-center justify-between px-6 lg:px-10">
        {/* Left: Menu pill */}
        <button
          className={cn(
            "rounded-full border px-5 py-2 text-[13px] font-medium backdrop-blur-xl transition-all",
            isDark
              ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
              : "border-black/10 bg-black/5 text-black hover:bg-black/10"
          )}
        >
          Menu
        </button>

        {/* Center: SVG Logo — transparent, crisp at any size */}
        <Link href="/" className="absolute left-1/2 -translate-x-1/2">
          <GrixiLogo
            height={36}
            variant={isDark ? "dark" : "light"}
          />
        </Link>

        {/* Right: Time + Theme toggle */}
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "hidden text-[13px] sm:inline",
              isDark ? "text-white/50" : "text-black/50"
            )}
          >
            {new Date().toLocaleTimeString("es-EC", {
              hour: "2-digit",
              minute: "2-digit",
              timeZoneName: "short",
            })}
          </span>
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-xl transition-all",
              isDark
                ? "border-white/20 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                : "border-black/10 bg-black/5 text-black/60 hover:bg-black/10 hover:text-black"
            )}
            aria-label="Cambiar tema"
          >
            {isDark ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </nav>
    </header>
  );
}
