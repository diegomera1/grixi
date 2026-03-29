import { redirect, useLoaderData, Outlet } from "react-router";
import { useState, useEffect, type ComponentType } from "react";
import type { Route } from "./+types/authenticated";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";

// Client-only wrapper to avoid SSR issues with framer-motion + browser APIs  
function ClientOnlyOrb({ data }: { data: any }) {
  const [Orb, setOrb] = useState<ComponentType<{ data: any }> | null>(null);
  useEffect(() => {
    import("~/components/layout/grixi-orb").then((m) => setOrb(() => m.GrixiOrb));
  }, []);
  if (!Orb) return null;
  return <Orb data={data} />;
}

export interface TenantContext {
  user: { id: string; email: string; name: string; avatar?: string };
  isPlatformAdmin: boolean;
  currentOrg: {
    id: string; name: string; slug: string; role: string;
    status: string; settings: any; hierarchyLevel: number;
  } | null;
  /** User's permission keys for the current org (e.g. ['dashboard.view', 'finance.manage']) */
  permissions: string[];
  organizations: Array<{ id: string; name: string; slug: string; role: string; status: string }>;
  /** Subdomain slug from URL, e.g. "empresa-x" from empresa-x.grixi.ai */
  tenantSlug: string | null;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const tenantSlug = (context as any).tenantSlug as string | null;
  const { supabase, headers } = createSupabaseServerClient(request, env);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/", { headers });

  const admin = createSupabaseAdminClient(env);

  // Platform admin check
  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Resolve user's organizations via memberships
  const { data: memberships } = await admin
    .from("memberships")
    .select("organization_id, status, roles(name, hierarchy_level), organizations(id, name, slug, status, settings)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const organizations = (memberships || []).map((m: any) => ({
    id: m.organizations?.id,
    name: m.organizations?.name,
    slug: m.organizations?.slug,
    role: m.roles?.name || "member",
    status: m.organizations?.status || "active",
    settings: m.organizations?.settings,
    hierarchyLevel: m.roles?.hierarchy_level || 0,
  })).filter((o: any) => o.id);

  // Resolve current org: subdomain > URL ?org= > cookie > first membership
  const url = new URL(request.url);
  const orgParam = url.searchParams.get("org");
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieOrgId = cookieHeader.match(/grixi_org=([^;]+)/)?.[1];

  let currentOrg: TenantContext["currentOrg"] = null;

  // 1. Subdomain slug takes highest priority
  if (tenantSlug) {
    currentOrg = organizations.find((o: any) => o.slug === tenantSlug) || null;
    if (!currentOrg && platformAdmin) {
      const { data: orgBySlug } = await admin
        .from("organizations")
        .select("id, name, slug, status, settings")
        .eq("slug", tenantSlug)
        .maybeSingle();
      if (orgBySlug) {
        currentOrg = { ...orgBySlug, role: "platform_admin", hierarchyLevel: 999 };
      }
    }
    if (!currentOrg && !platformAdmin) {
      return redirect("/unauthorized", { headers });
    }
  }

  // 2. URL param
  if (!currentOrg && orgParam) {
    currentOrg = organizations.find((o: any) => o.id === orgParam || o.slug === orgParam) || null;
  }

  // 3. Cookie
  if (!currentOrg && cookieOrgId) {
    currentOrg = organizations.find((o: any) => o.id === cookieOrgId) || null;
  }

  // 4. First membership
  if (!currentOrg && organizations.length > 0) {
    currentOrg = organizations[0];
  }

  // ── RBAC Enforcement: org.status check ──
  if (currentOrg && currentOrg.status === "suspended" && !platformAdmin) {
    return redirect("/suspended", { headers });
  }

  // ── Fetch user permissions for current org ──
  let permissions: string[] = [];
  if (currentOrg) {
    if (platformAdmin) {
      // Platform admins get ALL permissions
      const { data: allPerms } = await admin.from("permissions").select("key");
      permissions = (allPerms || []).map((p: any) => p.key);
    } else {
      // Regular users: permissions from their role in this org
      const { data: userPerms } = await admin
        .from("memberships")
        .select("roles(role_permissions(permissions(key)))")
        .eq("user_id", user.id)
        .eq("organization_id", currentOrg.id)
        .eq("status", "active")
        .maybeSingle();
      
      const rolePerms = (userPerms as any)?.roles?.role_permissions || [];
      permissions = rolePerms.map((rp: any) => rp.permissions?.key).filter(Boolean);
    }
  }

  // Set org cookie for persistence
  const responseCookies: string[] = [];
  if (currentOrg) {
    responseCookies.push(`grixi_org=${currentOrg.id}; Path=/; SameSite=Lax; Secure; Max-Age=31536000`);
  }

  const responseHeaders = new Headers(headers);
  responseCookies.forEach(c => responseHeaders.append("Set-Cookie", c));

  return Response.json(
    {
      user: {
        id: user.id,
        email: user.email || "",
        name: user.user_metadata?.full_name || user.email || "Usuario",
        avatar: user.user_metadata?.avatar_url,
      },
      isPlatformAdmin: !!platformAdmin,
      currentOrg,
      permissions,
      organizations,
      tenantSlug,
    } satisfies TenantContext,
    { headers: responseHeaders }
  );
}

export default function AuthenticatedLayout() {
  const data = useLoaderData<typeof loader>() as TenantContext;

  return (
    <div className="relative h-screen overflow-hidden bg-bg-primary">
      {/* Main content — full screen */}
      <main className="platform-dot-grid relative h-full overflow-y-auto overflow-x-hidden px-4 pb-6 md:px-6 lg:px-8">
        <div className="relative z-10 pt-6">
          <Outlet context={data} />
        </div>
      </main>

      {/* GRIXI Orb — floating navigation + AI (client-only) */}
      <ClientOnlyOrb data={data} />
    </div>
  );
}
