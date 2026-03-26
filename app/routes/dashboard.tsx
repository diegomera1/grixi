import { redirect, useLoaderData, Link } from "react-router";
import type { Route } from "./+types/dashboard";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request, context.cloudflare.env);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  return Response.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email,
        avatar: user.user_metadata?.avatar_url,
      },
    },
    { headers }
  );
}

export default function DashboardPage() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            <span className="text-[var(--primary)]">GRIXI</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {user.avatar && (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-8 w-8 rounded-full"
              />
            )}
            <span className="text-sm text-[var(--muted-foreground)]">{user.email}</span>
          </div>
          <Link
            to="/auth/signout"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Cerrar sesión
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="p-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[var(--foreground)] mb-2">
            ¡Bienvenido, {user.name}!
          </h2>
          <p className="text-[var(--muted-foreground)] mb-8">
            Tu plataforma empresarial inteligente está lista.
          </p>

          {/* Placeholder cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {["Dashboard", "Almacenes", "Compras"].map((module) => (
              <div
                key={module}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
              >
                <h3 className="font-semibold text-[var(--foreground)] mb-1">{module}</h3>
                <p className="text-sm text-[var(--muted-foreground)]">Módulo en desarrollo</p>
                <div className="mt-4 h-2 w-full rounded-full bg-[var(--muted)]">
                  <div className="h-2 rounded-full bg-[var(--primary)] w-1/6" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
