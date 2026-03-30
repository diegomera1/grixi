import { redirect } from "react-router";

/**
 * Server-side permission guard for route loaders.
 * Checks if the user has the required permission.
 * Platform admins bypass all checks.
 * 
 * @example
 * // In a loader:
 * requirePermission(permissions, isPlatformAdmin, "finance.view", headers);
 */
export function requirePermission(
  permissions: string[],
  isPlatformAdmin: boolean,
  requiredKey: string,
  headers: Headers,
  redirectTo = "/dashboard"
): void {
  if (isPlatformAdmin) return;
  if (!permissions.includes(requiredKey)) {
    throw redirect(redirectTo, { headers });
  }
}

/**
 * Check if user has ANY of the specified permissions.
 */
export function requirePermissionAny(
  permissions: string[],
  isPlatformAdmin: boolean,
  requiredKeys: string[],
  headers: Headers,
  redirectTo = "/dashboard"
): void {
  if (isPlatformAdmin) return;
  if (!requiredKeys.some((k) => permissions.includes(k))) {
    throw redirect(redirectTo, { headers });
  }
}
