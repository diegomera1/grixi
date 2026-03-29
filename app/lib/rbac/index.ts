/**
 * RBAC Module — Centralized exports for roles, permissions, and access control.
 */
export {
  useTenant,
  useHasPermission,
  useHasAllPermissions,
  useHasAnyPermission,
  useIsOrgAdmin,
  useCanManageUser,
} from "./hooks";
