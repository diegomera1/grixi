/**
 * RBAC Hooks — Frontend permission utilities
 * These are UX-only guards. Security is enforced in the DB via RLS.
 */
import { useOutletContext } from "react-router";
import type { TenantContext } from "~/routes/authenticated";

/**
 * Access the full tenant context from the authenticated layout.
 */
export function useTenant(): TenantContext {
  return useOutletContext<TenantContext>();
}

/**
 * Check if the current user has a specific permission in the active org.
 * @param permission - Permission key, e.g. "finance.view"
 * @returns true if the user has the permission
 */
export function useHasPermission(permission: string): boolean {
  const { permissions, isPlatformAdmin } = useTenant();
  if (isPlatformAdmin) return true;
  return permissions.includes(permission);
}

/**
 * Check if the current user has ALL of the specified permissions.
 * @param requiredPermissions - Array of permission keys
 * @returns true if the user has all of them
 */
export function useHasAllPermissions(requiredPermissions: string[]): boolean {
  const { permissions, isPlatformAdmin } = useTenant();
  if (isPlatformAdmin) return true;
  return requiredPermissions.every((p) => permissions.includes(p));
}

/**
 * Check if the current user has ANY of the specified permissions.
 * @param requiredPermissions - Array of permission keys
 * @returns true if the user has at least one
 */
export function useHasAnyPermission(requiredPermissions: string[]): boolean {
  const { permissions, isPlatformAdmin } = useTenant();
  if (isPlatformAdmin) return true;
  return requiredPermissions.some((p) => permissions.includes(p));
}

/**
 * Check if the user is an org admin or above (owner/admin/platform_admin).
 */
export function useIsOrgAdmin(): boolean {
  const { currentOrg, isPlatformAdmin } = useTenant();
  if (isPlatformAdmin) return true;
  if (!currentOrg) return false;
  return currentOrg.hierarchyLevel >= 80;
}

/**
 * Check if the user can manage another user based on hierarchy level.
 * A user can only manage users with a LOWER hierarchy level.
 * @param targetHierarchyLevel - The target user's hierarchy level
 */
export function useCanManageUser(targetHierarchyLevel: number): boolean {
  const { currentOrg, isPlatformAdmin } = useTenant();
  if (isPlatformAdmin) return true;
  if (!currentOrg) return false;
  return currentOrg.hierarchyLevel > targetHierarchyLevel;
}
