"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, X, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export function PasskeyPromptBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if browser doesn't support WebAuthn
    if (typeof window === "undefined" || !window.PublicKeyCredential) return;

    // Check if user has passkeys and if the prompt was dismissed
    const supabase = createClient();

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if dismissed in local storage
      const dismissKey = `grixi_passkey_prompt_dismissed_${user.id}`;
      if (localStorage.getItem(dismissKey) === "true") return;

      // Check if user already has passkeys
      const { count } = await supabase
        .from("user_passkeys")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (count === 0) {
        setVisible(true);
      }
    })();
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setTimeout(() => setVisible(false), 300);

    // Persist dismissal
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        localStorage.setItem(`grixi_passkey_prompt_dismissed_${user.id}`, "true");
      }
    });
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          className="mb-4 overflow-hidden"
        >
          <div className="flex items-center gap-3 rounded-xl border border-[var(--brand)]/20 bg-[var(--brand)]/5 p-3 pr-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]/15">
              <Fingerprint size={18} className="text-[var(--brand)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                Configura tu Passkey
              </p>
              <p className="text-[10px] text-[var(--text-secondary)] leading-tight mt-0.5">
                Inicia sesión más rápido con tu huella o Face ID
              </p>
            </div>
            <Link
              href={`/usuarios/me`}
              className="flex items-center gap-1 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-[10px] font-semibold text-white shrink-0 transition-all hover:opacity-90"
            >
              Configurar
              <ArrowRight size={12} />
            </Link>
            <button
              onClick={handleDismiss}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)]"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
