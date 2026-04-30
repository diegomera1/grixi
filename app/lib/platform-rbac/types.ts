/**
 * Platform Admin RBAC — Type Definitions
 * 
 * Types for the granular platform admin permission system.
 * Platform admins have role-based permissions separate from tenant RBAC.
 */

// ── Permission Keys ──
export type PlatformPermissionModule =
  | "dashboard"
  | "organizations"
  | "users"
  | "audit"
  | "billing"
  | "notifications"
  | "feature_flags"
  | "errors"
  | "analytics"
  | "settings"
  | "roles";

export type PlatformPermissionKey =
  // Dashboard
  | "admin.dashboard.view"
  // Organizations
  | "admin.orgs.view"
  | "admin.orgs.create"
  | "admin.orgs.edit"
  | "admin.orgs.suspend"
  | "admin.orgs.delete"
  | "admin.orgs.modules"
  // Users
  | "admin.users.view"
  | "admin.users.manage"
  | "admin.users.roles"
  // Audit
  | "admin.audit.view"
  | "admin.audit.export"
  // Billing
  | "admin.billing.view"
  | "admin.billing.manage"
  // Notifications
  | "admin.notifications.view"
  | "admin.notifications.broadcast"
  // Feature Flags
  | "admin.flags.view"
  | "admin.flags.manage"
  // Errors
  | "admin.errors.view"
  | "admin.errors.manage"
  // Analytics
  | "admin.analytics.view"
  // Settings
  | "admin.settings.view"
  | "admin.settings.manage"
  // Roles
  | "admin.roles.view"
  | "admin.roles.manage";

// ── Role ──
export interface PlatformRole {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  hierarchy_level: number;
  is_system: boolean;
  is_super_admin: boolean;
  color: string;
}

// ── Platform Admin Record ──
export interface PlatformAdminRecord {
  id: string;
  user_id: string;
  role_id: string;
  scoped_org_ids: string[] | null; // null = all orgs
  granted_by: string | null;
  granted_at: string;
  notes: string | null;
  // Joined data
  role?: PlatformRole;
  user?: {
    email: string;
    name: string;
    avatar?: string;
  };
}

// ── Admin Context (passed from layout to child routes) ──
export interface PlatformAdminContext {
  /** Current admin's user ID */
  userId: string;
  /** Current admin's role */
  role: PlatformRole;
  /** Flat list of permission keys the admin has */
  permissions: PlatformPermissionKey[];
  /** Org IDs the admin is scoped to (null = all) */
  scopedOrgIds: string[] | null;
  /** Whether this admin is a super admin (bypasses all checks) */
  isSuperAdmin: boolean;
}

// ── Permission requirement for a route/action ──
export interface PlatformPermissionRequirement {
  /** Required permission key */
  key: PlatformPermissionKey;
  /** If true, redirects instead of 403 */
  redirectOnFail?: boolean;
  /** Custom redirect path (default: /admin) */
  redirectTo?: string;
}

// ── Sidebar nav item with permission requirement ──
export interface AdminNavItem {
  to: string;
  label: string;
  icon: any;
  end?: boolean;
  /** Permission required to see this item */
  requiredPermission: PlatformPermissionKey;
}
