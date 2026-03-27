import { Link } from "react-router";
import { LogOut, Menu } from "lucide-react";
import { useSidebar } from "./sidebar";

interface TopbarProps {
  user: {
    email: string;
    name: string;
    avatar?: string;
  };
}

export function Topbar({ user }: TopbarProps) {
  const { collapsed, setCollapsed } = useSidebar();

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
      {/* Left: mobile toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-2 transition-colors hover:bg-white/5 lg:hidden"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Right: User */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="h-8 w-8 rounded-full ring-2 ring-white/10"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
              style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}
            >
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {user.name}
            </p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {user.email}
            </p>
          </div>
        </div>

        <Link
          to="/auth/signout"
          className="rounded-lg p-2 transition-colors hover:bg-white/5"
          style={{ color: "var(--muted-foreground)" }}
          title="Cerrar sesión"
        >
          <LogOut size={18} />
        </Link>
      </div>
    </header>
  );
}
