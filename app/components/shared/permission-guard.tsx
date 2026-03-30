import type { ReactNode } from "react";
import { usePermission, usePermissionAny } from "~/lib/hooks/use-permissions";

interface PermissionGuardProps {
  /** Single permission key to check */
  permission?: string;
  /** Multiple permission keys — user needs ANY of them */
  anyOf?: string[];
  /** Content to show if user has permission */
  children: ReactNode;
  /** Optional fallback content when permission is denied */
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on user permissions.
 * Platform admins always pass.
 * 
 * @example
 * <PermissionGuard permission="finance.view">
 *   <FinanceWidget />
 * </PermissionGuard>
 * 
 * <PermissionGuard anyOf={["members.manage", "roles.manage"]}>
 *   <AdminPanel />
 * </PermissionGuard>
 */
export function PermissionGuard({ permission, anyOf, children, fallback = null }: PermissionGuardProps) {
  const hasSingle = permission ? usePermission(permission) : true;
  const hasAny = anyOf ? usePermissionAny(anyOf) : true;

  if (hasSingle && hasAny) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
