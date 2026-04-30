/**
 * Platform Admin RBAC — Frontend Hooks
 *
 * UX-only guards for hiding/showing admin UI elements.
 * Security is enforced server-side via guard.server.ts.
 */
import { useOutletContext } from "react-router";
import type { PlatformAdminContext, PlatformPermissionKey } from "./types";

// Extended admin context passed from admin-layout
export interface AdminLayoutContext {
  user: { id: string; email: string; name: string; avatar?: string };
  adminCtx: PlatformAdminContext;
  stats: {
    orgs: number;
    users: number;
    activeMemberships: number;
    invitations: number;
    audit24h: number;
  };
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/**
 * Access the full admin layout context.
 */
export function useAdminLayout(): AdminLayoutContext {
  return useOutletContext<AdminLayoutContext>();
}

/**
 * Access the platform admin RBAC context.
 */
export function usePlatformAdmin(): PlatformAdminContext {
  const { adminCtx } = useAdminLayout();
  return adminCtx;
}

/**
 * Check if the current platform admin has a specific permission.
 */
export function useHasPlatformPermission(permission: PlatformPermissionKey): boolean {
  const { isSuperAdmin, permissions } = usePlatformAdmin();
  if (isSuperAdmin) return true;
  return permissions.includes(permission);
}

/**
 * Check if the current platform admin has ANY of the specified permissions.
 */
export function useHasAnyPlatformPermission(requiredPerms: PlatformPermissionKey[]): boolean {
  const { isSuperAdmin, permissions } = usePlatformAdmin();
  if (isSuperAdmin) return true;
  return requiredPerms.some((p) => permissions.includes(p));
}

/**
 * Check if the current platform admin has ALL of the specified permissions.
 */
export function useHasAllPlatformPermissions(requiredPerms: PlatformPermissionKey[]): boolean {
  const { isSuperAdmin, permissions } = usePlatformAdmin();
  if (isSuperAdmin) return true;
  return requiredPerms.every((p) => permissions.includes(p));
}

/**
 * Check if the current admin is a super admin.
 */
export function useIsSuperAdmin(): boolean {
  const { isSuperAdmin } = usePlatformAdmin();
  return isSuperAdmin;
}

/**
 * Check if the current admin can manage another admin (hierarchy check).
 * Super admins cannot be degraded from UI.
 */
export function useCanManageAdmin(targetHierarchyLevel: number, targetIsSuperAdmin: boolean): boolean {
  const { isSuperAdmin, role } = usePlatformAdmin();
  if (targetIsSuperAdmin) return false; // Can't manage super admins
  if (isSuperAdmin) return true;
  return role.hierarchy_level > targetHierarchyLevel;
}

/**
 * Get the list of platform permissions the current admin has.
 */
export function usePlatformPermissions(): PlatformPermissionKey[] {
  const { permissions } = usePlatformAdmin();
  return permissions;
}
