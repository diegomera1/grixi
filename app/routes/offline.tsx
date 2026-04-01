import { Link } from "react-router";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* Animated logo */}
      <div className="relative mb-6">
        <div className="absolute inset-0 scale-150 rounded-2xl opacity-10 blur-2xl"
          style={{ backgroundColor: "var(--brand)" }}
        />
        <img
          src="/icon-192.png"
          alt="GRIXI"
          width={72}
          height={72}
          className="relative rounded-2xl"
        />
      </div>

      {/* Title */}
      <h1 className="mb-2 font-serif text-xl font-semibold italic"
        style={{ color: "var(--text-primary)" }}
      >
        Sin conexión
      </h1>
      <p className="mb-8 max-w-xs text-sm leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        No se pudo conectar al servidor. Verifica tu conexión a internet e intenta de nuevo.
      </p>

      {/* Retry */}
      <button
        onClick={() => window.location.reload()}
        className="rounded-xl px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:opacity-90 active:scale-95"
        style={{ backgroundColor: "var(--brand)", boxShadow: "0 4px 14px rgba(124, 58, 237, 0.25)" }}
      >
        Reintentar
      </button>

      {/* Dashboard link */}
      <Link
        to="/dashboard"
        className="mt-4 text-xs transition-colors"
        style={{ color: "var(--text-muted)" }}
      >
        Volver al dashboard
      </Link>

      {/* Footer */}
      <p className="absolute bottom-8 text-[10px]"
        style={{ color: "var(--text-muted)" }}
      >
        GRIXI — La interconexión inteligente
      </p>
    </div>
  );
}
