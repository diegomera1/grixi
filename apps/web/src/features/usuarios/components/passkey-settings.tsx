"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, Plus, Trash2, Smartphone, Loader2, ShieldCheck } from "lucide-react";
import { usePasskey } from "@/lib/hooks/use-passkey";

type PasskeyItem = {
  id: string;
  credential_id: string;
  device_name: string;
  created_at: string;
};

export function PasskeySettings() {
  const { register, listPasskeys, deletePasskey, isSupported, loading, error } = usePasskey();
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setFetching(true);
    const keys = await listPasskeys();
    setPasskeys(keys);
    setFetching(false);
  }, [listPasskeys]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRegister = async () => {
    const success = await register();
    if (success) refresh();
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await deletePasskey(id);
    setPasskeys((prev) => prev.filter((p) => p.id !== id));
    setDeleting(null);
  };

  if (!isSupported) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-4 text-center">
        <p className="text-xs text-[var(--text-muted)]">
          Tu navegador no soporta Passkeys (WebAuthn)
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-[var(--brand)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Passkeys
          </h3>
        </div>
        <button
          onClick={handleRegister}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Plus size={12} />
          )}
          Registrar Passkey
        </button>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Passkey list */}
      {fetching ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
        </div>
      ) : passkeys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-muted)]/20 p-6 text-center">
          <Fingerprint size={32} className="mx-auto mb-2 text-[var(--text-muted)]/40" />
          <p className="text-xs text-[var(--text-muted)]">
            No tienes passkeys registradas
          </p>
          <p className="mt-1 text-[10px] text-[var(--text-muted)]/60">
            Registra una para iniciar sesión sin contraseña
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {passkeys.map((pk, i) => (
            <motion.div
              key={pk.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)]/10">
                <Smartphone size={16} className="text-[var(--brand)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {pk.device_name}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Registrada {new Date(pk.created_at).toLocaleDateString("es-EC", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(pk.id)}
                disabled={deleting === pk.id}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                {deleting === pk.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
