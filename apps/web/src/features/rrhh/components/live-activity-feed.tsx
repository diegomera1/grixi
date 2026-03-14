"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Activity } from "lucide-react";
import type { DemoEvent } from "../hooks/use-rrhh-demo";

type Props = {
  events: DemoEvent[];
  isRunning: boolean;
};

export function LiveActivityFeed({ events, isRunning }: Props) {
  if (events.length === 0 && !isRunning) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)]">
        <div className="relative">
          <Activity size={13} className="text-[#10B981]" />
          {isRunning && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
          )}
        </div>
        <span className="text-[11px] font-semibold text-[var(--text-primary)]">
          Actividad en Vivo
        </span>
        {isRunning && (
          <span className="ml-auto text-[9px] text-[#10B981] font-medium tracking-wider uppercase">
            ● Conectado
          </span>
        )}
      </div>

      {/* Feed */}
      <div className="px-4 py-2 max-h-[180px] overflow-y-auto space-y-0.5">
        <AnimatePresence initial={false}>
          {events.slice(0, 8).map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className="flex items-center gap-2.5 py-1.5"
            >
              {/* Dot */}
              <div
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: event.color }}
              />
              {/* Message */}
              <span className="text-[10px] text-[var(--text-secondary)] flex-1 truncate">
                {event.message}
              </span>
              {/* Time */}
              <span className="text-[8px] font-mono text-[var(--text-muted)] shrink-0">
                {event.timestamp.toLocaleTimeString("es-EC", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {events.length === 0 && isRunning && (
          <div className="flex items-center gap-2 py-3">
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] animate-pulse" />
            <span className="text-[10px] text-[var(--text-muted)] italic">
              Esperando actividad...
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
