"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  DollarSign,
  Users,
  Shield,
  Warehouse,
  Sparkles,
  Settings,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon: typeof Search;
  href: string;
  category: string;
  color: string;
};

const COMMANDS: CommandItem[] = [
  // Pages
  { id: "dashboard", label: "Dashboard", description: "Panel principal", icon: LayoutDashboard, href: "/dashboard", category: "Páginas", color: "#06B6D4" },
  { id: "finanzas", label: "Finanzas", description: "Centro financiero", icon: DollarSign, href: "/finanzas", category: "Páginas", color: "#8B5CF6" },
  { id: "usuarios", label: "Usuarios", description: "Gestión de equipo", icon: Users, href: "/usuarios", category: "Páginas", color: "#F59E0B" },
  { id: "admin", label: "Administración", description: "Auditoría y control", icon: Shield, href: "/administracion", category: "Páginas", color: "#F43F5E" },
  { id: "almacenes", label: "Almacenes", description: "Inventario 3D", icon: Warehouse, href: "/almacenes", category: "Páginas", color: "#10B981" },
  { id: "ai", label: "GRIXI AI", description: "Asistente inteligente", icon: Sparkles, href: "/ai", category: "Páginas", color: "#8B5CF6" },
  // Actions
  { id: "config", label: "Configuración", description: "Ajustes del sistema", icon: Settings, href: "/dashboard", category: "Acciones", color: "#71717A" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ⌘K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Filtered commands
  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [query]);

  // Group by category
  const groups = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return map;
  }, [filtered]);

  // Flat list for keyboard nav
  const flatList = useMemo(() => filtered, [filtered]);

  const navigate = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      router.push(item.href);
    },
    [router]
  );

  // Keyboard nav
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flatList[selectedIndex]) {
        e.preventDefault();
        navigate(flatList[selectedIndex]);
      }
    },
    [flatList, selectedIndex, navigate]
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2"
          >
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl">
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
                <Search size={18} className="shrink-0 text-[var(--text-muted)]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar páginas, módulos, acciones..."
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
                <kbd className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[320px] overflow-y-auto p-2">
                {flatList.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    Sin resultados para &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  Array.from(groups.entries()).map(([category, items]) => (
                    <div key={category} className="mb-2 last:mb-0">
                      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                        {category}
                      </p>
                      {items.map((item) => {
                        const globalIndex = flatList.indexOf(item);
                        const isSelected = globalIndex === selectedIndex;
                        return (
                          <button
                            key={item.id}
                            onClick={() => navigate(item)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                              isSelected
                                ? "bg-[var(--brand)]/10 text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                            )}
                          >
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                              style={{
                                backgroundColor: `${item.color}15`,
                                color: item.color,
                              }}
                            >
                              <item.icon size={15} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{item.label}</p>
                              {item.description && (
                                <p className="truncate text-[11px] text-[var(--text-muted)]">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <ArrowRight
                                size={14}
                                className="shrink-0 text-[var(--brand)]"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2">
                <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-[var(--border)] bg-[var(--bg-muted)] px-1 py-px text-[9px]">↑↓</kbd>
                    Navegar
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-[var(--border)] bg-[var(--bg-muted)] px-1 py-px text-[9px]">↵</kbd>
                    Seleccionar
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)]">
                  GRIXI Command
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
