"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, History, ChevronLeft, ChevronRight, BarChart3, Image as ImageIcon, Table2 } from "lucide-react";
import { AiChartBlock, type ChartConfig } from "./ai-chart-block";
import { cn } from "@/lib/utils/cn";

export type CanvasArtifact = {
  id: string;
  type: "chart" | "image" | "table";
  title: string;
  data: ChartConfig | string; // ChartConfig for charts, URL for images, HTML for tables
  createdAt: string;
};

type AiCanvasPanelProps = {
  artifacts: CanvasArtifact[];
  isOpen: boolean;
  onClose: () => void;
};

export function AiCanvasPanel({ artifacts, isOpen, onClose }: AiCanvasPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const prevLengthRef = useRef(artifacts.length);

  // Auto-navigate to the newest artifact when one is added
  useEffect(() => {
    if (artifacts.length > prevLengthRef.current) {
      setCurrentIndex(artifacts.length - 1);
    }
    prevLengthRef.current = artifacts.length;
  }, [artifacts.length]);

  const currentArtifact = artifacts[currentIndex];
  const hasMultiple = artifacts.length > 1;

  const handlePrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const handleNext = () => setCurrentIndex((i) => Math.min(artifacts.length - 1, i + 1));

  const getIcon = (type: string) => {
    switch (type) {
      case "chart": return <BarChart3 size={12} />;
      case "image": return <ImageIcon size={12} />;
      case "table": return <Table2 size={12} />;
      default: return <BarChart3 size={12} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && artifacts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 20, width: 0 }}
          animate={{ opacity: 1, x: 0, width: 420 }}
          exit={{ opacity: 0, x: 20, width: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="flex h-full flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--bg-primary)]"
        >
          {/* Header */}
          <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--brand)]/10 text-[var(--brand)]">
                <BarChart3 size={12} />
              </div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">Canvas</h3>
              {hasMultiple && (
                <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                  {currentIndex + 1}/{artifacts.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasMultiple && (
                <>
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex === artifacts.length - 1}
                    className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                  >
                    <ChevronRight size={14} />
                  </button>
                </>
              )}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={cn(
                  "rounded-lg p-1.5 transition-colors",
                  showHistory
                    ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                )}
                title="Historial"
              >
                <History size={14} />
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* History sidebar overlay */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-b border-[var(--border)]"
              >
                <div className="max-h-48 overflow-y-auto px-2 py-2">
                  <p className="mb-1.5 px-2 text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Historial
                  </p>
                  {artifacts.map((art, i) => (
                    <button
                      key={art.id}
                      onClick={() => { setCurrentIndex(i); setShowHistory(false); }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                        i === currentIndex
                          ? "bg-[var(--brand)]/10 text-[var(--text-primary)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
                      )}
                    >
                      <span className="shrink-0">{getIcon(art.type)}</span>
                      <span className="truncate text-[11px] font-medium">{art.title}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-4">
            {currentArtifact && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentArtifact.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Artifact title */}
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-[var(--text-muted)]">{getIcon(currentArtifact.type)}</span>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">{currentArtifact.title}</h4>
                  </div>

                  {/* Render based on type */}
                  {currentArtifact.type === "chart" && typeof currentArtifact.data !== "string" && (
                    <AiChartBlock config={currentArtifact.data} />
                  )}
                  {currentArtifact.type === "image" && typeof currentArtifact.data === "string" && (
                    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                      <img
                        src={currentArtifact.data}
                        alt={currentArtifact.title}
                        className="w-full object-contain"
                      />
                    </div>
                  )}
                  {currentArtifact.type === "table" && typeof currentArtifact.data === "string" && (
                    <div
                      className="overflow-x-auto rounded-xl border border-[var(--border)]"
                      dangerouslySetInnerHTML={{ __html: currentArtifact.data }}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
