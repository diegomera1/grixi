import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, BarChart3 } from "lucide-react";
import { AiChartBlock, type ChartConfig } from "./ai-chart-block";

type CanvasProps = {
  isOpen: boolean;
  onClose: () => void;
  charts: ChartConfig[];
  lastUpdated?: string;
};

export function AiCanvasPanel({ isOpen, onClose, charts, lastUpdated }: CanvasProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 420, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="flex h-full flex-col border-l border-border bg-surface overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-brand" />
              <h3 className="text-sm font-semibold text-text-primary">Canvas</h3>
              {lastUpdated && (
                <span className="text-[9px] text-text-muted">
                  {new Date(lastUpdated).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted hover:text-text-primary"
              title="Cerrar canvas"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {charts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 rounded-full bg-muted p-3">
                  <Maximize2 size={20} className="text-text-muted" />
                </div>
                <p className="text-xs text-text-muted">
                  Los gráficos y visualizaciones aparecerán aquí cuando GRIXI AI los genere.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {charts.map((chart, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <AiChartBlock config={chart} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
