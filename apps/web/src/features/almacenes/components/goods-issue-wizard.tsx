"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowUpFromLine, ChevronRight, ChevronLeft, Package,
  Search, CheckCircle2, AlertCircle, Loader2,
  ShoppingCart, ClipboardList, Eye, Send,
  Users, Calendar, Truck, MapPin, Sparkles,
  Save, ToggleLeft, ToggleRight, Plus, Minus, Box,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SalesOrderForGI } from "../types";

const MiniWarehouse3D = dynamic(() => import("./mini-warehouse-3d"), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] flex items-center justify-center bg-[#0d0f1e] rounded-xl">
      <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
    </div>
  ),
});

// ── Types ─────────────────────────────────────────────
type WizardStep = 1 | 2 | 3 | 4;

type GIWizardProps = {
  open: boolean;
  onClose: () => void;
  warehouseId?: string;
  warehouses: { id: string; name: string }[];
};

type PickItem = {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity_ordered: number;
  quantity_to_pick: number;
  unit: string;
};

type PickingSuggestion = {
  su_id: string;
  su_code: string;
  lot_number: string;
  available_quantity: number;
  suggested_qty: number;
  position_label: string;
  rack_code: string;
  row_number: number;
  column_number: number;
  warehouse_name: string;
  reason: string;
};

type AvailableSU = {
  su_id: string;
  su_code: string;
  su_type: string;
  quantity: number;
  available_quantity: number;
  warehouse_id: string;
  warehouse_name: string;
  rack_code: string;
  row_number: number;
  column_number: number;
  position_label: string;
  lot_number: string;
  expiry_date: string | null;
};

type ManualPickLine = {
  su_id: string;
  su_code: string;
  lot_number: string;
  quantity: number;
  max_available: number;
  rack_code: string;
  row_number: number;
  column_number: number;
  warehouse_name: string;
  position_label: string;
};

const STEPS: { step: WizardStep; label: string; icon: typeof Package }[] = [
  { step: 1, label: "Seleccionar Pedido", icon: ShoppingCart },
  { step: 2, label: "Picking", icon: ClipboardList },
  { step: 3, label: "Revisar", icon: Eye },
  { step: 4, label: "Contabilizar", icon: Send },
];

const PRIORITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: "Urgente", color: "text-red-500", bg: "bg-red-500/10" },
  high: { label: "Alta", color: "text-amber-500", bg: "bg-amber-500/10" },
  medium: { label: "Media", color: "text-blue-500", bg: "bg-blue-500/10" },
  low: { label: "Baja", color: "text-slate-500", bg: "bg-slate-500/10" },
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

export function GoodsIssueWizard({ open, onClose, warehouseId, warehouses }: GIWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [isPending, startTransition] = useTransition();

  // Step 1: SO selection
  const [salesOrders, setSalesOrders] = useState<SalesOrderForGI[]>([]);
  const [selectedSO, setSelectedSO] = useState<SalesOrderForGI | null>(null);
  const [soSearch, setSOSearch] = useState("");
  const [loadingSOs, setLoadingSOs] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouseId || "");

  // Step 2: Picking
  const [pickItems, setPickItems] = useState<PickItem[]>([]);
  const [pickingSuggestions, setPickingSuggestions] = useState<Record<string, PickingSuggestion[]>>({});
  const [loadingPicking, setLoadingPicking] = useState(false);

  // Manual picking
  const [pickingMode, setPickingMode] = useState<Record<string, "ai" | "manual">>({});
  const [manualPicks, setManualPicks] = useState<Record<string, ManualPickLine[]>>({});
  const [availableSUs, setAvailableSUs] = useState<Record<string, AvailableSU[]>>({});
  const [loadingSUs, setLoadingSUs] = useState<Record<string, boolean>>({});

  // 3D panel
  const [show3DPanel, setShow3DPanel] = useState(false);

  // Draft
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  // Step 4: Result
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // ── Load Sales Orders ────────────────────────────────
  const loadSalesOrders = useCallback(async () => {
    setLoadingSOs(true);
    try {
      const params = new URLSearchParams();
      if (selectedWarehouse) params.set("warehouseId", selectedWarehouse);
      const resp = await fetch(`/api/wms/pending-sos?${params.toString()}`);
      const res = await resp.json();
      if (res.success) {
        setSalesOrders(res.data as SalesOrderForGI[]);
      }
    } catch (err) {
      console.error("[GI Wizard] Error loading SOs:", err);
    } finally {
      setLoadingSOs(false);
    }
  }, [selectedWarehouse]);

  useEffect(() => {
    if (open && step === 1) {
      loadSalesOrders();
    }
  }, [open, step, loadSalesOrders]);

  // Re-trigger AI picking when warehouse changes on Step 2
  useEffect(() => {
    if (step === 2 && selectedSO && selectedWarehouse) {
      loadPickingSuggestions(selectedSO, selectedWarehouse);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouse]);

  // ── Filter SOs ────────────────────────────────────────
  const filteredSOs = salesOrders.filter((so) => {
    if (!soSearch) return true;
    const q = soSearch.toLowerCase();
    return (
      so.so_number.toLowerCase().includes(q) ||
      so.customer_name.toLowerCase().includes(q) ||
      (so.sap_so_number?.toLowerCase().includes(q) ?? false)
    );
  });

  // ── Select SO → prepare pick items ────────────────────
  function selectSO(so: SalesOrderForGI) {
    setSelectedSO(so);
    setPickItems(
      so.items.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        product_sku: it.product_sku,
        quantity_ordered: it.quantity_ordered,
        quantity_to_pick: it.quantity_ordered - it.quantity_picked,
        unit: it.unit,
      }))
    );
    if (so.warehouse_id) setSelectedWarehouse(so.warehouse_id);
    setStep(2);
    // Load picking suggestions
    loadPickingSuggestions(so, so.warehouse_id || selectedWarehouse);
  }

  // ── Load AI picking suggestions ────────────────────────
  async function loadPickingSuggestions(so: SalesOrderForGI, whId: string) {
    if (!whId) return;
    setLoadingPicking(true);
    try {
      const items = so.items
        .filter((it) => it.quantity_ordered - it.quantity_picked > 0)
        .map((it) => ({
          product_id: it.product_id,
          quantity_needed: it.quantity_ordered - it.quantity_picked,
        }));

      const resp = await fetch("/api/wms/ai-picking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouse_id: whId, items }),
      });
      const res = await resp.json();

      if (res.success && res.data) {
        const mapped: Record<string, PickingSuggestion[]> = {};
        for (const result of res.data as { product_id: string; sources: PickingSuggestion[] }[]) {
          if (result.sources && result.sources.length > 0) {
            mapped[result.product_id] = result.sources.map((s: Record<string, unknown>) => ({
              su_id: s.su_id as string,
              su_code: s.su_code as string,
              lot_number: s.lot_number as string,
              available_quantity: Number(s.available),
              suggested_qty: Number(s.suggested_qty),
              position_label: s.position_label as string,
              rack_code: s.rack_code as string,
              row_number: Number(s.row_number),
              column_number: Number(s.column_number),
              warehouse_name: s.warehouse_name as string,
              reason: s.reason as string,
            }));
          }
        }
        setPickingSuggestions(mapped);
      }
    } catch (err) {
      console.error("[GI Wizard] Picking suggestion error:", err);
    } finally {
      setLoadingPicking(false);
    }
  }

  // ── Load Available SUs for Manual Picking ─────────────
  const loadAvailableSUs = useCallback(async (productId: string) => {
    setLoadingSUs(prev => ({ ...prev, [productId]: true }));
    try {
      const params = new URLSearchParams({ product_id: productId });
      if (selectedWarehouse) params.set("warehouse_id", selectedWarehouse);
      const resp = await fetch(`/api/wms/available-sus?${params.toString()}`);
      const res = await resp.json();
      if (res.success) {
        setAvailableSUs(prev => ({ ...prev, [productId]: res.data as AvailableSU[] }));
      }
    } catch (err) {
      console.error("[GI] Error loading available SUs:", err);
    } finally {
      setLoadingSUs(prev => ({ ...prev, [productId]: false }));
    }
  }, [selectedWarehouse]);

  // ── Toggle Picking Mode (AI ↔ Manual) ──────────────
  function togglePickingMode(productId: string) {
    const current = pickingMode[productId] || "ai";
    const next = current === "ai" ? "manual" : "ai";
    setPickingMode(prev => ({ ...prev, [productId]: next }));

    // Load available SUs on first switch to manual
    if (next === "manual" && !availableSUs[productId]) {
      loadAvailableSUs(productId);
    }
  }

  // ── Manual Pick Management ─────────────────────────
  function addManualPick(productId: string, su: AvailableSU) {
    const existing = manualPicks[productId] || [];
    if (existing.find(p => p.su_id === su.su_id)) return; // Already added

    const item = pickItems.find(it => it.product_id === productId);
    const alreadyPicked = existing.reduce((acc, p) => acc + p.quantity, 0);
    const remaining = (item?.quantity_to_pick || 0) - alreadyPicked;
    const qty = Math.min(Math.max(1, remaining), su.available_quantity);

    setManualPicks(prev => ({
      ...prev,
      [productId]: [
        ...existing,
        {
          su_id: su.su_id,
          su_code: su.su_code,
          lot_number: su.lot_number,
          quantity: qty,
          max_available: su.available_quantity,
          rack_code: su.rack_code,
          row_number: su.row_number,
          column_number: su.column_number,
          warehouse_name: su.warehouse_name,
          position_label: su.position_label,
        },
      ],
    }));
  }

  function removeManualPick(productId: string, suId: string) {
    setManualPicks(prev => ({
      ...prev,
      [productId]: (prev[productId] || []).filter(p => p.su_id !== suId),
    }));
  }

  function updateManualPickQty(productId: string, suId: string, qty: number) {
    setManualPicks(prev => ({
      ...prev,
      [productId]: (prev[productId] || []).map(p =>
        p.su_id === suId ? { ...p, quantity: Math.min(Math.max(1, qty), p.max_available) } : p
      ),
    }));
  }

  // ── Save Draft ─────────────────────────────────────
  async function saveDraft() {
    if (!selectedSO || !selectedWarehouse) return;
    setSavingDraft(true);
    try {
      const resp = await fetch("/api/wms/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_goods_issue",
          warehouse_id: selectedWarehouse,
          so_id: selectedSO.id,
          issue_type: "sales_order",
          draft: true,
          items: pickItems
            .filter((it) => it.quantity_to_pick > 0)
            .map((it) => ({
              product_id: it.product_id,
              quantity_picked: it.quantity_to_pick,
            })),
          picking_lines: buildPickingLines(),
        }),
      });
      const res = await resp.json();
      if (res.success) {
        setDraftId(res.id);
        toast.success("Borrador guardado", {
          description: `Picking guardado — puedes retomarlo después`,
        });
      } else {
        toast.error("Error al guardar borrador");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingDraft(false);
    }
  }

  // ── Build picking_lines from AI or manual picks ────
  function buildPickingLines() {
    const lines: { product_id: string; su_id: string; su_code?: string; quantity: number }[] = [];

    for (const item of pickItems) {
      const mode = pickingMode[item.product_id] || "ai";
      if (mode === "manual") {
        const picks = manualPicks[item.product_id] || [];
        for (const p of picks) {
          lines.push({
            product_id: item.product_id,
            su_id: p.su_id,
            su_code: p.su_code,
            quantity: p.quantity,
          });
        }
      } else {
        const aiPicks = pickingSuggestions[item.product_id] || [];
        for (const s of aiPicks) {
          lines.push({
            product_id: item.product_id,
            su_id: s.su_id,
            su_code: s.su_code,
            quantity: s.suggested_qty,
          });
        }
      }
    }
    return lines;
  }

  // ── Build highlighted positions for 3D ─────────────
  const allHighlightedPositions = (() => {
    const positions: { rack_code: string; row_number: number; column_number: number; su_code: string }[] = [];
    for (const item of pickItems) {
      const mode = pickingMode[item.product_id] || "ai";
      if (mode === "manual") {
        for (const p of manualPicks[item.product_id] || []) {
          if (p.rack_code && p.row_number && p.column_number) {
            positions.push({ rack_code: p.rack_code, row_number: p.row_number, column_number: p.column_number, su_code: p.su_code });
          }
        }
      } else {
        for (const s of pickingSuggestions[item.product_id] || []) {
          if (s.rack_code && s.row_number && s.column_number) {
            positions.push({ rack_code: s.rack_code, row_number: s.row_number, column_number: s.column_number, su_code: s.su_code });
          }
        }
      }
    }
    return positions;
  })();

  // ── Handle post ───────────────────────────────────────
  function handlePost() {
    if (!selectedSO || !selectedWarehouse) return;
    startTransition(async () => {
      try {
        const resp = await fetch("/api/wms/operations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_goods_issue",
            warehouse_id: selectedWarehouse,
            so_id: selectedSO.id,
            issue_type: "sales_order",
            items: pickItems
              .filter((it) => it.quantity_to_pick > 0)
              .map((it) => ({
                product_id: it.product_id,
                quantity_picked: it.quantity_to_pick,
              })),
            picking_lines: buildPickingLines(),
          }),
        });
        const res = await resp.json();
        setResult(res);
        if (res.success) {
          setStep(4);
          toast.success("Salida contabilizada", {
            description: `${pickItems.reduce((s, i) => s + i.quantity_to_pick, 0)} unidades despachadas — ${selectedSO?.so_number}`,
          });
          // Check for low stock alerts post-dispatch
          if (res.low_stock_alerts && Array.isArray(res.low_stock_alerts)) {
            for (const alert of res.low_stock_alerts as { product_name: string; remaining: number; min_stock: number }[]) {
              toast.warning(`Stock bajo: ${alert.product_name}`, {
                description: `${alert.remaining} UN restantes (mínimo: ${alert.min_stock})`,
                duration: 8000,
              });
            }
          }
        }
      } catch {
        setResult({ success: false, message: "Error al contabilizar" });
        toast.error("Error al contabilizar salida");
      }
    });
  }

  // ── Reset ─────────────────────────────────────────────
  function handleClose() {
    setStep(1);
    setSelectedSO(null);
    setPickItems([]);
    setResult(null);
    setSOSearch("");
    setPickingMode({});
    setManualPicks({});
    setAvailableSUs({});
    setShow3DPanel(false);
    setDraftId(null);
    onClose();
  }

  // ── Computed ──────────────────────────────────────────
  const totalPicking = pickItems.reduce((acc, it) => acc + it.quantity_to_pick, 0);
  const totalItems = pickItems.filter((it) => it.quantity_to_pick > 0).length;
  const wh = warehouses.find((w) => w.id === selectedWarehouse);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      />
      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl overflow-y-auto bg-background border-l border-border shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10">
                <ArrowUpFromLine size={18} className="text-orange-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Salida de Mercancía</h2>
                <p className="text-[10px] text-text-muted">Despacho por pedido de venta</p>
              </div>
            </div>
            <button onClick={handleClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
              <X size={16} className="text-text-muted" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-1 mt-3">
            {STEPS.map((s, i) => {
              const StIcon = s.icon;
              const isActive = step === s.step;
              const isDone = step > s.step;
              return (
                <div key={s.step} className="flex items-center gap-1 flex-1">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-all flex-1 justify-center",
                      isActive
                        ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                        : isDone
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "text-text-muted bg-muted"
                    )}
                  >
                    {isDone ? <CheckCircle2 size={11} /> : <StIcon size={11} />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <ChevronRight size={10} className="text-text-muted shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            {/* ── STEP 1: Select Sales Order ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-text-primary">
                    Pedidos de Venta Confirmados
                  </h3>
                  <span className="text-[10px] text-text-muted">
                    {filteredSOs.length} pedido{filteredSOs.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Buscar por # Pedido, cliente, SAP..."
                    value={soSearch}
                    onChange={(e) => setSOSearch(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-orange-500 focus:outline-none"
                  />
                </div>

                {/* SO List */}
                {loadingSOs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-orange-500" />
                    <span className="ml-2 text-xs text-text-muted">Cargando pedidos...</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                    {filteredSOs.map((so) => {
                      const pr = PRIORITY_CFG[so.priority] || PRIORITY_CFG.medium;
                      const pendingItems = so.items.filter(
                        (it) => it.quantity_ordered > it.quantity_picked
                      ).length;
                      return (
                        <motion.button
                          key={so.id}
                          whileHover={{ scale: 1.005 }}
                          onClick={() => selectSO(so)}
                          className="w-full text-left rounded-xl border border-border bg-surface p-3 hover:border-orange-500/40 transition-all group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-text-primary font-mono">
                                  {so.so_number}
                                </span>
                                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", pr.bg, pr.color)}>
                                  {pr.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                                <Users size={11} className="text-text-muted" />
                                {so.customer_name}
                              </div>
                              {so.sap_so_number && (
                                <span className="text-[9px] text-text-muted font-mono">
                                  SAP: {so.sap_so_number}
                                </span>
                              )}
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-sm font-bold text-text-primary">
                                {formatCurrency(so.total)}
                              </p>
                              <div className="flex items-center gap-1 text-[10px] text-text-muted">
                                <Calendar size={9} />
                                {formatDate(so.requested_delivery_date)}
                              </div>
                            </div>
                          </div>

                          {/* Items preview */}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {so.items.slice(0, 3).map((it) => (
                              <span
                                key={it.id}
                                className="text-[9px] bg-muted text-text-muted px-1.5 py-0.5 rounded-full"
                              >
                                {it.quantity_ordered} × {it.product_name.slice(0, 25)}
                              </span>
                            ))}
                            {so.items.length > 3 && (
                              <span className="text-[9px] text-text-muted">
                                +{so.items.length - 3} más
                              </span>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[10px] text-text-muted">
                              {so.item_count} materiales · {pendingItems} pendientes de picking
                            </span>
                            <span className="text-[10px] font-medium text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              Crear Salida <ChevronRight size={10} />
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── STEP 2: Picking (AI + Manual) ── */}
            {step === 2 && selectedSO && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* SO Header - compact */}
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-orange-500">{selectedSO.so_number}</p>
                      <p className="text-[11px] text-text-secondary">{selectedSO.customer_name}</p>
                    </div>
                    <div className="text-right text-[10px] text-text-muted">
                      <p>Entrega: {formatDate(selectedSO.requested_delivery_date)}</p>
                      <p className="font-bold text-text-primary">{formatCurrency(selectedSO.total)}</p>
                    </div>
                  </div>
                </div>

                {/* Warehouse selector */}
                <div>
                  <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                    Almacén de Despacho
                  </label>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background py-2 px-3 text-xs text-text-primary focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Seleccionar almacén...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* ═══ 3D VISUALIZATION PANEL ═══ */}
                {selectedWarehouse && allHighlightedPositions.length > 0 && (
                  <div className="rounded-xl border border-indigo-500/20 overflow-hidden">
                    <button
                      onClick={() => setShow3DPanel(!show3DPanel)}
                      className="flex items-center justify-between w-full px-4 py-2.5 bg-linear-to-r from-indigo-500/5 to-violet-500/5 hover:from-indigo-500/10 hover:to-violet-500/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className="text-indigo-500" />
                        <span className="text-[10px] font-bold text-indigo-500">
                          Vista 3D — {allHighlightedPositions.length} posiciones de extracción
                        </span>
                      </div>
                      <ChevronRight
                        size={12}
                        className={cn("text-indigo-400 transition-transform", show3DPanel && "rotate-90")}
                      />
                    </button>
                    <AnimatePresence>
                      {show3DPanel && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          <MiniWarehouse3D
                            warehouseId={selectedWarehouse}
                            warehouseName={wh?.name || "Almacén"}
                            highlightedPositions={allHighlightedPositions}
                            contextLabel={`Picking · ${selectedSO.so_number}`}
                          />
                          <p className="text-[8px] text-text-muted text-center py-1.5 bg-[#0d0f1e]">
                            Posiciones resaltadas = ubicaciones de extracción
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ═══ AI PICKING HEADER ═══ */}
                <div className="flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-linear-to-br from-indigo-500/5 to-violet-500/5 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-500 shrink-0">
                    <Sparkles size={14} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-text-primary">GRIXI AI — Picking Inteligente</p>
                    <p className="text-[8px] text-text-muted">
                      FEFO/FIFO · Cada producto permite elegir entre sugerencia IA o selección manual
                    </p>
                  </div>
                  {loadingPicking && <Loader2 size={14} className="animate-spin text-indigo-500" />}
                </div>

                {/* ═══ PRODUCTS WITH PICKING MODES ═══ */}
                <div className="space-y-3">
                  {pickItems.map((item, idx) => {
                    const mode = pickingMode[item.product_id] || "ai";
                    const aiSuggestions = pickingSuggestions[item.product_id] || [];
                    const manual = manualPicks[item.product_id] || [];
                    const available = availableSUs[item.product_id] || [];
                    const isLoadingSU = loadingSUs[item.product_id] || false;
                    const hasSuggestion = aiSuggestions.length > 0;
                    const manualTotal = manual.reduce((acc, p) => acc + p.quantity, 0);

                    return (
                      <div
                        key={item.product_id}
                        className={cn(
                          "rounded-xl border p-3 space-y-3",
                          mode === "manual" && manual.length > 0
                            ? "border-cyan-500/20 bg-cyan-500/2"
                            : hasSuggestion
                            ? "border-emerald-500/20 bg-emerald-500/2"
                            : "border-amber-500/20 bg-amber-500/2"
                        )}
                      >
                        {/* Product header + mode toggle */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {(mode === "manual" ? manual.length > 0 : hasSuggestion) ? (
                              <CheckCircle2 size={13} className={mode === "manual" ? "text-cyan-500 shrink-0 mt-0.5" : "text-emerald-500 shrink-0 mt-0.5"} />
                            ) : (
                              <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <p className="text-xs font-bold text-text-primary">{item.product_name}</p>
                              <p className="text-[10px] text-text-muted font-mono">{item.product_sku}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-text-muted">
                              Pedido: {item.quantity_ordered} {item.unit}
                            </span>
                            {/* Mode Toggle */}
                            <button
                              onClick={() => togglePickingMode(item.product_id)}
                              className={cn(
                                "flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full transition-all",
                                mode === "manual"
                                  ? "bg-cyan-500/10 text-cyan-500 border border-cyan-500/20"
                                  : "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                              )}
                            >
                              {mode === "manual" ? (
                                <><ToggleRight size={10} /> Manual</>
                              ) : (
                                <><ToggleLeft size={10} /> IA</>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* ── AI Mode ── */}
                        {mode === "ai" && (
                          <>
                            {aiSuggestions.length > 0 ? (
                              <div className="space-y-1">
                                {aiSuggestions.map((s, sIdx) => (
                                  <div key={sIdx} className="rounded-md bg-emerald-500/5 border border-emerald-500/10 px-2.5 py-1.5">
                                    <div className="flex items-center justify-between text-[10px]">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{s.su_code}</span>
                                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-medium">
                                          {s.lot_number}
                                        </span>
                                      </div>
                                      <span className="font-bold text-emerald-500 tabular-nums">{s.suggested_qty} {item.unit}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[8px] text-text-muted mt-0.5">
                                      <span className="flex items-center gap-0.5">
                                        <MapPin size={7} className="text-cyan-500" />
                                        {s.rack_code} · Fila {s.row_number} · Col {s.column_number}
                                      </span>
                                      <span>Stock: {s.available_quantity} {item.unit}</span>
                                    </div>
                                    <p className="text-[8px] text-amber-600 dark:text-amber-400">💡 {s.reason}</p>
                                  </div>
                                ))}
                              </div>
                            ) : !loadingPicking ? (
                              <p className="text-[9px] text-amber-500">⚠ Sin stock disponible — usa modo Manual para buscar en otros almacenes</p>
                            ) : null}
                          </>
                        )}

                        {/* ── Manual Mode ── */}
                        {mode === "manual" && (
                          <div className="space-y-2">
                            {/* Selected manual picks */}
                            {manual.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-[9px] font-semibold text-cyan-500 flex items-center gap-1">
                                  <Box size={9} /> UAs seleccionadas ({manual.length})
                                </p>
                                {manual.map((p) => (
                                  <div key={p.su_id} className="rounded-md bg-cyan-500/5 border border-cyan-500/10 px-2.5 py-1.5">
                                    <div className="flex items-center justify-between text-[10px]">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{p.su_code}</span>
                                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-medium">
                                          {p.lot_number}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => updateManualPickQty(item.product_id, p.su_id, p.quantity - 1)}
                                          className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-surface text-text-muted"
                                        >
                                          <Minus size={9} />
                                        </button>
                                        <input
                                          type="number"
                                          value={p.quantity}
                                          onChange={(e) => updateManualPickQty(item.product_id, p.su_id, Number(e.target.value))}
                                          min={1}
                                          max={p.max_available}
                                          className="w-12 text-center text-[10px] font-bold rounded border border-border bg-muted py-0.5 text-text-primary focus:outline-none focus:border-cyan-500"
                                        />
                                        <button
                                          onClick={() => updateManualPickQty(item.product_id, p.su_id, p.quantity + 1)}
                                          className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-surface text-text-muted"
                                        >
                                          <Plus size={9} />
                                        </button>
                                        <span className="text-[8px] text-text-muted">/ {p.max_available}</span>
                                        <button
                                          onClick={() => removeManualPick(item.product_id, p.su_id)}
                                          className="text-red-400 hover:text-red-500 ml-1"
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[8px] text-text-muted mt-0.5">
                                      <MapPin size={7} className="text-cyan-500" />
                                      <span>{p.warehouse_name} · {p.position_label}</span>
                                    </div>
                                  </div>
                                ))}
                                <div className="text-[9px] text-right">
                                  <span className={manualTotal >= item.quantity_to_pick ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                                    {manualTotal} / {item.quantity_to_pick} {item.unit} seleccionadas
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Available SUs to add */}
                            <div className="border-t border-border/50 pt-2">
                              <p className="text-[9px] font-semibold text-text-muted mb-1">
                                UAs disponibles — click para agregar
                              </p>
                              {isLoadingSU ? (
                                <div className="flex items-center gap-2 py-3 justify-center">
                                  <Loader2 size={12} className="animate-spin text-cyan-500" />
                                  <span className="text-[9px] text-cyan-500">Buscando UAs...</span>
                                </div>
                              ) : available.length > 0 ? (
                                <div className="grid gap-1 max-h-[160px] overflow-y-auto">
                                  {available
                                    .filter(su => !manual.find(p => p.su_id === su.su_id))
                                    .map((su) => (
                                      <button
                                        key={su.su_id}
                                        onClick={() => addManualPick(item.product_id, su)}
                                        className="flex items-center justify-between px-2.5 py-1.5 rounded-md border border-border hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-colors text-left group"
                                      >
                                        <div className="flex items-center gap-2 text-[10px]">
                                          <Plus size={10} className="text-text-muted group-hover:text-cyan-500 transition-colors" />
                                          <span className="font-mono font-bold text-text-primary">{su.su_code}</span>
                                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-medium">
                                            {su.lot_number}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[9px] text-text-muted">
                                          <span>{su.warehouse_name} · {su.position_label}</span>
                                          <span className="font-bold text-emerald-500 tabular-nums">{su.available_quantity} disp.</span>
                                        </div>
                                      </button>
                                    ))}
                                </div>
                              ) : (
                                <p className="text-[9px] text-amber-500 py-2">⚠ No hay UAs disponibles para este producto</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Quantity override */}
                        <div className="flex items-center gap-3 border-t border-border/30 pt-2">
                          <label className="text-[10px] text-text-muted shrink-0">Despachar:</label>
                          <input
                            type="number"
                            min={0}
                            max={item.quantity_ordered}
                            value={item.quantity_to_pick}
                            onChange={(e) => {
                              const val = Math.min(Math.max(0, Number(e.target.value)), item.quantity_ordered);
                              setPickItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, quantity_to_pick: val } : it))
                              );
                            }}
                            className="w-20 rounded-lg border border-border bg-muted py-1.5 px-2 text-xs text-center font-bold text-text-primary focus:border-orange-500 focus:outline-none"
                          />
                          <span className="text-[10px] text-text-muted">{item.unit}</span>
                          {item.quantity_to_pick === item.quantity_ordered && (
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Navigation + Save Draft */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => { setStep(1); setSelectedSO(null); }}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                  >
                    <ChevronLeft size={14} /> Cambiar Pedido
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveDraft}
                      disabled={savingDraft || totalPicking === 0}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-[10px] font-medium text-text-secondary hover:bg-muted transition-colors disabled:opacity-40"
                    >
                      {savingDraft ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}
                      {draftId ? "Borrador Guardado ✓" : "Guardar Borrador"}
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      disabled={totalPicking === 0 || !selectedWarehouse}
                      className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition-colors disabled:opacity-40"
                    >
                      Revisar Despacho <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: Review ── */}
            {step === 3 && selectedSO && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Summary KPIs */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 text-center">
                    <p className="text-2xl font-bold text-orange-500">{totalPicking}</p>
                    <p className="text-[10px] text-text-muted">Unidades</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-center">
                    <p className="text-2xl font-bold text-blue-500">{totalItems}</p>
                    <p className="text-[10px] text-text-muted">Materiales</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                    <p className="text-2xl font-bold text-emerald-500">{buildPickingLines().length}</p>
                    <p className="text-[10px] text-text-muted">UAs Picking</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
                    <p className="text-lg font-bold text-amber-500">{formatCurrency(selectedSO.total)}</p>
                    <p className="text-[10px] text-text-muted">Valor Total</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                  <h4 className="text-xs font-bold text-text-primary">Resumen de Salida</h4>

                  {/* Header info */}
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="text-text-muted">Pedido:</span>
                      <span className="ml-1 font-bold text-text-primary">{selectedSO.so_number}</span>
                    </div>
                    <div>
                      <span className="text-text-muted">Cliente:</span>
                      <span className="ml-1 font-medium text-text-primary">{selectedSO.customer_name}</span>
                    </div>
                    <div>
                      <span className="text-text-muted">Almacén:</span>
                      <span className="ml-1 font-medium text-text-primary">{wh?.name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-text-muted">Fecha:</span>
                      <span className="ml-1 font-medium text-text-primary">{new Date().toLocaleDateString("es-EC")}</span>
                    </div>
                  </div>

                  {/* 3D Preview — uses unified highlighted positions */}
                  {selectedWarehouse && allHighlightedPositions.length > 0 && (
                    <div className="border-t border-border pt-3 space-y-1.5">
                      <p className="text-[9px] font-semibold text-indigo-500 flex items-center gap-1">
                        <MapPin size={9} />
                        Vista 3D — {allHighlightedPositions.length} posiciones de extracción
                      </p>
                      <div className="rounded-xl border border-indigo-500/20 overflow-hidden">
                        <MiniWarehouse3D
                          warehouseId={selectedWarehouse}
                          warehouseName={wh?.name || "Almacén"}
                          highlightedPositions={allHighlightedPositions}
                          contextLabel={`Picking · ${selectedSO.so_number}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Items with picking detail — unified from buildPickingLines */}
                  <div className="border-t border-border pt-3 space-y-3">
                    {pickItems.filter((it) => it.quantity_to_pick > 0).map((item) => {
                      const mode = pickingMode[item.product_id] || "ai";
                      const pickLines = mode === "manual"
                        ? (manualPicks[item.product_id] || []).map(p => ({ su_code: p.su_code, lot_number: p.lot_number, position_label: p.position_label, quantity: p.quantity }))
                        : (pickingSuggestions[item.product_id] || []).map(s => ({ su_code: s.su_code, lot_number: s.lot_number, position_label: s.position_label, quantity: s.suggested_qty }));
                      return (
                        <div key={item.product_id} className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <Truck size={11} className="text-orange-500" />
                              <span className="text-text-primary font-medium">{item.product_name}</span>
                              <span className="text-text-muted font-mono text-[9px]">{item.product_sku}</span>
                              {mode === "manual" && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 font-medium">Manual</span>
                              )}
                            </div>
                            <span className="font-bold text-text-primary tabular-nums">
                              {Math.round(item.quantity_to_pick * 100) / 100} {item.unit}
                            </span>
                          </div>
                          {/* Picking source UAs */}
                          {pickLines.length > 0 && (
                            <div className="ml-6 space-y-1">
                              {pickLines.map((s, sIdx) => (
                                <div key={sIdx} className="flex items-center gap-2 text-[9px] text-text-muted">
                                  <span className={cn("font-mono font-semibold", mode === "manual" ? "text-cyan-500" : "text-emerald-500")}>{s.su_code}</span>
                                  <span>·</span>
                                  <span className="px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-medium">{s.lot_number}</span>
                                  <span>·</span>
                                  <span>Pos: {s.position_label}</span>
                                  <span className={cn("ml-auto font-bold tabular-nums", mode === "manual" ? "text-cyan-500" : "text-emerald-500")}>{s.quantity} UN</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Picking Summary */}
                  {buildPickingLines().length > 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
                      <Sparkles size={12} className="text-emerald-500 shrink-0" />
                      <p className="text-[9px] text-emerald-500">
                        <span className="font-bold">{buildPickingLines().length} UAs seleccionadas</span> · {pickItems.some(it => (pickingMode[it.product_id] || "ai") === "manual") ? "Mixto (IA + Manual)" : "Estrategia FEFO/FIFO"}
                      </p>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <span className="text-xs text-text-muted">
                      {totalItems} materiales · {totalPicking} unidades totales
                    </span>
                    <span className="text-sm font-bold text-orange-500">
                      {formatCurrency(selectedSO.total)}
                    </span>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                  >
                    <ChevronLeft size={14} /> Editar Picking
                  </button>
                  <button
                    onClick={handlePost}
                    disabled={isPending}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Contabilizando...
                      </>
                    ) : (
                      <>
                        <Send size={14} /> Contabilizar Salida
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 4: Result ── */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12 space-y-4"
              >
                {result?.success ? (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.1 }}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10"
                    >
                      <CheckCircle2 size={32} className="text-emerald-500" />
                    </motion.div>
                    <h3 className="text-lg font-bold text-text-primary">
                      Salida Contabilizada
                    </h3>
                    <p className="text-xs text-text-secondary text-center max-w-sm">
                      {result.message}
                    </p>
                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={handleClose}
                        className="rounded-xl bg-muted px-4 py-2 text-xs font-medium text-text-primary hover:bg-surface transition-colors"
                      >
                        Cerrar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                      <AlertCircle size={32} className="text-red-500" />
                    </div>
                    <h3 className="text-lg font-bold text-red-500">Error</h3>
                    <p className="text-xs text-text-secondary text-center max-w-sm">
                      {result?.message || "Error desconocido"}
                    </p>
                    <button
                      onClick={() => { setStep(3); setResult(null); }}
                      className="rounded-xl bg-muted px-4 py-2 text-xs font-medium text-text-primary"
                    >
                      Reintentar
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
