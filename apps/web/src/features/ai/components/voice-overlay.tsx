"use client";

import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useGrixiLive, type LiveState, type LiveTranscript } from "@/features/ai/hooks/use-grixi-live";
import { GrixiAiLogo } from "@/features/ai/components/grixi-ai-logo";

// ── Animated Dot Ring ─────────────────────────────────
function DotRing({ audioLevel, state }: { audioLevel: number; state: LiveState }) {
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
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: stateColor }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.06, 0.12, 0.06] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {Array.from({ length: dotCount }).map((_, i) => {
        const angle = (i / dotCount) * 360;
        const baseRadius = 42;
        const audioReact = isActive ? audioLevel * 16 : 0;
        const radius = baseRadius + audioReact + (i % 3 === 0 ? 4 : 0);
        const size = 2 + (isActive ? audioLevel * 2.5 : 0) + (i % 4 === 0 ? 1 : 0);

        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ width: size, height: size, backgroundColor: stateColor }}
            animate={{
              x: Math.cos((angle * Math.PI) / 180) * radius,
              y: Math.sin((angle * Math.PI) / 180) * radius,
              opacity: isActive ? [0.4 + audioLevel * 0.5, 0.8, 0.4 + audioLevel * 0.5] : 0.25,
              scale: isActive ? [1, 1 + audioLevel * 0.6, 1] : 1,
            }}
            transition={{
              x: { duration: 0.15, ease: "easeOut" },
              y: { duration: 0.15, ease: "easeOut" },
              opacity: { duration: 1.5, repeat: Infinity, delay: i * 0.03 },
              scale: { duration: 0.8, repeat: Infinity, delay: i * 0.03 },
            }}
          />
        );
      })}

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
function WaveformBars({ audioLevel, state }: { audioLevel: number; state: LiveState }) {
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
        const center = barCount / 2;
        const distFromCenter = Math.abs(i - center) / center;
        const envelope = 1 - distFromCenter * distFromCenter;
        const baseHeight = 3;
        const audioHeight = isActive ? audioLevel * 20 * envelope : 0;

        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{ width: 2, backgroundColor: stateColor }}
            animate={{
              height: baseHeight + audioHeight,
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

// ── Status Labels ─────────────────────────────────────
const STATE_LABELS: Record<LiveState, string> = {
  idle: "Toca para hablar",
  connecting: "Conectando...",
  listening: "Escuchando...",
  speaking: "GRIXI responde...",
  processing: "Procesando...",
};

const STATE_DOT_COLORS: Record<LiveState, string> = {
  idle: "bg-[var(--text-muted)]",
  connecting: "bg-amber-500",
  listening: "bg-emerald-500",
  speaking: "bg-violet-500",
  processing: "bg-amber-500",
};

const STATE_TEXT_COLORS: Record<LiveState, string> = {
  idle: "text-[var(--text-muted)]",
  connecting: "text-amber-500",
  listening: "text-emerald-500",
  speaking: "text-violet-500",
  processing: "text-amber-500",
};

// ── Transcript Bubble ─────────────────────────────────
function TranscriptBubble({ transcript }: { transcript: LiveTranscript }) {
  const isUser = transcript.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg px-2.5 py-1.5 text-[10px] leading-relaxed",
        isUser
          ? "ml-auto bg-emerald-500/10 text-emerald-400"
          : "mr-auto bg-violet-500/10 text-violet-300"
      )}
    >
      <p>{transcript.text}</p>
    </motion.div>
  );
}

// ── Main Floating Voice Panel ─────────────────────────
export function VoiceOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    state,
    transcripts,
    inputText,
    outputText,
    error,
    audioLevel,
    devices,
    selectedDeviceId,
    refreshDevices,
    selectDevice,
    connect,
    disconnect,
    isActive,
  } = useGrixiLive();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showDevices, setShowDevices] = useState(false);

  // Stable refs
  const connectRef = useRef(connect);
  const disconnectRef = useRef(disconnect);
  const refreshDevicesRef = useRef(refreshDevices);
  connectRef.current = connect;
  disconnectRef.current = disconnect;
  refreshDevicesRef.current = refreshDevices;

  // Load devices and auto-connect when panel opens
  useEffect(() => {
    if (isOpen) {
      refreshDevicesRef.current();
      const timer = setTimeout(() => connectRef.current(), 300);
      return () => clearTimeout(timer);
    } else {
      disconnectRef.current();
      setShowDevices(false);
    }
  }, [isOpen]);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, outputText, inputText]);

  const handleClose = useCallback(() => {
    disconnect();
    onClose();
  }, [disconnect, onClose]);

  const handleDeviceChange = useCallback((deviceId: string) => {
    selectDevice(deviceId);
    setShowDevices(false);
    // Reconnect with new device
    disconnect();
    setTimeout(() => connect(), 200);
  }, [selectDevice, disconnect, connect]);

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
            style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.05), transparent)" }}
          >
            <div className="flex items-center gap-2">
              <GrixiAiLogo size={20} showText={false} animate={isActive} />
              <div>
                <p className="text-[11px] font-semibold text-[var(--text-primary)]">GRIXI Voice</p>
                <div className="flex items-center gap-1">
                  <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-emerald-500" : "bg-[var(--text-muted)]")} />
                  <span className="text-[8px] text-[var(--text-muted)]">
                    {isActive ? "Live · Conectado" : "Desconectado"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Mic selector toggle */}
              <button
                onClick={() => { setShowDevices(!showDevices); if (!showDevices) refreshDevices(); }}
                className={cn(
                  "rounded-lg p-1.5 transition-colors",
                  showDevices
                    ? "bg-[#7C3AED]/20 text-[#A855F7]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                )}
                title="Seleccionar micrófono"
              >
                <Settings2 size={13} />
              </button>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Device selector */}
          <AnimatePresence>
            {showDevices && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b border-[var(--border)] bg-[var(--bg-muted)]/30 px-3 py-2"
              >
                <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Dispositivo de entrada
                </p>
                {devices.length === 0 ? (
                  <p className="text-[10px] text-[var(--text-muted)]">
                    No se encontraron micrófonos
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {devices.map((device) => (
                      <button
                        key={device.deviceId}
                        onClick={() => handleDeviceChange(device.deviceId)}
                        className={cn(
                          "w-full rounded-lg px-2.5 py-1.5 text-left text-[10px] transition-colors",
                          device.deviceId === selectedDeviceId
                            ? "bg-[#7C3AED]/15 text-[#A855F7] font-medium"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <Mic size={10} className="shrink-0" />
                          <span className="truncate">{device.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

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
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", STATE_TEXT_COLORS[state])}>
                {STATE_LABELS[state]}
              </span>
            </div>

            {error && <p className="mt-1 text-[9px] text-red-400">{error}</p>}
          </div>

          {/* Live output text */}
          <AnimatePresence>
            {outputText && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-[var(--border)] px-4 py-3"
              >
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {outputText}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live input text */}
          <AnimatePresence>
            {inputText && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 py-2"
              >
                <p className="text-[10px] italic text-emerald-400/60">{inputText}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Transcript history */}
          {transcripts.length > 0 && (
            <div
              ref={scrollRef}
              className="max-h-[150px] overflow-y-auto border-t border-[var(--border)] px-3 py-2"
            >
              <div className="flex flex-col gap-1.5">
                {transcripts.map((t) => (
                  <TranscriptBubble key={t.id} transcript={t} />
                ))}
              </div>
            </div>
          )}

          {/* Bottom controls */}
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2.5">
            <p className="max-w-[200px] text-[8px] text-[var(--text-muted)]">
              Habla · Interrumpe · &quot;Llévame a...&quot;
            </p>
            {isActive ? (
              <button
                onClick={disconnect}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] font-semibold text-red-400 transition-colors hover:bg-red-500/20"
              >
                <MicOff size={12} />
                Detener
              </button>
            ) : (
              <button
                onClick={connect}
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
