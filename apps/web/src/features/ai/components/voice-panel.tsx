"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  X,
  Volume2,
  Loader2,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useGrixiVoice, type VoiceState } from "@/features/ai/hooks/use-grixi-voice";
import { GrixiAiLogo } from "@/features/ai/components/grixi-ai-logo";

// ── Audio Waveform Visualization ─────────────────────
function WaveformRings({
  level,
  state,
  color,
}: {
  level: number;
  state: VoiceState;
  color: string;
}) {
  const isActive = state === "listening" || state === "speaking";
  const scale = 1 + level * 0.5;

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{ borderColor: `${color}${isActive ? "30" : "10"}` }}
          animate={{
            width: isActive ? 80 + i * 20 + level * 30 : 64 + i * 12,
            height: isActive ? 80 + i * 20 + level * 30 : 64 + i * 12,
            opacity: isActive ? 0.6 - i * 0.15 : 0.2,
          }}
          transition={{
            duration: 0.3,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Pulsing glow */}
      {isActive && (
        <motion.div
          className="absolute rounded-full"
          style={{ backgroundColor: color }}
          animate={{
            width: [48, 56, 48],
            height: [48, 56, 48],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Core circle */}
      <motion.div
        className="relative flex h-16 w-16 items-center justify-center rounded-full"
        animate={{ scale }}
        transition={{ duration: 0.1 }}
        style={{
          backgroundColor: isActive ? `${color}20` : "var(--bg-muted)",
          boxShadow: isActive ? `0 0 30px ${color}30` : "none",
        }}
      >
        {state === "connecting" ? (
          <Loader2 size={24} className="animate-spin" style={{ color }} />
        ) : state === "speaking" ? (
          <Volume2 size={24} style={{ color }} className="animate-pulse" />
        ) : state === "processing" ? (
          <Loader2 size={24} className="animate-spin" style={{ color }} />
        ) : (
          <Mic size={24} style={{ color: isActive ? color : "var(--text-muted)" }} />
        )}
      </motion.div>
    </div>
  );
}

// ── Status Label ─────────────────────────────────────
function StatusLabel({ state }: { state: VoiceState }) {
  const labels: Record<VoiceState, string> = {
    idle: "Toca para hablar",
    connecting: "Conectando...",
    listening: "Escuchando...",
    speaking: "GRIXI habla...",
    processing: "Procesando...",
  };

  const colors: Record<VoiceState, string> = {
    idle: "text-[var(--text-muted)]",
    connecting: "text-amber-500",
    listening: "text-emerald-500",
    speaking: "text-violet-500",
    processing: "text-amber-500",
  };

  return (
    <div className="flex items-center gap-2">
      {(state === "listening" || state === "speaking") && (
        <motion.div
          className={cn("h-1.5 w-1.5 rounded-full", state === "listening" ? "bg-emerald-500" : "bg-violet-500")}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
      <span className={cn("text-[11px] font-semibold uppercase tracking-wider", colors[state])}>
        {labels[state]}
      </span>
    </div>
  );
}

// ── Main Voice Panel ─────────────────────────────────
export function VoicePanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { state, transcripts, currentUserText, currentAssistantText, error, audioLevel, start, stop, isActive } =
    useGrixiVoice();
  const scrollRef = useRef<HTMLDivElement>(null);
  const accentColor = "#A855F7";

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, currentUserText, currentAssistantText]);

  // Auto-start when panel opens
  useEffect(() => {
    if (isOpen && state === "idle") {
      start();
    }
    if (!isOpen && isActive) {
      stop();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-20 left-4 z-[52] flex w-[340px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]/95 shadow-2xl backdrop-blur-xl md:w-[360px]"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5"
            style={{ background: `linear-gradient(135deg, ${accentColor}08, transparent)` }}
          >
            <div className="flex items-center gap-2">
              <GrixiAiLogo size={20} showText={false} animate={isActive} />
              <div>
                <p className="text-[11px] font-semibold text-[var(--text-primary)]">GRIXI Voice</p>
                <div className="flex items-center gap-1">
                  <Radio size={8} className={cn(isActive ? "text-emerald-500" : "text-[var(--text-muted)]")} />
                  <span className="text-[8px] text-[var(--text-muted)]">
                    {isActive ? "Conectado" : "Desconectado"}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                stop();
                onClose();
              }}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
            >
              <X size={14} />
            </button>
          </div>

          {/* Visualization + Status */}
          <div className="flex flex-col items-center gap-3 px-4 py-6">
            <WaveformRings level={audioLevel} state={state} color={accentColor} />
            <StatusLabel state={state} />

            {error && (
              <p className="text-[10px] text-red-400">{error}</p>
            )}
          </div>

          {/* Transcripts */}
          <div
            ref={scrollRef}
            className="max-h-[200px] min-h-[60px] overflow-y-auto border-t border-[var(--border)] px-4 py-3 scrollbar-thin"
          >
            {transcripts.length === 0 && !currentUserText && !currentAssistantText ? (
              <p className="text-center text-[10px] text-[var(--text-muted)] italic">
                Di algo a GRIXI... Prueba "¿Cómo va la operación?" o "Llévame a almacenes"
              </p>
            ) : (
              <div className="space-y-2">
                {transcripts.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "flex",
                      t.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-3 py-1.5 text-[11px]",
                        t.role === "user"
                          ? "bg-[var(--brand)] text-white"
                          : "border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                      )}
                    >
                      {t.text}
                    </div>
                  </div>
                ))}

                {/* Live user text */}
                {currentUserText && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-xl bg-[var(--brand)]/60 px-3 py-1.5 text-[11px] text-white">
                      {currentUserText}
                      <motion.span
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      >
                        ▎
                      </motion.span>
                    </div>
                  </div>
                )}

                {/* Live assistant text */}
                {currentAssistantText && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] text-[var(--text-primary)]">
                      {currentAssistantText}
                      <motion.span
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      >
                        ▎
                      </motion.span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 border-t border-[var(--border)] px-4 py-3">
            {isActive ? (
              <button
                onClick={stop}
                className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/20"
              >
                <MicOff size={14} />
                Detener
              </button>
            ) : (
              <button
                onClick={start}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-semibold text-white transition-all hover:shadow-lg"
                style={{ backgroundColor: accentColor }}
              >
                <Mic size={14} />
                Iniciar GRIXI Voice
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
