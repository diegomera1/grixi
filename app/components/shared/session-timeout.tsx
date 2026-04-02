/**
 * Session Timeout Warning — shows a warning modal 5 minutes before token expiry
 * Uses Supabase onAuthStateChange to detect token refresh needs
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Clock, RefreshCw, LogOut } from "lucide-react";

interface SessionTimeoutProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function SessionTimeout({ supabaseUrl, supabaseAnonKey }: SessionTimeoutProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 min = 300s
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  const checkSession = useCallback(async () => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const expiresAt = session.expires_at;
      if (!expiresAt) return;

      const now = Math.floor(Date.now() / 1000);
      const timeLeft = expiresAt - now;

      // Show warning when < 5 minutes remain
      if (timeLeft > 0 && timeLeft <= 300) {
        setShowWarning(true);
        setCountdown(timeLeft);
      } else if (timeLeft <= 0) {
        // Session expired — redirect to login
        navigate("/?error=session_expired");
      } else {
        setShowWarning(false);
      }
    } catch (e) {
      // Silently fail — don't break the app for auth checks
    }
  }, [supabaseUrl, supabaseAnonKey, navigate]);

  useEffect(() => {
    // Check every 60 seconds
    const interval = setInterval(checkSession, 60_000);
    // Also check once on mount (after a delay to let hydration settle)
    const timeout = setTimeout(checkSession, 5_000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [checkSession]);

  // Countdown timer when warning is shown
  useEffect(() => {
    if (!showWarning) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate("/?error=session_expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showWarning, navigate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { error } = await supabase.auth.refreshSession();
      if (!error) {
        setShowWarning(false);
        setCountdown(300);
      }
    } catch {
      // If refresh fails, let it expire naturally
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = () => {
    navigate("/auth/signout");
  };

  if (!showWarning) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-9998 bg-black/60 backdrop-blur-sm animate-in fade-in" />

      {/* Modal */}
      <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
        <div
          className="w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl animate-in zoom-in-95 fade-in duration-200"
          style={{ backgroundColor: "var(--card, #111)", borderColor: "var(--border, #333)" }}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(251,191,36,0.15)" }}>
            <Clock size={28} style={{ color: "#fbbf24" }} />
          </div>

          <h2 className="text-lg font-bold" style={{ color: "var(--foreground, #fff)" }}>
            Sesión por expirar
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground, #888)" }}>
            Tu sesión se cerrará automáticamente en:
          </p>

          {/* Countdown */}
          <div className="my-4 text-4xl font-mono font-bold tabular-nums" style={{ color: countdown < 60 ? "#ef4444" : "#fbbf24" }}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleLogout}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium border transition-all hover:opacity-80"
              style={{ borderColor: "var(--border, #333)", color: "var(--muted-foreground, #888)" }}
            >
              <LogOut size={14} className="inline mr-1.5" />
              Cerrar
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: "#7c3aed" }}
            >
              <RefreshCw size={14} className={`inline mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Renovando..." : "Renovar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
