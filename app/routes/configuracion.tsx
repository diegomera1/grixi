import { redirect, useLoaderData, Outlet, NavLink } from "react-router";
import type { Route } from "./+types/configuracion";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { requirePermissionAny } from "~/lib/permission-guard.server";
import { Users, Mail, Shield, ScrollText, Building2, ArrowLeft } from "lucide-react";
import type { TenantContext } from "./authenticated";
import { useOutletContext } from "react-router";

const TABS = [
  { id: "equipo", label: "Equipo", href: "/configuracion", icon: Users, end: true },
  { id: "invitaciones", label: "Invitaciones", href: "/configuracion/invitaciones", icon: Mail },
  { id: "roles", label: "Roles y Permisos", href: "/configuracion/roles", icon: Shield },
  { id: "auditoria", label: "Auditoría", href: "/configuracion/auditoria", icon: ScrollText },
  { id: "organizacion", label: "Organización", href: "/configuracion/organizacion", icon: Building2 },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);
  const tenantSlug = (context as any).tenantSlug as string | null;

  // Resolve current org
  if (!tenantSlug) return redirect("/dashboard", { headers });

  const { data: org } = await admin.from("organizations")
    .select("id, name, slug, status, settings")
    .eq("slug", tenantSlug)
    .maybeSingle();

  if (!org) return redirect("/dashboard", { headers });

  // Check platform admin
  const { data: pa } = await admin.from("platform_admins")
    .select("user_id").eq("user_id", user.id).maybeSingle();

  // Check membership & permissions
  const { data: membership } = await admin.from("memberships")
    .select("status, roles(name, hierarchy_level, role_permissions(permissions(key)))")
    .eq("user_id", user.id)
    .eq("organization_id", org.id)
    .eq("status", "active")
    .maybeSingle();

  const isPlatformAdmin = !!pa;
  let permissions: string[] = [];

  if (isPlatformAdmin) {
    const { data: allPerms } = await admin.from("permissions").select("key");
    permissions = (allPerms || []).map((p: any) => p.key);
  } else if (membership) {
    const rolePerms = (membership as any)?.roles?.role_permissions || [];
    permissions = rolePerms.map((rp: any) => rp.permissions?.key).filter(Boolean);
  }

  // Guard: Must have at least one config-related permission
  requirePermissionAny(
    permissions,
    isPlatformAdmin,
    ["org.configure", "members.manage", "roles.manage", "admin.audit"],
    headers
  );

  return Response.json({
    org,
    permissions,
    isPlatformAdmin,
    userRole: (membership as any)?.roles?.name || (isPlatformAdmin ? "platform_admin" : "member"),
  }, { headers });
}

export interface ConfigContext {
  org: { id: string; name: string; slug: string; status: string; settings: any };
  permissions: string[];
  isPlatformAdmin: boolean;
  userRole: string;
  tenantContext: TenantContext;
}

export default function ConfiguracionLayout() {
  const loaderData = useLoaderData<typeof loader>() as any;
  const tenantContext = useOutletContext<TenantContext>();
  const { org, permissions, isPlatformAdmin, userRole } = loaderData;

  const configContext: ConfigContext = {
    org, permissions, isPlatformAdmin, userRole, tenantContext,
  };

  const hasPerm = (key: string) => isPlatformAdmin || permissions.includes(key);

  return (
    <div className="animate-in fade-in duration-500 mx-auto max-w-[1200px]">
      {/* Header */}
      <div className="mb-8">
        <NavLink to="/dashboard" className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-white/5 mb-4" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft size={16} /> Dashboard
        </NavLink>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold"
            style={{ backgroundColor: (org.settings?.primary_color || "#7c3aed") + "20", color: org.settings?.primary_color || "#7c3aed" }}>
            {org.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Configuración</h1>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{org.name} · {org.slug}.grixi.ai</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((tab) => {
          // Check permission for each tab
          const tabPerms: Record<string, string | string[]> = {
            equipo: "members.manage",
            invitaciones: "members.manage",
            roles: "roles.manage",
            auditoria: "admin.audit",
            organizacion: "org.configure",
          };
          const requiredPerm = tabPerms[tab.id];
          const hasAccess = isPlatformAdmin || (
            Array.isArray(requiredPerm)
              ? requiredPerm.some(p => permissions.includes(p))
              : permissions.includes(requiredPerm as string)
          );
          if (!hasAccess) return null;

          return (
            <NavLink
              key={tab.id}
              to={tab.href}
              end={tab.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
                  isActive ? "border-[#7c3aed]" : "border-transparent"
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
              })}
            >
              <tab.icon size={16} /> {tab.label}
            </NavLink>
          );
        })}
      </div>

      {/* Content */}
      <Outlet context={configContext} />
    </div>
  );
}
