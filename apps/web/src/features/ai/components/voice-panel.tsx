"use client";

import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useGrixiVoice, type VoiceState } from "@/features/ai/hooks/use-grixi-voice";
import { GrixiAiLogo } from "@/features/ai/components/grixi-ai-logo";

// ── Animated Dot Ring ─────────────────────────────────
function DotRing({ audioLevel, state }: { audioLevel: number; state: VoiceState }) {
  const isActive = state === "listening" || state === "speaking";
  const dotCount = 24;

  const stateColor = useMemo(() => {
    if (state === "listening") return "#10B981";
    if (state === "speaking") return "#A855F7";
    if (state === "processing") return "#F59E0B";
    return "#7C3AED";
  }, [state]);

  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      {/* Glow pulse */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: stateColor }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.06, 0.12, 0.06],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Orbiting dots */}
      {Array.from({ length: dotCount }).map((_, i) => {
        const angle = (i / dotCount) * 360;
        const baseRadius = 42;
        const audioReact = isActive ? audioLevel * 16 : 0;
        const radius = baseRadius + audioReact + (i % 3 === 0 ? 4 : 0);
        const size = 2 + (isActive ? audioLevel * 2.5 : 0) + (i % 4 === 0 ? 1 : 0);
        const delay = i * 0.03;

        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              backgroundColor: stateColor,
            }}
            animate={{
              x: Math.cos((angle * Math.PI) / 180) * radius,
              y: Math.sin((angle * Math.PI) / 180) * radius,
              opacity: isActive ? [0.4 + audioLevel * 0.5, 0.8, 0.4 + audioLevel * 0.5] : 0.25,
              scale: isActive ? [1, 1 + audioLevel * 0.6, 1] : 1,
            }}
            transition={{
              x: { duration: 0.15, ease: "easeOut" },
              y: { duration: 0.15, ease: "easeOut" },
              opacity: { duration: 1.5, repeat: Infinity, delay },
              scale: { duration: 0.8, repeat: Infinity, delay },
            }}
          />
        );
      })}

      {/* Center icon */}
      <motion.div
        className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          backgroundColor: `${stateColor}15`,
          boxShadow: isActive ? `0 0 24px ${stateColor}25` : "none",
        }}
        animate={{ scale: 1 + audioLevel * 0.15 }}
        transition={{ duration: 0.1 }}
      >
        {state === "connecting" || state === "processing" ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          >
            <GrixiAiLogo size={24} showText={false} animate />
          </motion.div>
        ) : state === "speaking" ? (
          <GrixiAiLogo size={24} showText={false} animate />
        ) : (
          <Mic size={22} style={{ color: isActive ? stateColor : "var(--text-muted)" }} />
        )}
      </motion.div>
    </div>
  );
}

// ── Waveform Bars ─────────────────────────────────────
function WaveformBars({ audioLevel, state }: { audioLevel: number; state: VoiceState }) {
  const isActive = state === "listening" || state === "speaking";
  const barCount = 32;

  const stateColor = useMemo(() => {
    if (state === "listening") return "#10B981";
    if (state === "speaking") return "#A855F7";
    if (state === "processing") return "#F59E0B";
    return "#7C3AED";
  }, [state]);

  return (
    <div className="flex h-8 items-center justify-center gap-[2px]">
      {Array.from({ length: barCount }).map((_, i) => {
        // Create a natural envelope shape — higher in middle
        const center = barCount / 2;
        const distFromCenter = Math.abs(i - center) / center;
        const envelope = 1 - distFromCenter * distFromCenter;
        const baseHeight = 3;
        const audioHeight = isActive ? audioLevel * 20 * envelope : 0;
        const height = baseHeight + audioHeight;

        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: 2,
              backgroundColor: stateColor,
            }}
            animate={{
              height,
              opacity: isActive ? 0.4 + envelope * 0.5 * audioLevel : 0.15,
            }}
            transition={{
              height: { duration: 0.08, ease: "easeOut" },
              opacity: { duration: 0.15 },
            }}
          />
        );
      })}
    </div>
  );
}

// ── Status Label ──────────────────────────────────────
const STATE_LABELS: Record<VoiceState, string> = {
  idle: "Toca para hablar",
  connecting: "Conectando...",
  listening: "Escuchando...",
  speaking: "GRIXI responde...",
  processing: "Procesando...",
};

const STATE_DOT_COLORS: Record<VoiceState, string> = {
  idle: "bg-[var(--text-muted)]",
  connecting: "bg-amber-500",
  listening: "bg-emerald-500",
  speaking: "bg-violet-500",
  processing: "bg-amber-500",
};

const STATE_TEXT_COLORS: Record<VoiceState, string> = {
  idle: "text-[var(--text-muted)]",
  connecting: "text-amber-500",
  listening: "text-emerald-500",
  speaking: "text-violet-500",
  processing: "text-amber-500",
};

// ── Main Voice Panel ──────────────────────────────────
export function VoicePanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    state,
    currentAssistantText,
    error,
    audioLevel,
    start,
    stop,
    isActive,
  } = useGrixiVoice();

  // Auto-start/stop
  useEffect(() => {
    if (isOpen && state === "idle") start();
    if (!isOpen && isActive) stop();
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-20 left-4 z-[52] flex w-[320px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]/95 shadow-2xl backdrop-blur-xl md:w-[340px]"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5"
            style={{
              background: "linear-gradient(135deg, rgba(124,58,237,0.05), transparent)",
            }}
          >
            <div className="flex items-center gap-2">
              <GrixiAiLogo size={20} showText={false} animate={isActive} />
              <div>
                <p className="text-[11px] font-semibold text-[var(--text-primary)]">
                  GRIXI Voice
                </p>
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isActive ? "bg-emerald-500" : "bg-[var(--text-muted)]"
                    )}
                  />
                  <span className="text-[8px] text-[var(--text-muted)]">
                    {isActive ? "Conectado" : "Desconectado"}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => { stop(); onClose(); }}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
            >
              <X size={14} />
            </button>
          </div>

          {/* Visualization */}
          <div className="flex flex-col items-center gap-2 px-4 py-5">
            <DotRing audioLevel={audioLevel} state={state} />
            <WaveformBars audioLevel={audioLevel} state={state} />

            {/* Status */}
            <div className="mt-1 flex items-center gap-2">
              {(state === "listening" || state === "speaking" || state === "processing") && (
                <motion.div
                  className={cn("h-1.5 w-1.5 rounded-full", STATE_DOT_COLORS[state])}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  STATE_TEXT_COLORS[state]
                )}
              >
                {STATE_LABELS[state]}
              </span>
            </div>

            {error && (
              <p className="mt-1 text-[9px] text-red-400">{error}</p>
            )}
          </div>

          {/* Response text */}
          <AnimatePresence>
            {currentAssistantText && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-[var(--border)] px-4 py-3"
              >
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {currentAssistantText}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hint + controls */}
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2.5">
            <p className="text-[8px] text-[var(--text-muted)] max-w-[200px]">
              Di: &quot;¿Cómo va la operación?&quot; o &quot;Llévame a almacenes&quot;
            </p>
            {isActive ? (
              <button
                onClick={stop}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] font-semibold text-red-400 transition-colors hover:bg-red-500/20"
              >
                <MicOff size={12} />
                Detener
              </button>
            ) : (
              <button
                onClick={start}
                className="flex items-center gap-1.5 rounded-lg bg-[#7C3AED]/10 px-3 py-1.5 text-[10px] font-semibold text-[#A855F7] transition-colors hover:bg-[#7C3AED]/20"
              >
                <Mic size={12} />
                Iniciar
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
