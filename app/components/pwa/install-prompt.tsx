import { useState, useEffect, useCallback } from "react";
import { X, Download, Share } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// InstallPrompt — A2HS (Add to Home Screen) banner
// - Coordinated with other banners via activeBannerId
// ═══════════════════════════════════════════════════════════

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallPromptProps {
  activeBannerId?: string | null;
  onBannerChange?: (id: string | null) => void;
}

const BANNER_ID = "pwa-install";

export function InstallPrompt({ activeBannerId, onBannerChange }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    const dismissed = localStorage.getItem("grixi_install_dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isiOS);

    if (isiOS) {
      // If another banner is already active, don't show yet
      if (activeBannerId && activeBannerId !== BANNER_ID) return;
      const timer = setTimeout(() => {
        setShowBanner(true);
        onBannerChange?.(BANNER_ID);
      }, 8000); // 8s delay — after push banner has had its chance
      return () => clearTimeout(timer);
    }

    // Android/Desktop: intercept beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show if no other banner is active
      if (!activeBannerId || activeBannerId === BANNER_ID) {
        setTimeout(() => {
          setShowBanner(true);
          onBannerChange?.(BANNER_ID);
        }, 8000); // 8s delay
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [activeBannerId]);

  // If another banner becomes active while we're visible, hide ourselves
  useEffect(() => {
    if (showBanner && activeBannerId && activeBannerId !== BANNER_ID) {
      setShowBanner(false);
    }
  }, [activeBannerId]);

  // Yield slot when hidden
  useEffect(() => {
    if (!showBanner && activeBannerId === BANNER_ID) {
      onBannerChange?.(null);
    }
  }, [showBanner]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      onBannerChange?.(null);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt, onBannerChange]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    setShowIOSGuide(false);
    onBannerChange?.(null);
    localStorage.setItem("grixi_install_dismissed", String(Date.now()));
  }, [onBannerChange]);

  if (!showBanner) return null;

  // iOS instructions
  if (isIOS) {
    return (
      <>
        {showIOSGuide && (
          <div
            className="fixed inset-0 z-998 bg-black/40 backdrop-blur-sm"
            onClick={handleDismiss}
          />
        )}

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
      className="fixed bottom-20 left-4 z-60 w-80 md:bottom-6 md:left-6 md:right-auto"
      style={{ animation: "slideInUpPwa 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Gradient accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-emerald-500 to-transparent" />

        <div className="flex items-start gap-3 p-4">
          <img src="/icon-192.png" alt="GRIXI" className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">
              Instalar GRIXI
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
              Acceso rápido desde tu pantalla de inicio con notificaciones y modo offline.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleInstall}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-emerald-700 active:scale-95"
              >
                <Download size={13} />
                Instalar
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-muted hover:text-text-primary"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInUpPwa {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
