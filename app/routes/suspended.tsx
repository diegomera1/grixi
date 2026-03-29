import { useNavigate } from "react-router";
import { PauseCircle, Mail, ArrowLeft } from "lucide-react";

export default function Suspended() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="text-center max-w-md px-6">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <PauseCircle className="h-8 w-8 text-amber-400" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Organización Suspendida
        </h1>

        {/* Description */}
        <p className="text-text-secondary mb-2 text-sm">
          Tu organización ha sido temporalmente suspendida. 
          Esto puede deberse a falta de pago o una acción administrativa.
        </p>
        <p className="text-text-muted mb-8 text-xs">
          Contacta al equipo de GRIXI para más información.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="mailto:soporte@grixi.ai"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Mail size={16} />
            Contactar Soporte
          </a>
          <button
            onClick={() => navigate("/select-org")}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:bg-muted transition-colors"
          >
            <ArrowLeft size={16} />
            Cambiar Organización
          </button>
        </div>
      </div>
    </div>
  );
}
