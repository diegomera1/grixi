import { redirect, useLoaderData, Outlet } from "react-router";
import type { Route } from "./+types/authenticated";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { Sidebar, SidebarProvider, useSidebar } from "~/components/layout/sidebar";
import { Topbar } from "~/components/layout/topbar";

export interface TenantContext {
  user: { id: string; email: string; name: string; avatar?: string };
  isPlatformAdmin: boolean;
  currentOrg: { id: string; name: string; slug: string; role: string; settings: any } | null;
  organizations: Array<{ id: string; name: string; slug: string; role: string }>;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
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

  // Resolve current org: URL ?org= > cookie > first membership
  const url = new URL(request.url);
  const orgParam = url.searchParams.get("org");
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieOrgId = cookieHeader.match(/grixi_org=([^;]+)/)?.[1];

  let currentOrg = null;
  if (orgParam) {
    currentOrg = organizations.find((o: any) => o.id === orgParam || o.slug === orgParam) || null;
  }
  if (!currentOrg && cookieOrgId) {
    currentOrg = organizations.find((o: any) => o.id === cookieOrgId) || null;
  }
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
    } satisfies TenantContext,
    { headers: responseHeaders }
  );
}

function AuthenticatedContent() {
  const data = useLoaderData<typeof loader>() as TenantContext;
  const { collapsed } = useSidebar();

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <Sidebar isPlatformAdmin={data.isPlatformAdmin} />
      <div
        className="flex flex-1 flex-col transition-all duration-300"
        style={{ marginLeft: collapsed ? 68 : 240 }}
      >
        <Topbar user={data.user} currentOrg={data.currentOrg} organizations={data.organizations} />
        <main className="flex-1 p-6">
          <Outlet context={data} />
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
