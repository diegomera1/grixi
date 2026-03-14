"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useGrixiVoice, type VoiceState } from "@/features/ai/hooks/use-grixi-voice";

// ── Particle Orb (Canvas) ─────────────────────────────
function ParticleOrb({
  audioLevel,
  state,
}: {
  audioLevel: number;
  state: VoiceState;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<
    { angle: number; radius: number; baseRadius: number; size: number; speed: number; opacity: number }[]
  >([]);
  const frameRef = useRef(0);
  const timeRef = useRef(0);

  // Initialize particles
  useEffect(() => {
    const count = 64;
    particlesRef.current = Array.from({ length: count }, (_, i) => ({
      angle: (i / count) * Math.PI * 2,
      radius: 60 + Math.random() * 20,
      baseRadius: 60 + Math.random() * 20,
      size: 1.5 + Math.random() * 2,
      speed: 0.002 + Math.random() * 0.003,
      opacity: 0.3 + Math.random() * 0.7,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const isActive = state === "listening" || state === "speaking" || state === "processing" || state === "connecting";

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      timeRef.current += 0.016;
      const t = timeRef.current;

      ctx.clearRect(0, 0, rect.width, rect.height);

      // Outer glow
      if (isActive) {
        const glowRadius = 85 + audioLevel * 40;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        gradient.addColorStop(0, `rgba(124, 58, 237, ${0.08 + audioLevel * 0.12})`);
        gradient.addColorStop(0.5, `rgba(168, 85, 247, ${0.04 + audioLevel * 0.06})`);
        gradient.addColorStop(1, "rgba(168, 85, 247, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core glow sphere
      const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 35 + audioLevel * 10);
      if (state === "speaking") {
        coreGradient.addColorStop(0, `rgba(168, 85, 247, ${0.35 + audioLevel * 0.2})`);
        coreGradient.addColorStop(1, "rgba(124, 58, 237, 0)");
      } else if (state === "listening") {
        coreGradient.addColorStop(0, `rgba(16, 185, 129, ${0.3 + audioLevel * 0.25})`);
        coreGradient.addColorStop(1, "rgba(6, 182, 212, 0)");
      } else {
        coreGradient.addColorStop(0, "rgba(124, 58, 237, 0.15)");
        coreGradient.addColorStop(1, "rgba(124, 58, 237, 0)");
      }
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(cx, cy, 35 + audioLevel * 10, 0, Math.PI * 2);
      ctx.fill();

      // Particles
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Orbit
        p.angle += p.speed * (1 + audioLevel * 3);

        // Radius reacts to audio
        const audioExpand = state === "listening" ? audioLevel * 50 : state === "speaking" ? audioLevel * 30 : 0;
        const breathe = Math.sin(t * 0.8 + i * 0.3) * 5;
        const targetRadius = p.baseRadius + audioExpand + breathe;
        p.radius += (targetRadius - p.radius) * 0.08;

        const x = cx + Math.cos(p.angle) * p.radius;
        const y = cy + Math.sin(p.angle) * p.radius;

        // Color based on state
        let r = 124, g = 58, b = 237;
        if (state === "listening") {
          r = 16; g = 185; b = 129;
        } else if (state === "speaking") {
          r = 168; g = 85; b = 247;
        } else if (state === "processing") {
          r = 245; g = 158; b = 11;
        }

        const alpha = p.opacity * (0.5 + audioLevel * 0.5);
        const size = p.size * (1 + audioLevel * 1.2);

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();

        // Subtle trail
        if (audioLevel > 0.1) {
          const trailX = cx + Math.cos(p.angle - p.speed * 3) * p.radius;
          const trailY = cy + Math.sin(p.angle - p.speed * 3) * p.radius;
          ctx.beginPath();
          ctx.arc(trailX, trailY, size * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`;
          ctx.fill();
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [audioLevel, state]);

  return (
    <canvas
      ref={canvasRef}
      className="h-[220px] w-[220px]"
      style={{ imageRendering: "auto" }}
    />
  );
}

// ── Waveform Line (Canvas) ────────────────────────────
function WaveformLine({
  audioLevel,
  state,
}: {
  audioLevel: number;
  state: VoiceState;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const isActive = state === "listening" || state === "speaking";

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const midY = h / 2;
      timeRef.current += 0.03;
      const t = timeRef.current;

      ctx.clearRect(0, 0, w, h);

      // Determine color
      let r = 124, g = 58, b = 237;
      if (state === "listening") { r = 16; g = 185; b = 129; }
      else if (state === "speaking") { r = 168; g = 85; b = 247; }

      // Draw main waveform
      const amplitude = isActive ? 6 + audioLevel * 20 : 2;
      const segments = 120;

      ctx.beginPath();
      ctx.moveTo(0, midY);

      for (let i = 0; i <= segments; i++) {
        const x = (i / segments) * w;
        const progress = i / segments;

        // Envelope — fade at edges
        const envelope = Math.sin(progress * Math.PI);

        // Multi-frequency wave
        const wave =
          Math.sin(progress * 8 + t * 2) * amplitude * 0.6 +
          Math.sin(progress * 16 + t * 3.5) * amplitude * 0.3 * audioLevel +
          Math.sin(progress * 24 + t * 5) * amplitude * 0.15 * audioLevel;

        const y = midY + wave * envelope;
        ctx.lineTo(x, y);
      }

      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.4 + audioLevel * 0.5})`;
      ctx.lineWidth = 1.5 + audioLevel * 1;
      ctx.stroke();

      // Secondary thinner wave
      ctx.beginPath();
      ctx.moveTo(0, midY);
      for (let i = 0; i <= segments; i++) {
        const x = (i / segments) * w;
        const progress = i / segments;
        const envelope = Math.sin(progress * Math.PI);
        const wave =
          Math.sin(progress * 12 + t * 1.5 + 1) * amplitude * 0.35 +
          Math.sin(progress * 20 + t * 4) * amplitude * 0.2 * audioLevel;
        ctx.lineTo(x, midY + wave * envelope);
      }
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.15 + audioLevel * 0.2})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Center dot
      const dotSize = 2 + audioLevel * 3;
      ctx.beginPath();
      ctx.arc(w / 2, midY, dotSize, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.6 + audioLevel * 0.4})`;
      ctx.fill();

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [audioLevel, state]);

  return (
    <canvas
      ref={canvasRef}
      className="h-[40px] w-[280px] sm:w-[320px]"
    />
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

const STATE_COLORS: Record<VoiceState, string> = {
  idle: "text-white/40",
  connecting: "text-amber-400",
  listening: "text-emerald-400",
  speaking: "text-violet-400",
  processing: "text-amber-400",
};

// ── Main Voice Panel (Fullscreen Floating) ────────────
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

  const handleClose = useCallback(() => {
    stop();
    onClose();
  }, [stop, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
          style={{
            background: "radial-gradient(ellipse at center, rgba(124,58,237,0.08) 0%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.95) 100%)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Close button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            onClick={handleClose}
            className="absolute top-6 right-6 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </motion.button>

          {/* GRIXI label */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8"
          >
            <p className="text-center font-serif text-lg font-semibold italic tracking-wide text-white/20">
              GRIXI
              <span className="ml-1.5 bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">
                Voice
              </span>
            </p>
          </motion.div>

          {/* Particle Orb */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
          >
            <ParticleOrb audioLevel={audioLevel} state={state} />
          </motion.div>

          {/* Waveform Line */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0.5 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="mt-4"
          >
            <WaveformLine audioLevel={audioLevel} state={state} />
          </motion.div>

          {/* Status */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-6 flex items-center gap-2"
          >
            {(state === "listening" || state === "speaking") && (
              <motion.div
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  state === "listening" ? "bg-emerald-400" : "bg-violet-400"
                )}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
            {state === "processing" && (
              <motion.div
                className="h-1.5 w-1.5 rounded-full bg-amber-400"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              />
            )}
            <span
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.2em]",
                STATE_COLORS[state]
              )}
            >
              {STATE_LABELS[state]}
            </span>
          </motion.div>

          {/* Error */}
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-[11px] text-red-400/80"
            >
              {error}
            </motion.p>
          )}

          {/* Assistant response text */}
          <AnimatePresence>
            {currentAssistantText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="mx-auto mt-8 max-w-md px-6"
              >
                <p className="text-center text-sm leading-relaxed text-white/70">
                  {currentAssistantText}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-8 text-[10px] text-white/20"
          >
            Prueba: &quot;¿Cómo va la operación?&quot; · &quot;Llévame a almacenes&quot; · &quot;Dame un resumen&quot;
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
