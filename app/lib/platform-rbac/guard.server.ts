/**
 * Platform Admin RBAC — Server Guards
 *
 * Centralized permission enforcement for all admin routes.
 * Replaces the repetitive platform_admins check in every route.
 *
 * Usage in loaders/actions:
 *   const adminCtx = await requirePlatformAdmin(request, env, context);
 *   requirePlatformPermission(adminCtx, "admin.orgs.view", headers);
 */
import { redirect } from "react-router";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { isPlatformTenant } from "~/lib/platform-guard";
import { getCachedOrFetch, cacheKey, CACHE_TTL } from "~/lib/cache/kv";
import type {
  PlatformAdminContext,
  PlatformPermissionKey,
  PlatformRole,
} from "./types";

/**
 * Load and validate a platform admin's full context (role + permissions + scope).
 * Throws redirect if not a valid platform admin or not on admin portal.
 *
 * @returns PlatformAdminContext with userId, role, permissions, scopedOrgIds, isSuperAdmin
 */
export async function requirePlatformAdmin(
  request: Request,
  env: any,
  context: any,
): Promise<{ adminCtx: PlatformAdminContext; supabaseHeaders: Headers }> {
  const { supabase, headers } = createSupabaseServerClient(request, env);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw redirect("/", { headers });

  // Must be on admin.grixi.ai
  if (!isPlatformTenant(context)) throw redirect("/dashboard", { headers });

  const admin = createSupabaseAdminClient(env);
  const kv = (env as any).KV_CACHE as KVNamespace | undefined;

  // Fetch platform admin record with role (cached 3 min)
  const { data: platformAdmin } = await getCachedOrFetch(
    kv,
    `platform_admin_ctx:${user.id}`,
    async () => {
      const { data } = await admin
        .from("platform_admins")
        .select(`
          id, user_id, role_id, scoped_org_ids, granted_by, granted_at, notes,
          platform_roles!inner (
            id, name, display_name, description, hierarchy_level,
            is_system, is_super_admin, color
          )
        `)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    180 // 3 minutes
  );

  if (!platformAdmin) throw redirect("/unauthorized", { headers });

  const role = (platformAdmin as any).platform_roles as PlatformRole;

  // Load permissions for this role (cached 3 min)
  let permissions: PlatformPermissionKey[] = [];
  if (role.is_super_admin) {
    // Super admins get ALL permissions
    const { data: allPerms } = await getCachedOrFetch(
      kv,
      "platform_all_permissions",
      async () => {
        const { data } = await admin.from("platform_permissions").select("key");
        return data;
      },
      300 // 5 minutes — permissions catalog rarely changes
    );
    permissions = (allPerms || []).map((p: any) => p.key as PlatformPermissionKey);
  } else {
    const { data: rolePerms } = await getCachedOrFetch(
      kv,
      `platform_role_perms:${role.id}`,
      async () => {
        const { data } = await admin
          .from("platform_role_permissions")
          .select("platform_permissions!inner(key)")
          .eq("role_id", role.id);
        return data;
      },
      180
    );
    permissions = (rolePerms || []).map(
      (rp: any) => (rp as any).platform_permissions?.key as PlatformPermissionKey
    ).filter(Boolean);
  }

  return {
    adminCtx: {
      userId: user.id,
      role,
      permissions,
      scopedOrgIds: (platformAdmin as any).scoped_org_ids || null,
      isSuperAdmin: role.is_super_admin,
    },
    supabaseHeaders: headers,
  };
}

/**
 * Check if the admin has a specific permission. Throws redirect/403 if not.
 */
export function requirePlatformPermission(
  adminCtx: PlatformAdminContext,
  requiredKey: PlatformPermissionKey,
  headers: Headers,
  redirectTo = "/admin"
): void {
  if (adminCtx.isSuperAdmin) return;
  if (!adminCtx.permissions.includes(requiredKey)) {
    throw redirect(redirectTo, { headers });
  }
}

/**
 * Check if the admin has ANY of the specified permissions.
 */
export function requirePlatformPermissionAny(
  adminCtx: PlatformAdminContext,
  requiredKeys: PlatformPermissionKey[],
  headers: Headers,
  redirectTo = "/admin"
): void {
  if (adminCtx.isSuperAdmin) return;
  if (!requiredKeys.some((k) => adminCtx.permissions.includes(k))) {
    throw redirect(redirectTo, { headers });
  }
}

/**
 * Check if the admin has ALL of the specified permissions.
 */
export function requirePlatformPermissionAll(
  adminCtx: PlatformAdminContext,
  requiredKeys: PlatformPermissionKey[],
  headers: Headers,
  redirectTo = "/admin"
): void {
  if (adminCtx.isSuperAdmin) return;
  if (!requiredKeys.every((k) => adminCtx.permissions.includes(k))) {
    throw redirect(redirectTo, { headers });
  }
}

/**
 * Check if an admin can manage another admin (based on hierarchy level).
 * A higher hierarchy level can manage lower levels.
 * Super admins can manage everyone except other super admins (unless they ARE the last super admin).
 */
export function canManagePlatformAdmin(
  actor: PlatformAdminContext,
  targetHierarchyLevel: number,
  targetIsSuperAdmin: boolean,
): boolean {
  // Super admins cannot be degraded from UI
  if (targetIsSuperAdmin) return false;
  // Must have higher hierarchy to manage
  return actor.role.hierarchy_level > targetHierarchyLevel;
}

/**
 * Filter organization IDs by admin's scope.
 * If admin has no scope (null), returns all IDs as-is.
 * If admin has scope, returns only IDs in the scope.
 */
export function filterByAdminScope(
  adminCtx: PlatformAdminContext,
  orgIds: string[],
): string[] {
  if (!adminCtx.scopedOrgIds) return orgIds; // No scope = all
  const scopeSet = new Set(adminCtx.scopedOrgIds);
  return orgIds.filter((id) => scopeSet.has(id));
}

/**
 * Check if a specific org is within the admin's scope.
 */
export function isOrgInScope(
  adminCtx: PlatformAdminContext,
  orgId: string,
): boolean {
  if (!adminCtx.scopedOrgIds) return true; // No scope = all
  return adminCtx.scopedOrgIds.includes(orgId);
}

/**
 * Invalidate all platform admin caches for a user.
 * Call this when roles/permissions change.
 */
export async function invalidatePlatformAdminCache(
  kv: KVNamespace | undefined,
  userId: string,
  roleId?: string,
): Promise<void> {
  if (!kv) return;
  await Promise.all([
    kv.delete(`platform_admin_ctx:${userId}`),
    kv.delete(cacheKey.platformAdmin(userId)),
    roleId ? kv.delete(`platform_role_perms:${roleId}`) : Promise.resolve(),
  ]);
}
