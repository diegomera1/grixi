import { useOutletContext } from "react-router";
import type { TenantContext } from "./authenticated";

export default function DashboardPage() {
  const { user, currentOrg } = useOutletContext<TenantContext>();

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          ¡Bienvenido, {user.name}!
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
          {currentOrg ? `${currentOrg.name} — Tu plataforma empresarial inteligente.` : "Tu plataforma empresarial inteligente está lista."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { name: "Dashboard", desc: "KPIs y métricas principales", progress: 15, color: "#6366F1" },
          { name: "Almacenes", desc: "Inventario, racks, vista 3D", progress: 0, color: "#16A34A" },
          { name: "Compras", desc: "POs, proveedores, aprobaciones", progress: 0, color: "#F59E0B" },
          { name: "Finanzas", desc: "Libro Mayor, CxC, CxP", progress: 0, color: "#3B82F6" },
          { name: "RRHH", desc: "Empleados, asistencia, nómina", progress: 0, color: "#EC4899" },
          { name: "Flota", desc: "Vehículos, mantenimiento, logística", progress: 0, color: "#06B6D4" },
        ].map((module, i) => (
          <div
            key={module.name}
            className="rounded-xl border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold"
                style={{ backgroundColor: `${module.color}20`, color: module.color }}
              >
                {module.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>{module.name}</h3>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{module.desc}</p>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: "var(--muted)" }}>
              <div
                className="h-1.5 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(module.progress, 3)}%`,
                  backgroundColor: module.color,
                  opacity: module.progress > 0 ? 1 : 0.3,
                }}
              />
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {module.progress > 0 ? `${module.progress}% completado` : "En desarrollo"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
