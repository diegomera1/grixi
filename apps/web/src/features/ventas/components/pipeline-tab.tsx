"use client";

import { useState, useMemo, useCallback } from "react";
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
  arrayMove,
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
  Keyboard,
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
};

// ── Amount Filters ────────────────────────────────

const AMOUNT_FILTERS = [
  { label: "Todos", min: 0, max: Infinity },
  { label: "<$50K", min: 0, max: 50000 },
  { label: "$50-200K", min: 50000, max: 200000 },
  { label: ">$200K", min: 200000, max: Infinity },
];

// ── Sortable Opportunity Card ─────────────────────

function SortableOpportunityCard({
  opp,
  index,
  stages,
  currentStageId,
  onQuickMove,
}: {
  opp: SalesOpportunity;
  index: number;
  stages: SalesPipelineStage[];
  currentStageId: string;
  onQuickMove: (oppId: string, newStageId: string) => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

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

  // Other stages to move to (excluding current)
  const otherStages = stages.filter((s) => s.id !== currentStageId && s.is_active);

  // Days in current stage
  const daysInStage = opp.stage_changed_at
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(opp.stage_changed_at).getTime()) / 86400000
        )
      )
    : 0;

  return (
    <div ref={setNodeRef} style={style}>
      <motion.div
        layout
        layoutId={opp.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        className={cn(
          "group relative rounded-xl border bg-[var(--bg-card)] p-3",
          "transition-all duration-200",
          isDragging
            ? "border-[var(--brand)]/40 shadow-xl shadow-[var(--brand)]/10"
            : "border-[var(--border)] hover:shadow-md hover:border-[var(--brand)]/20"
        )}
      >
        {/* Top: grip handle + name + amount */}
        <div className="flex items-start gap-2">
          {/* Drag handle */}
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
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                {opp.name}
              </p>
              <span className="shrink-0 text-[10px] font-bold text-emerald-500 tabular-nums">
                ${(Number(opp.amount) / 1000).toFixed(1)}K
              </span>
            </div>

            {/* Customer */}
            <div className="mt-1 flex items-center gap-1.5">
              {opp.customer?.logo_url ? (
                <img
                  src={opp.customer.logo_url}
                  alt=""
                  className="h-3.5 w-3.5 rounded object-cover"
                />
              ) : (
                <Building2 size={9} className="text-[var(--text-muted)]" />
              )}
              <span className="text-[8px] text-[var(--text-muted)] truncate">
                {opp.customer?.trade_name ||
                  opp.customer?.business_name ||
                  "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Metadata row */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {opp.expected_close_date && (
            <div className="flex items-center gap-0.5 rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5">
              <Calendar size={8} className="text-[var(--text-muted)]" />
              <span className="text-[7px] text-[var(--text-muted)]">
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
                "flex items-center gap-0.5 rounded-md px-1.5 py-0.5",
                daysInStage > 14
                  ? "bg-red-500/10 text-red-400"
                  : daysInStage > 7
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
              )}
            >
              <Clock size={7} />
              <span className="text-[7px] font-medium">{daysInStage}d</span>
            </div>
          )}
          {opp.source && (
            <span className="text-[7px] text-[var(--text-muted)]">
              {SOURCE_LABELS[opp.source]}
            </span>
          )}
        </div>

        {/* Bottom: seller + probability + quick-move */}
        <div className="mt-2 flex items-center justify-between">
          {opp.seller ? (
            <div className="flex items-center gap-1">
              {opp.seller.avatar_url ? (
                <img
                  src={opp.seller.avatar_url}
                  alt=""
                  className="h-4 w-4 rounded-full object-cover ring-1 ring-[var(--border)]"
                />
              ) : (
                <User size={10} className="text-[var(--text-muted)]" />
              )}
              <span className="text-[8px] text-[var(--text-muted)] truncate max-w-[80px]">
                {opp.seller.full_name}
              </span>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-1.5">
            {/* Probability badge */}
            <span
              className="rounded-full px-1.5 py-0.5 text-[7px] font-bold"
              style={{
                backgroundColor: `${opp.stage?.color || "#6B7280"}15`,
                color: opp.stage?.color || "#6B7280",
              }}
            >
              {opp.probability}%
            </span>

            {/* Quick-move button (click alternative to DnD) */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoveMenu(!showMoveMenu);
                }}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-md text-[var(--text-muted)] transition-all",
                  "hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]",
                  showMoveMenu && "bg-[var(--brand)]/10 text-[var(--brand)]"
                )}
                title="Mover a otra etapa"
              >
                <ArrowRight size={10} />
              </button>

              {/* Move menu dropdown */}
              <AnimatePresence>
                {showMoveMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowMoveMenu(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full right-0 z-50 mb-1 w-44 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-xl"
                    >
                      <p className="border-b border-[var(--border)] px-3 py-1.5 text-[8px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
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
                          className="flex w-full items-center gap-2 px-3 py-2 text-[9px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)]"
                        >
                          <div
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="flex-1 text-left">{stage.name}</span>
                          <span className="text-[7px] text-[var(--text-muted)]">
                            {stage.default_probability}%
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Drag Overlay Card (Ghost) ─────────────────────

function DragOverlayCard({ opp }: { opp: SalesOpportunity }) {
  return (
    <div className="w-[250px] rounded-xl border border-[var(--brand)]/30 bg-[var(--bg-card)]/95 p-3 shadow-2xl shadow-[var(--brand)]/15 backdrop-blur-md ring-2 ring-[var(--brand)]/20">
      <div className="flex items-start gap-2">
        <GripVertical size={10} className="mt-0.5 text-[var(--brand)]" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold text-[var(--text-primary)] truncate">
              {opp.name}
            </p>
            <span className="shrink-0 text-[10px] font-bold text-emerald-500 tabular-nums">
              ${(Number(opp.amount) / 1000).toFixed(1)}K
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {opp.customer?.logo_url ? (
              <img
                src={opp.customer.logo_url}
                alt=""
                className="h-3.5 w-3.5 rounded object-cover"
              />
            ) : (
              <Building2 size={9} className="text-[var(--text-muted)]" />
            )}
            <span className="text-[8px] text-[var(--text-muted)] truncate">
              {opp.customer?.trade_name ||
                opp.customer?.business_name ||
                "—"}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[8px] text-[var(--brand)] font-medium">
          ↕ Suelta en la etapa destino
        </span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[7px] font-bold"
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
}: Props) {
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [amountFilter, setAmountFilter] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);

  // Sensors: pointer (desktop), touch (mobile), keyboard (a11y)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages]
  );

  // Filtered opportunities
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

  // Active drag opportunity
  const activeOpp = useMemo(
    () => (activeId ? opportunities.find((o) => o.id === activeId) : null),
    [activeId, opportunities]
  );


  // Quick-move handler (click-based alternative to DnD)
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
    if (!over) {
      setOverStageId(null);
      return;
    }

    // Determine target stage
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

      // Only persist if actually changing stage
      if (activeStageId !== targetStageId) {
        const stage = stages.find((s) => s.id === targetStageId);
        if (!stage) return;
        onOpportunityMove(String(active.id), targetStageId);
        await moveOpportunityStage(
          String(active.id),
          targetStageId,
          stage.default_probability
        );
      }
    },
    [stages, onOpportunityMove]
  );

  return (
    <div className="space-y-4">
      {/* Filters + Summary Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
        <Filter size={12} className="text-[var(--text-muted)]" />

        {/* Seller filter */}
        <select
          value={sellerFilter}
          onChange={(e) => setSellerFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-[10px] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
        >
          <option value="all">Todos los vendedores</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>

        {/* Amount pills */}
        <div className="flex gap-1">
          {AMOUNT_FILTERS.map((af, i) => (
            <button
              key={af.label}
              onClick={() => setAmountFilter(i)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[9px] font-medium transition-all",
                amountFilter === i
                  ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
              )}
            >
              {af.label}
            </button>
          ))}
        </div>

        {/* Summary stats */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] text-[var(--text-muted)]">
            {filteredOpps.length} oportunidades
          </span>
        </div>
      </div>

      {/* Funnel Chart */}
      <PipelineFunnel stages={sortedStages} opportunities={filteredOpps} />

      {/* Interaction hint */}
      <div className="flex items-center gap-4 text-[8px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <GripVertical size={8} />
          Arrastra para mover
        </span>
        <span className="flex items-center gap-1">
          <ArrowRight size={8} />
          Click → para mover rápido
        </span>
        <span className="flex items-center gap-1">
          <Keyboard size={8} />
          Teclado accesible
        </span>
      </div>

      {/* Kanban Board with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {sortedStages.map((stage) => {
            const stageOpps = filteredOpps.filter(
              (o) => o.stage_id === stage.id
            );
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
                />
              </SortableContext>
            );
          })}
        </div>

        {/* Drag Overlay — premium floating card */}
        <DragOverlay dropAnimation={{
          duration: 200,
          easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
        }}>
          {activeOpp ? <DragOverlayCard opp={activeOpp} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ── Droppable Column Wrapper ──────────────────────

function DroppableColumn({
  stage,
  opportunities,
  stages,
  isOver,
  onQuickMove,
}: {
  stage: SalesPipelineStage;
  opportunities: SalesOpportunity[];
  stages: SalesPipelineStage[];
  isOver: boolean;
  onQuickMove: (oppId: string, newStageId: string) => void;
}) {
  // Make the column itself droppable
  const { setNodeRef } = useSortable({
    id: stage.id,
    data: {
      type: "column",
      stageId: stage.id,
    },
  });

  const totalAmount = opportunities.reduce(
    (sum, o) => sum + Number(o.amount),
    0
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[220px] flex-col rounded-xl border-2 transition-all duration-200",
        "min-h-[420px]",
        isOver
          ? "border-dashed bg-[var(--bg-muted)]/80"
          : "border-[var(--border)] bg-[var(--bg-muted)]/40"
      )}
      style={
        isOver
          ? {
              borderColor: stage.color,
              boxShadow: `0 0 24px ${stage.color}20, inset 0 0 16px ${stage.color}05`,
            }
          : undefined
      }
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3 pb-1">
        <motion.div
          className="h-3 w-3 rounded-full shadow-sm"
          style={{ backgroundColor: stage.color }}
          animate={
            isOver
              ? {
                  scale: [1, 1.3, 1],
                }
              : { scale: 1 }
          }
          transition={isOver ? { repeat: Infinity, duration: 1 } : {}}
        />
        <h3 className="text-[11px] font-bold text-[var(--text-primary)]">
          {stage.name}
        </h3>
        <span className="ml-auto rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-[9px] font-bold text-[var(--text-muted)] shadow-sm">
          {opportunities.length}
        </span>
      </div>

      {/* Amount summary */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <DollarSign size={9} className="text-emerald-500" />
        <span className="text-[9px] font-semibold text-emerald-500 tabular-nums">
          ${(totalAmount / 1000).toFixed(0)}K
        </span>
        <span className="text-[7px] text-[var(--text-muted)]">Pipeline</span>
      </div>

      {/* Drop zone indicator */}
      <AnimatePresence>
        {isOver && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 36 }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-3 mb-2 flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed"
            style={{
              borderColor: stage.color,
              backgroundColor: `${stage.color}08`,
            }}
          >
            <Zap size={10} style={{ color: stage.color }} />
            <span
              className="text-[8px] font-bold"
              style={{ color: stage.color }}
            >
              Soltar aquí — {stage.default_probability}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards area */}
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        {opportunities.length === 0 && !isOver && (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[var(--border)]">
            <p className="text-[8px] text-[var(--text-muted)]">
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
            onQuickMove={onQuickMove}
          />
        ))}
      </div>
    </div>
  );
}
