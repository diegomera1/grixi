/**
 * Toast Notification System — Global toast for user feedback
 * 
 * Usage:
 *   const { toast } = useToast();
 *   toast.success("Guardado exitosamente");
 *   toast.error("No se pudo guardar");
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside <ToastProvider>");
  return ctx;
}

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: "rgba(22,163,106,0.12)", border: "rgba(22,163,106,0.25)", text: "#4ade80", icon: "#22c55e" },
  error: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", text: "#f87171", icon: "#ef4444" },
  warning: { bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.25)", text: "#fbbf24", icon: "#eab308" },
  info: { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.25)", text: "#a5b4fc", icon: "#6366f1" },
};

const DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3500,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = DURATIONS[type];

    // Haptic feedback on mobile
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(type === "error" ? [50, 30, 50] : [30]);
    }

    setToasts((prev) => {
      const stack = [...prev, { id, type, message, duration }];
      return stack.slice(-3); // max 3 visible
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string) => addToast("success", msg),
    error: (msg: string) => addToast("error", msg),
    warning: (msg: string) => addToast("warning", msg),
    info: (msg: string) => addToast("info", msg),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div
        className="fixed z-9999 pointer-events-none"
        style={{
          bottom: "env(safe-area-inset-bottom, 16px)",
          right: "16px",
          left: "16px",
          display: "flex",
          flexDirection: "column-reverse",
          alignItems: "flex-end",
          gap: "8px",
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const Icon = ICONS[t.type];
  const color = COLORS[t.type];

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), t.duration - 300);
    const remove = setTimeout(() => onDismiss(t.id), t.duration);
    return () => { clearTimeout(timer); clearTimeout(remove); };
  }, [t.id, t.duration, onDismiss]);

  return (
    <div
      className="pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 backdrop-blur-xl shadow-2xl"
      style={{
        backgroundColor: color.bg,
        borderColor: color.border,
        maxWidth: "min(400px, calc(100vw - 32px))",
        animation: exiting
          ? "toastExit 300ms ease-in forwards"
          : "toastEnter 350ms cubic-bezier(0.16,1,0.3,1) forwards",
      }}
    >
      <Icon size={18} style={{ color: color.icon, flexShrink: 0 }} />
      <p className="flex-1 text-sm font-medium" style={{ color: color.text }}>
        {t.message}
      </p>
      <button
        onClick={() => { setExiting(true); setTimeout(() => onDismiss(t.id), 250); }}
        className="rounded p-0.5 transition-colors hover:bg-white/10"
        style={{ color: color.text }}
      >
        <X size={14} />
      </button>
      <style>{`
        @keyframes toastEnter {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toastExit {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(-8px) scale(0.95); }
        }
      `}</style>
    </div>
  );
}
