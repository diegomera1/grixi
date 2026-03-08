import { createClient } from "@/lib/supabase/server";
import { RolesContent } from "@/features/usuarios/components/roles-content";

export const metadata = {
  title: "Roles y Permisos",
};

export default async function RolesPage() {
  const supabase = await createClient();

  // Fetch roles for Org 1
  const { data: roles } = await supabase
    .from("roles")
    .select("*")
    .eq("org_id", "a0000000-0000-0000-0000-000000000001")
    .order("name");

  // Fetch all permissions
  const { data: permissions } = await supabase
    .from("permissions")
    .select("*")
    .order("module, action");

  // Fetch role-permission mappings
  const roleIds = (roles || []).map((r) => r.id);
  const { data: rolePermissions } = await supabase
    .from("role_permissions")
    .select("role_id, permission_id")
    .in("role_id", roleIds);

  // Count users per role
  const { data: userRoleCounts } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("org_id", "a0000000-0000-0000-0000-000000000001");

  const countMap = new Map<string, number>();
  for (const ur of userRoleCounts || []) {
    countMap.set(ur.role_id, (countMap.get(ur.role_id) || 0) + 1);
  }

  // Build permission map per role
  const permMap = new Map<string, Set<string>>();
  for (const rp of rolePermissions || []) {
    if (!permMap.has(rp.role_id)) permMap.set(rp.role_id, new Set());
    permMap.get(rp.role_id)!.add(rp.permission_id);
  }

  const enrichedRoles = (roles || []).map((role) => ({
    ...role,
    userCount: countMap.get(role.id) || 0,
    permissionIds: [...(permMap.get(role.id) || [])],
  }));

  return (
    <RolesContent
      roles={enrichedRoles}
      permissions={permissions || []}
    />
  );
}
