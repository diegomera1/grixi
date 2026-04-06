"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  RefreshCw,
  Loader2,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  PieChart,
  Clock,
  Package,
  Zap,
  ShieldAlert,
  Eye,
  ArrowRight,
  Bot,
  Brain,
  Target,
  Activity,
  Lightbulb,
  FileBarChart,
  Layers,
  Gauge,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { WmsAiInsight, WmsDashboardKpis } from "../types";
import { generateWmsInsights } from "../actions/ai-insights-action";

// ── Types ──────────────────────────────────────────────
type AiAnalysisTabProps = {
  insights: WmsAiInsight[];
  kpis: WmsDashboardKpis;
  onInsightsRefreshed?: (insights: WmsAiInsight[]) => void;
};

type ReportType =
  | "abc"
  | "tendencias"
  | "kpi_semanal"
  | "stock"
  | "valorizacion"
  | "eficiencia"
  | "dead_stock";

const SEVERITY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: typeof AlertTriangle; pulse?: boolean }
> = {
  critical: { label: "Crítica", color: "text-red-500", bg: "bg-red-500/8", border: "border-red-500/20", icon: ShieldAlert, pulse: true },
  high: { label: "Alta", color: "text-orange-500", bg: "bg-orange-500/8", border: "border-orange-500/20", icon: AlertTriangle },
  medium: { label: "Media", color: "text-amber-500", bg: "bg-amber-500/8", border: "border-amber-500/20", icon: Eye },
  low: { label: "Baja", color: "text-blue-500", bg: "bg-blue-500/8", border: "border-blue-500/20", icon: Lightbulb },
};

const TYPE_CONFIG: Record<string, { label: string; icon: typeof TrendingUp; color: string }> = {
  prediction: { label: "Predicción", icon: TrendingUp, color: "text-violet-500" },
  optimization: { label: "Optimización", icon: Target, color: "text-cyan-500" },
  warning: { label: "Alerta", icon: AlertTriangle, color: "text-amber-500" },
  info: { label: "Información", icon: Activity, color: "text-blue-500" },
};

const REPORT_CARDS: { id: ReportType; label: string; description: string; icon: typeof BarChart3; gradient: string }[] = [
  { id: "abc", label: "Análisis ABC", description: "Clasificación de productos por valor y rotación", icon: PieChart, gradient: "from-violet-500 to-purple-600" },
  { id: "tendencias", label: "Tendencias", description: "Movimientos de entrada/salida últimos 7 días", icon: TrendingUp, gradient: "from-cyan-500 to-blue-600" },
  { id: "kpi_semanal", label: "KPI Semanal", description: "Resumen ejecutivo de indicadores operativos", icon: BarChart3, gradient: "from-emerald-500 to-teal-600" },
  { id: "stock", label: "Estado de Stock", description: "Productos bajo mínimo y proyecciones", icon: Package, gradient: "from-amber-500 to-orange-600" },
  { id: "valorizacion", label: "Valorización", description: "Valor del inventario por categoría", icon: Layers, gradient: "from-indigo-500 to-blue-600" },
  { id: "eficiencia", label: "Eficiencia", description: "Dock-to-stock, picking time, precisión", icon: Gauge, gradient: "from-rose-500 to-pink-600" },
  { id: "dead_stock", label: "Dead Stock", description: "Productos sin movimiento en 60+ días", icon: Clock, gradient: "from-slate-500 to-gray-600" },
];

function timeAgo(dateStr: string) {
  const delta = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "ahora mismo";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

// ── Main Component ──────────────────────────────────────
export function AiAnalysisTab({ insights: initialInsights, kpis, onInsightsRefreshed }: AiAnalysisTabProps) {
  const [insights, setInsights] = useState<WmsAiInsight[]>(initialInsights);
  const [isPending, startTransition] = useTransition();
  const [generatingReport, setGeneratingReport] = useState<ReportType | null>(null);
  const [reportResult, setReportResult] = useState<string | null>(null);

  const activeInsights = useMemo(() => insights.filter((i) => !i.is_dismissed), [insights]);

  const handleRegenerate = () => {
    startTransition(async () => {
      toast.loading("Generando insights con IA...", { id: "ai-regen" });
      const result = await generateWmsInsights();
      if (result.success && result.insights) {
        setInsights(result.insights);
        onInsightsRefreshed?.(result.insights);
        toast.success("Insights actualizados", { id: "ai-regen", description: `${result.insights.length} insights generados por GRIXI AI` });
      } else {
        toast.error("Error al generar insights", { id: "ai-regen", description: result.message });
      }
    });
  };

  const handleQuickReport = (reportId: ReportType) => {
    const reportLabel = REPORT_CARDS.find((r) => r.id === reportId)?.label || reportId;
    setGeneratingReport(reportId);
    setReportResult(null);

    // Simulate AI report generation with contextual mock data
    setTimeout(() => {
      const reports: Record<ReportType, string> = {
        abc: `📊 **Análisis ABC — Todos los Almacenes**\n\n**Clase A** (12 productos, ~78% del valor):\n• Motor Eléctrico 5HP — 287 movimientos, $51,660\n• Bomba Rexroth A10V — 215 movimientos, $96,750\n• Variador ABB ACS580 — 198 movimientos, $89,100\n\n**Clase B** (18 productos, ~15% del valor):\n• Rodamiento SKF 6205, Filtro hidráulico, Aceite SAE 68...\n\n**Clase C** (37 productos, ~7% del valor):\n• Empaque de caucho, Tornillo M8, Arandela plana...\n\n💡 **Recomendación:** Mover productos Clase A a posiciones de picking rápido (nivel 1-2, pasillo A).`,

        tendencias: `📈 **Tendencias de Movimiento — Última Semana**\n\n| Día | Entradas | Salidas | Traspasos |\n|-----|----------|---------|----------|\n| Lun | 12 | 8 | 3 |\n| Mar | 15 | 11 | 2 |\n| Mié | 8 | 14 | 5 |\n| Jue | 18 | 9 | 1 |\n| Vie | 22 | 16 | 4 |\n| Sáb | 3 | 2 | 0 |\n| Dom | 0 | 0 | 0 |\n\n📊 **Total:** 78 entradas, 60 salidas, 15 traspasos\n⚡ **Pico:** Viernes (22 entradas) — considerar refuerzo de personal\n📉 **Ratio E/S:** 1.30 — acumulando stock neto`,

        kpi_semanal: `📋 **Informe KPI Semanal — Semana 14/2026**\n\n• **Ocupación promedio:** ${kpis.avgOccupancy}% (${kpis.avgOccupancy > 80 ? "⚠️ sobre el óptimo" : "✅ en rango"})\n• **Posiciones totales:** ${kpis.totalPositions.toLocaleString()}\n• **Posiciones ocupadas:** ${kpis.occupiedPositions.toLocaleString()}\n• **Productos catalogados:** ${kpis.totalProducts}\n• **Recepciones hoy:** ${kpis.todayReceipts}\n• **Despachos hoy:** ${kpis.todayIssues}\n• **Lotes expirando (<30d):** ${kpis.expiringLots}\n• **Traspasos pendientes:** ${kpis.pendingTransfers}\n\n✅ **Precisión de inventario:** 97.3% (sobre objetivo 95%)\n⏱️ **Dock-to-Stock promedio:** 2.4h (objetivo: <4h)`,

        stock: `📦 **Estado de Stock — Alertas Activas**\n\n**⚠️ Bajo Mínimo:**\n• Motor Eléctrico 5HP — 5 UN (mín: 10) — ¡CRÍTICO!\n• Rodamiento SKF 6205 — 45 UN (mín: 50) — bajo\n• Aceite Hidráulico — 8 L (mín: 20) — CRÍTICO\n\n**📈 Proyección Stock-Out (14 días):**\n• Motor Eléctrico 5HP → se agota ~9 abril\n• Aceite Hidráulico → se agota ~12 abril\n\n**✅ Sobre-stock:**\n• Tornillo M8 — 2,500 UN (mín: 100) — 25x el mínimo\n\n💡 Crear solicitudes de compra para 3 ítems críticos`,

        valorizacion: `💰 **Valorización del Inventario**\n\n| Categoría | Valor | % del Total |\n|-----------|-------|------------|\n| Hidráulicos | $285,400 | 32.1% |\n| Eléctricos | $198,750 | 22.4% |\n| Mecánicos | $156,300 | 17.6% |\n| Instrumentación | $98,200 | 11.1% |\n| Lubricantes | $67,800 | 7.6% |\n| Seguridad | $45,100 | 5.1% |\n| Consumibles | $36,450 | 4.1% |\n\n**Total inventario:** $888,000\n📊 Top 3 categorías = 72.1% del valor total`,

        eficiencia: `⏱️ **Métricas de Eficiencia Operativa**\n\n| Métrica | Actual | Objetivo | Estado |\n|---------|--------|----------|--------|\n| Dock-to-Stock | 2.4h | <4h | ✅ |\n| Picking Accuracy | 98.1% | >97% | ✅ |\n| Order Fill Rate | 94.7% | >95% | ⚠️ |\n| Inventory Accuracy | 97.3% | >95% | ✅ |\n| Cycle Count Coverage | 82% | >90% | ⚠️ |\n| Space Utilization | ${kpis.avgOccupancy}% | 70-85% | ${kpis.avgOccupancy > 85 ? "⚠️" : "✅"} |\n\n💡 **Áreas de mejora:** Order Fill Rate (ajustar stock de seguridad) y cobertura de conteos cíclicos.`,

        dead_stock: `🕐 **Dead Stock Analysis**\n\n**Productos sin movimiento 60+ días:**\n\n| Producto | Última Mov. | Qty | Valor | Acción |\n|----------|------------|-----|-------|--------|\n| Empaque O-Ring 45mm | 15 ene | 340 | $680 | Liquidar |\n| Fusible HRC 63A | 28 ene | 48 | $960 | Devolver |\n| Válvula Solenoide DN8 | 02 feb | 12 | $2,880 | Revisar |\n| Cable AWG 14 (rollo) | 10 feb | 25 | $625 | Reubicar |\n\n📊 **Total dead stock:** 4 productos, ~$5,145\n📍 **Posiciones ocupadas:** 4 posiciones en zona B-C\n\n💡 Liberar estas posiciones reduciría la ocupación en ~0.05% y liberaría capital de trabajo.`,
      };

      setReportResult(reports[reportId] || "Reporte no disponible");
      setGeneratingReport(null);
      toast.success(`Reporte "${reportLabel}" generado`, { description: "Análisis completado por GRIXI AI" });
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-5"
    >
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500/20 to-purple-500/20">
            <Brain size={20} className="text-violet-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">Análisis IA</h2>
            <p className="text-[10px] text-text-muted">
              Powered by GRIXI AI
            </p>
          </div>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={isPending}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all",
            isPending
              ? "cursor-not-allowed opacity-50 bg-muted text-text-muted"
              : "bg-linear-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-sm"
          )}
        >
          {isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          {isPending ? "Analizando..." : "Regenerar Análisis"}
        </button>
      </div>

      {/* ── Insights Proactivos ──────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
            <Sparkles size={13} className="text-violet-500" />
            Insights Automáticos
          </h3>
          <span className="text-[10px] text-text-muted">
            {activeInsights.length > 0 && `Último: ${timeAgo(activeInsights[0]?.created_at || "")}`}
          </span>
        </div>

        {activeInsights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-border bg-muted/30">
            <Bot size={28} className="text-text-muted mb-2 opacity-40" />
            <p className="text-xs text-text-muted">Sin insights activos</p>
            <p className="text-[10px] text-text-muted mt-0.5">
              Click en &quot;Regenerar Análisis&quot; para generar nuevos insights
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            <AnimatePresence>
              {activeInsights.map((insight, i) => {
                const sev = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.medium;
                const SevIcon = sev.icon;
                const type = TYPE_CONFIG[insight.insight_type] || TYPE_CONFIG.info;
                const TypeIcon = type.icon;

                return (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      "group rounded-xl border p-4 transition-all hover:shadow-sm",
                      sev.border,
                      sev.bg
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                        sev.bg,
                        sev.pulse && "animate-pulse"
                      )}>
                        <SevIcon size={16} className={sev.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-bold text-text-primary">
                            {insight.title}
                          </span>
                          <span className={cn("flex items-center gap-1 text-[9px] font-semibold rounded-full px-2 py-0.5", sev.bg, sev.color)}>
                            <SevIcon size={8} /> {sev.label}
                          </span>
                          <span className={cn("flex items-center gap-1 text-[9px] font-medium rounded-full px-2 py-0.5 bg-muted", type.color)}>
                            <TypeIcon size={8} /> {type.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-secondary leading-relaxed">
                          {insight.message}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[9px] text-text-muted">
                            {timeAgo(insight.created_at)}
                          </span>
                          {insight.warehouse_name && (
                            <span className="text-[9px] text-text-muted">
                              📍 {insight.warehouse_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-brand transition-colors opacity-0 group-hover:opacity-100 rounded-lg px-2 py-1.5 hover:bg-muted">
                        <ArrowRight size={10} />
                        <span>Acción</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Reportes Rápidos ─────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
          <FileBarChart size={13} className="text-emerald-500" />
          Reportes Rápidos
        </h3>
        <p className="text-[10px] text-text-muted -mt-1">
          Click en un reporte para generarlo al instante con GRIXI AI
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {REPORT_CARDS.map((report, i) => {
            const isGenerating = generatingReport === report.id;
            return (
              <motion.button
                key={report.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => handleQuickReport(report.id)}
                disabled={generatingReport !== null}
                className={cn(
                  "group relative text-left rounded-xl border border-border bg-surface p-3.5 transition-all hover:shadow-md hover:border-brand/20",
                  isGenerating && "ring-2 ring-violet-500/30 border-violet-500/40",
                  generatingReport !== null && !isGenerating && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br mb-2.5 transition-transform group-hover:scale-110",
                  report.gradient
                )}>
                  {isGenerating ? (
                    <Loader2 size={14} className="text-white animate-spin" />
                  ) : (
                    <report.icon size={14} className="text-white" />
                  )}
                </div>
                <p className="text-[11px] font-bold text-text-primary mb-0.5">
                  {report.label}
                </p>
                <p className="text-[9px] text-text-muted leading-snug line-clamp-2">
                  {report.description}
                </p>
                {/* Hover arrow */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Zap size={12} className="text-text-muted" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Report Result Panel ─────────────────────────── */}
      <AnimatePresence>
        {reportResult && (
          <motion.div
            initial={{ opacity: 0, y: 12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -12, height: 0 }}
            className="rounded-xl border border-violet-500/20 bg-linear-to-br from-violet-500/5 to-purple-500/5 overflow-hidden"
          >
            <div className="border-b border-violet-500/10 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot size={14} className="text-violet-500" />
                <span className="text-xs font-bold text-text-primary">Resultado del Análisis</span>
                <span className="text-[9px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full font-medium">
                  GRIXI AI
                </span>
              </div>
              <button
                onClick={() => setReportResult(null)}
                className="text-[10px] text-text-muted hover:text-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-muted"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4">
              <pre className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap font-sans">
                {reportResult}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chat Contextual Link ────────────────────────── */}
      <div className="rounded-xl border border-border bg-linear-to-r from-surface to-violet-500/5 p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-purple-600 shrink-0">
            <MessageSquare size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-bold text-text-primary">
              Chat Contextual GRIXI AI
            </h3>
            <p className="text-[10px] text-text-muted mt-0.5">
              Pregunta lo que necesites sobre tus almacenes. La IA tiene acceso completo a tu data WMS en tiempo real.
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {[
                "¿Cuáles productos tienen mayor rotación?",
                "¿Cuándo debo reordenar rodamientos SKF?",
                "Analiza la ocupación de los almacenes",
              ].map((suggestion) => (
                <span
                  key={suggestion}
                  className="text-[9px] text-violet-500 bg-violet-500/8 rounded-full px-2.5 py-1 font-medium"
                >
                  &quot;{suggestion}&quot;
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
