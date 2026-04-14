"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { Moon, Sun, Search, Bell } from "lucide-react";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/usuarios": "Usuarios",
  "/usuarios/roles": "Roles y Permisos",
  "/administracion": "Administración",
  "/almacenes": "Almacenes",
  "/finanzas": "Finanzas",
  "/compras": "Compras",
  "/ventas": "Ventas",
  "/flota": "Flota",
  "/rrhh": "Recursos Humanos",
  "/command-center": "Centro de Comando",
  "/ai": "GRIXI AI",
};

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: { label: string; href: string }[] = [];
  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const title = routeTitles[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
    breadcrumbs.push({ label: title, href: currentPath });
  }
  return breadcrumbs;
}

export function Topbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const breadcrumbs = getBreadcrumbs(pathname);
  const pageTitle = routeTitles[pathname] || breadcrumbs[breadcrumbs.length - 1]?.label || "GRIXI";

  return (
    <header className="flex h-10 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-4">
      {/* Left: Page title + breadcrumbs */}
      <div className="flex items-center gap-2">
        <h1 className="text-[13px] font-semibold text-[var(--text-primary)]">
          {pageTitle}
        </h1>
        {breadcrumbs.length > 1 && (
          <div className="hidden items-center gap-1 text-[11px] text-[var(--text-muted)] sm:flex">
            <span>·</span>
            {breadcrumbs.slice(0, -1).map((crumb, i) => (
              <span key={crumb.href}>
                {i > 0 && <span className="mx-0.5">/</span>}
                {crumb.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Search */}
        <button className="group flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-1 text-[12px] text-[var(--text-muted)] transition-all hover:border-[var(--border-hover)]">
          <Search size={13} />
          <span className="hidden md:inline">Buscar...</span>
          <kbd className="hidden rounded border border-[var(--border)] bg-[var(--bg-surface)] px-1 py-px text-[9px] font-medium md:inline">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <button className="relative rounded-lg p-1.5 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]">
          <Bell size={14} />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--error)]" />
        </button>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        )}
      </div>
    </header>
  );
}
