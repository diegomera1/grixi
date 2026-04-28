/**
 * PWA Offline Fallback Page
 * Shown when the app is in PWA mode and loses network connectivity
 */
import { WifiOff, RefreshCw } from "lucide-react";

export const meta = () => [{ title: "Sin Conexión — GRIXI" }];

export default function OfflinePage() {
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
        style={{ backgroundColor: "rgba(124, 58, 237, 0.12)" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        {/* Icon */}
        <div className="relative">
          <div className="absolute inset-0 scale-150 rounded-2xl blur-2xl" style={{ backgroundColor: "rgba(124, 58, 237, 0.15)" }} />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: "rgba(124, 58, 237, 0.1)", border: "1px solid rgba(124, 58, 237, 0.2)" }}>
            <WifiOff className="h-8 w-8" style={{ color: "#7C3AED" }} />
          </div>
        </div>

        {/* Error code */}
        <p className="text-7xl font-bold tracking-tight" style={{ color: "#7C3AED" }}>⚡</p>

        {/* Title + details */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Sin Conexión</h1>
          <p className="max-w-sm text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
            No tienes conexión a internet. Verifica tu red e intenta de nuevo.
          </p>
        </div>

        {/* Actions */}
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: "#7C3AED", boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)" }}
        >
          <RefreshCw size={16} /> Reintentar
        </button>

        {/* Brand */}
        <p className="mt-8 text-[10px]" style={{ color: "#3F3F46" }}>
          GRIXI funciona mejor con una conexión estable
        </p>
      </div>
    </main>
  );
}
