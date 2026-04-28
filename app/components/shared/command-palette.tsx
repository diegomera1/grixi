/**
 * Command Palette — Cmd+K global search & navigation
 * 
 * Usage: Import into authenticated layout. Opens with Cmd+K / Ctrl+K.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Search, LayoutDashboard, DollarSign, Settings, Users, Shield, ScrollText,
  Mail, Building2, Bell, MessageSquare, User, Sparkles, ArrowRight,
  Command, Keyboard,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: typeof Search;
  action: string; // path to navigate
  category: "nav" | "config" | "quick";
  keywords?: string[];
}

const COMMANDS: CommandItem[] = [
  // Navigation
  { id: "dashboard", label: "Dashboard", description: "Panel principal", icon: LayoutDashboard, action: "/dashboard", category: "nav", keywords: ["inicio", "home", "panel"] },
  { id: "finanzas", label: "Finanzas", description: "Módulo financiero", icon: DollarSign, action: "/finanzas", category: "nav", keywords: ["finance", "dinero", "contabilidad"] },
  { id: "ai", label: "GRIXI AI", description: "Asistente inteligente", icon: Sparkles, action: "/ai", category: "nav", keywords: ["chat", "gemini", "inteligencia"] },
  { id: "notifications", label: "Notificaciones", description: "Centro de alertas", icon: Bell, action: "/notificaciones", category: "nav", keywords: ["alertas", "avisos"] },
  { id: "profile", label: "Mi Perfil", description: "Datos personales y seguridad", icon: User, action: "/perfil", category: "nav", keywords: ["cuenta", "avatar", "password"] },
  // Config
  { id: "config-team", label: "Equipo", description: "Gestionar miembros", icon: Users, action: "/configuracion", category: "config", keywords: ["miembros", "team", "personas"] },
  { id: "config-invites", label: "Invitaciones", description: "Enviar invitaciones", icon: Mail, action: "/configuracion/invitaciones", category: "config", keywords: ["invitar", "email"] },
  { id: "config-roles", label: "Roles y Permisos", description: "Control de acceso RBAC", icon: Shield, action: "/configuracion/roles", category: "config", keywords: ["permisos", "rbac", "acceso"] },
  { id: "config-audit", label: "Auditoría", description: "Log de actividad", icon: ScrollText, action: "/configuracion/auditoria", category: "config", keywords: ["logs", "historial", "actividad"] },
  { id: "config-org", label: "Organización", description: "Ajustes de la organización", icon: Building2, action: "/configuracion/organizacion", category: "config", keywords: ["empresa", "branding", "logo"] },
];

const CATEGORY_LABELS: Record<string, string> = {
  nav: "Navegación",
  config: "Configuración",
  quick: "Acciones rápidas",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Filter commands
  const filtered = COMMANDS.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.keywords?.some((k) => k.includes(q))
    );
  });

  // Group by category
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    (acc[cmd.category] ??= []).push(cmd);
    return acc;
  }, {});

  // Flat list for keyboard nav
  const flatList = Object.values(grouped).flat();

  const execute = useCallback((cmd: CommandItem) => {
    setOpen(false);
    navigate(cmd.action);
  }, [navigate]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatList[selectedIndex]) {
      execute(flatList[selectedIndex]);
    }
  };

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        style={{ animation: "fadeIn 150ms ease" }}
      />

      {/* Modal */}
      <div
        className="fixed inset-x-0 top-[15vh] z-[9999] mx-auto w-full max-w-lg px-4"
        style={{ animation: "cmdSlideIn 200ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <div
          className="overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            backgroundColor: "var(--bg-elevated, #1A1A1D)",
            borderColor: "var(--border, #27272A)",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.05)",
          }}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
            <Search size={18} className="shrink-0" style={{ color: "var(--text-muted)" }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Buscar página, acción o configuración..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
              style={{ color: "var(--text-primary)" }}
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-mono"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2" style={{ scrollbarWidth: "thin" }}>
            {flatList.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No se encontraron resultados para "{query}"
                </p>
              </div>
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {CATEGORY_LABELS[category] || category}
                  </p>
                  {items.map((cmd) => {
                    const globalIndex = flatList.indexOf(cmd);
                    const isSelected = globalIndex === selectedIndex;
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        data-index={globalIndex}
                        onClick={() => execute(cmd)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                        style={{
                          backgroundColor: isSelected ? "var(--brand-surface, rgba(124,58,237,0.1))" : "transparent",
                          color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                        }}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: isSelected ? "var(--brand, #7C3AED)" + "20" : "var(--bg-muted, #27272A)" }}>
                          <Icon size={15} style={{ color: isSelected ? "var(--brand)" : "var(--text-muted)" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cmd.label}</p>
                          {cmd.description && (
                            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{cmd.description}</p>
                          )}
                        </div>
                        {isSelected && (
                          <ArrowRight size={14} style={{ color: "var(--brand)" }} className="shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t px-4 py-2" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <span className="inline-flex items-center gap-1"><Keyboard size={11} /> ↑↓ navegar</span>
              <span className="inline-flex items-center gap-1">↵ abrir</span>
              <span className="inline-flex items-center gap-1">esc cerrar</span>
            </div>
            <span className="text-[10px] font-medium" style={{ color: "var(--brand)" }}>GRIXI</span>
          </div>
        </div>

        <style>{`
          @keyframes cmdSlideIn {
            from { opacity: 0; transform: translateY(-8px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
}
