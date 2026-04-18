"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { formatCurrencyCompact } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/lib/utils/currency";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  DollarSign,
  Calendar,
  User,
  Building2,
  Clock,
  Filter,
  Zap,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type {
  SalesPipelineStage,
  SalesOpportunity,
  DemoRole,
  SellerProfile,
} from "../types";
import { SOURCE_LABELS } from "../types";
import { moveOpportunityStage } from "../actions/ventas-actions";
import { PipelineFunnel } from "./pipeline-funnel";

// ── Types ─────────────────────────────────────────

type Props = {
  stages: SalesPipelineStage[];
  opportunities: SalesOpportunity[];
  sellers: SellerProfile[];
  onOpportunityMove: (oppId: string, newStageId: string) => void;
  demoRole: DemoRole;
  currency: CurrencyCode;
  convert: (v: number) => number;
};

// ── Amount Filters ────────────────────────────────

const AMOUNT_FILTERS = [
  { label: "Todos", min: 0, max: Infinity },
  { label: "<$50K", min: 0, max: 50000 },
  { label: "$50-200K", min: 50000, max: 200000 },
  { label: ">$200K", min: 200000, max: Infinity },
];

// Note: fmtAmount is replaced by formatCurrencyCompact in render calls

function daysAgo(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

// ── Sortable Opportunity Card ─────────────────────

function SortableOpportunityCard({
  opp,
  index,
  stages,
  currentStageId,
  stageColor,
  onQuickMove,
  currency,
  convert,
}: {
  opp: SalesOpportunity;
  index: number;
  stages: SalesPipelineStage[];
  currentStageId: string;
  stageColor: string;
  onQuickMove: (oppId: string, newStageId: string) => void;
  currency: CurrencyCode;
  convert: (v: number) => number;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const moveButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  // Calculate menu position when opening
  useEffect(() => {
    if (showMoveMenu && moveButtonRef.current) {
      const rect = moveButtonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.top - 4, // above the button
        left: Math.min(rect.right, window.innerWidth - 176), // 176 = w-44 = 11rem
      });
    }
  }, [showMoveMenu]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: opp.id,
    data: {
      type: "opportunity",
      stageId: currentStageId,
      opportunity: opp,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const otherStages = stages.filter((s) => s.id !== currentStageId && s.is_active);
  const daysInStage = daysAgo(opp.stage_changed_at);

  return (
    <div ref={setNodeRef} style={style}>
      <motion.div
        layout
        layoutId={opp.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        className={cn(
          "group relative rounded-lg border-l-[3px] bg-[var(--bg-card)] p-2.5",
          "border border-[var(--border)] transition-all duration-200",
          isDragging
            ? "shadow-xl shadow-[var(--brand)]/10"
            : "hover:shadow-md hover:border-[var(--brand)]/20"
        )}
        style={{ borderLeftColor: stageColor }}
      >
        {/* Top row: name + amount */}
        <div className="flex items-start gap-1.5">
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--bg-muted)] active:cursor-grabbing"
            tabIndex={-1}
            aria-label="Arrastrar oportunidad"
          >
            <GripVertical size={10} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate leading-tight">
                {opp.name}
              </p>
              <span className="shrink-0 text-xs font-bold text-emerald-500 tabular-nums">
                {formatCurrencyCompact(convert(Number(opp.amount)), currency)}
              </span>
            </div>

            {/* Customer */}
            <div className="mt-0.5 flex items-center gap-1">
              {opp.customer?.logo_url ? (
                <img
                  src={opp.customer.logo_url}
                  alt=""
                  className="h-3.5 w-3.5 rounded object-cover"
                />
              ) : (
                <Building2 size={10} className="text-[var(--text-muted)]" />
              )}
              <span className="text-[11px] text-[var(--text-muted)] truncate">
                {opp.customer?.trade_name || opp.customer?.business_name || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom metadata */}
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {opp.expected_close_date && (
            <div className="flex items-center gap-0.5 rounded bg-[var(--bg-muted)] px-1 py-0.5">
              <Calendar size={8} className="text-[var(--text-muted)]" />
              <span className="text-[10px] text-[var(--text-muted)]">
                {new Date(opp.expected_close_date).toLocaleDateString("es-EC", {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
            </div>
          )}
          {daysInStage > 0 && (
            <div
              className={cn(
                "flex items-center gap-0.5 rounded px-1 py-0.5",
                daysInStage > 14
                  ? "bg-red-500/10 text-red-400"
                  : daysInStage > 7
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
              )}
            >
              <Clock size={8} />
              <span className="text-[10px] font-medium">{daysInStage}d</span>
            </div>
          )}

          {/* Probability + quick move */}
          <div className="ml-auto flex items-center gap-1">
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: `${stageColor}15`,
                color: stageColor,
              }}
            >
              {opp.probability}%
            </span>

            {/* Quick-move */}
            <button
              ref={moveButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                setShowMoveMenu(!showMoveMenu);
              }}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded transition-all",
                "hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]",
                showMoveMenu
                  ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                  : "text-[var(--text-muted)]"
              )}
              title="Mover a otra etapa"
            >
              <ArrowRight size={10} />
            </button>

            {/* Fixed-position dropdown (avoids overflow clipping) */}
            {showMoveMenu && (
              <>
                <div
                  className="fixed inset-0 z-[9998]"
                  onClick={() => setShowMoveMenu(false)}
                />
                <div
                  className="fixed z-[9999] w-44 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl"
                  style={{
                    top: menuPos ? `${menuPos.top}px` : 0,
                    left: menuPos ? `${menuPos.left - 176}px` : 0,
                    transform: 'translateY(-100%)',
                  }}
                >
                  <p className="border-b border-[var(--border)] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Mover a
                  </p>
                  {otherStages.map((stage) => (
                    <button
                      key={stage.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickMove(opp.id, stage.id);
                        setShowMoveMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)]"
                    >
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="flex-1 text-left truncate">{stage.name}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {stage.default_probability}%
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Drag Overlay Card (Ghost) ─────────────────────

function DragOverlayCard({ opp, currency, convert }: { opp: SalesOpportunity; currency: CurrencyCode; convert: (v: number) => number }) {
  return (
    <div className="w-[220px] rounded-lg border border-[var(--brand)]/30 bg-[var(--bg-card)]/95 p-2.5 shadow-2xl shadow-[var(--brand)]/15 backdrop-blur-md ring-2 ring-[var(--brand)]/20">
      <div className="flex items-start gap-1.5">
        <GripVertical size={10} className="mt-0.5 text-[var(--brand)]" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
              {opp.name}
            </p>
            <span className="shrink-0 text-xs font-bold text-emerald-500 tabular-nums">
              {formatCurrencyCompact(convert(Number(opp.amount)), currency)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            {opp.customer?.logo_url ? (
              <img src={opp.customer.logo_url} alt="" className="h-3.5 w-3.5 rounded object-cover" />
            ) : (
              <Building2 size={10} className="text-[var(--text-muted)]" />
            )}
            <span className="text-[11px] text-[var(--text-muted)] truncate">
              {opp.customer?.trade_name || opp.customer?.business_name || "—"}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[11px] text-[var(--brand)] font-medium">
          ↕ Suelta en la etapa destino
        </span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
          style={{
            backgroundColor: `${opp.stage?.color || "#6B7280"}15`,
            color: opp.stage?.color || "#6B7280",
          }}
        >
          {opp.probability}%
        </span>
      </div>
    </div>
  );
}


// ── Main Pipeline Export ───────────────────────────

export function PipelineTab({
  stages,
  opportunities,
  sellers,
  onOpportunityMove,
  demoRole,
  currency,
  convert,
}: Props) {
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [amountFilter, setAmountFilter] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages]
  );

  const filteredOpps = useMemo(() => {
    let result = opportunities;
    if (sellerFilter !== "all") {
      result = result.filter((o) => o.seller_id === sellerFilter);
    }
    const af = AMOUNT_FILTERS[amountFilter];
    result = result.filter(
      (o) => Number(o.amount) >= af.min && Number(o.amount) < af.max
    );
    return result;
  }, [opportunities, sellerFilter, amountFilter]);

  const activeOpp = useMemo(
    () => (activeId ? opportunities.find((o) => o.id === activeId) : null),
    [activeId, opportunities]
  );

  // Total pipeline metrics
  const totalPipeline = filteredOpps.reduce((s, o) => s + Number(o.amount), 0);
  const totalWeighted = filteredOpps.reduce(
    (s, o) => s + Number(o.amount) * (o.probability / 100), 0
  );
  const avgDealSize = filteredOpps.length > 0 ? totalPipeline / filteredOpps.length : 0;

  // Quick-move handler
  const handleQuickMove = useCallback(
    async (oppId: string, newStageId: string) => {
      const stage = stages.find((s) => s.id === newStageId);
      if (!stage) return;
      onOpportunityMove(oppId, newStageId);
      await moveOpportunityStage(oppId, newStageId, stage.default_probability);
    },
    [stages, onOpportunityMove]
  );

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) { setOverStageId(null); return; }
    const overData = over.data.current;
    if (overData?.type === "opportunity") {
      setOverStageId(overData.stageId as string);
    } else if (overData?.type === "column") {
      setOverStageId(String(over.id));
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverStageId(null);
      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;
      if (!activeData) return;

      const activeStageId = activeData.stageId as string;
      let targetStageId: string;

      if (overData?.type === "opportunity") {
        targetStageId = overData.stageId as string;
      } else if (overData?.type === "column") {
        targetStageId = String(over.id);
      } else {
        return;
      }

      if (activeStageId !== targetStageId) {
        const stage = stages.find((s) => s.id === targetStageId);
        if (!stage) return;
        onOpportunityMove(String(active.id), targetStageId);
        await moveOpportunityStage(String(active.id), targetStageId, stage.default_probability);
      }
    },
    [stages, onOpportunityMove]
  );

  return (
    <div className="space-y-3">
      {/* ═══ Summary KPIs + Filters ═══ */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
        {/* KPI chips */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10">
              <DollarSign size={12} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)] leading-none">Pipeline</p>
              <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatCurrencyCompact(convert(totalPipeline), currency)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--brand)]/10">
              <Target size={12} className="text-[var(--brand)]" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)] leading-none">Ponderado</p>
              <p className="text-sm font-bold text-emerald-500 tabular-nums">{formatCurrencyCompact(convert(totalWeighted), currency)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10">
              <BarChart3 size={12} className="text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)] leading-none">Ticket Prom.</p>
              <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatCurrencyCompact(convert(avgDealSize), currency)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
              <TrendingUp size={12} className="text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)] leading-none">Deals</p>
              <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{filteredOpps.length}</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-[var(--border)]" />

        {/* Filters */}
        <Filter size={12} className="text-[var(--text-muted)]" />
        <select
          value={sellerFilter}
          onChange={(e) => setSellerFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
        >
          <option value="all">Todos los vendedores</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {AMOUNT_FILTERS.map((af, i) => (
            <button
              key={af.label}
              onClick={() => setAmountFilter(i)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium transition-all",
                amountFilter === i
                  ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
              )}
            >
              {af.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Funnel Chart ═══ */}
      <PipelineFunnel stages={sortedStages} opportunities={filteredOpps} currency={currency} convert={convert} />

      {/* ═══ Kanban Board ═══ */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-2 pb-4" style={{ gridTemplateColumns: `repeat(${sortedStages.length}, minmax(0, 1fr))` }}>
          {sortedStages.map((stage) => {
            const stageOpps = filteredOpps.filter((o) => o.stage_id === stage.id);
            const oppIds = stageOpps.map((o) => o.id);

            return (
              <SortableContext
                key={stage.id}
                items={oppIds}
                strategy={verticalListSortingStrategy}
              >
                <DroppableColumn
                  stage={stage}
                  opportunities={stageOpps}
                  stages={sortedStages}
                  isOver={overStageId === stage.id}
                  onQuickMove={handleQuickMove}
                  totalPipeline={totalPipeline}
                  currency={currency}
                  convert={convert}
                />
              </SortableContext>
            );
          })}
        </div>

        <DragOverlay dropAnimation={{
          duration: 200,
          easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
        }}>
          {activeOpp ? <DragOverlayCard opp={activeOpp} currency={currency} convert={convert} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ── Droppable Column ──────────────────────────────

function DroppableColumn({
  stage,
  opportunities,
  stages,
  isOver,
  onQuickMove,
  totalPipeline,
  currency,
  convert,
}: {
  stage: SalesPipelineStage;
  opportunities: SalesOpportunity[];
  stages: SalesPipelineStage[];
  isOver: boolean;
  onQuickMove: (oppId: string, newStageId: string) => void;
  totalPipeline: number;
  currency: CurrencyCode;
  convert: (v: number) => number;
}) {
  const { setNodeRef } = useSortable({
    id: stage.id,
    data: { type: "column", stageId: stage.id },
  });

  const stageAmount = opportunities.reduce((sum, o) => sum + Number(o.amount), 0);
  const stageWeighted = opportunities.reduce(
    (sum, o) => sum + Number(o.amount) * (o.probability / 100), 0
  );
  const pipelinePct = totalPipeline > 0 ? (stageAmount / totalPipeline) * 100 : 0;

  // Avg days in stage
  const avgDays = opportunities.length > 0
    ? Math.round(
        opportunities.reduce((s, o) => s + daysAgo(o.stage_changed_at), 0) / opportunities.length
      )
    : 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border transition-all duration-200",
        "min-h-[350px]",
        isOver
          ? "border-dashed bg-[var(--bg-muted)]/80"
          : "border-[var(--border)] bg-[var(--bg-muted)]/30"
      )}
      style={
        isOver
          ? {
              borderColor: stage.color,
              boxShadow: `0 0 20px ${stage.color}15, inset 0 0 12px ${stage.color}05`,
            }
          : undefined
      }
    >
      {/* Column Header */}
      <div className="p-2.5 pb-1.5 space-y-1.5">
        {/* Title row */}
        <div className="flex items-center gap-2">
          <motion.div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: stage.color }}
            animate={isOver ? { scale: [1, 1.3, 1] } : { scale: 1 }}
            transition={isOver ? { repeat: Infinity, duration: 1 } : {}}
          />
          <h3 className="text-xs font-bold text-[var(--text-primary)] truncate flex-1">
            {stage.name}
          </h3>
          <span className="rounded-full bg-[var(--bg-card)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-muted)] shadow-sm">
            {opportunities.length}
          </span>
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-emerald-500 tabular-nums">
            {formatCurrencyCompact(convert(stageAmount), currency)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">·</span>
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
            {pipelinePct.toFixed(0)}%
          </span>
          {avgDays > 0 && (
            <>
              <span className="text-[10px] text-[var(--text-muted)]">·</span>
              <span className={cn(
                "text-[10px] tabular-nums",
                avgDays > 14 ? "text-red-400" : avgDays > 7 ? "text-amber-400" : "text-[var(--text-muted)]"
              )}>
                ~{avgDays}d
              </span>
            </>
          )}
        </div>

        {/* Pipeline bar */}
        <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pipelinePct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ backgroundColor: stage.color }}
          />
        </div>
      </div>

      {/* Drop zone indicator */}
      <AnimatePresence>
        {isOver && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 32 }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-2 mb-1.5 flex items-center justify-center gap-1 rounded-lg border-2 border-dashed"
            style={{
              borderColor: stage.color,
              backgroundColor: `${stage.color}08`,
            }}
          >
            <Zap size={10} style={{ color: stage.color }} />
            <span className="text-[11px] font-bold" style={{ color: stage.color }}>
              Soltar aquí — {stage.default_probability}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards */}
      <div className="flex-1 space-y-1.5 overflow-y-auto px-1.5 pb-2">
        {opportunities.length === 0 && !isOver && (
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)]">
              Sin oportunidades
            </p>
          </div>
        )}
        {opportunities.map((opp, i) => (
          <SortableOpportunityCard
            key={opp.id}
            opp={opp}
            index={i}
            stages={stages}
            currentStageId={stage.id}
            stageColor={stage.color}
            onQuickMove={onQuickMove}
            currency={currency}
            convert={convert}
          />
        ))}
      </div>
    </div>
  );
}
