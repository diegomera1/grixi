"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Plus, Trash2, Shield, Clock, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  getAllowedEmails,
  addAllowedEmail,
  removeAllowedEmail,
} from "../actions/allowlist-actions";

type AllowedEmail = {
  id: string;
  email: string;
  added_by: string | null;
  notes: string | null;
  created_at: string;
};

export function AllowlistTab() {
  const [emails, setEmails] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const data = await getAllowedEmails();
      setEmails(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Auto-clear messages
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addAllowedEmail(newEmail, newNotes || undefined);
      setNewEmail("");
      setNewNotes("");
      setSuccess(`${newEmail.trim()} agregado a la lista`);
      await fetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al agregar");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string, email: string) => {
    if (!confirm(`¿Eliminar ${email} de la lista de acceso?`)) return;
    setRemoving(id);
    setError(null);
    try {
      await removeAllowedEmail(id);
      setSuccess(`${email} eliminado de la lista`);
      await fetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
          <Shield className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Lista de Acceso
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Solo los correos en esta lista pueden iniciar sesión con Google
          </p>
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800/30 dark:bg-red-900/15 dark:text-red-400"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-800/30 dark:bg-emerald-900/15 dark:text-emerald-400"
          >
            ✓ {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add form */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Agregar Correo
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-violet-500 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <input
            type="text"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Nota (opcional)"
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-violet-500 focus:outline-none sm:w-48"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newEmail.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Agregar
          </button>
        </div>
      </div>

      {/* Email list */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Correos Autorizados ({emails.length})
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {emails.map((entry) => (
              <motion.div
                key={entry.id}
                layout
                className="flex items-center gap-3 px-4 py-3 group"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10 shrink-0">
                  <Mail className="h-3.5 w-3.5 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {entry.email}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                    <Clock className="h-3 w-3" />
                    Agregado {new Date(entry.created_at).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}
                    {entry.notes && (
                      <span className="text-violet-500"> · {entry.notes}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(entry.id, entry.email)}
                  disabled={removing === entry.id}
                  className="rounded-lg p-2 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 disabled:opacity-50"
                  title="Eliminar"
                >
                  {removing === entry.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
