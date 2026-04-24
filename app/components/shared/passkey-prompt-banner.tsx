import { useState, useEffect } from "react";
import { Fingerprint, X, Shield } from "lucide-react";
import { useNavigate } from "react-router";

// ═══════════════════════════════════════════════════════════
// PasskeyPromptBanner — Sugiere activar passkey tras login
// - Solo aparece si el browser soporta WebAuthn
// - Solo si el usuario no tiene passkeys configurados
// - Se puede descartar permanentemente (localStorage)
// - Respeta el sistema de banner coordination
// ═══════════════════════════════════════════════════════════

interface PasskeyPromptBannerProps {
  hasPasskeys: boolean;
  activeBannerId?: string | null;
  onBannerChange?: (id: string | null) => void;
}

const BANNER_ID = "passkey-prompt";
const DISMISS_KEY = "grixi_passkey_prompt_dismissed";

export function PasskeyPromptBanner({ hasPasskeys, activeBannerId, onBannerChange }: PasskeyPromptBannerProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [supported, setSupported] = useState(false);
  const navigate = useNavigate();

  // Check WebAuthn support
  useEffect(() => {
    async function check() {
      try {
        if (typeof window === "undefined" || !window.PublicKeyCredential) return;
        const platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
        if (platform) setSupported(true);
      } catch {
        // Not supported
      }
    }
    check();
  }, []);

  // Show logic with delay (10s — lower priority than push + install)
  useEffect(() => {
    if (!supported) return;
    if (hasPasskeys) return;
    if (dismissed) return;

    const wasDismissed = localStorage.getItem(DISMISS_KEY);
    if (wasDismissed) return;

    // If another banner is active, yield
    if (activeBannerId && activeBannerId !== BANNER_ID) return;

    const timer = setTimeout(() => {
      setVisible(true);
      onBannerChange?.(BANNER_ID);
    }, 10000); // 10s delay — priority 3
    return () => clearTimeout(timer);
  }, [supported, hasPasskeys, dismissed, activeBannerId]);

  // Yield slot when hidden
  useEffect(() => {
    if (!visible && activeBannerId === BANNER_ID) {
      onBannerChange?.(null);
    }
  }, [visible]);

  if (!visible) return null;
  if (activeBannerId && activeBannerId !== BANNER_ID) return null;

  const handleSetup = () => {
    setVisible(false);
    onBannerChange?.(null);
    navigate("/perfil");
  };

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    onBannerChange?.(null);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  return (
    <div
      className="fixed bottom-20 left-4 z-60 w-80 md:bottom-6 md:left-6"
      style={{ animation: "slideInUpPasskey 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Gradient accent — emerald for security */}
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-emerald-500 to-transparent" />

        {/* Close */}
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-lg p-1 text-text-muted transition-colors hover:bg-muted hover:text-text-primary"
        >
          <X size={14} />
        </button>

        <div className="p-4">
          {/* Icon */}
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <Fingerprint size={20} className="text-emerald-500" />
          </div>

          {/* Content */}
          <h4 className="text-sm font-semibold text-text-primary">
            Protege tu cuenta con Passkey
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Inicia sesión con tu huella dactilar o Face ID. Más rápido y seguro que las contraseñas.
          </p>

          {/* Actions */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleSetup}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-500 active:scale-[0.98]"
            >
              <Shield size={13} />
              Configurar
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
        @keyframes slideInUpPasskey {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
