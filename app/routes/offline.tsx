/**
 * PWA Offline Fallback Page
 * Shown when the app is in PWA mode and loses network connectivity
 */
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: "var(--background, #0a0a0f)" }}>
      <div className="max-w-sm text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(124,58,237,0.1)" }}>
          <WifiOff size={36} style={{ color: "#7c3aed" }} />
        </div>

        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--foreground, #fff)" }}>
            Sin conexión
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground, #888)" }}>
            No tienes conexión a internet. Verifica tu red e intenta de nuevo.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white transition-all hover:scale-105 active:scale-95"
          style={{ backgroundColor: "#7c3aed" }}
        >
          <RefreshCw size={16} />
          Reintentar
        </button>

        <p className="text-xs" style={{ color: "var(--muted-foreground, #666)" }}>
          GRIXI funciona mejor con una conexión estable
        </p>
      </div>
    </div>
  );
}
