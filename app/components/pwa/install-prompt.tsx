import { useState, useEffect, useCallback } from "react";
import { X, Download, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    const dismissed = localStorage.getItem("grixi_install_dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    // Detect iOS
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isiOS);

    if (isiOS) {
      // Show iOS guide after 5 seconds
      const timer = setTimeout(() => setShowBanner(true), 5000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop: intercept beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after 3 seconds
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    setShowIOSGuide(false);
    localStorage.setItem("grixi_install_dismissed", String(Date.now()));
  }, []);

  if (!showBanner) return null;

  // iOS instructions
  if (isIOS) {
    return (
      <>
        {/* Backdrop */}
        {showIOSGuide && (
          <div
            className="fixed inset-0 z-998 bg-black/40 backdrop-blur-sm"
            onClick={handleDismiss}
          />
        )}

        {/* Banner */}
        <div
          className="fixed bottom-0 left-0 right-0 z-999 border-t p-4 enter-fade"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          }}
        >
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <img src="/icon-192.png" alt="GRIXI" className="h-10 w-10 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Instalar GRIXI
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Toca <Share size={12} className="mx-0.5 inline align-text-bottom" /> y luego &quot;Agregar a pantalla de inicio&quot;
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="shrink-0 rounded-lg p-2 transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </>
    );
  }

  // Android / Desktop
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-999 border-t p-4 enter-fade md:bottom-4 md:left-auto md:right-4 md:w-80 md:rounded-2xl md:border md:shadow-2xl"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
      }}
    >
      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="GRIXI" className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Instalar GRIXI
          </p>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Acceso rápido desde tu pantalla de inicio con notificaciones y modo offline.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleInstall}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: "var(--brand)" }}
            >
              <Download size={13} />
              Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
