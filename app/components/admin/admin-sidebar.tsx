import { NavLink, useLocation, Form } from "react-router";
import {
  LayoutDashboard, Building2, Users, History, CreditCard,
  Bell, Settings, LogOut, Shield, Radio, Flag, Bug, BarChart3,
  ShieldCheck, Lock,
} from "lucide-react";
import type { PlatformAdminContext, PlatformPermissionKey } from "~/lib/platform-rbac/types";

interface AdminSidebarProps {
  user: { name: string; email: string; avatar?: string };
  isRealtimeConnected: boolean;
  adminCtx: PlatformAdminContext;
  stats?: { orgs: number; users: number; audit24h: number };
}

// ── Nav items with required permissions ──
const NAV_ITEMS: Array<{
  to: string;
  label: string;
  icon: any;
  end?: boolean;
  requiredPermission: PlatformPermissionKey;
}> = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, requiredPermission: "admin.dashboard.view" },
  { to: "/admin/organizations", label: "Organizaciones", icon: Building2, requiredPermission: "admin.orgs.view" },
  { to: "/admin/users", label: "Usuarios", icon: Users, requiredPermission: "admin.users.view" },
  { to: "/admin/roles", label: "Roles Admin", icon: ShieldCheck, requiredPermission: "admin.roles.view" },
  { to: "/admin/audit", label: "Auditoría", icon: History, requiredPermission: "admin.audit.view" },
  { to: "/admin/plans", label: "Planes & Billing", icon: CreditCard, requiredPermission: "admin.billing.view" },
  { to: "/admin/notifications", label: "Notificaciones", icon: Bell, requiredPermission: "admin.notifications.view" },
  { to: "/admin/feature-flags", label: "Feature Flags", icon: Flag, requiredPermission: "admin.flags.view" },
  { to: "/admin/errors", label: "Errores", icon: Bug, requiredPermission: "admin.errors.view" },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, requiredPermission: "admin.analytics.view" },
  { to: "/admin/settings", label: "Configuración", icon: Settings, requiredPermission: "admin.settings.view" },
];

function hasPermission(adminCtx: PlatformAdminContext, key: PlatformPermissionKey): boolean {
  if (adminCtx.isSuperAdmin) return true;
  return adminCtx.permissions.includes(key);
}

export function AdminSidebar({ user, isRealtimeConnected, adminCtx, stats }: AdminSidebarProps) {
  const location = useLocation();

  // Filter nav items based on admin's permissions
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => hasPermission(adminCtx, item.requiredPermission)
  );

  // Role badge
  const roleName = adminCtx.role?.display_name || "Admin";
  const roleColor = adminCtx.role?.color || "#6366F1";

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-surface">
      {/* ═══════ Brand ═══════ */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand shadow-lg"
          style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
        >
          <Shield size={17} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[13px] font-bold tracking-tight text-text-primary">GRIXI ADMIN</h1>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: isRealtimeConnected ? "#10B981" : "#EF4444" }}
            />
            <span className="text-[9px] font-medium text-text-muted">
              {isRealtimeConnected ? "Live" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* ═══════ Quick Stats ═══════ */}
      {stats && (
        <div className="grid grid-cols-3 gap-0 border-b border-border">
          {[
            { label: "Orgs", value: stats.orgs, color: "#6366F1" },
            { label: "Users", value: stats.users, color: "#EC4899" },
            { label: "24h", value: stats.audit24h, color: "#10B981" },
          ].map((s) => (
            <div key={s.label} className="px-3 py-3 text-center">
              <p className="text-sm font-bold tabular-nums text-text-primary">{s.value}</p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ═══════ Navigation ═══════ */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-0.5">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-brand/10 text-brand"
                    : "text-text-secondary hover:bg-muted hover:text-text-primary"
                }`}
              >
                <Icon
                  size={16}
                  className={`shrink-0 transition-colors ${
                    isActive ? "text-brand" : "text-text-muted group-hover:text-text-primary"
                  }`}
                />
                <span>{item.label}</span>
                {/* Realtime indicator for Audit */}
                {item.to === "/admin/audit" && isRealtimeConnected && (
                  <Radio size={10} className="ml-auto animate-pulse text-success" />
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* ═══════ User & Role & Logout ═══════ */}
      <div className="border-t border-border px-4 py-3">
        {/* Role badge */}
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${roleColor}15`, color: roleColor }}
          >
            {adminCtx.isSuperAdmin ? <Lock size={9} /> : <ShieldCheck size={9} />}
            {roleName}
          </div>
          {adminCtx.scopedOrgIds && (
            <span className="text-[9px] text-text-muted">
              {adminCtx.scopedOrgIds.length} org{adminCtx.scopedOrgIds.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* User info */}
        <div className="mb-3 flex items-center gap-3">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="h-8 w-8 rounded-full ring-2 ring-brand/20"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-text-primary">{user.name}</p>
            <p className="truncate text-[9px] text-text-muted">{user.email}</p>
          </div>
        </div>
        <Form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-[11px] font-medium text-text-muted transition-all hover:border-error/30 hover:bg-error/5 hover:text-error"
          >
            <LogOut size={13} />
            Cerrar Sesión
          </button>
        </Form>
      </div>
    </aside>
  );
}
