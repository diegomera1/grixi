import { useOutletContext } from "react-router";
import type { TenantContext } from "~/routes/authenticated";

/**
 * Typed access to the TenantContext from any authenticated route.
 */
export function useTenantContext(): TenantContext {
  return useOutletContext<TenantContext>();
}

/**
 * Check if the current user has a specific permission key.
 * @example const canViewFinance = usePermission("finance.view");
 */
export function usePermission(key: string): boolean {
  const ctx = useTenantContext();
  if (ctx.isPlatformAdmin) return true;
  return ctx.permissions.includes(key);
}

/**
 * Check if the current user has ANY of the specified permissions.
 * @example const canAdmin = usePermissionAny(["members.manage", "roles.manage", "org.configure"]);
 */
export function usePermissionAny(keys: string[]): boolean {
  const ctx = useTenantContext();
  if (ctx.isPlatformAdmin) return true;
  return keys.some((k) => ctx.permissions.includes(k));
}

/**
 * Get all permission keys for the current user.
 */
export function usePermissions(): string[] {
  const ctx = useTenantContext();
  return ctx.permissions;
}

/**
 * Get the current user's role name in this org.
 */
export function useRole(): string {
  const ctx = useTenantContext();
  return ctx.currentOrg?.role || "viewer";
}
