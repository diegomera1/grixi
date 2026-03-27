import { Outlet, useOutletContext } from "react-router";
import type { TenantContext } from "./authenticated";

export default function Finanzas() {
  const ctx = useOutletContext<TenantContext>();

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Finanzas</h1>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
          Módulo de finanzas · {ctx.currentOrg?.name || "Sin organización"}
        </p>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] py-20" style={{ minHeight: 400 }}>
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Módulo en construcción</h2>
        <p className="mt-1 text-[11px] text-[var(--text-muted)] max-w-xs text-center">
          El módulo de finanzas estará disponible próximamente. Incluirá libro mayor, cuentas por cobrar, cuentas por pagar y presupuestos.
        </p>
      </div>
    </div>
  );
}
