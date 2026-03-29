/**
 * PermissionGate — Conditionally render children based on user permissions.
 * This is a UX guard only. RLS enforces actual security.
 *
 * Usage:
 *   <PermissionGate permission="finance.manage">
 *     <Button>Crear Asiento</Button>
 *   </PermissionGate>
 *
 *   <PermissionGate anyOf={["finance.view", "finance.manage"]} fallback={<UpgradePrompt />}>
 *     <FinanceDashboard />
 *   </PermissionGate>
 */
import type { ReactNode } from "react";
import { useHasPermission, useHasAnyPermission, useHasAllPermissions } from "~/lib/rbac/hooks";

interface PermissionGateProps {
  /** Single permission to check */
  permission?: string;
  /** Require ALL of these permissions */
  allOf?: string[];
  /** Require ANY of these permissions */
  anyOf?: string[];
  /** Content to show if permission check fails */
  fallback?: ReactNode;
  /** Content to show if permission check passes */
  children: ReactNode;
}

export function PermissionGate({ permission, allOf, anyOf, fallback = null, children }: PermissionGateProps) {
  let hasAccess = false;

  if (permission) {
    hasAccess = useHasPermission(permission);
  } else if (allOf) {
    hasAccess = useHasAllPermissions(allOf);
  } else if (anyOf) {
    hasAccess = useHasAnyPermission(anyOf);
  } else {
    // No permission specified, always render
    hasAccess = true;
  }

  if (!hasAccess) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * PlatformAdminGate — Only render for Platform Admins.
 */
import { useTenant } from "~/lib/rbac/hooks";

interface PlatformAdminGateProps {
  fallback?: ReactNode;
  children: ReactNode;
}

export function PlatformAdminGate({ fallback = null, children }: PlatformAdminGateProps) {
  const { isPlatformAdmin } = useTenant();
  if (!isPlatformAdmin) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * OrgAdminGate — Only render for Org Admins or above (Owner, Admin, Platform Admin).
 */
import { useIsOrgAdmin } from "~/lib/rbac/hooks";

interface OrgAdminGateProps {
  fallback?: ReactNode;
  children: ReactNode;
}

export function OrgAdminGate({ fallback = null, children }: OrgAdminGateProps) {
  const isAdmin = useIsOrgAdmin();
  if (!isAdmin) return <>{fallback}</>;
  return <>{children}</>;
}
