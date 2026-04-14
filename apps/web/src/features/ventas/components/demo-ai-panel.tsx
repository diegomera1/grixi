"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  SkipForward,
  SkipBack,
  Pause,
  Play,
  X,
  Loader2,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDemoTour } from "./demo-tour-provider";

// ── Typewriter Hook ───────────────────────────────

function useTypewriter(text: string | null, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!text) {
      setDisplayed("");
      setIsTyping(false);
      return;
    }

    setDisplayed("");
    setIsTyping(true);
    let i = 0;

    intervalRef.current = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        setIsTyping(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, speed]);

  return { displayed, isTyping };
}

// ── Demo AI Panel ─────────────────────────────────

export function DemoAiPanel() {
  const {
    status,
    currentStep,
    currentStepIndex,
    currentInsight,
    isAnalyzing,
    steps,
    nextStep,
    prevStep,
    pauseDemo,
    resumeDemo,
    stopDemo,
  } = useDemoTour();

  const { displayed, isTyping } = useTypewriter(currentInsight);

  if (status === "idle") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "fixed bottom-6 right-6 z-[60] w-[420px]",
          "rounded-2xl border border-[var(--border)]",
          "bg-[var(--bg-card)]/95 backdrop-blur-xl",
          "shadow-2xl shadow-black/20",
          "overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6]">
                <Bot size={14} className="text-white" />
              </div>
              {(isAnalyzing || isTyping) && (
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[var(--bg-card)]"
                />
              )}
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-[var(--text-primary)]">
                GRIXI AI Demo
              </h4>
              <p className="text-[8px] text-[var(--text-muted)]">
                {currentStep
                  ? `Analizando: ${currentStep.tabLabel}`
                  : "Demo completada"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Step indicator */}
            <div className="flex items-center gap-1 mr-2">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === currentStepIndex
                      ? "w-4 bg-[#3B82F6]"
                      : i < currentStepIndex
                        ? "w-1.5 bg-emerald-400"
                        : "w-1.5 bg-[var(--bg-muted)]"
                  )}
                />
              ))}
            </div>
            <button
              onClick={stopDemo}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Tab badge */}
        {currentStep && (
          <div className="px-4 pt-3 pb-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#3B82F6]/10 px-2.5 py-1">
              <Sparkles size={9} className="text-[#3B82F6]" />
              <span className="text-[8px] font-semibold text-[#3B82F6]">
                {currentStep.tabLabel}
              </span>
              <span className="text-[8px] text-[var(--text-muted)]">
                — {currentStep.description}
              </span>
            </div>
          </div>
        )}

        {/* AI insight content */}
        <div className="px-4 py-3 min-h-[80px]">
          {isAnalyzing ? (
            <div className="flex items-center gap-3">
              <Loader2
                size={14}
                className="animate-spin text-[#3B82F6]"
              />
              <div>
                <p className="text-[10px] font-medium text-[var(--text-primary)]">
                  Analizando datos...
                </p>
                <p className="text-[8px] text-[var(--text-muted)]">
                  Procesando {currentStep?.tabLabel} con Gemini AI
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] leading-relaxed text-[var(--text-primary)]">
              {displayed}
              {isTyping && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="inline-block w-0.5 h-3 bg-[#3B82F6] ml-0.5 align-text-bottom"
                />
              )}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2.5">
          <span className="text-[9px] font-medium text-[var(--text-muted)] tabular-nums">
            Paso {currentStepIndex + 1} de {steps.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              className="flex h-7 items-center gap-1 rounded-lg px-2.5 text-[9px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30"
            >
              <SkipBack size={10} />
              Anterior
            </button>

            {status === "paused" ? (
              <button
                onClick={resumeDemo}
                className="flex h-7 items-center gap-1 rounded-lg bg-[#3B82F6]/10 px-2.5 text-[9px] font-medium text-[#3B82F6] hover:bg-[#3B82F6]/20 transition-colors"
              >
                <Play size={10} />
                Continuar
              </button>
            ) : (
              <button
                onClick={pauseDemo}
                className="flex h-7 items-center gap-1 rounded-lg px-2.5 text-[9px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Pause size={10} />
                Pausar
              </button>
            )}

            <button
              onClick={nextStep}
              disabled={isAnalyzing || status === "completed"}
              className="flex h-7 items-center gap-1 rounded-lg bg-[#3B82F6] px-3 text-[9px] font-bold text-white shadow-lg shadow-[#3B82F6]/25 hover:bg-[#2563EB] transition-colors disabled:opacity-50"
            >
              {status === "completed" ? "Finalizado" : "Siguiente"}
              {status !== "completed" && <SkipForward size={10} />}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
