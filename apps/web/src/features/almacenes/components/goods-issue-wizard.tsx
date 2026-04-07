"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowUpFromLine, ChevronRight, ChevronLeft, Package,
  Search, CheckCircle2, AlertCircle, Loader2,
  ShoppingCart, ClipboardList, Eye, Send,
  Users, Calendar, Truck, MapPin, Sparkles,
  Save, Plus, Minus, Box,
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
  const router = useRouter();
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

  const [show3DPanel, setShow3DPanel] = useState(false);
  const [manualSubView, setManualSubView] = useState<Record<string, "list" | "map">>({});
  const [manualMapRack, setManualMapRack] = useState<Record<string, string | null>>({});

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
        router.refresh();
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
          router.refresh();
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
    setManualSubView({});
    setManualMapRack({});
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
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl flex flex-col bg-background border-l border-border shadow-2xl"
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

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
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
                <div className="flex items-center gap-2 rounded-lg border border-indigo-500/15 bg-indigo-500/5 px-3 py-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-linear-to-br from-indigo-500 to-violet-500 shrink-0">
                    <Sparkles size={11} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold text-text-primary">GRIXI AI — Picking Inteligente
                      <span className="font-normal text-text-muted ml-1">FEFO/FIFO · IA o manual por producto</span>
                    </p>
                  </div>
                  {loadingPicking && <Loader2 size={12} className="animate-spin text-indigo-500 shrink-0" />}
                </div>

                {/* ═══ PRODUCTS WITH PICKING MODES ═══ */}
                <div className="space-y-2">
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
                          "rounded-lg border p-2.5 space-y-2",
                          mode === "manual" && manual.length > 0
                            ? "border-cyan-500/20 bg-cyan-500/2"
                            : hasSuggestion
                            ? "border-emerald-500/20 bg-emerald-500/2"
                            : "border-amber-500/20 bg-amber-500/2"
                        )}
                      >
                        {/* Product header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {(mode === "manual" ? manual.length > 0 : hasSuggestion) ? (
                              <CheckCircle2 size={13} className={mode === "manual" ? "text-cyan-500 shrink-0" : "text-emerald-500 shrink-0"} />
                            ) : (
                              <AlertCircle size={13} className="text-amber-500 shrink-0" />
                            )}
                            <div>
                              <p className="text-xs font-bold text-text-primary">{item.product_name}</p>
                              <p className="text-[10px] text-text-muted font-mono">{item.product_sku} · Pedido: {item.quantity_ordered} {item.unit}</p>
                            </div>
                          </div>
                        </div>

                        {/* ── MODE SELECTOR — inline compact ── */}
                        <div className="flex items-center gap-1 p-0.5 bg-muted/50 rounded-lg border border-border/50">
                          <button
                            onClick={() => { if (mode !== "ai") togglePickingMode(item.product_id); }}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[9px] font-bold transition-all flex-1 justify-center",
                              mode === "ai"
                                ? "bg-indigo-500/15 text-indigo-500 border border-indigo-500/25 shadow-sm"
                                : "text-text-muted hover:bg-surface border border-transparent"
                            )}
                          >
                            <Sparkles size={10} />
                            IA Auto
                          </button>
                          <button
                            onClick={() => { if (mode !== "manual") togglePickingMode(item.product_id); }}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[9px] font-bold transition-all flex-1 justify-center",
                              mode === "manual"
                                ? "bg-cyan-500/15 text-cyan-500 border border-cyan-500/25 shadow-sm"
                                : "text-text-muted hover:bg-surface border border-transparent"
                            )}
                          >
                            <MapPin size={10} />
                            Manual
                          </button>
                        </div>

                        {/* ── Animated Mode Content ── */}
                        <AnimatePresence mode="wait">
                        {/* ── AI Mode ── */}
                        {mode === "ai" && (
                          <motion.div
                            key="ai-mode"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className="space-y-2"
                          >
                            {/* AI Hint — compact */}
                            <div className="flex items-center gap-2 rounded-md bg-indigo-500/5 border border-indigo-500/10 px-2.5 py-1.5">
                              <Sparkles size={10} className="text-indigo-400 shrink-0" />
                              <p className="text-[8px] text-indigo-400/80">
                                <span className="font-bold text-indigo-400">Auto.</span> Optimizado FEFO/FIFO por lote y antigüedad.
                              </p>
                            </div>

                            {loadingPicking && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-2 py-4 justify-center"
                              >
                                <Loader2 size={14} className="animate-spin text-indigo-500" />
                                <span className="text-[10px] text-indigo-400">Analizando stock con IA...</span>
                              </motion.div>
                            )}

                            {!loadingPicking && aiSuggestions.length > 0 && (
                              <div className="space-y-1.5">
                                {aiSuggestions.map((s, sIdx) => (
                                  <motion.div
                                    key={sIdx}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.15 + sIdx * 0.06, ease: "easeOut" }}
                                    className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-2 hover:bg-emerald-500/8 transition-colors"
                                  >
                                    <div className="flex items-center justify-between text-[10px]">
                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center justify-center w-5 h-5 rounded bg-emerald-500/20">
                                          <Package size={9} className="text-emerald-400" />
                                        </div>
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{s.su_code}</span>
                                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-medium">
                                          {s.lot_number}
                                        </span>
                                      </div>
                                      <span className="font-bold text-emerald-500 tabular-nums">{s.suggested_qty} {item.unit}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[8px] text-text-muted mt-1">
                                      <span className="flex items-center gap-0.5">
                                        <MapPin size={7} className="text-cyan-500" />
                                        {s.rack_code} · F{s.row_number} · C{s.column_number}
                                      </span>
                                      <span>Stock: {s.available_quantity} {item.unit}</span>
                                    </div>
                                    <p className="text-[8px] text-amber-600 dark:text-amber-400 mt-0.5">💡 {s.reason}</p>
                                  </motion.div>
                                ))}

                                {/* AI Summary */}
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.3 }}
                                  className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-1.5"
                                >
                                  <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                                  <span className="text-[9px] text-emerald-500 font-medium">
                                    {aiSuggestions.length} UA{aiSuggestions.length > 1 ? "s" : ""} seleccionada{aiSuggestions.length > 1 ? "s" : ""} ·{" "}
                                    {aiSuggestions.reduce((s, a) => s + a.suggested_qty, 0)} {item.unit} total
                                  </span>
                                </motion.div>
                              </div>
                            )}

                            {!loadingPicking && aiSuggestions.length === 0 && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-3 text-center"
                              >
                                <AlertCircle size={16} className="mx-auto mb-1 text-amber-500/60" />
                                <p className="text-[9px] text-amber-500 font-medium">Sin stock disponible en este almacén</p>
                                <p className="text-[8px] text-text-muted mt-0.5">Cambia a modo <span className="text-cyan-500 font-bold">Manual</span> para buscar en todas las ubicaciones</p>
                              </motion.div>
                            )}
                          </motion.div>
                        )}

                        {/* ── Manual Mode ── */}
                        {mode === "manual" && (() => {
                          const subView = (manualSubView[item.product_id] || "list") as "list" | "map";
                          const setSubView = (v: "list" | "map") => setManualSubView(prev => ({ ...prev, [item.product_id]: v }));
                          const selectedRackForMap = manualMapRack[item.product_id] || null;
                          const setSelectedRackForMap = (r: string | null) => setManualMapRack(prev => ({ ...prev, [item.product_id]: r }));

                          return (
                          <motion.div
                            key="manual-mode"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className="space-y-2"
                          >
                            {/* Manual Hint — compact */}
                            <div className="flex items-center gap-2 rounded-md bg-cyan-500/5 border border-cyan-500/10 px-2.5 py-1.5">
                              <MapPin size={10} className="text-cyan-400 shrink-0" />
                              <p className="text-[8px] text-cyan-400/80">
                                <span className="font-bold text-cyan-400">Manual.</span> Selecciona UAs por lista o explora el mapa visual.
                              </p>
                            </div>

                            {/* Selected manual picks (always visible) */}
                            <AnimatePresence>
                            {manual.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-1.5 overflow-hidden"
                              >
                                <p className="text-[9px] font-semibold text-cyan-500 flex items-center gap-1">
                                  <Box size={9} /> UAs seleccionadas ({manual.length})
                                </p>
                                {manual.map((p, pIdx) => (
                                  <motion.div
                                    key={p.su_id}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 12, height: 0 }}
                                    transition={{ delay: pIdx * 0.04 }}
                                    layout
                                    className="rounded-lg bg-cyan-500/5 border border-cyan-500/15 px-3 py-2"
                                  >
                                    <div className="flex items-center justify-between text-[10px]">
                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center justify-center w-5 h-5 rounded bg-cyan-500/20">
                                          <Package size={9} className="text-cyan-400" />
                                        </div>
                                        <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{p.su_code}</span>
                                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-medium">
                                          {p.lot_number}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => updateManualPickQty(item.product_id, p.su_id, p.quantity - 1)}
                                          className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-surface text-text-muted transition-colors"
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
                                          className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-surface text-text-muted transition-colors"
                                        >
                                          <Plus size={9} />
                                        </button>
                                        <span className="text-[8px] text-text-muted">/ {p.max_available}</span>
                                        <button
                                          onClick={() => removeManualPick(item.product_id, p.su_id)}
                                          className="text-red-400 hover:text-red-500 ml-1 transition-colors"
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[8px] text-text-muted mt-1">
                                      <MapPin size={7} className="text-cyan-500" />
                                      <span>{p.warehouse_name} · {p.position_label}</span>
                                    </div>
                                  </motion.div>
                                ))}
                                <div className="text-[9px] text-right">
                                  <span className={manualTotal >= item.quantity_to_pick ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                                    {manualTotal} / {item.quantity_to_pick} {item.unit} seleccionadas
                                  </span>
                                </div>
                              </motion.div>
                            )}
                            </AnimatePresence>

                            {/* Sub-view toggle: Lista ↔ Mapa Visual ↔ 3D */}
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.15 }}
                              className="flex items-center gap-1.5 border-t border-border/50 pt-2"
                            >
                              {([
                                { key: "list" as const, label: "Lista", icon: ClipboardList },
                                { key: "map" as const, label: "Mapa Rack", icon: MapPin },
                              ]).map(tab => (
                                <button
                                  key={tab.key}
                                  onClick={() => setSubView(tab.key)}
                                  className={cn(
                                    "flex items-center gap-1.5 text-[9px] px-3 py-1.5 rounded-lg font-medium transition-all",
                                    subView === tab.key
                                      ? "bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 shadow-sm"
                                      : "text-text-muted hover:text-text-primary hover:bg-muted border border-transparent"
                                  )}
                                >
                                  <tab.icon size={10} />
                                  {tab.label}
                                </button>
                              ))}
                              <span className="text-[8px] text-text-muted ml-auto tabular-nums">
                                {available.length} UAs disp.
                              </span>
                            </motion.div>

                            {/* ── Animated sub-views ── */}
                            <AnimatePresence mode="wait">
                            {/* LIST SUB-VIEW */}
                            {subView === "list" && (
                              <motion.div
                                key="list-sub"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.2 }}
                              >
                                {isLoadingSU ? (
                                  <div className="flex items-center gap-2 py-4 justify-center">
                                    <Loader2 size={12} className="animate-spin text-cyan-500" />
                                    <span className="text-[9px] text-cyan-500">Buscando UAs disponibles...</span>
                                  </div>
                                ) : available.length > 0 ? (
                                  <div className="grid gap-1 max-h-[180px] overflow-y-auto">
                                    {available
                                      .filter(su => !manual.find(p => p.su_id === su.su_id))
                                      .map((su, suIdx) => (
                                        <motion.button
                                          key={su.su_id}
                                          initial={{ opacity: 0, x: -8 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: suIdx * 0.03 }}
                                          onClick={() => addManualPick(item.product_id, su)}
                                          className="flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all text-left group"
                                        >
                                          <div className="flex items-center gap-2 text-[10px]">
                                            <div className="flex items-center justify-center w-5 h-5 rounded bg-muted group-hover:bg-cyan-500/20 transition-colors">
                                              <Plus size={9} className="text-text-muted group-hover:text-cyan-500 transition-colors" />
                                            </div>
                                            <span className="font-mono font-bold text-text-primary">{su.su_code}</span>
                                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-medium">
                                              {su.lot_number}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-3 text-[9px] text-text-muted">
                                            <span>{su.rack_code} · F{su.row_number}C{su.column_number}</span>
                                            <span className="font-bold text-emerald-500 tabular-nums">{su.available_quantity} disp.</span>
                                          </div>
                                        </motion.button>
                                      ))}
                                  </div>
                                ) : (
                                  <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-3 text-center"
                                  >
                                    <AlertCircle size={16} className="mx-auto mb-1 text-amber-500/60" />
                                    <p className="text-[9px] text-amber-500 font-medium">No hay UAs disponibles para este producto</p>
                                  </motion.div>
                                )}
                              </motion.div>
                            )}

                            {/* MAP SUB-VIEW */}
                            {subView === "map" && selectedWarehouse && (
                              <motion.div
                                key="map-sub"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-2 max-h-[300px] overflow-y-auto"
                              >
                                {isLoadingSU ? (
                                  <div className="flex items-center gap-2 py-6 justify-center">
                                    <Loader2 size={14} className="animate-spin text-cyan-500" />
                                    <span className="text-[10px] text-cyan-500">Cargando mapa...</span>
                                  </div>
                                ) : available.length > 0 ? (
                                  <>
                                    {/* Mini 3D Preview of full warehouse */}
                                    {allHighlightedPositions.length > 0 && (
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.1 }}
                                        className="rounded-xl border border-cyan-500/15 overflow-hidden"
                                      >
                                        <MiniWarehouse3D
                                          warehouseId={selectedWarehouse}
                                          warehouseName={wh?.name || "Almacén"}
                                          highlightedPositions={allHighlightedPositions}
                                          contextLabel={`Picking Manual · ${item.product_name}`}
                                        />
                                      </motion.div>
                                    )}

                                    {/* Rack chips */}
                                    {(() => {
                                      const rackGroups: Record<string, AvailableSU[]> = {};
                                      for (const su of available) {
                                        const key = su.rack_code || "SIN-RACK";
                                        if (!rackGroups[key]) rackGroups[key] = [];
                                        rackGroups[key].push(su);
                                      }
                                      const rackKeys = Object.keys(rackGroups);

                                      return (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[8px] text-text-muted uppercase tracking-wider font-semibold shrink-0">Racks:</span>
                                            {rackKeys.map((rk, rkIdx) => {
                                              const isActive = selectedRackForMap === rk;
                                              const count = rackGroups[rk].length;
                                              const totalQty = rackGroups[rk].reduce((s, su) => s + su.available_quantity, 0);
                                              return (
                                                <motion.button
                                                  key={rk}
                                                  initial={{ opacity: 0, scale: 0.9 }}
                                                  animate={{ opacity: 1, scale: 1 }}
                                                  transition={{ delay: 0.15 + rkIdx * 0.04 }}
                                                  onClick={() => setSelectedRackForMap(isActive ? null : rk)}
                                                  className={cn(
                                                    "text-[9px] font-mono font-bold px-2.5 py-1 rounded-lg border transition-all",
                                                    isActive
                                                      ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400 ring-1 ring-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                                                      : "bg-muted border-border text-text-muted hover:border-cyan-500/20 hover:text-cyan-500"
                                                  )}
                                                >
                                                  {rk}
                                                  <span className="ml-1 text-[8px] font-normal opacity-60">
                                                    {count} UA · {totalQty} UN
                                                  </span>
                                                </motion.button>
                                              );
                                            })}
                                          </div>

                                          {/* Selected rack content */}
                                          <AnimatePresence mode="wait">
                                          {selectedRackForMap && rackGroups[selectedRackForMap] && (
                                            <motion.div
                                              key={selectedRackForMap}
                                              initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                              animate={{ opacity: 1, y: 0, scale: 1 }}
                                              exit={{ opacity: 0, y: -4, scale: 0.98 }}
                                              transition={{ duration: 0.2 }}
                                              className="rounded-xl border border-cyan-500/15 bg-[#0d0f1e] p-3 space-y-2"
                                            >
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-cyan-500/20">
                                                    <MapPin size={11} className="text-cyan-400" />
                                                  </div>
                                                  <div>
                                                    <span className="text-[10px] font-bold text-white/90 font-mono">
                                                      {wh?.name} → {selectedRackForMap}
                                                    </span>
                                                    <span className="text-[8px] text-cyan-400/50 font-mono ml-2">PICKING</span>
                                                  </div>
                                                </div>
                                                <span className="text-[9px] text-emerald-400 font-bold tabular-nums">
                                                  {rackGroups[selectedRackForMap].reduce((s, su) => s + su.available_quantity, 0)} UN disp.
                                                </span>
                                              </div>

                                              {/* Visual position grid */}
                                              {(() => {
                                                const rackSUs = rackGroups[selectedRackForMap];
                                                const maxRow = Math.max(...rackSUs.map(su => su.row_number), 1);
                                                const maxCol = Math.max(...rackSUs.map(su => su.column_number), 1);

                                                return (
                                                  <div>
                                                    <p className="text-[7px] text-zinc-500 uppercase tracking-widest mb-1.5">
                                                      Posiciones con stock · Click para seleccionar
                                                    </p>
                                                    <div
                                                      className="grid gap-[3px]"
                                                      style={{ gridTemplateColumns: `auto repeat(${maxCol}, 1fr)` }}
                                                    >
                                                      <div />
                                                      {Array.from({ length: maxCol }, (_, c) => (
                                                        <div key={c} className="text-center text-[7px] font-mono text-zinc-600 py-0.5">C{c + 1}</div>
                                                      ))}

                                                      {Array.from({ length: maxRow }, (_, r) => (
                                                        <>
                                                          <div key={`rl-${r}`} className="flex items-center justify-center text-[7px] font-mono text-zinc-600 pr-1">F{r + 1}</div>
                                                          {Array.from({ length: maxCol }, (_, c) => {
                                                            const su = rackSUs.find(s => s.row_number === r + 1 && s.column_number === c + 1);
                                                            const alreadyPicked = manual.find(p => p.su_id === su?.su_id);

                                                            if (!su) {
                                                              return <div key={`e-${r}-${c}`} className="h-10 rounded bg-zinc-900/50 border border-zinc-800/40" />;
                                                            }

                                                            return (
                                                              <motion.button
                                                                key={su.su_id}
                                                                initial={{ opacity: 0, scale: 0.8 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                transition={{ delay: (r * maxCol + c) * 0.02 }}
                                                                onClick={() => { if (!alreadyPicked) addManualPick(item.product_id, su); }}
                                                                disabled={!!alreadyPicked}
                                                                className={cn(
                                                                  "relative h-10 rounded border transition-all flex flex-col items-center justify-center gap-0.5",
                                                                  alreadyPicked
                                                                    ? "bg-cyan-500/20 border-cyan-400/50 ring-1 ring-cyan-400/30"
                                                                    : "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-400/50 cursor-pointer hover:scale-[1.08]"
                                                                )}
                                                                title={`${su.su_code} · ${su.available_quantity} UN · Lote ${su.lot_number}`}
                                                              >
                                                                <span className={cn(
                                                                  "text-[8px] font-bold tabular-nums leading-none",
                                                                  alreadyPicked ? "text-cyan-300" : "text-emerald-400"
                                                                )}>
                                                                  {su.available_quantity}
                                                                </span>
                                                                <span className="text-[5px] text-zinc-500 font-mono leading-none truncate max-w-full px-0.5">
                                                                  {su.su_code.slice(-4)}
                                                                </span>
                                                                {alreadyPicked && (
                                                                  <motion.div
                                                                    initial={{ scale: 0 }}
                                                                    animate={{ scale: 1 }}
                                                                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 flex items-center justify-center"
                                                                  >
                                                                    <CheckCircle2 size={6} className="text-white" />
                                                                  </motion.div>
                                                                )}
                                                              </motion.button>
                                                            );
                                                          })}
                                                        </>
                                                      ))}
                                                    </div>

                                                    <div className="flex items-center gap-3 mt-2">
                                                      <div className="flex items-center gap-1">
                                                        <div className="w-2 h-2 rounded-sm bg-emerald-500/30 border border-emerald-500/50" />
                                                        <span className="text-[7px] text-zinc-500">Disponible</span>
                                                      </div>
                                                      <div className="flex items-center gap-1">
                                                        <div className="w-2 h-2 rounded-sm bg-cyan-500/30 border border-cyan-400/50" />
                                                        <span className="text-[7px] text-zinc-500">Seleccionado</span>
                                                      </div>
                                                      <div className="flex items-center gap-1">
                                                        <div className="w-2 h-2 rounded-sm bg-zinc-900/50 border border-zinc-800" />
                                                        <span className="text-[7px] text-zinc-500">Vacío</span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              })()}

                                              {/* SU detail list */}
                                              <div className="border-t border-white/5 pt-2 space-y-1 max-h-[120px] overflow-y-auto">
                                                {rackGroups[selectedRackForMap].map((su, suIdx) => {
                                                  const isPicked = !!manual.find(p => p.su_id === su.su_id);
                                                  return (
                                                    <motion.button
                                                      key={su.su_id}
                                                      initial={{ opacity: 0, x: -6 }}
                                                      animate={{ opacity: 1, x: 0 }}
                                                      transition={{ delay: suIdx * 0.03 }}
                                                      onClick={() => { if (!isPicked) addManualPick(item.product_id, su); }}
                                                      disabled={isPicked}
                                                      className={cn(
                                                        "flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left transition-all",
                                                        isPicked
                                                          ? "bg-cyan-500/10 border border-cyan-500/20"
                                                          : "hover:bg-white/5 border border-transparent"
                                                      )}
                                                    >
                                                      <div className="flex items-center gap-2 text-[10px]">
                                                        {isPicked ? (
                                                          <CheckCircle2 size={10} className="text-cyan-400 shrink-0" />
                                                        ) : (
                                                          <Plus size={10} className="text-zinc-600 shrink-0" />
                                                        )}
                                                        <span className={cn("font-mono font-bold", isPicked ? "text-cyan-300" : "text-white/80")}>{su.su_code}</span>
                                                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium">{su.lot_number}</span>
                                                      </div>
                                                      <div className="flex items-center gap-2 text-[9px]">
                                                        <span className="text-zinc-500">F{su.row_number}C{su.column_number}</span>
                                                        <span className="font-bold text-emerald-400 tabular-nums">{su.available_quantity} UN</span>
                                                      </div>
                                                    </motion.button>
                                                  );
                                                })}
                                              </div>
                                            </motion.div>
                                          )}

                                          {!selectedRackForMap && (
                                            <motion.div
                                              initial={{ opacity: 0 }}
                                              animate={{ opacity: 1 }}
                                              transition={{ delay: 0.2 }}
                                              className="text-center py-4 rounded-xl border border-dashed border-border/40"
                                            >
                                              <motion.div
                                                animate={{ y: [0, -4, 0] }}
                                                transition={{ repeat: Infinity, duration: 2 }}
                                              >
                                                <MapPin size={20} className="mx-auto mb-2 text-cyan-500/40" />
                                              </motion.div>
                                              <p className="text-[10px] text-text-muted">Selecciona un rack para ver las posiciones</p>
                                              <p className="text-[8px] text-text-muted mt-0.5">Cada celda representa una posición con stock disponible</p>
                                            </motion.div>
                                          )}
                                          </AnimatePresence>
                                        </div>
                                      );
                                    })()}
                                  </>
                                ) : (
                                  <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-4 text-center"
                                  >
                                    <Package size={18} className="mx-auto mb-1.5 text-amber-500/40" />
                                    <p className="text-[9px] text-amber-500 font-medium">No hay stock disponible en el almacén</p>
                                  </motion.div>
                                )}
                              </motion.div>
                            )}
                            </AnimatePresence>
                          </motion.div>
                          );
                        })()}
                        </AnimatePresence>

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

        {/* ── Sticky Footer — Step 2 Actions ── */}
        {step === 2 && (
          <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep(1); setSelectedSO(null); }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:bg-muted transition-colors"
              >
                <ChevronLeft size={14} /> Cambiar Pedido
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveDraft}
                  disabled={savingDraft || totalPicking === 0}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[10px] font-medium text-text-secondary hover:bg-muted transition-colors disabled:opacity-40"
                >
                  {savingDraft ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  {draftId ? "Guardado ✓" : "Borrador"}
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={totalPicking === 0 || !selectedWarehouse}
                  className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 shadow-sm shadow-orange-500/20 transition-colors disabled:opacity-40 disabled:shadow-none"
                >
                  Revisar <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Sticky Footer — Step 3 Actions ── */}
        {step === 3 && selectedSO && (
          <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:bg-muted transition-colors"
              >
                <ChevronLeft size={14} /> Volver al Picking
              </button>
              <button
                onClick={handlePost}
                disabled={isPending}
                className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/20 transition-colors disabled:opacity-40"
              >
                {isPending ? (
                  <><Loader2 size={13} className="animate-spin" /> Contabilizando...</>
                ) : (
                  <><CheckCircle2 size={13} /> Contabilizar Salida</>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}
