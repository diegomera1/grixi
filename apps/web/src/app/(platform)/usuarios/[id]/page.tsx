import { createClient } from "@/lib/supabase/server";
import { UserProfileContent } from "@/features/usuarios/components/user-profile-content";
import { notFound } from "next/navigation";
import { HIDDEN_USER_IDS } from "@/config/hidden-users";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", id)
    .single();

  return {
    title: profile?.full_name || "Perfil de Usuario",
  };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch user profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !profile || HIDDEN_USER_IDS.includes(id)) {
    notFound();
  }

  // Fetch user roles
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("roles(name, color, description)")
    .eq("user_id", id);

  // Fetch recent activity
  const { data: recentActivity } = await supabase
    .from("audit_logs")
    .select("id, action, resource_type, new_data, created_at")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Fetch organizations
  const { data: orgs } = await supabase
    .from("organization_members")
    .select("organizations(name, slug)")
    .eq("user_id", id);

  const roles = (userRoles || []).map((ur) => ur.roles as unknown as { name: string; color: string; description: string });
  const organizations = (orgs || []).map((o) => o.organizations as unknown as { name: string; slug: string });

  return (
    <UserProfileContent
      profile={profile}
      roles={roles}
      organizations={organizations}
      recentActivity={recentActivity || []}
    />
  );
}
