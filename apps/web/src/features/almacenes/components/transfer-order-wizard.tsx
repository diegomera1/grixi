"use client";

import { useState, useTransition, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Repeat2, ChevronRight, ChevronLeft,
  Search, CheckCircle2, Loader2,
  MapPin, Package, Send, Warehouse, ArrowRight, Sparkles, Box, Star,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RackPositionGrid } from "./rack-position-grid";

const MiniWarehouse3D = dynamic(() => import("./mini-warehouse-3d"), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] flex items-center justify-center bg-[#0d0f1e] rounded-xl">
      <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
    </div>
  ),
});

const PutawaySelector3D = lazy(() => import("./putaway-selector-3d"));

// ── Types ─────────────────────────────────────────────
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

type TransferWizardProps = {
  open: boolean;
  onClose: () => void;
  warehouses: { id: string; name: string }[];
  products: { id: string; name: string; sku: string }[];
};

type TransferItem = {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
};

type SourcePick = {
  su_id: string;
  su_code: string;
  lot_number: string;
  available_quantity: number;
  suggested_qty: number;
  position_id: string;
  position_label: string;
  rack_code: string;
  row_number: number;
  column_number: number;
  warehouse_name: string;
  reason: string;
};

type PutawaySuggestion = {
  position_id: string;
  rack_id: string;
  rack_code: string;
  row_number: number;
  column_number: number;
  position_label: string;
  score: number;
  reason: string;
};

type DestinationAssignment = {
  product_id: string;
  position_id: string;
  position_label: string;
};

const STEPS: { step: WizardStep; label: string; icon: typeof Package }[] = [
  { step: 1, label: "Material", icon: Package },
  { step: 2, label: "Origen", icon: Warehouse },
  { step: 3, label: "Picking", icon: MapPin },
  { step: 4, label: "Destino", icon: ArrowRight },
  { step: 5, label: "Ubicación", icon: MapPin },
  { step: 6, label: "Confirmar", icon: Send },
];

const REASONS = [
  { value: "reslotting", label: "Reslotting (ABC)" },
  { value: "consolidation", label: "Consolidación de stock" },
  { value: "balancing", label: "Balanceo entre almacenes" },
  { value: "maintenance", label: "Mantenimiento de rack" },
  { value: "cleanup", label: "Limpieza de zona" },
  { value: "other", label: "Otro" },
];



export function TransferOrderWizard({ open, onClose, warehouses, products }: TransferWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [isPending, startTransition] = useTransition();

  // Step 1: Materials
  const [items, setItems] = useState<TransferItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [stockByProduct, setStockByProduct] = useState<Record<string, { warehouse_id: string; warehouse_name: string; total_stock: number }[]>>({});
  const [loadingStock, setLoadingStock] = useState(false);

  // Step 2: Source warehouse
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [reason, setReason] = useState("reslotting");

  // Step 3: Picking
  const [sourcePicks, setSourcePicks] = useState<Record<string, SourcePick[]>>({});
  const [loadingSources, setLoadingSources] = useState(false);
  const [activePickIdx, setActivePickIdx] = useState(0);
  const [pickViewMode, setPickViewMode] = useState<"suggestions" | "manual">("suggestions");
  const [pickManualRack, setPickManualRack] = useState<string | null>(null);
  const [pick3DIdx, setPick3DIdx] = useState<number | null>(null);

  // Step 4: Destination warehouse
  const [toWarehouseId, setToWarehouseId] = useState("");

  // Step 5: Putaway at destination
  const [destAssignments, setDestAssignments] = useState<DestinationAssignment[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<Record<string, PutawaySuggestion[]>>({});
  const [loadingDest, setLoadingDest] = useState(false);
  const [activeDestIdx, setActiveDestIdx] = useState(0);
  const [destViewMode, setDestViewMode] = useState<"suggestions" | "manual">("suggestions");
  const [destManualRack, setDestManualRack] = useState<string | null>(null);
  const [dest3DIdx, setDest3DIdx] = useState<number | null>(null);
  const preview3DRef = useRef<HTMLDivElement>(null);

  // Step 6: Result
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<{ success: boolean; message: string; id?: string; status?: string } | null>(null);

  // ── Computed ──────────────────────────────────────────
  const fromWh = warehouses.find((w) => w.id === fromWarehouseId);
  const toWh = warehouses.find((w) => w.id === toWarehouseId);
  const isInternal = fromWarehouseId === toWarehouseId && !!fromWarehouseId && !!toWarehouseId;
  const totalQty = items.reduce((acc, it) => acc + it.quantity, 0);

  const filteredProducts = useMemo(() => products.filter((p) => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  }), [products, productSearch]);

  // ── Load stock per product/warehouse ──────────────────
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadStock() {
      setLoadingStock(true);
      try {
        const resp = await fetch("/api/wms/stock-summary");
        const res = await resp.json();
        if (!cancelled && res.success && res.data) {
          const mapped: Record<string, { warehouse_id: string; warehouse_name: string; total_stock: number }[]> = {};
          for (const row of res.data as { product_id: string; warehouse_id: string; warehouse_name: string; total_stock: number }[]) {
            if (!mapped[row.product_id]) mapped[row.product_id] = [];
            mapped[row.product_id].push({ warehouse_id: row.warehouse_id, warehouse_name: row.warehouse_name, total_stock: row.total_stock });
          }
          setStockByProduct(mapped);
        }
      } catch (err) { console.error("[Transfer] Stock load error:", err); }
      finally { if (!cancelled) setLoadingStock(false); }
    }
    loadStock();
    return () => { cancelled = true; };
  }, [open]);

  function addProduct(p: { id: string; name: string; sku: string }) {
    if (items.find((it) => it.product_id === p.id)) return;
    setItems([...items, { product_id: p.id, product_name: p.name, product_sku: p.sku, quantity: 1 }]);
    setProductSearch("");
  }

  function removeItem(idx: number) {
    const removed = items[idx];
    setItems(items.filter((_, i) => i !== idx));
    if (removed) {
      setSourcePicks((prev) => { const n = { ...prev }; delete n[removed.product_id]; return n; });
    }
  }

  function updateQty(idx: number, qty: number) {
    setItems(items.map((it, i) => (i === idx ? { ...it, quantity: Math.max(1, qty) } : it)));
  }

  // ── AI Source Picking ────────────────────────────────
  const loadSourcePicks = useCallback(async () => {
    if (!fromWarehouseId || items.length === 0) return;
    setLoadingSources(true);
    try {
      const resp = await fetch("/api/wms/ai-picking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouse_id: fromWarehouseId, items: items.map(it => ({ product_id: it.product_id, quantity_needed: it.quantity })) }),
      });
      const res = await resp.json();
      if (res.success && res.data) {
        const mapped: Record<string, SourcePick[]> = {};
        for (const r of res.data as { product_id: string; sources: Record<string, unknown>[] }[]) {
          if (r.sources?.length > 0) {
            mapped[r.product_id] = r.sources.map((s) => ({
              su_id: s.su_id as string, su_code: s.su_code as string,
              lot_number: s.lot_number as string || "N/A",
              available_quantity: Number(s.available), suggested_qty: Number(s.suggested_qty),
              position_id: s.position_id as string, position_label: s.position_label as string,
              rack_code: s.rack_code as string, row_number: Number(s.row_number),
              column_number: Number(s.column_number), warehouse_name: s.warehouse_name as string,
              reason: s.reason as string,
            }));
          }
        }
        setSourcePicks(mapped);
      }
    } catch (err) { console.error("[Transfer] Source pick error:", err); }
    finally { setLoadingSources(false); }
  }, [fromWarehouseId, items]);

  useEffect(() => {
    if (step === 3 && fromWarehouseId && items.length > 0) {
      const timer = setTimeout(() => loadSourcePicks(), 300);
      return () => clearTimeout(timer);
    }
  }, [step, fromWarehouseId, items.length, loadSourcePicks]);

  // ── Putaway Suggestions for Destination ──────────────
  const loadDestSuggestions = useCallback(async () => {
    if (!toWarehouseId || items.length === 0) return;
    setLoadingDest(true);
    try {
      const mapped: Record<string, PutawaySuggestion[]> = {};
      for (const item of items) {
        const resp = await fetch(`/api/wms/putaway-suggestions?warehouseId=${toWarehouseId}&productId=${item.product_id}&quantity=${item.quantity}`);
        const res = await resp.json();
        if (res.success && res.data?.length > 0) {
          mapped[item.product_id] = res.data;
        }
      }
      setDestSuggestions(mapped);
    } catch (err) { console.error("[Transfer] Dest suggestion error:", err); }
    finally { setLoadingDest(false); }
  }, [toWarehouseId, items]);

  useEffect(() => {
    if (step === 5 && toWarehouseId && items.length > 0) {
      const timer = setTimeout(() => loadDestSuggestions(), 300);
      return () => clearTimeout(timer);
    }
  }, [step, toWarehouseId, items.length, loadDestSuggestions]);

  const sourceHighlightedPositions = Object.values(sourcePicks).flat()
    .filter(s => s.rack_code && s.row_number && s.column_number)
    .map(s => ({ rack_code: s.rack_code, row_number: s.row_number, column_number: s.column_number, su_code: s.su_code }));

  // ── Assign destination position ──────────────────────
  const assignDestPosition = (productId: string, posId: string, posLabel: string) => {
    setDestAssignments((prev) => {
      const existing = prev.filter((a) => a.product_id !== productId);
      return [...existing, { product_id: productId, position_id: posId, position_label: posLabel }];
    });
  };

  // ── Submit Draft ─────────────────────────────────────
  function handleSaveDraft() {
    if (!fromWarehouseId || items.length === 0) return;
    startTransition(async () => {
      try {
        const transferItems = Object.entries(sourcePicks).flatMap(([productId, picks]) =>
          picks.map((s) => ({
            product_id: productId, su_id: s.su_id, su_code: s.su_code,
            quantity: s.suggested_qty, from_position_id: s.position_id,
            from_position_label: s.position_label, lot_number: s.lot_number,
          }))
        );
        const resp = await fetch("/api/wms/operations", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_transfer_draft", from_warehouse_id: fromWarehouseId,
            transfer_type: "cross_warehouse", priority, reason,
            notes: notes || undefined, transfer_items: transferItems,
          }),
        });
        const res = await resp.json();
        setResult(res);
        if (res.success) {
          setStep(4);
          toast.success("Picking registrado", { description: `${totalQty} UN preparadas de ${fromWh?.name}` });
        }
      } catch { setResult({ success: false, message: "Error al guardar borrador" }); toast.error("Error al guardar"); }
    });
  }

  // ── Submit Full Transfer ─────────────────────────────
  function handleFullSubmit() {
    if (!fromWarehouseId || !toWarehouseId || items.length === 0) return;
    startTransition(async () => {
      try {
        // If we have a draft, assign destination
        if (result?.id && result.status === "draft") {
          const resp = await fetch("/api/wms/operations", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "assign_transfer_destination", id: result.id,
              to_warehouse_id: toWarehouseId,
              destination_positions: destAssignments,
            }),
          });
          const res = await resp.json();
          if (res.success) {
            setResult((prev) => prev ? { ...prev, status: "pending", message: `Traspaso listo para envío a ${toWh?.name}` } : prev);
            toast.success("Destino asignado", { description: `Material asignado a ${toWh?.name}` });
            setStep(6);
          } else { toast.error("Error", { description: res.message }); }
          return;
        }
        // Full creation in one shot
        const transferItems = Object.entries(sourcePicks).flatMap(([productId, picks]) =>
          picks.map((s) => ({ product_id: productId, su_id: s.su_id, su_code: s.su_code, quantity: s.suggested_qty, from_position_label: s.position_label, lot_number: s.lot_number }))
        );
        const resp = await fetch("/api/wms/operations", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_transfer", from_warehouse_id: fromWarehouseId, to_warehouse_id: toWarehouseId,
            transfer_type: isInternal ? "internal" : "cross_warehouse", priority, reason,
            notes: notes || undefined,
            items: items.map((it) => ({ product_id: it.product_id, quantity: Math.round(it.quantity * 100) / 100 })),
            transfer_items: transferItems,
          }),
        });
        const res = await resp.json();
        setResult(res);
        if (res.success) { setStep(6); toast.success("Traspaso creado"); }
      } catch { toast.error("Error al crear traspaso"); }
    });
  }

  // ── Reset ─────────────────────────────────────────────
  function handleClose() {
    setStep(1); setFromWarehouseId(""); setToWarehouseId("");
    setPriority("medium"); setReason("reslotting");
    setItems([]); setProductSearch(""); setNotes("");
    setResult(null); setSourcePicks({}); setDestAssignments([]); setDestSuggestions({});
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={handleClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      {/* Panel */}
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl overflow-y-auto bg-background border-l border-border shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
                <Repeat2 size={18} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Nuevo Traspaso</h2>
                <p className="text-[10px] text-text-muted">
                  {step <= 3 ? "Selección de material y origen" : step <= 5 ? "Asignación de destino" : "Confirmación"}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
              <X size={16} className="text-text-muted" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-0.5 mt-3">
            {STEPS.map((s, i) => {
              const StIcon = s.icon;
              const isActive = step === s.step;
              const isDone = step > s.step;
              return (
                <div key={s.step} className="flex items-center gap-0.5 flex-1">
                  <div className={cn(
                    "flex items-center gap-1 rounded-lg px-1.5 py-1.5 text-[9px] font-medium transition-all flex-1 justify-center",
                    isActive ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      : isDone ? "bg-emerald-500/10 text-emerald-500"
                      : "text-text-muted bg-muted"
                  )}>
                    {isDone ? <CheckCircle2 size={10} /> : <StIcon size={10} />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <ChevronRight size={8} className="text-text-muted shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            {/* ── STEP 1: Material Selection ── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 flex items-center gap-3">
                  <Package size={16} className="text-blue-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-blue-400">Paso 1 — Seleccionar Materiales</p>
                    <p className="text-[9px] text-text-muted">Selecciona los materiales a traspasar y define las cantidades.</p>
                  </div>
                  {items.length > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-blue-500 tabular-nums">{items.length}</p>
                      <p className="text-[9px] text-text-muted">seleccionados</p>
                    </div>
                  )}
                </div>

                {/* ── Selected Items (top) ── */}
                {items.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 size={10} /> Materiales Seleccionados — {items.length} · {totalQty} UN
                    </h4>
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 divide-y divide-emerald-500/10 max-h-[180px] overflow-y-auto">
                      {items.map((item, idx) => (
                        <div key={item.product_id} className="flex items-center gap-3 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-text-primary truncate">{item.product_name}</p>
                            <p className="text-[9px] text-text-muted font-mono">{item.product_sku}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => updateQty(idx, item.quantity - 1)}
                              className="w-5 h-5 rounded flex items-center justify-center text-text-muted hover:bg-muted text-xs font-bold">−</button>
                            <input type="number" min={1} value={item.quantity}
                              onChange={(e) => updateQty(idx, Number(e.target.value))}
                              className="w-14 rounded-md border border-emerald-500/20 bg-background py-1 px-1.5 text-[11px] text-center font-bold text-text-primary tabular-nums focus:border-emerald-500 focus:outline-none" />
                            <button onClick={() => updateQty(idx, item.quantity + 1)}
                              className="w-5 h-5 rounded flex items-center justify-center text-text-muted hover:bg-muted text-xs font-bold">+</button>
                          </div>
                          <button onClick={() => removeItem(idx)}
                            className="rounded-md p-1 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Full Product Catalog ── */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Catálogo de Materiales</h4>
                  {/* Search + Count */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input type="text" placeholder="Filtrar por nombre o SKU..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-blue-500 focus:outline-none" />
                    </div>
                    <span className="text-[9px] text-text-muted shrink-0 tabular-nums">{filteredProducts.length} materiales</span>
                  </div>

                  {/* Table Header */}
                  <div className="grid grid-cols-[1fr_70px_minmax(0,1fr)_44px] gap-2 px-3 py-1.5 text-[9px] font-semibold text-text-muted uppercase tracking-wider">
                    <span>Material</span>
                    <span className="text-center">SKU</span>
                    <span>Stock por Almacén</span>
                    <span className="text-center"></span>
                  </div>

                  {/* Product List */}
                  <div className="rounded-xl border border-border divide-y divide-border max-h-[320px] overflow-y-auto">
                    {loadingStock && (
                      <div className="flex items-center justify-center py-6 gap-2">
                        <Loader2 size={14} className="animate-spin text-blue-500" />
                        <span className="text-xs text-text-muted">Cargando inventario...</span>
                      </div>
                    )}
                    {!loadingStock && filteredProducts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-text-muted">
                        <Search size={20} className="mb-2 opacity-30" />
                        <p className="text-xs">No se encontraron materiales</p>
                      </div>
                    ) : !loadingStock && filteredProducts.map((p) => {
                      const isSelected = items.some((it) => it.product_id === p.id);
                      const productStock = stockByProduct[p.id] || [];
                      const totalProductStock = productStock.reduce((s, w) => s + w.total_stock, 0);
                      return (
                        <button key={p.id}
                          onClick={() => {
                            if (isSelected) {
                              const idx = items.findIndex((it) => it.product_id === p.id);
                              if (idx !== -1) removeItem(idx);
                            } else {
                              addProduct(p);
                            }
                          }}
                          className={cn(
                            "w-full grid grid-cols-[1fr_70px_minmax(0,1fr)_44px] gap-2 items-center px-3 py-2 text-left transition-colors",
                            isSelected
                              ? "bg-blue-500/5 hover:bg-blue-500/10"
                              : "hover:bg-muted/50"
                          )}>
                          <div className="min-w-0">
                            <p className={cn("text-[11px] font-medium truncate", isSelected ? "text-blue-400" : "text-text-primary")}>{p.name}</p>
                          </div>
                          <span className="text-[8px] text-text-muted font-mono text-center">{p.sku}</span>
                          <div className="flex flex-wrap gap-1 min-w-0">
                            {productStock.length > 0 ? productStock.map((ws) => {
                              // Short warehouse name
                              const shortName = ws.warehouse_name.length > 12 ? ws.warehouse_name.slice(0, 12) + "…" : ws.warehouse_name;
                              return (
                                <span key={ws.warehouse_id}
                                  className="inline-flex items-center gap-0.5 text-[7px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
                                  title={`${ws.warehouse_name}: ${ws.total_stock} UN`}>
                                  <Warehouse size={7} className="shrink-0" />
                                  {shortName}: <span className="font-bold tabular-nums">{ws.total_stock}</span>
                                </span>
                              );
                            }) : (
                              <span className="text-[8px] text-text-muted/50 italic">Sin stock</span>
                            )}
                            {totalProductStock > 0 && productStock.length > 1 && (
                              <span className="text-[7px] font-bold text-blue-500 tabular-nums px-1">= {totalProductStock}</span>
                            )}
                          </div>
                          <div className="flex justify-center">
                            {isSelected ? (
                              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500">
                                <CheckCircle2 size={12} className="text-white" />
                              </span>
                            ) : (
                              <span className="flex h-5 w-5 items-center justify-center rounded-md border border-border text-text-muted hover:border-blue-500/50 hover:text-blue-500 transition-colors">
                                <Package size={10} />
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] text-text-muted">
                    {items.length > 0 ? `${items.length} materiales · ${totalQty} unidades` : "Selecciona al menos un material"}
                  </span>
                  <button onClick={() => setStep(2)} disabled={items.length === 0}
                    className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 transition-colors disabled:opacity-40">
                    Seleccionar Origen <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: Source Warehouse ── */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 flex items-center gap-3">
                  <Warehouse size={16} className="text-blue-500 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-blue-400">Paso 2 — Almacén de Origen</p>
                    <p className="text-[9px] text-text-muted">Selecciona de qué almacén se extraerán los {items.length} materiales ({totalQty} UN).</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider">¿De qué almacén sale el material?</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {warehouses.map((w) => (
                      <button key={w.id} onClick={() => setFromWarehouseId(w.id)}
                        className={cn("rounded-xl border p-3 text-left transition-all",
                          fromWarehouseId === w.id ? "border-blue-500 bg-blue-500/10" : "border-border bg-background hover:border-blue-500/40")}>
                        <div className="flex items-center gap-2">
                          <Warehouse size={14} className={fromWarehouseId === w.id ? "text-blue-500" : "text-text-muted"} />
                          <span className={cn("text-xs font-medium", fromWarehouseId === w.id ? "text-blue-400" : "text-text-primary")}>{w.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Prioridad</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background py-2 px-3 text-xs text-text-primary focus:border-blue-500 focus:outline-none">
                      <option value="low">Baja</option><option value="medium">Media</option>
                      <option value="high">Alta</option><option value="urgent">Urgente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Motivo</label>
                    <select value={reason} onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background py-2 px-3 text-xs text-text-primary focus:border-blue-500 focus:outline-none">
                      {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors">
                    <ChevronLeft size={14} /> Materiales
                  </button>
                  <button onClick={() => setStep(3)} disabled={!fromWarehouseId}
                    className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 transition-colors disabled:opacity-40">
                    Picking de Salida <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: Picking (AI + Manual + 3D) ── */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-2.5">
                  <Warehouse className="w-4 h-4 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-blue-400 uppercase tracking-widest font-bold">Picking desde</p>
                    <p className="text-sm font-semibold text-text-primary">{fromWh?.name || "Almacén"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[9px] text-text-muted">Items</p>
                    <p className="text-sm font-bold text-blue-400">{items.length}</p>
                  </div>
                </div>

                <div className="grid grid-cols-[220px_1fr] gap-4">
                  {/* Left: Item list */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">Items a extraer</h4>
                    {items.map((item, idx) => {
                      const hasPick = (sourcePicks[item.product_id] || []).length > 0;
                      return (
                        <button key={idx} onClick={() => { setActivePickIdx(idx); setPick3DIdx(null); }}
                          className={cn("w-full text-left p-3 rounded-xl border transition-all text-sm",
                            activePickIdx === idx ? "border-blue-500/50 bg-blue-500/5" : "border-border hover:bg-surface/50")}>
                          <p className="font-medium text-text-primary truncate">{item.product_name}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-text-muted">{item.quantity} UN</span>
                            {hasPick ? (
                              <span className="text-[10px] text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Asignado</span>
                            ) : (
                              <span className="text-[10px] text-amber-500">Sin asignar</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Right: AI Suggestions / Manual */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        {items[activePickIdx]?.product_name || "Seleccionar item"}
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setPickViewMode("suggestions"); setPick3DIdx(null); setPickManualRack(null); }}
                          className={cn("text-[9px] px-2.5 py-1 rounded-full font-medium transition-colors",
                            pickViewMode === "suggestions" ? "bg-indigo-500/10 text-indigo-500" : "text-text-muted hover:text-text-primary")}>
                          Sugerencias IA
                        </button>
                        <button onClick={() => { setPickViewMode("manual"); setPick3DIdx(null); }}
                          className={cn("text-[9px] px-2.5 py-1 rounded-full font-medium transition-colors",
                            pickViewMode === "manual" ? "bg-blue-500/10 text-blue-500" : "text-text-muted hover:text-text-primary")}>
                          Selección Manual
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2 mb-3">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <p className="text-[9px] text-text-muted">
                        {pickViewMode === "suggestions"
                          ? "Propuesta FEFO/FIFO — Selecciona una sugerencia para ver la ubicación en 3D"
                          : "Selección manual — Elige rack y posición ocupada"}
                      </p>
                    </div>

                    {pickViewMode === "manual" ? (
                      <div className="space-y-3">
                        <RackPositionGrid warehouseId={fromWarehouseId}
                          onSelectPosition={() => {}}
                          onRackSelect={(rc) => setPickManualRack(rc)} />
                        {pickManualRack && (
                          <div className="rounded-xl border border-blue-500/20 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/5 border-b border-blue-500/15">
                              <Box className="w-3 h-3 text-blue-400" />
                              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                                Vista 3D — {fromWh?.name} → {pickManualRack}
                              </span>
                            </div>
                            <Suspense fallback={<div className="h-[220px] bg-[#0d0f1e] flex items-center justify-center"><Loader2 className="w-4 h-4 text-blue-500 animate-spin" /></div>}>
                              <PutawaySelector3D warehouseId={fromWarehouseId}
                                warehouseName={`${fromWh?.name} → ${pickManualRack}`}
                                suggestedPositions={[{ position_id: "", rack_code: pickManualRack, row_number: 1, column_number: 1 }]}
                                onSelectPosition={(pos) => {
                                  const activeItem = items[activePickIdx];
                                  if (!activeItem) return;
                                  setSourcePicks(prev => ({
                                    ...prev, [activeItem.product_id]: [{ su_id: "", su_code: pos.label, lot_number: "N/A",
                                      available_quantity: activeItem.quantity, suggested_qty: activeItem.quantity,
                                      position_id: pos.id, position_label: pos.label, rack_code: pos.rack_code,
                                      row_number: pos.row, column_number: pos.col, warehouse_name: fromWh?.name || "", reason: "Selección manual" }],
                                  }));
                                }} />
                            </Suspense>
                          </div>
                        )}
                      </div>
                    ) : loadingSources ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                        <span className="ml-3 text-sm text-text-muted">Analizando stock de origen...</span>
                      </div>
                    ) : (() => {
                      const activeItem = items[activePickIdx];
                      const itemPicks = activeItem ? (sourcePicks[activeItem.product_id] || []) : [];
                      if (itemPicks.length === 0) return (
                        <div className="text-center py-8 text-text-muted space-y-3">
                          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm font-medium">Sin stock disponible</p>
                          <p className="text-xs">No hay stock en {fromWh?.name} para este material.</p>
                          <button onClick={() => setPickViewMode("manual")}
                            className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-400 font-medium">
                            <Box className="w-3.5 h-3.5" /> Selección manual
                          </button>
                        </div>
                      );
                      return (
                        <div className="space-y-2">
                          {itemPicks.map((s, idx) => (
                            <div key={idx}>
                              <button onClick={() => setPick3DIdx(prev => prev === idx ? null : idx)}
                                className={cn("w-full text-left rounded-xl border p-3 transition-all",
                                  pick3DIdx === idx ? "border-indigo-500/50 bg-indigo-500/5" : "border-border hover:border-indigo-500/30 hover:bg-surface/50")}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {idx === 0 && <Star size={12} className="text-amber-500" />}
                                    <span className="text-xs font-bold text-emerald-400 font-mono">{s.su_code}</span>
                                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-medium">{s.lot_number}</span>
                                  </div>
                                  <span className="text-xs font-bold text-indigo-500 tabular-nums">{s.suggested_qty} UN</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-[9px] text-text-muted">
                                  <span className="flex items-center gap-0.5"><MapPin size={8} className="text-cyan-500" /> {s.position_label}</span>
                                  <span>Stock: {s.available_quantity} UN</span>
                                </div>
                                <p className="text-[8px] text-amber-500 mt-1">💡 {s.reason}</p>
                              </button>
                              {pick3DIdx === idx && (
                                <div ref={preview3DRef} className="mt-2 rounded-xl border border-indigo-500/20 overflow-hidden">
                                  <MiniWarehouse3D warehouseId={fromWarehouseId} warehouseName={fromWh?.name || ""} contextLabel="Extracción"
                                    highlightedPositions={[{ rack_code: s.rack_code, row_number: s.row_number, column_number: s.column_number, su_code: s.su_code }]} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => setStep(2)} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors">
                    <ChevronLeft size={14} /> Origen
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={handleSaveDraft} disabled={isPending || Object.keys(sourcePicks).length === 0}
                      className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-xs font-medium text-text-primary hover:bg-surface transition-colors disabled:opacity-40">
                      {isPending ? <Loader2 size={12} className="animate-spin" /> : null} Guardar Borrador
                    </button>
                    <button onClick={() => setStep(4)} disabled={Object.keys(sourcePicks).length === 0}
                      className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 transition-colors disabled:opacity-40">
                      Asignar Destino <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 4: Destination Warehouse ── */}
            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-3">
                  <ArrowRight size={16} className="text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-400">Paso 4 — Almacén de Destino</p>
                    <p className="text-[9px] text-text-muted">Material preparado en {fromWh?.name}. ¿A qué almacén se envía?</p>
                  </div>
                </div>

                {/* Route preview */}
                <div className="flex items-center gap-3 text-[11px]">
                  <div className="rounded-lg bg-blue-500/10 px-2.5 py-1.5 text-blue-400 font-medium flex items-center gap-1.5">
                    <Warehouse size={11} /> {fromWh?.name || "Origen"}
                  </div>
                  <ArrowRight size={14} className="text-text-muted" />
                  <div className={cn("rounded-lg px-2.5 py-1.5 font-medium flex items-center gap-1.5",
                    toWarehouseId ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-text-muted")}>
                    <MapPin size={11} /> {toWh?.name || "Seleccionar..."}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider">¿A qué almacén va el material?</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {warehouses.map((w) => (
                      <button key={w.id} onClick={() => setToWarehouseId(w.id)}
                        className={cn("rounded-xl border p-3 text-left transition-all",
                          toWarehouseId === w.id ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-background hover:border-emerald-500/40")}>
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className={toWarehouseId === w.id ? "text-emerald-500" : "text-text-muted"} />
                          <span className={cn("text-xs font-medium", toWarehouseId === w.id ? "text-emerald-400" : "text-text-primary")}>{w.name}</span>
                          {w.id === fromWarehouseId && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Interno</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {fromWarehouseId && toWarehouseId && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className={cn("rounded-xl border p-3 flex items-center gap-3",
                      isInternal ? "border-blue-500/20 bg-blue-500/5" : "border-amber-500/20 bg-amber-500/5")}>
                    <Repeat2 size={14} className={isInternal ? "text-blue-500" : "text-amber-500"} />
                    <div>
                      <p className={cn("text-xs font-bold", isInternal ? "text-blue-400" : "text-amber-400")}>
                        {isInternal ? "Traspaso Interno" : "Traspaso entre Almacenes"}
                      </p>
                      <p className="text-[10px] text-text-muted">{fromWh?.name} → {toWh?.name}</p>
                    </div>
                  </motion.div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => setStep(3)} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors">
                    <ChevronLeft size={14} /> Picking
                  </button>
                  <button onClick={() => setStep(5)} disabled={!toWarehouseId}
                    className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 transition-colors disabled:opacity-40">
                    Ubicar en Destino <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 5: Putaway at Destination ── */}
            {step === 5 && (
              <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
                  <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-emerald-400 uppercase tracking-widest font-bold">Ubicar en</p>
                    <p className="text-sm font-semibold text-text-primary">{toWh?.name || "Destino"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[9px] text-text-muted">Pendientes</p>
                    <p className="text-sm font-bold text-emerald-400">
                      {items.filter(i => !destAssignments.find(a => a.product_id === i.product_id)).length}/{items.length}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-[220px_1fr] gap-4">
                  {/* Left: Items */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">Items a ubicar</h4>
                    {items.map((item, idx) => {
                      const assigned = destAssignments.find(a => a.product_id === item.product_id);
                      return (
                        <button key={idx} onClick={() => { setActiveDestIdx(idx); setDest3DIdx(null); }}
                          className={cn("w-full text-left p-3 rounded-xl border transition-all text-sm",
                            activeDestIdx === idx ? "border-emerald-500/50 bg-emerald-500/5" : "border-border hover:bg-surface/50")}>
                          <p className="font-medium text-text-primary truncate">{item.product_name}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-text-muted">{item.quantity} UN</span>
                            {assigned ? (
                              <span className="text-[10px] text-emerald-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {assigned.position_label}</span>
                            ) : (
                              <span className="text-[10px] text-amber-500">Sin ubicar</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Right: Suggestions / Manual */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                        {items[activeDestIdx]?.product_name || "Seleccionar item"}
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setDestViewMode("suggestions"); setDest3DIdx(null); setDestManualRack(null); }}
                          className={cn("text-[9px] px-2.5 py-1 rounded-full font-medium transition-colors",
                            destViewMode === "suggestions" ? "bg-emerald-500/10 text-emerald-500" : "text-text-muted hover:text-text-primary")}>
                          Sugerencias IA
                        </button>
                        <button onClick={() => { setDestViewMode("manual"); setDest3DIdx(null); }}
                          className={cn("text-[9px] px-2.5 py-1 rounded-full font-medium transition-colors",
                            destViewMode === "manual" ? "bg-indigo-500/10 text-indigo-500" : "text-text-muted hover:text-text-primary")}>
                          Selección Manual
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 mb-3">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <p className="text-[9px] text-text-muted">
                        {destViewMode === "suggestions"
                          ? "Posiciones óptimas sugeridas por el algoritmo de ubicación"
                          : "Selección manual — Elige rack y posición vacía"}
                      </p>
                    </div>

                    {destViewMode === "manual" ? (
                      <div className="space-y-3">
                        <RackPositionGrid warehouseId={toWarehouseId}
                          selectedPositionId={destAssignments.find(a => a.product_id === items[activeDestIdx]?.product_id)?.position_id}
                          onSelectPosition={(pos) => {
                            const activeItem = items[activeDestIdx];
                            if (activeItem) assignDestPosition(activeItem.product_id, pos.id, pos.label);
                          }}
                          onRackSelect={(rc) => setDestManualRack(rc)} />
                        {destManualRack && (
                          <div className="rounded-xl border border-indigo-500/20 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/5 border-b border-indigo-500/15">
                              <Box className="w-3 h-3 text-indigo-400" />
                              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                                Vista 3D — {toWh?.name} → {destManualRack}
                              </span>
                            </div>
                            <Suspense fallback={<div className="h-[220px] bg-[#0d0f1e] flex items-center justify-center"><Loader2 className="w-4 h-4 text-indigo-500 animate-spin" /></div>}>
                              <PutawaySelector3D warehouseId={toWarehouseId}
                                warehouseName={`${toWh?.name} → ${destManualRack}`}
                                suggestedPositions={[{ position_id: "", rack_code: destManualRack, row_number: 1, column_number: 1 }]}
                                selectedPositionId={destAssignments.find(a => a.product_id === items[activeDestIdx]?.product_id)?.position_id}
                                onSelectPosition={(pos) => {
                                  const activeItem = items[activeDestIdx];
                                  if (activeItem) assignDestPosition(activeItem.product_id, pos.id, pos.label);
                                }} />
                            </Suspense>
                          </div>
                        )}
                      </div>
                    ) : loadingDest ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                        <span className="ml-3 text-sm text-text-muted">Calculando mejores posiciones...</span>
                      </div>
                    ) : (() => {
                      const activeItem = items[activeDestIdx];
                      const itemSuggs = activeItem ? (destSuggestions[activeItem.product_id] || []) : [];
                      if (itemSuggs.length === 0) return (
                        <div className="text-center py-8 text-text-muted space-y-3">
                          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm font-medium">Sin sugerencias</p>
                          <button onClick={() => setDestViewMode("manual")}
                            className="inline-flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-400 font-medium">
                            <Box className="w-3.5 h-3.5" /> Selección manual
                          </button>
                        </div>
                      );
                      return (
                        <div className="space-y-2">
                          {itemSuggs.map((s, idx) => (
                            <div key={idx}>
                              <button onClick={() => {
                                if (activeItem) assignDestPosition(activeItem.product_id, s.position_id, s.position_label);
                                setDest3DIdx(prev => prev === idx ? null : idx);
                              }}
                                className={cn("w-full text-left rounded-xl border p-3 transition-all",
                                  dest3DIdx === idx ? "border-emerald-500/50 bg-emerald-500/5"
                                    : destAssignments.find(a => a.position_id === s.position_id) ? "border-emerald-500/30 bg-emerald-500/5"
                                    : "border-border hover:border-emerald-500/30 hover:bg-surface/50")}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {idx === 0 && <Star size={12} className="text-amber-500" />}
                                    <span className="text-xs font-bold text-text-primary">{s.position_label}</span>
                                    <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full font-medium",
                                      s.score >= 90 ? "bg-emerald-500/10 text-emerald-500" : s.score >= 70 ? "bg-amber-500/10 text-amber-500" : "bg-muted text-text-muted")}>
                                      {s.score}/100
                                    </span>
                                  </div>
                                  {destAssignments.find(a => a.position_id === s.position_id) && <CheckCircle2 size={14} className="text-emerald-500" />}
                                </div>
                                <p className="text-[9px] text-text-muted mt-1">📍 {s.reason}</p>
                                <p className="text-[8px] text-text-muted">Rack {s.rack_code} · Fila {s.row_number} · Col {s.column_number}</p>
                              </button>
                              {dest3DIdx === idx && (
                                <div className="mt-2 rounded-xl border border-emerald-500/20 overflow-hidden">
                                  <MiniWarehouse3D warehouseId={toWarehouseId} warehouseName={toWh?.name || ""}
                                    contextLabel="Ubicación destino"
                                    highlightedPositions={[{ rack_code: s.rack_code, row_number: s.row_number, column_number: s.column_number, su_code: s.position_label }]} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => setStep(4)} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors">
                    <ChevronLeft size={14} /> Destino
                  </button>
                  <button onClick={() => { if (!result?.id) { handleSaveDraft(); } setStep(6); }}
                    disabled={destAssignments.length === 0}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-40">
                    Revisar y Confirmar <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 6: Confirm + Lifecycle ── */}
            {step === 6 && (() => {
              const transferId = result?.id;
              const transferStatus = result?.status || "pending";

              const handleStartTransit = async () => {
                if (!transferId) return;
                try {
                  // If still draft, assign destination first
                  if (transferStatus === "draft" && toWarehouseId) {
                    await fetch("/api/wms/operations", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "assign_transfer_destination", id: transferId, to_warehouse_id: toWarehouseId, destination_positions: destAssignments }),
                    });
                  }
                  const resp = await fetch("/api/wms/operations", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "start_transfer", id: transferId }),
                  });
                  const res = await resp.json();
                  if (res.success) {
                    setResult(prev => prev ? { ...prev, status: "in_transit", message: `Traspaso en tránsito hacia ${toWh?.name}` } : prev);
                    toast.success("En tránsito", { description: `Material en camino a ${toWh?.name}` });
                  } else { toast.error("Error", { description: res.message }); }
                } catch { toast.error("Error de conexión"); }
              };

              const handleConfirmReceipt = async () => {
                if (!transferId) return;
                try {
                  const resp = await fetch("/api/wms/operations", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "confirm_transfer", id: transferId, destination_positions: destAssignments.map(a => ({ product_id: a.product_id, position_id: a.position_id, position_label: a.position_label })) }),
                  });
                  const res = await resp.json();
                  if (res.success) {
                    setResult(prev => prev ? { ...prev, status: "posted", message: `Traspaso confirmado — ${totalQty} UN recibidas en ${toWh?.name}` } : prev);
                    toast.success("Confirmado", { description: `${totalQty} UN en ${toWh?.name}` });
                  } else { toast.error("Error", { description: res.message }); }
                } catch { toast.error("Error de conexión"); }
              };

              return (
                <motion.div key="step6" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-6 space-y-5">

                  {/* Status Progress */}
                  <div className="flex items-center gap-2 w-full max-w-sm">
                    {[
                      { label: "Registrado", done: true },
                      { label: "Destino", done: !!toWarehouseId },
                      { label: "En Tránsito", done: transferStatus === "in_transit" || transferStatus === "posted" },
                      { label: "Confirmado", done: transferStatus === "posted" },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-1 flex-1">
                        <div className={cn("flex-1 h-1.5 rounded-full transition-all", s.done ? "bg-emerald-500" : "bg-muted")} />
                        <span className={cn("text-[8px] font-medium whitespace-nowrap", s.done ? "text-emerald-400" : "text-text-muted")}>{s.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Icon */}
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}
                    className={cn("flex h-16 w-16 items-center justify-center rounded-full",
                      transferStatus === "posted" ? "bg-emerald-500/10" : "bg-blue-500/10")}>
                    {transferStatus === "posted" ? <CheckCircle2 size={32} className="text-emerald-500" />
                      : transferStatus === "in_transit" ? <Repeat2 size={32} className="text-blue-500 animate-spin" style={{ animationDuration: "3s" }} />
                      : <Send size={32} className="text-blue-400" />}
                  </motion.div>

                  <h3 className="text-lg font-bold text-text-primary">
                    {transferStatus === "posted" ? "Traspaso Confirmado" : transferStatus === "in_transit" ? "En Tránsito" : "Traspaso Registrado"}
                  </h3>
                  <p className="text-xs text-text-secondary text-center max-w-sm">{result?.message || `${totalQty} UN de ${fromWh?.name} a ${toWh?.name}`}</p>

                  {/* Route */}
                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    <span className="font-medium text-blue-400">{fromWh?.name}</span>
                    <ArrowRight size={10} />
                    <span className="font-medium text-emerald-400">{toWh?.name || "Sin destino"}</span>
                    <span>· {totalQty} UN · {items.length} materiales</span>
                  </div>

                  {/* Summary KPIs */}
                  <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
                    <div className="p-2 rounded-xl bg-blue-500/5 border border-blue-500/20 text-center">
                      <p className="text-lg font-bold text-blue-500 tabular-nums">{items.length}</p>
                      <p className="text-[9px] text-text-muted">Materiales</p>
                    </div>
                    <div className="p-2 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-center">
                      <p className="text-lg font-bold text-indigo-500 tabular-nums">{totalQty}</p>
                      <p className="text-[9px] text-text-muted">Unidades</p>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                      <p className="text-lg font-bold text-emerald-500 tabular-nums">{destAssignments.length}</p>
                      <p className="text-[9px] text-text-muted">Ubicadas</p>
                    </div>
                  </div>

                  {/* 3D Views Side by Side */}
                  {fromWarehouseId && (
                    <div className={cn("grid gap-3 w-full", toWarehouseId ? "grid-cols-2" : "grid-cols-1")}>
                      <div className="space-y-1">
                        <p className="text-[9px] font-semibold text-blue-500 flex items-center gap-1"><Warehouse size={9} /> Origen</p>
                        <div className="rounded-xl border border-blue-500/20 overflow-hidden">
                          <MiniWarehouse3D warehouseId={fromWarehouseId} warehouseName={fromWh?.name || ""} contextLabel="Salida"
                            highlightedPositions={sourceHighlightedPositions} />
                        </div>
                      </div>
                      {toWarehouseId && (
                        <div className="space-y-1">
                          <p className="text-[9px] font-semibold text-emerald-500 flex items-center gap-1"><MapPin size={9} /> Destino</p>
                          <div className="rounded-xl border border-emerald-500/20 overflow-hidden">
                            <MiniWarehouse3D warehouseId={toWarehouseId} warehouseName={toWh?.name || ""}
                              contextLabel="Recepción" highlightedPositions={[]} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    {(transferStatus === "draft" || transferStatus === "pending") && toWarehouseId && (
                      <button onClick={handleStartTransit}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors">
                        <Send size={14} /> Iniciar Tránsito
                      </button>
                    )}
                    {transferStatus === "in_transit" && (
                      <button onClick={handleConfirmReceipt}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors">
                        <CheckCircle2 size={14} /> Confirmar Recepción
                      </button>
                    )}
                    {!result?.id && (
                      <button onClick={handleFullSubmit} disabled={isPending}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        {isPending ? "Procesando..." : "Ejecutar Traspaso"}
                      </button>
                    )}
                    <button onClick={handleClose}
                      className="rounded-xl bg-muted px-4 py-2 text-xs font-medium text-text-primary hover:bg-surface transition-colors">
                      {transferStatus === "posted" ? "Cerrar" : "Cerrar (continuar después)"}
                    </button>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
