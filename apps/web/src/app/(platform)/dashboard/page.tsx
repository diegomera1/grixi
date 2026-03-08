import { createClient } from "@/lib/supabase/server";
import { LayoutDashboard, Users, Shield, Warehouse, Bot } from "lucide-react";

const modules = [
  {
    title: "Usuarios",
    description: "Gestión de personas, roles y permisos",
    href: "/usuarios",
    icon: Users,
    color: "#3B82F6",
  },
  {
    title: "Administración",
    description: "Auditoría, tracking y sesiones",
    href: "/administracion",
    icon: Shield,
    color: "#EF4444",
  },
  {
    title: "Almacenes",
    description: "Warehouse 2D/3D, inventario, racks",
    href: "/almacenes",
    icon: Warehouse,
    color: "#10B981",
  },
  {
    title: "Asistente IA",
    description: "Chat inteligente con Gemini",
    href: "/asistente",
    icon: Bot,
    color: "#7C3AED",
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Hola, {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario"} 👋
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Bienvenido a la plataforma de interconexión inteligente de tu empresa.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Usuarios activos", value: "0", change: "+0%", icon: Users },
          { label: "Acciones hoy", value: "0", change: "+0%", icon: LayoutDashboard },
          { label: "Almacenes", value: "0", change: "", icon: Warehouse },
          { label: "Consultas IA", value: "0", change: "", icon: Bot },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl p-5 transition-all duration-200"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                {kpi.label}
              </span>
              <kpi.icon size={16} style={{ color: "var(--text-tertiary)" }} />
            </div>
            <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {kpi.value}
            </div>
            {kpi.change && (
              <span className="text-xs mt-1" style={{ color: "var(--color-success)" }}>
                {kpi.change}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Module Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Módulos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {modules.map((mod) => (
            <a
              key={mod.href}
              href={mod.href}
              className="group rounded-xl p-5 transition-all duration-200 hover:shadow-md"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-primary)",
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${mod.color}15`, color: mod.color }}
                >
                  <mod.icon size={20} />
                </div>
                <div>
                  <h3
                    className="font-semibold group-hover:underline"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {mod.title}
                  </h3>
                  <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {mod.description}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
