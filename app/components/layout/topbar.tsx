import { Link, useNavigate } from "react-router";
import { LogOut, Menu, ChevronDown, Building2 } from "lucide-react";
import { useSidebar } from "./sidebar";
import { useState, useRef, useEffect } from "react";

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
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOrgMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const switchOrg = (orgId: string) => {
    // Set cookie and reload
    document.cookie = `grixi_org=${orgId}; Path=/; SameSite=Lax; Secure; Max-Age=31536000`;
    setOrgMenuOpen(false);
    navigate(0); // reload current page
  };

  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center justify-between border-b px-6"
      style={{
        backgroundColor: "rgba(10, 10, 15, 0.8)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderColor: "var(--border)",
      }}
    >
      {/* Left: mobile toggle + org switcher */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-2 transition-colors hover:bg-white/5 lg:hidden"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Menu size={20} />
        </button>

        {/* Org Switcher */}
        {currentOrg && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOrgMenuOpen(!orgMenuOpen)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
              style={{ color: "var(--foreground)" }}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold" style={{ backgroundColor: "#6366F120", color: "#6366F1" }}>
                {currentOrg.name.charAt(0)}
              </div>
              <span className="hidden sm:inline font-medium">{currentOrg.name}</span>
              <span className="hidden sm:inline rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: "#8B5CF620", color: "#8B5CF6" }}>{currentOrg.role}</span>
              {organizations.length > 1 && <ChevronDown size={14} style={{ color: "var(--muted-foreground)" }} />}
            </button>

            {orgMenuOpen && organizations.length > 1 && (
              <div
                className="absolute left-0 top-full mt-2 w-56 rounded-xl border p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                style={{ backgroundColor: "#1a1625", borderColor: "var(--border)" }}
              >
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Cambiar organización</p>
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => switchOrg(org.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${org.id === currentOrg.id ? "bg-white/10" : "hover:bg-white/5"}`}
                    style={{ color: "var(--foreground)" }}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold shrink-0" style={{ backgroundColor: "#6366F120", color: "#6366F1" }}>
                      {org.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{org.name}</p>
                      <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{org.role}</p>
                    </div>
                    {org.id === currentOrg.id && <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: "#16A34A" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: User */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full ring-2 ring-white/10" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}>
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{user.name}</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{user.email}</p>
          </div>
        </div>

        <Link to="/auth/signout" className="rounded-lg p-2 transition-colors hover:bg-white/5" style={{ color: "var(--muted-foreground)" }} title="Cerrar sesión">
          <LogOut size={18} />
        </Link>
      </div>
    </header>
  );
}
