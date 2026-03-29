import { redirect, useLoaderData, Form } from "react-router";
import type { Route } from "./+types/select-org";
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { AnimatedNodes } from "~/components/login/animated-nodes";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // Get all orgs the user belongs to
  const admin = createSupabaseAdminClient(env);
  const { data: memberships } = await admin
    .from("memberships")
    .select("organization_id, role_id, organizations(id, name, slug), roles(name)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    return redirect("/login?error=unauthorized");
  }

  if (memberships.length === 1) {
    return redirect("/dashboard", { headers });
  }

  const orgs = memberships.map((m: any) => ({
    id: m.organizations.id,
    name: m.organizations.name,
    slug: m.organizations.slug,
    role: m.roles.name,
  }));

  return Response.json({ orgs }, { headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const orgId = formData.get("orgId") as string;

  if (!orgId) return redirect("/select-org");

  // For now, just redirect to dashboard
  // In production, this would set the active org in a cookie/session
  return redirect("/dashboard");
}

export default function SelectOrgPage() {
  const { orgs } = useLoaderData<typeof loader>();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <AnimatedNodes />

      <div className="relative z-10 w-full max-w-lg px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Selecciona una organización
          </h1>
          <p className="text-(--muted-foreground) text-sm">
            Tienes acceso a múltiples organizaciones
          </p>
        </div>

        <div className="space-y-3">
          {(orgs as any[]).map((org) => (
            <Form method="post" key={org.id}>
              <input type="hidden" name="orgId" value={org.id} />
              <button
                type="submit"
                className="group w-full glass-strong rounded-xl p-5 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-(--shadow-glow-purple) active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-(--primary)">
                      {org.name}
                    </h3>
                    <p className="text-xs text-(--muted-foreground) mt-0.5">
                      {org.slug}.grixi.io · Rol: {org.role}
                    </p>
                  </div>
                  <svg
                    className="h-5 w-5 text-(--muted-foreground) group-hover:text-(--primary) transition-transform duration-200 group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </Form>
          ))}
        </div>
      </div>
    </div>
  );
}
