import { redirect, useLoaderData, Outlet } from "react-router";
import type { Route } from "./+types/authenticated";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { Sidebar, SidebarProvider } from "~/components/layout/sidebar";
import { Topbar } from "~/components/layout/topbar";

export interface TenantContext {
  user: { id: string; email: string; name: string; avatar?: string };
  isPlatformAdmin: boolean;
  currentOrg: { id: string; name: string; slug: string; role: string; settings: any } | null;
  organizations: Array<{ id: string; name: string; slug: string; role: string }>;
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
    .select("organization_id, roles(name), organizations(id, name, slug, settings)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const organizations = (memberships || []).map((m: any) => ({
    id: m.organizations?.id,
    name: m.organizations?.name,
    slug: m.organizations?.slug,
    role: m.roles?.name || "member",
    settings: m.organizations?.settings,
  })).filter((o: any) => o.id);

  // Resolve current org: subdomain > URL ?org= > cookie > first membership
  const url = new URL(request.url);
  const orgParam = url.searchParams.get("org");
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieOrgId = cookieHeader.match(/grixi_org=([^;]+)/)?.[1];

  let currentOrg = null;

  // 1. Subdomain slug takes highest priority
  if (tenantSlug) {
    currentOrg = organizations.find((o: any) => o.slug === tenantSlug) || null;
    // If platform admin, allow accessing any org by subdomain even without membership
    if (!currentOrg && platformAdmin) {
      const { data: orgBySlug } = await admin
        .from("organizations")
        .select("id, name, slug, settings")
        .eq("slug", tenantSlug)
        .maybeSingle();
      if (orgBySlug) {
        currentOrg = { ...orgBySlug, role: "platform_admin" };
      }
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
      organizations,
      tenantSlug,
    } satisfies TenantContext,
    { headers: responseHeaders }
  );
}

function AuthenticatedContent() {
  const data = useLoaderData<typeof loader>() as TenantContext;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      <Sidebar isPlatformAdmin={data.isPlatformAdmin} tenantSlug={data.tenantSlug} />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar user={data.user} currentOrg={data.currentOrg} organizations={data.organizations} />
        <main className="platform-dot-grid relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-6 md:px-6 lg:px-8">
          <div className="relative z-10 pt-4">
            <Outlet context={data} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <AuthenticatedContent />
    </SidebarProvider>
  );
}
