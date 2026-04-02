import { useState, useEffect } from "react";
import { Bell, X, BellRing } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// PushPermissionBanner — Banner premium para solicitar
// permisos de push notifications
// - No se muestra si hay otro banner activo (PWA install)
// ═══════════════════════════════════════════════════════════

interface PushPermissionBannerProps {
  push: {
    status: {
      supported: boolean;
      permission: NotificationPermission | "unsupported";
      subscribed: boolean;
      loading: boolean;
    };
    requestPermission: () => Promise<boolean>;
  };
  /** Slot ID this banner occupies — if another one is active, yield */
  activeBannerId?: string | null;
  onBannerChange?: (id: string | null) => void;
}

const BANNER_ID = "push-permission";

export function PushPermissionBanner({ push, activeBannerId, onBannerChange }: PushPermissionBannerProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!push.status.supported) return;
    if (push.status.permission !== "default") return;
    if (push.status.subscribed) return;
    if (dismissed) return;

    const wasDismissed = localStorage.getItem("grixi_push_dismissed");
    if (wasDismissed) return;

    // If another banner is active, wait
    if (activeBannerId && activeBannerId !== BANNER_ID) return;

    // Show after 5s delay
    const timer = setTimeout(() => {
      setVisible(true);
      onBannerChange?.(BANNER_ID);
    }, 5000);
    return () => clearTimeout(timer);
  }, [push.status.supported, push.status.permission, push.status.subscribed, dismissed, activeBannerId]);

  // Yield slot when hidden
  useEffect(() => {
    if (!visible && activeBannerId === BANNER_ID) {
      onBannerChange?.(null);
    }
  }, [visible]);

  if (!visible) return null;

  // If another banner took priority while we were trying to show, hide
  if (activeBannerId && activeBannerId !== BANNER_ID) return null;

  const handleAccept = async () => {
    setVisible(false);
    onBannerChange?.(null);
    await push.requestPermission();
  };

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    onBannerChange?.(null);
    localStorage.setItem("grixi_push_dismissed", "true");
  };

  return (
    <div
      className="fixed bottom-20 right-4 z-60 w-80 md:bottom-6 md:right-6"
      style={{ animation: "slideInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Gradient accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand to-transparent" />

        {/* Close */}
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-lg p-1 text-text-muted transition-colors hover:bg-muted hover:text-text-primary"
        >
          <X size={14} />
        </button>

        <div className="p-4">
          {/* Icon */}
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
            <BellRing size={20} className="text-brand" />
          </div>

          {/* Content */}
          <h4 className="text-sm font-semibold text-text-primary">
            Activa las notificaciones
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Recibe alertas instantáneas sobre actividad en tu organización, incluso cuando no estés usando GRIXI.
          </p>

          {/* Actions */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleAccept}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-brand/90 active:scale-[0.98]"
            >
              <Bell size={13} />
              Activar
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-xl px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-muted hover:text-text-primary"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
