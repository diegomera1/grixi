/**
 * GRIXI — Route Error Boundary
 * 
 * Error boundary reutilizable para rutas individuales.
 * Permite que un error en un módulo no destruya toda la aplicación.
 * El usuario puede volver al dashboard o reintentar sin perder el sidebar/layout.
 */

import { isRouteErrorResponse, useNavigate } from "react-router";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface RouteErrorBoundaryProps {
  error: unknown;
  /** Nombre del módulo para mostrar en el mensaje de error */
  moduleName?: string;
}

export function RouteErrorBoundary({ error, moduleName = "este módulo" }: RouteErrorBoundaryProps) {
  const navigate = useNavigate();

  let code = "500";
  let title = "Error en " + moduleName;
  let details = "Ocurrió un error inesperado. Puedes reintentar o volver al dashboard.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    code = String(error.status);
    if (error.status === 404) {
      title = "Página no encontrada";
      details = "La sección que buscas no existe o fue movida.";
    } else if (error.status === 403) {
      title = "Sin acceso";
      details = "No tienes permisos para acceder a esta sección.";
    } else {
      details = error.statusText || details;
    }
  } else if (error instanceof Error) {
    console.error(`[GRIXI Error] ${moduleName}:`, error.message, error.stack);
    if (error.message.includes("fetch") || error.message.includes("network") || error.message.includes("Failed to fetch")) {
      code = "⚡";
      title = "Error de conexión";
      details = "No se pudo conectar al servidor. Revisa tu conexión e intenta de nuevo.";
    } else if (error.message.includes("ChunkLoadError") || error.message.includes("Loading chunk")) {
      code = "📦";
      title = "Actualización disponible";
      details = "Hay una nueva versión de GRIXI. Recarga la página para actualizar.";
    } else {
      details = error.message;
    }
    if (import.meta.env.DEV) stack = error.stack;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex flex-col items-center gap-5 text-center max-w-md">
        {/* Icon */}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
        >
          <AlertTriangle size={28} style={{ color: "#EF4444" }} />
        </div>

        {/* Code */}
        <p className="text-4xl font-bold tracking-tight" style={{ color: "#7C3AED" }}>
          {code}
        </p>

        {/* Title + details */}
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            {title}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            {details}
          </p>
        </div>

        {/* Stack trace (dev only) */}
        {stack && (
          <details className="w-full text-left">
            <summary
              className="cursor-pointer text-xs font-medium"
              style={{ color: "var(--muted-foreground)" }}
            >
              Ver detalles técnicos
            </summary>
            <pre
              className="mt-2 max-h-40 overflow-auto rounded-lg p-3 text-[10px] leading-relaxed"
              style={{
                background: "var(--background)",
                color: "var(--muted-foreground)",
                border: "1px solid var(--border)",
              }}
            >
              <code>{stack}</code>
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: "#7C3AED",
              boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
            }}
          >
            <RefreshCw size={14} /> Reintentar
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          >
            <Home size={14} /> Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
