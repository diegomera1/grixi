import { useNavigate } from "react-router";
import { PauseCircle, Mail, ArrowLeft } from "lucide-react";

export const meta = () => [{ title: "Organización Suspendida — GRIXI" }];

export default function Suspended() {
  const navigate = useNavigate();

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ background: "#09090B", color: "#FAFAFA" }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle, #27272A 0.5px, transparent 0.5px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent 80%)",
        }}
      />

      {/* Glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full blur-[100px]"
        style={{ backgroundColor: "rgba(245, 158, 11, 0.12)" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        {/* Icon */}
        <div className="relative">
          <div className="absolute inset-0 scale-150 rounded-2xl blur-2xl" style={{ backgroundColor: "rgba(245, 158, 11, 0.15)" }} />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
            <PauseCircle className="h-8 w-8 text-amber-400" />
          </div>
        </div>

        {/* Error code */}
        <p className="text-7xl font-bold tracking-tight" style={{ color: "#F59E0B" }}>⏸</p>

        {/* Title + details */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Organización Suspendida</h1>
          <p className="max-w-sm text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
            Tu organización ha sido temporalmente suspendida. Esto puede deberse a falta de pago o una acción administrativa.
          </p>
          <p className="text-xs" style={{ color: "#71717A" }}>
            Contacta al equipo de GRIXI para más información.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <a
            href="mailto:soporte@grixi.ai"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: "#7C3AED", boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)" }}
          >
            <Mail size={16} /> Contactar Soporte
          </a>
          <button
            onClick={() => navigate("/select-org")}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:opacity-80"
            style={{ border: "1px solid #27272A", color: "#A1A1AA" }}
          >
            <ArrowLeft size={16} /> Cambiar Organización
          </button>
        </div>

        {/* Brand */}
        <p className="mt-8 text-[10px]" style={{ color: "#3F3F46" }}>
          GRIXI — La interconexión inteligente
        </p>
      </div>
    </main>
  );
}
