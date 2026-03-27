import { Link, useLocation, useNavigate } from "react-router";
import { LogOut, ChevronDown, Building2, Menu, Search, Bell } from "lucide-react";
import { useSidebar } from "./sidebar";
import { useState, useRef, useEffect } from "react";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/almacenes": "Almacenes",
  "/compras": "Compras",
  "/finanzas": "Finanzas",
  "/rrhh": "Recursos Humanos",
  "/flota": "Flota",
  "/ai": "GRIXI AI",
  "/admin": "Administración",
  "/admin/organizations": "Organizaciones",
  "/admin/users": "Usuarios",
  "/admin/billing": "Billing",
  "/admin/audit": "Audit Log",
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

interface TopbarProps {
  user: {
    email: string;
    name: string;
    avatar?: string;
  };
  currentOrg?: { id: string; name: string; slug: string; role: string } | null;
  organizations?: Array<{ id: string; name: string; slug: string; role: string }>;
}

export function Topbar({ user, currentOrg, organizations = [] }: TopbarProps) {
  const { collapsed, setCollapsed } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOrgMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const switchOrg = (orgId: string) => {
    document.cookie = `grixi_org=${orgId}; Path=/; SameSite=Lax; Secure; Max-Age=31536000`;
    setOrgMenuOpen(false);
    navigate(0);
  };

  const breadcrumbs = getBreadcrumbs(location.pathname);
  const pageTitle = routeTitles[location.pathname] || breadcrumbs[breadcrumbs.length - 1]?.label || "GRIXI";

  return (
    <header className="flex h-11 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-4">
      {/* Left: Mobile toggle + Title + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-muted)] md:hidden"
        >
          <Menu size={16} />
        </button>

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

      {/* Right: Org Switcher + User */}
      <div className="flex items-center gap-2">
        {/* Org Switcher */}
        {currentOrg && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOrgMenuOpen(!orgMenuOpen)}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-1 text-[12px] transition-all hover:border-[var(--border-hover)]"
            >
              <div
                className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold"
                style={{ backgroundColor: "#6366F120", color: "#6366F1" }}
              >
                {currentOrg.name.charAt(0)}
              </div>
              <span className="hidden sm:inline font-medium text-[var(--text-primary)]">{currentOrg.name}</span>
              <span
                className="hidden sm:inline rounded-full px-1.5 py-px text-[9px] font-medium"
                style={{ backgroundColor: "#8B5CF620", color: "#8B5CF6" }}
              >
                {currentOrg.role}
              </span>
              {organizations.length > 1 && <ChevronDown size={12} className="text-[var(--text-muted)]" />}
            </button>

            {orgMenuOpen && organizations.length > 1 && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 shadow-lg z-50 animate-scale-in">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Cambiar organización
                </p>
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => switchOrg(org.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12px] transition-colors ${
                      org.id === currentOrg.id
                        ? "bg-[var(--brand-surface)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                    }`}
                  >
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: "#6366F120", color: "#6366F1" }}
                    >
                      {org.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{org.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{org.role}</p>
                    </div>
                    {org.id === currentOrg.id && (
                      <div className="h-2 w-2 rounded-full shrink-0 bg-[var(--success)]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User avatar + sign out */}
        <div className="flex items-center gap-2">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="h-7 w-7 rounded-full ring-1 ring-[var(--border)]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-muted)] text-xs font-semibold text-[var(--text-secondary)]">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
          <Link
            to="/auth/signout"
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
            title="Cerrar sesión"
          >
            <LogOut size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}
