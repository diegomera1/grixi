/**
 * GRIXI — Module Guard
 * 
 * Client-side guard that prevents rendering of modules not enabled
 * for the current organization. Shows a premium "module not available"
 * screen and redirects to dashboard.
 * 
 * Usage in module routes:
 *   import { ModuleGuard } from "~/components/shared/module-guard";
 *   // In component:
 *   <ModuleGuard module="finanzas">
 *     <FinanceContent ... />
 *   </ModuleGuard>
 * 
 * @module components/shared/module-guard
 */

import { useOutletContext, useNavigate } from "react-router";
import type { TenantContext } from "~/routes/authenticated";
import { ShieldOff, ArrowLeft, Lock } from "lucide-react";
import { useEffect } from "react";

interface ModuleGuardProps {
  module: string;
  children: React.ReactNode;
}

export function ModuleGuard({ module, children }: ModuleGuardProps) {
  const ctx = useOutletContext<TenantContext>();
  const navigate = useNavigate();

  // Platform admins bypass
  if (ctx?.isPlatformAdmin) return <>{children}</>;

  // Dashboard always allowed
  if (module === "dashboard") return <>{children}</>;

  const enabledModules = ctx?.enabledModules ?? ["dashboard"];
  const isEnabled = enabledModules.includes(module);

  useEffect(() => {
    if (!isEnabled) {
      // Auto-redirect after 3 seconds
      const timer = setTimeout(() => navigate("/dashboard"), 3000);
      return () => clearTimeout(timer);
    }
  }, [isEnabled, navigate]);

  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-20 px-6" style={{ minHeight: 400 }}>
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
          <Lock size={28} className="text-amber-500" />
        </div>
        <h2 className="text-base font-bold text-text-primary">Módulo no disponible</h2>
        <p className="mt-2 max-w-md text-center text-sm text-text-muted">
          El módulo <span className="font-semibold text-text-secondary">{module}</span> no está habilitado
          para tu organización. Contacta al administrador de la plataforma para activarlo.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-6 flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-medium text-white transition-all hover:opacity-90 active:scale-[0.97]"
        >
          <ArrowLeft size={14} />
          Volver al Dashboard
        </button>
        <p className="mt-3 text-[10px] text-text-muted animate-pulse">Redirigiendo en 3 segundos…</p>
      </div>
    );
  }

  return <>{children}</>;
}
