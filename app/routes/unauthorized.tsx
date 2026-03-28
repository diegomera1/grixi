import { useNavigate } from "react-router";
import { ShieldX } from "lucide-react";

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-center max-w-md px-6">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
          <ShieldX className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Acceso Denegado
        </h1>
        <p className="text-[#8a8f98] mb-6">
          No tienes membresía en esta organización. Contacta al administrador si necesitas acceso.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2.5 rounded-lg bg-[#6366F1] text-white text-sm font-medium hover:bg-[#5558E6] transition-colors"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
