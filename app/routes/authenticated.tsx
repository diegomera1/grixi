import { redirect, useLoaderData, Outlet } from "react-router";
import type { Route } from "./+types/authenticated";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { Sidebar, SidebarProvider, useSidebar } from "~/components/layout/sidebar";
import { Topbar } from "~/components/layout/topbar";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirect("/", { headers });
  }

  // Check platform admin status (bypasses RLS)
  const admin = createSupabaseAdminClient(env);
  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return Response.json(
    {
      user: {
        id: user.id,
        email: user.email || "",
        name: user.user_metadata?.full_name || user.email || "Usuario",
        avatar: user.user_metadata?.avatar_url,
      },
      isPlatformAdmin: !!platformAdmin,
    },
    { headers }
  );
}

function AuthenticatedContent() {
  const { user, isPlatformAdmin } = useLoaderData<typeof loader>();
  const { collapsed } = useSidebar();

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <Sidebar isPlatformAdmin={isPlatformAdmin} />
      <div
        className="flex flex-1 flex-col transition-all duration-300"
        style={{ marginLeft: collapsed ? 68 : 240 }}
      >
        <Topbar user={user} />
        <main className="flex-1 p-6">
          <Outlet context={{ user, isPlatformAdmin }} />
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
