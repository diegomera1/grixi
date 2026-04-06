"use client";

import { useState, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownToLine, ArrowUpFromLine, Repeat2, Clock,
  CheckCircle2, AlertTriangle, Package, Truck, FileText,
  ChevronRight, Search, Plus, Loader2, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type {
  GoodsReceiptRow, GoodsIssueRow, TransferOrderRow, InventoryMovementRow,
} from "../types";
import { MOVEMENT_DESCRIPTIONS } from "../types";
import { GoodsReceiptWizard } from "./goods-receipt-wizard";
import { GoodsIssueWizard } from "./goods-issue-wizard";
import { TransferOrderWizard } from "./transfer-order-wizard";
import { OperationProfileDrawer } from "./operation-profile-drawer";
import { MovementProfileDrawer } from "./movement-profile-drawer";

// ── Props ──────────────────────────────────────────────
type WmsOperationsProps = {
  goodsReceipts: GoodsReceiptRow[];
  goodsIssues: GoodsIssueRow[];
  transfers: TransferOrderRow[];
  movements: InventoryMovementRow[];
  warehouses: { id: string; name: string }[];
  products: { id: string; name: string; sku: string }[];
};

type ViewMode = "operaciones" | "historial";
type OperationSubTab = "todas" | "entradas" | "salidas" | "traspasos";

// ── Status config ──────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  draft: { label: "Borrador", color: "text-violet-500", bg: "bg-violet-500/10", icon: Clock },
  pending: { label: "Pendiente", color: "text-amber-500", bg: "bg-amber-500/10", icon: Clock },
  in_progress: { label: "En Proceso", color: "text-blue-500", bg: "bg-blue-500/10", icon: Loader2 },
  receiving: { label: "Recibiendo", color: "text-blue-500", bg: "bg-blue-500/10", icon: Loader2 },
  picking: { label: "En Picking", color: "text-indigo-500", bg: "bg-indigo-500/10", icon: Package },
  posted: { label: "Contabilizado", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  confirmed: { label: "Confirmado", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  completed: { label: "Completado", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  in_transit: { label: "En Tránsito", color: "text-blue-500", bg: "bg-blue-500/10", icon: Truck },
  approved: { label: "Aprobado", color: "text-cyan-500", bg: "bg-cyan-500/10", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "text-red-500", bg: "bg-red-500/10", icon: AlertTriangle },
  reversed: { label: "Reversado", color: "text-red-500", bg: "bg-red-500/10", icon: AlertTriangle },
  accepted: { label: "Aceptado", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}
function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
}



// ══════════════════════════════════════════════════════════
// UNIFIED Operations + Movements View
// ══════════════════════════════════════════════════════════
const POSTED_STATUSES = new Set(["posted", "cancelled", "accepted"]);

export function WmsOperations({
  goodsReceipts, goodsIssues, transfers, movements, warehouses, products,
}: WmsOperationsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("operaciones");
  const [subTab, setSubTab] = useState<OperationSubTab>("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [grWizardOpen, setGrWizardOpen] = useState(false);
  const [giWizardOpen, setGiWizardOpen] = useState(false);
  const [toWizardOpen, setToWizardOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [postingId, setPostingId] = useState<string | null>(null);
  const [newOpMenuOpen, setNewOpMenuOpen] = useState(false);

  // Profile drawer
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileType, setProfileType] = useState<"gr" | "gi" | "to">("gr");
  const [profileId, setProfileId] = useState("");

  // Movement profile drawer
  const [movProfileOpen, setMovProfileOpen] = useState(false);
  const [movProfileId, setMovProfileId] = useState("");

  function openProfile(type: "gr" | "gi" | "to", id: string) {
    setProfileType(type);
    setProfileId(id);
    setProfileOpen(true);
  }

  function openMovProfile(id: string) {
    setMovProfileId(id);
    setMovProfileOpen(true);
  }

  function handleAction(action: string, id: string) {
    setPostingId(id);
    startTransition(async () => {
      try {
        const resp = await fetch("/api/wms/operations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, id }),
        });
        const res = await resp.json();
        setPostingId(null);
        if (res.success) {
          toast.success("Operación ejecutada", { description: res.message });
          setProfileOpen(false);
        } else {
          toast.error("Error", { description: res.message });
        }
      } catch {
        toast.error("Error de conexión");
        setPostingId(null);
      }
    });
  }

  // ── Build unified items list ────────────────────────
  type UnifiedItem = {
    id: string;
    docNumber: string;
    opType: "gr" | "gi" | "to";
    status: string;
    warehouseName: string;
    reference: string | null;
    description: string;
    created_at: string;
    movementType: string | null;
    priority?: string;
    extra?: string;
  };

  const allOperations = useMemo<UnifiedItem[]>(() => {
    const ops: UnifiedItem[] = [];

    for (const gr of goodsReceipts) {
      ops.push({
        id: gr.id,
        docNumber: gr.receipt_number,
        opType: "gr",
        status: gr.status,
        warehouseName: gr.warehouse_name || "—",
        reference: gr.po_number ? `OC: ${gr.po_number}` : null,
        description: MOVEMENT_DESCRIPTIONS[gr.movement_type || "101"] || "Entrada de mercancía",
        created_at: gr.created_at,
        movementType: gr.movement_type,
      });
    }

    for (const gi of goodsIssues) {
      ops.push({
        id: gi.id,
        docNumber: gi.issue_number,
        opType: "gi",
        status: gi.status,
        warehouseName: gi.warehouse_name || "—",
        reference: gi.reference_so ? `PV: ${gi.reference_so}` : null,
        description: MOVEMENT_DESCRIPTIONS[gi.movement_type || "261"] || "Salida de mercancía",
        created_at: gi.created_at,
        movementType: gi.movement_type,
        extra: gi.issue_type?.replace("_", " "),
      });
    }

    for (const to of transfers) {
      ops.push({
        id: to.id,
        docNumber: to.transfer_number,
        opType: "to",
        status: to.status,
        warehouseName: `${to.from_warehouse_name || "?"} → ${to.to_warehouse_name || "?"}`,
        reference: to.reason || null,
        description: MOVEMENT_DESCRIPTIONS[to.movement_type || "311"] || "Traspaso",
        created_at: to.created_at,
        movementType: to.movement_type,
        priority: to.priority,
      });
    }

    return ops.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [goodsReceipts, goodsIssues, transfers]);

  // Bandeja: only pending/in-progress operations
  const pendingOps = useMemo(() => allOperations.filter(op => !POSTED_STATUSES.has(op.status)), [allOperations]);
  const postedOps = useMemo(() => allOperations.filter(op => POSTED_STATUSES.has(op.status)), [allOperations]);

  const filteredOps = useMemo(() => {
    const source = viewMode === "operaciones" ? pendingOps : postedOps;
    return source.filter(op => {
      const matchTab = subTab === "todas"
        || (subTab === "entradas" && op.opType === "gr")
        || (subTab === "salidas" && op.opType === "gi")
        || (subTab === "traspasos" && op.opType === "to");
      const matchSearch = !searchQuery
        || op.docNumber.toLowerCase().includes(searchQuery.toLowerCase())
        || op.warehouseName.toLowerCase().includes(searchQuery.toLowerCase())
        || (op.reference && op.reference.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchTab && matchSearch;
    });
  }, [viewMode, pendingOps, postedOps, subTab, searchQuery]);



  // ── Counts ────────────────────────────────────────
  const counts = useMemo(() => {
    const src = viewMode === "operaciones" ? pendingOps : postedOps;
    return {
      todas: src.length,
      entradas: src.filter(o => o.opType === "gr").length,
      salidas: src.filter(o => o.opType === "gi").length,
      traspasos: src.filter(o => o.opType === "to").length,
      movimientos: movements?.length || 0,
      pendientes: pendingOps.length,
      completados: postedOps.length,
    };
  }, [viewMode, pendingOps, postedOps, movements]);

  // ── Icon + color per type ─────────────────────────
  const TYPE_ICON = { gr: ArrowDownToLine, gi: ArrowUpFromLine, to: Repeat2 };
  const TYPE_COLOR = { gr: "text-emerald-500", gi: "text-rose-500", to: "text-blue-500" };
  const TYPE_BG = { gr: "bg-emerald-500/10", gi: "bg-rose-500/10", to: "bg-blue-500/10" };

  const subTabs: { id: OperationSubTab; label: string; count: number }[] = [
    { id: "todas", label: "Todas", count: counts.todas },
    { id: "entradas", label: "Entradas", count: counts.entradas },
    { id: "salidas", label: "Salidas", count: counts.salidas },
    { id: "traspasos", label: "Traspasos", count: counts.traspasos },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      {/* ── View Mode Toggle ────────────── */}
      <div className="flex items-center gap-2 bg-muted rounded-xl p-1" data-tour="operations-subtabs">
        <button
          onClick={() => setViewMode("operaciones")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center",
            viewMode === "operaciones"
              ? "bg-surface shadow-sm text-text-primary"
              : "text-text-muted hover:text-text-secondary"
          )}
        >
          <Package size={13} />
          Movimiento de Material
          <span className={cn(
            "text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full",
            viewMode === "operaciones" ? "bg-brand/10 text-brand" : ""
          )}>
            {counts.pendientes}
          </span>
        </button>
        <button
          onClick={() => setViewMode("historial")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center",
            viewMode === "historial"
              ? "bg-surface shadow-sm text-text-primary"
              : "text-text-muted hover:text-text-secondary"
          )}
        >
          <Activity size={13} />
          Historial
          <span className={cn(
            "text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full",
            viewMode === "historial" ? "bg-brand/10 text-brand" : ""
          )}>
            {counts.completados}
          </span>
        </button>
      </div>

      {/* ── Sub-filters + Search ─────────── */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        {viewMode === "operaciones" ? (
          <div className="flex items-center gap-1 overflow-x-auto">
            {subTabs.map(st => (
              <button
                key={st.id}
                onClick={() => setSubTab(st.id)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                  subTab === st.id
                    ? "bg-brand text-white"
                    : "bg-muted text-text-muted hover:text-text-secondary"
                )}
              >
                {st.label}
                <span className={cn("text-[10px] font-bold tabular-nums", subTab === st.id ? "text-white/70" : "")}>
                  {st.count}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1 overflow-x-auto">
            {subTabs.map(st => (
              <button
                key={st.id}
                onClick={() => setSubTab(st.id)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                  subTab === st.id
                    ? "bg-brand text-white"
                    : "bg-muted text-text-muted hover:text-text-secondary"
                )}
              >
                {st.label}
                <span className={cn("text-[10px] font-bold tabular-nums", subTab === st.id ? "text-white/70" : "")}>
                  {st.count}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-56 sm:flex-initial">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder={viewMode === "operaciones" ? "Buscar movimiento..." : "Buscar en historial..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
            />
          </div>
          {/* Unified New Operation Button */}
          <div className="relative">
            <button
              onClick={() => setNewOpMenuOpen(!newOpMenuOpen)}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:shadow-md hover:shadow-brand/25 transition-all"
              data-tour="operations-new"
            >
              <Plus size={13} className={cn("transition-transform duration-200", newOpMenuOpen && "rotate-45")} />
              <span className="hidden sm:inline">Nuevo Movimiento</span>
            </button>

            <AnimatePresence>
              {newOpMenuOpen && (
                <>
                  {/* Click-away overlay */}
                  <div className="fixed inset-0 z-40" onClick={() => setNewOpMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-border bg-background shadow-xl shadow-black/10 overflow-hidden"
                  >
                    {[
                      { label: "Entrada de Mercancía", desc: "Recepción de pedidos", icon: ArrowDownToLine, color: "text-emerald-500", bg: "bg-emerald-500/10", action: () => { setGrWizardOpen(true); setNewOpMenuOpen(false); } },
                      { label: "Salida de Mercancía", desc: "Despacho por pedido de venta", icon: ArrowUpFromLine, color: "text-rose-500", bg: "bg-rose-500/10", action: () => { setGiWizardOpen(true); setNewOpMenuOpen(false); } },
                      { label: "Traspaso", desc: "Mover entre almacenes", icon: Repeat2, color: "text-blue-500", bg: "bg-blue-500/10", action: () => { setToWizardOpen(true); setNewOpMenuOpen(false); } },
                    ].map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <button
                          key={item.label}
                          onClick={item.action}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-muted transition-colors group"
                        >
                          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", item.bg)}>
                            <ItemIcon size={15} className={item.color} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-text-primary group-hover:text-brand transition-colors">{item.label}</p>
                            <p className="text-[9px] text-text-muted">{item.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────── */}
      <AnimatePresence mode="wait">
        {viewMode === "operaciones" ? (
          <motion.div key="operations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2" data-tour="operations-list">
            {filteredOps.length === 0 ? (
              <EmptyState icon={Package} label="No hay movimientos pendientes" />
            ) : (
              filteredOps.map((op, i) => {
                const st = STATUS_CONFIG[op.status] || STATUS_CONFIG.pending;
                const StIcon = st.icon;
                const OpIcon = TYPE_ICON[op.opType];

                return (
                  <motion.div
                    key={op.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 hover:border-brand/20 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => openProfile(op.opType, op.id)}
                  >
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", TYPE_BG[op.opType])}>
                      <OpIcon size={18} className={TYPE_COLOR[op.opType]} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-text-primary">{op.docNumber}</span>
                        <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5", st.bg)}>
                          <StIcon size={10} className={st.color} />
                          <span className={cn("text-[9px] font-bold", st.color)}>{st.label}</span>
                        </div>
                        {op.priority && op.priority !== "medium" && (
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                            op.priority === "urgent" ? "bg-red-500/10 text-red-500" :
                            op.priority === "high" ? "bg-amber-500/10 text-amber-500" :
                            "bg-slate-500/10 text-slate-500"
                          )}>
                            {op.priority === "urgent" ? "Urgente" : op.priority === "high" ? "Alta" : "Baja"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-muted flex-wrap">
                        <span className="font-medium">{op.description}</span>
                        <span>·</span>
                        <span>{op.warehouseName}</span>
                        {op.reference && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-0.5">
                              <FileText size={9} /> {op.reference}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-xs text-text-primary">{formatDate(op.created_at)}</p>
                      <p className="text-[10px] text-text-muted">{formatTime(op.created_at)}</p>
                    </div>
                    {/* Inline action button for non-posted */}
                    {(op.status === "draft" || op.status === "pending" || op.status === "picking" || op.status === "in_transit") && (
                      <button
                        disabled={isPending && postingId === op.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (op.opType === "to" && op.status === "draft") {
                            // Open transfer wizard to continue draft — for now just show toast
                            toast.info("Borrador", { description: "Abre un nuevo traspaso para continuar este borrador" });
                            return;
                          }
                          const action =
                            op.opType === "gr" ? "post_goods_receipt" :
                            op.opType === "gi" ? "post_goods_issue" :
                            op.status === "in_transit" ? "confirm_transfer" : "start_transfer";
                          handleAction(action, op.id);
                        }}
                        className={cn(
                          "flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-bold text-white transition-colors shrink-0",
                          op.status === "draft" ? "bg-violet-500 hover:bg-violet-600" :
                          op.opType === "gr" ? "bg-emerald-500 hover:bg-emerald-600" :
                          op.opType === "gi" ? "bg-rose-500 hover:bg-rose-600" :
                          "bg-blue-500 hover:bg-blue-600"
                        )}
                      >
                        {isPending && postingId === op.id ? (
                          <><Loader2 size={10} className="animate-spin" /> Procesando...</>
                        ) : (
                          <><CheckCircle2 size={10} />
                            {op.opType === "to" && op.status === "draft" ? "Continuar" :
                             op.opType === "to" && op.status === "pending" ? "Enviar" :
                             op.opType === "to" && op.status === "in_transit" ? "Confirmar" :
                             "Contabilizar"}</>
                        )}
                      </button>
                    )}
                    <ChevronRight size={14} className="text-text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                );
              })
            )}
          </motion.div>
        ) : (
          /* ── Historial: Same card format but for completed ── */
          <motion.div key="historial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            {filteredOps.length === 0 ? (
              <EmptyState icon={Clock} label="No hay movimientos completados" />
            ) : (
              filteredOps.map((op, i) => {
                const st = STATUS_CONFIG[op.status] || STATUS_CONFIG.posted;
                const StIcon = st.icon;
                const OpIcon = TYPE_ICON[op.opType];

                return (
                  <motion.div
                    key={op.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 hover:border-brand/20 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => openProfile(op.opType, op.id)}
                  >
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", TYPE_BG[op.opType])}>
                      <OpIcon size={18} className={TYPE_COLOR[op.opType]} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-text-primary">{op.docNumber}</span>
                        <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5", st.bg)}>
                          <StIcon size={10} className={st.color} />
                          <span className={cn("text-[9px] font-bold", st.color)}>{st.label}</span>
                        </div>
                        {op.extra && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-text-muted">{op.extra}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-text-muted">{op.description}</span>
                        <span className="text-[10px] text-text-muted">·</span>
                        <span className="text-[10px] text-text-muted">{op.warehouseName}</span>
                        {op.reference && (
                          <>
                            <span className="text-[10px] text-text-muted">·</span>
                            <span className="text-[10px] font-mono text-text-muted">{op.reference}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-text-primary">{formatDate(op.created_at)}</p>
                      <p className="text-[10px] text-text-muted">{formatTime(op.created_at)}</p>
                    </div>
                    <ChevronRight size={14} className="text-text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Wizards ─────────────────────── */}
      {grWizardOpen && (
        <GoodsReceiptWizard
          open={grWizardOpen}
          onClose={() => setGrWizardOpen(false)}
          warehouses={warehouses}
        />
      )}
      {giWizardOpen && (
        <GoodsIssueWizard
          open={giWizardOpen}
          onClose={() => setGiWizardOpen(false)}
          warehouses={warehouses}
        />
      )}
      {toWizardOpen && (
        <TransferOrderWizard
          open={toWizardOpen}
          onClose={() => setToWizardOpen(false)}
          warehouses={warehouses}
          products={products}
        />
      )}

      {/* ── Profile Drawer ──────────────── */}
      <OperationProfileDrawer
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        operationType={profileType}
        operationId={profileId}
        onAction={handleAction}
      />

      {/* ── Movement Profile Drawer ────── */}
      <MovementProfileDrawer
        open={movProfileOpen}
        onClose={() => setMovProfileOpen(false)}
        movementId={movProfileId}
      />
    </motion.div>
  );
}

function EmptyState({ icon: Icon, label }: { icon: typeof Package; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-text-muted">
      <Icon size={28} className="mb-2 opacity-30" />
      <p className="text-xs">{label}</p>
    </div>
  );
}
