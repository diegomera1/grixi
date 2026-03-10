import { createClient } from "@/lib/supabase/server";
import { UsersContent } from "@/features/usuarios/components/users-content";
import { HIDDEN_USER_IDS } from "@/config/hidden-users";

export const metadata = {
  title: "Usuarios",
};

export default async function UsersPage() {
  const supabase = await createClient();

  // Fetch all profiles with their org memberships and roles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");

  // Fetch org memberships
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("user_id, org_id, organizations(name)")
    .eq("org_id", "a0000000-0000-0000-0000-000000000001"); // Default to Org 1

  // Fetch user roles
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("user_id, role_id, roles(name, color)")
    .eq("org_id", "a0000000-0000-0000-0000-000000000001");

  const memberUserIds = new Set((memberships || []).map((m) => m.user_id));
  const roleMap = new Map<string, { name: string; color: string }>();
  for (const ur of userRoles || []) {
    const role = ur.roles as unknown as { name: string; color: string };
    if (role) {
      roleMap.set(ur.user_id, role);
    }
  }

  const users = (profiles || [])
    .filter((p) => memberUserIds.has(p.id) && !HIDDEN_USER_IDS.includes(p.id))
    .map((p) => ({
      ...p,
      role: roleMap.get(p.id) || null,
    }));

  // Get unique departments for filter
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))].sort();
  const roles = [...new Set((userRoles || []).map((ur) => {
    const role = ur.roles as unknown as { name: string };
    return role?.name;
  }).filter(Boolean))].sort();

  return (
    <UsersContent
      users={users}
      departments={departments as string[]}
      roles={roles as string[]}
    />
  );
}
