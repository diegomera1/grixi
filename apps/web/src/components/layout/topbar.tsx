"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, LogOut, User } from "lucide-react";
import { logout } from "@/features/auth/actions/auth-actions";
import { useState, useEffect, useRef } from "react";

type TopbarProps = {
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
};

export function Topbar({ userName, userEmail, userAvatar }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      className="h-16 flex items-center justify-between px-6 shrink-0 sticky top-0 z-20"
      style={{
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-primary)",
      }}
    >
      {/* Left side — breadcrumb placeholder */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Plataforma
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-xl transition-all duration-200 hover:opacity-80"
            style={{
              background: "var(--bg-muted)",
              color: "var(--text-secondary)",
            }}
            aria-label="Cambiar tema"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 hover:opacity-80"
            style={{ background: "var(--bg-muted)" }}
          >
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName || "User"}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: "var(--color-brand)",
                  color: "white",
                }}
              >
                {userName?.charAt(0)?.toUpperCase() || "U"}
              </div>
            )}
            <span
              className="text-sm font-medium hidden sm:block"
              style={{ color: "var(--text-primary)" }}
            >
              {userName || "Usuario"}
            </span>
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-xl py-1 shadow-lg"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-primary)",
              }}
            >
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {userName || "Usuario"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {userEmail || ""}
                </p>
              </div>
              <button
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:opacity-80"
                style={{ color: "var(--text-secondary)" }}
              >
                <User size={16} />
                Mi perfil
              </button>
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors"
                  style={{ color: "var(--color-error)" }}
                >
                  <LogOut size={16} />
                  Cerrar sesión
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
