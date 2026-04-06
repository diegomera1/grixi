"use client";

import { useState, useTransition, useEffect, useRef, lazy, Suspense } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowDownToLine, ChevronRight, ChevronLeft, ChevronDown, Package,
  Search, CheckCircle2, AlertCircle, Loader2, Sparkles,
  MapPin, FileText, ClipboardCheck, ShieldCheck,
  Star, Box, Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RackPositionGrid } from "./rack-position-grid";
import type { PurchaseOrderForGR, PutawaySuggestion } from "../types";

// Dynamic import for 3D component (heavy — Three.js)
const PutawaySelector3D = lazy(() => import("./putaway-selector-3d"));

// ── Types ─────────────────────────────────────────────
type WizardStep = 1 | 2 | 3 | 4;

type GRWizardProps = {
  open: boolean;
  onClose: () => void;
  warehouseId?: string;
  warehouses: { id: string; name: string }[];
};

type ItemVerification = {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_rejected: number;
  rejection_reason: string;
  lot_number: string;
  quality_ok: boolean;
  position_id: string;
  position_label: string;
  su_type: 'palet' | 'tina' | 'caja' | 'contenedor';
  su_code: string;
};

const SU_TYPE_OPTIONS = [
  { value: 'palet', label: 'Palet', maxWeight: '1000 kg', icon: '📦' },
  { value: 'tina', label: 'Tina', maxWeight: '200 kg', icon: '🗑️' },
  { value: 'caja', label: 'Caja', maxWeight: '50 kg', icon: '📋' },
  { value: 'contenedor', label: 'Contenedor', maxWeight: '2000 kg', icon: '🏗️' },
] as const;

const STEPS: { step: WizardStep; label: string; icon: typeof Package }[] = [
  { step: 1, label: "Seleccionar OC", icon: FileText },
  { step: 2, label: "Verificar Cantidades", icon: ClipboardCheck },
  { step: 3, label: "UA y Ubicación", icon: MapPin },
  { step: 4, label: "Contabilizar", icon: CheckCircle2 },
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

// ── Main Component ────────────────────────────────────
export function GoodsReceiptWizard({ open, onClose, warehouseId, warehouses }: GRWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [isPending, startTransition] = useTransition();

  // Step 1 state
  const [pendingPOs, setPendingPOs] = useState<PurchaseOrderForGR[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderForGR | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(warehouseId || "");

  // Step 2 state
  const [items, setItems] = useState<ItemVerification[]>([]);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [carrier, setCarrier] = useState("");
  const [plateNumber, setPlateNumber] = useState("");

  // Step 3 state
  const [suggestions, setSuggestions] = useState<Record<string, PutawaySuggestion[]>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [activeItemIdx, setActiveItemIdx] = useState(0);

  // Step 4 state
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load POs on mount — component only mounts when wizard opens
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingPOs(true);
      try {
        const params = new URLSearchParams();
        if (warehouseId) params.set("warehouseId", warehouseId);
        const resp = await fetch(`/api/wms/pending-pos?${params.toString()}`);
        const res = await resp.json();
        if (!cancelled && res.success) setPendingPOs(res.data);
      } catch (err) {
        console.error("[GR Wizard] Error loading POs:", err);
      }
      if (!cancelled) setLoadingPOs(false);
    }
    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter POs
  const filteredPOs = pendingPOs.filter(po => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return po.po_number.toLowerCase().includes(q)
      || po.vendor_name?.toLowerCase().includes(q)
      || po.sap_po_number?.toLowerCase().includes(q);
  });

  // Select PO → populate items
  const handleSelectPO = (po: PurchaseOrderForGR) => {
    setSelectedPO(po);
    setItems(po.items.map(i => {
      const qty = Math.max(0, i.quantity_ordered - i.quantity_received);
      // Smart UA type suggestion based on quantity
      const suType = qty >= 500 ? 'palet' : qty >= 50 ? 'tina' : 'caja';
      return {
        product_id: i.product_id,
        product_name: i.product_name,
        product_sku: i.product_sku,
        quantity_ordered: i.quantity_ordered,
        quantity_received: qty,
        quantity_rejected: 0,
        rejection_reason: "",
        lot_number: "",
        quality_ok: true,
        position_id: "",
        position_label: "",
        su_type: suType as ItemVerification['su_type'],
        su_code: "", // Auto-generated on post
      };
    }));
    if (po.warehouse_id) setSelectedWarehouseId(po.warehouse_id);
    setStep(2);
  };

  // Load putaway suggestions for all items (via API route)
  const loadSuggestions = async () => {
    if (!selectedWarehouseId) {
      console.warn("[GR Wizard] No warehouseId set — skipping suggestions");
      return;
    }
    setLoadingSuggestions(true);
    const newSuggestions: Record<string, PutawaySuggestion[]> = {};
    for (const item of items) {
      if (item.quantity_received > 0) {
        try {
          const params = new URLSearchParams({
            warehouseId: selectedWarehouseId,
            productId: item.product_id,
            quantity: String(item.quantity_received),
          });
          console.log("[GR Wizard] Fetching suggestions:", { warehouseId: selectedWarehouseId, productId: item.product_id, product: item.product_name });
          const resp = await fetch(`/api/wms/putaway-suggestions?${params.toString()}`);
          const res = await resp.json();
          console.log("[GR Wizard] Suggestions response:", { product: item.product_name, success: res.success, count: res.data?.length || 0 });
          if (res.success && res.data?.length > 0) {
            newSuggestions[item.product_id] = res.data;
          }
        } catch (err) {
          console.error("[GR Wizard] Error fetching putaway suggestions:", err);
        }
      }
    }
    console.log("[GR Wizard] Total suggestions loaded:", Object.keys(newSuggestions).length);
    setSuggestions(newSuggestions);
    setLoadingSuggestions(false);
  };

  // Submit GR (via API route)
  const handleSubmit = () => {
    startTransition(async () => {
      try {
        const resp = await fetch("/api/wms/operations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_goods_receipt",
            warehouse_id: selectedWarehouseId,
            po_id: selectedPO!.id,
            delivery_note: deliveryNote || undefined,
            carrier: carrier || undefined,
            plate_number: plateNumber || undefined,
            quality_checked: items.every(i => i.quality_ok),
            items: items.filter(i => i.quantity_received > 0).map(i => ({
              product_id: i.product_id,
              quantity_received: i.quantity_received,
              quantity_rejected: i.quantity_rejected,
              rejection_reason: i.rejection_reason || undefined,
              lot_number: i.lot_number || undefined,
              position_id: i.position_id || undefined,
              su_type: i.su_type,
            })),
          }),
        });
        const res = await resp.json();
        setResult(res);
        if (res.success && res.id) {
          // Auto-post
          await fetch("/api/wms/operations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "post_goods_receipt", id: res.id }),
          });
          toast.success("Entrada contabilizada", {
            description: `${items.reduce((s, i) => s + i.quantity_received, 0)} unidades recibidas — ${selectedPO?.po_number}`,
          });
        }
      } catch (err) {
        console.error("[GR Wizard] Error submitting:", err);
        setResult({ success: false, message: "Error al contabilizar" });
        toast.error("Error al contabilizar entrada");
      }
    });
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-4xl max-h-[90vh] bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-emerald-500/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <ArrowDownToLine className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Nueva Entrada de Mercancía</h2>
                <p className="text-xs text-text-muted">
                  {selectedPO ? `OC: ${selectedPO.po_number} — ${selectedPO.vendor_name}` : "Seleccione una Orden de Compra"}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface transition-colors">
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-1 px-6 py-3 border-b border-border bg-surface/50">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isActive = s.step === step;
              const isCompleted = s.step < step;
              return (
                <div key={s.step} className="flex items-center">
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    isActive && "bg-emerald-500/10 text-emerald-500",
                    isCompleted && "text-emerald-400",
                    !isActive && !isCompleted && "text-text-muted"
                  )}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-text-muted/40 mx-1" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <Step1SelectPO
                  key="step1"
                  pos={filteredPOs}
                  loading={loadingPOs}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onSelect={handleSelectPO}
                  selectedWarehouseId={selectedWarehouseId}
                  onWarehouseChange={(id) => { setSelectedWarehouseId(id); }}
                  warehouses={warehouses}
                />
              )}
              {step === 2 && (
                <Step2VerifyQuantities
                  key="step2"
                  items={items}
                  onItemsChange={setItems}
                  deliveryNote={deliveryNote}
                  onDeliveryNoteChange={setDeliveryNote}
                  carrier={carrier}
                  onCarrierChange={setCarrier}
                  plateNumber={plateNumber}
                  onPlateNumberChange={setPlateNumber}
                />
              )}
              {step === 3 && (
                <Step3AssignPosition
                  key="step3"
                  items={items}
                  onItemsChange={setItems}
                  suggestions={suggestions}
                  loading={loadingSuggestions}
                  activeItemIdx={activeItemIdx}
                  onActiveItemChange={setActiveItemIdx}
                  warehouseId={selectedWarehouseId}
                  warehouseName={warehouses.find(w => w.id === selectedWarehouseId)?.name || "Almacén"}
                  warehouses={warehouses}
                  onWarehouseChange={(id: string) => { setSelectedWarehouseId(id); loadSuggestions(); }}
                />
              )}
              {step === 4 && (
                <Step4Review
                  key="step4"
                  po={selectedPO!}
                  items={items}
                  deliveryNote={deliveryNote}
                  carrier={carrier}
                  plateNumber={plateNumber}
                  result={result}
                  isPending={isPending}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface/50">
            <button
              onClick={() => step > 1 ? setStep((step - 1) as WizardStep) : onClose()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-text-muted hover:bg-surface transition-colors"
              disabled={isPending}
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 1 ? "Cancelar" : "Anterior"}
            </button>

            {result?.success ? (
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Cerrar
              </button>
            ) : step < 4 ? (
              <button
                onClick={() => {
                  if (step === 2) { loadSuggestions(); }
                  setStep((step + 1) as WizardStep);
                }}
                disabled={step === 1 && !selectedPO}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  step === 1 && !selectedPO
                    ? "bg-surface text-text-muted cursor-not-allowed"
                    : "bg-emerald-500 text-white hover:bg-emerald-600"
                )}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Contabilizar Entrada
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ══════════════════════════════════════════════════════
// STEP 1: Select Purchase Order
// ══════════════════════════════════════════════════════
function Step1SelectPO({
  pos, loading, searchQuery, onSearchChange, onSelect,
  selectedWarehouseId, onWarehouseChange, warehouses,
}: {
  pos: PurchaseOrderForGR[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (po: PurchaseOrderForGR) => void;
  selectedWarehouseId: string;
  onWarehouseChange: (id: string) => void;
  warehouses: { id: string; name: string }[];
}) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por # OC, proveedor o SAP..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
        <select
          value={selectedWarehouseId}
          onChange={(e) => onWarehouseChange(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-surface border border-border text-sm text-text-primary focus:outline-none"
        >
          <option value="">Todos los almacenes</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          <span className="ml-3 text-sm text-text-muted">Cargando órdenes de compra...</span>
        </div>
      ) : pos.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay órdenes de compra pendientes de recepción</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {pos.map((po) => {
            const pri = PRIORITY_CFG[po.priority] || PRIORITY_CFG.medium;
            const receivedPct = po.items.length > 0
              ? Math.round(po.items.reduce((a, i) => a + (i.quantity_received / Math.max(1, i.quantity_ordered)), 0) / po.items.length * 100)
              : 0;
            return (
              <motion.button
                key={po.id}
                onClick={() => onSelect(po)}
                className="w-full text-left p-4 rounded-xl border border-border bg-background hover:bg-surface/50 hover:border-emerald-500/30 transition-all group"
                whileHover={{ scale: 1.005 }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{po.po_number}</span>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", pri.color, pri.bg)}>{pri.label}</span>
                      {po.status === "partially_received" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 font-medium">Parcial</span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">{po.vendor_name}</p>
                    {po.sap_po_number && <p className="text-[10px] text-text-muted font-mono">SAP: {po.sap_po_number}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-text-primary">{formatCurrency(po.total)}</p>
                    <p className="text-[10px] text-text-muted">{po.item_count} items</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-[10px] text-text-muted">
                    <span>📅 {formatDate(po.expected_delivery)}</span>
                    <span>🏭 {po.warehouse_name || "Sin asignar"}</span>
                  </div>
                  {receivedPct > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-surface overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${receivedPct}%` }} />
                      </div>
                      <span className="text-[10px] text-emerald-500 font-medium">{receivedPct}%</span>
                    </div>
                  )}
                </div>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════
// STEP 2: Verify Quantities
// ══════════════════════════════════════════════════════
function Step2VerifyQuantities({
  items, onItemsChange, deliveryNote, onDeliveryNoteChange,
  carrier, onCarrierChange, plateNumber, onPlateNumberChange,
}: {
  items: ItemVerification[];
  onItemsChange: (items: ItemVerification[]) => void;
  deliveryNote: string;
  onDeliveryNoteChange: (v: string) => void;
  carrier: string;
  onCarrierChange: (v: string) => void;
  plateNumber: string;
  onPlateNumberChange: (v: string) => void;
}) {
  const [generatingLots, setGeneratingLots] = useState(false);

  const updateItem = (idx: number, patch: Partial<ItemVerification>) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onItemsChange(newItems);
  };

  // Auto-generate lot numbers for all items that don't have one
  const handleGenerateAllLots = async () => {
    const itemsNeedingLots = items.filter(i => !i.lot_number && i.quantity_received > 0);
    if (itemsNeedingLots.length === 0) return;
    setGeneratingLots(true);
    try {
      const resp = await fetch(`/api/wms/generate-lot?count=${itemsNeedingLots.length}`);
      const res = await resp.json();
      if (res.success && res.lots) {
        const newItems = [...items];
        let lotIdx = 0;
        for (let i = 0; i < newItems.length; i++) {
          if (!newItems[i].lot_number && newItems[i].quantity_received > 0 && lotIdx < res.lots.length) {
            newItems[i] = { ...newItems[i], lot_number: res.lots[lotIdx] };
            lotIdx++;
          }
        }
        onItemsChange(newItems);
        toast.success(`${lotIdx} lotes generados automáticamente`);
      }
    } catch { toast.error("Error al generar lotes"); }
    setGeneratingLots(false);
  };

  // Auto-generate lot for a single item
  const handleGenerateSingleLot = async (idx: number) => {
    try {
      const resp = await fetch("/api/wms/generate-lot?count=1");
      const res = await resp.json();
      if (res.success && res.lots?.[0]) {
        updateItem(idx, { lot_number: res.lots[0] });
      }
    } catch { toast.error("Error al generar lote"); }
  };

  const allHaveLots = items.every(i => i.lot_number || i.quantity_received === 0);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      {/* Transport Info */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div>
          <label className="text-[10px] text-text-muted font-medium mb-1 block">Nota de Entrega</label>
          <input
            type="text"
            placeholder="# Guía de remisión"
            value={deliveryNote}
            onChange={(e) => onDeliveryNoteChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted font-medium mb-1 block">Transportista</label>
          <input
            type="text"
            placeholder="Nombre transportista"
            value={carrier}
            onChange={(e) => onCarrierChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted font-medium mb-1 block">Placa Vehículo</label>
          <input
            type="text"
            placeholder="ABC-1234"
            value={plateNumber}
            onChange={(e) => onPlateNumberChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>
      </div>

      {/* Auto-Lot Generation Banner */}
      <div className="flex items-center justify-between mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-emerald-500" />
          <div>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Lotes Automáticos</p>
            <p className="text-[9px] text-text-muted">Formato: LOT-YYYYMMDD-SEQ · Editable después de generar</p>
          </div>
        </div>
        <button
          onClick={handleGenerateAllLots}
          disabled={generatingLots || allHaveLots}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all",
            allHaveLots
              ? "bg-emerald-500/10 text-emerald-400 cursor-default"
              : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm"
          )}
        >
          {generatingLots ? <Loader2 size={11} className="animate-spin" /> : allHaveLots ? <CheckCircle2 size={11} /> : <Sparkles size={11} />}
          {generatingLots ? "Generando..." : allHaveLots ? "Todos asignados" : "Generar Todos"}
        </button>
      </div>

      {/* Items Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-0 bg-surface px-4 py-2 text-[10px] font-medium text-text-muted uppercase tracking-wider">
          <span>Material</span>
          <span className="text-center">Ordenado</span>
          <span className="text-center">Recibido</span>
          <span className="text-center">Rechazado</span>
          <span className="text-center">QC</span>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="border-t border-border">
            <div className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-0 px-4 py-3 items-center">
              <div>
                <p className="text-sm font-medium text-text-primary">{item.product_name}</p>
                <p className="text-[10px] text-text-muted font-mono">{item.product_sku}</p>
              </div>
              <div className="text-center">
                <span className="text-sm text-text-muted tabular-nums">{item.quantity_ordered}</span>
              </div>
              <div className="flex justify-center">
                <input
                  type="number"
                  min={0}
                  max={item.quantity_ordered}
                  value={item.quantity_received}
                  onChange={(e) => updateItem(idx, { quantity_received: Math.max(0, Number(e.target.value)) })}
                  className="w-16 px-2 py-1 rounded-md bg-surface border border-border text-sm text-center text-text-primary tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>
              <div className="flex justify-center">
                <input
                  type="number"
                  min={0}
                  value={item.quantity_rejected}
                  onChange={(e) => updateItem(idx, { quantity_rejected: Math.max(0, Number(e.target.value)) })}
                  className="w-16 px-2 py-1 rounded-md bg-surface border border-border text-sm text-center text-text-primary tabular-nums focus:outline-none focus:ring-1 focus:ring-rose-500/30"
                />
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => updateItem(idx, { quality_ok: !item.quality_ok })}
                  className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                    item.quality_ok ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                  )}
                >
                  {item.quality_ok ? <ShieldCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {/* Rejection reason */}
            {item.quantity_rejected > 0 && (
              <div className="px-4 pb-3">
                <input
                  type="text"
                  placeholder="Motivo de rechazo..."
                  value={item.rejection_reason}
                  onChange={(e) => updateItem(idx, { rejection_reason: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-md bg-rose-500/5 border border-rose-500/20 text-xs text-text-primary placeholder:text-rose-400/50 focus:outline-none"
                />
              </div>
            )}
            {/* Lot number with auto-gen */}
            <div className="px-4 pb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Número de lote"
                  value={item.lot_number}
                  onChange={(e) => updateItem(idx, { lot_number: e.target.value })}
                  className={cn(
                    "w-full px-3 py-1.5 rounded-md text-xs focus:outline-none transition-colors",
                    item.lot_number
                      ? "bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-bold"
                      : "bg-surface border border-border text-text-primary placeholder:text-text-muted"
                  )}
                />
                {item.lot_number && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-emerald-500 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    AUTO
                  </span>
                )}
              </div>
              {!item.lot_number && item.quantity_received > 0 && (
                <button
                  onClick={() => handleGenerateSingleLot(idx)}
                  className="shrink-0 flex items-center gap-1 rounded-md bg-surface border border-border px-2 py-1.5 text-[10px] text-text-muted hover:text-emerald-500 hover:border-emerald-500/30 transition-colors"
                  title="Generar lote automático"
                >
                  <Sparkles size={10} />
                  LOT
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════
// STEP 3: Assign Position (Putaway)
// ══════════════════════════════════════════════════════
function Step3AssignPosition({
  items, onItemsChange, suggestions, loading, activeItemIdx, onActiveItemChange,
  warehouseId, warehouseName, warehouses, onWarehouseChange,
}: {
  items: ItemVerification[];
  onItemsChange: (items: ItemVerification[]) => void;
  suggestions: Record<string, PutawaySuggestion[]>;
  loading: boolean;
  activeItemIdx: number;
  onActiveItemChange: (idx: number) => void;
  warehouseId: string;
  warehouseName: string;
  warehouses: { id: string; name: string }[];
  onWarehouseChange: (id: string) => void;
}) {
  const [viewMode, setViewMode] = useState<"suggestions" | "manual">("suggestions");
  const [expanded3DIdx, setExpanded3DIdx] = useState<number | null>(null);
  const [manualRackCode, setManualRackCode] = useState<string | null>(null);
  const preview3DRef = useRef<HTMLDivElement>(null);
  const activeItem = items[activeItemIdx];
  const itemSuggestions = activeItem ? (suggestions[activeItem.product_id] || []) : [];

  const assignPosition = (productId: string, suggestion: PutawaySuggestion) => {
    const newItems = items.map(i =>
      i.product_id === productId
        ? { ...i, position_id: suggestion.position_id, position_label: suggestion.position_label }
        : i
    );
    onItemsChange(newItems);
  };

  const handleSuggestionClick = (idx: number, suggestion: PutawaySuggestion) => {
    if (activeItem) {
      assignPosition(activeItem.product_id, suggestion);
    }
    setExpanded3DIdx(prev => prev === idx ? null : idx);
    setTimeout(() => {
      preview3DRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 150);
  };

  const handleDirectPositionSelect = (pos: { id: string; label: string }) => {
    if (activeItem) {
      const newItems = items.map(i =>
        i.product_id === activeItem.product_id
          ? { ...i, position_id: pos.id, position_label: pos.label }
          : i
      );
      onItemsChange(newItems);
    }
  };

  const roundQty = (n: number) => Math.round(n * 100) / 100;




  // Enhanced AI justification
  const getEnhancedJustification = (s: PutawaySuggestion, idx: number) => {
    const lines: string[] = [];
    if (idx === 0) lines.push("⭐ Posición óptima seleccionada por el algoritmo de ubicación.");
    if (s.score >= 90) lines.push(`✅ Score ${s.score}/100 — Altamente recomendada.`);
    else if (s.score >= 70) lines.push(`🟡 Score ${s.score}/100 — Alternativa viable.`);
    else lines.push(`⚪ Score ${s.score}/100 — Opción disponible.`);
    lines.push(`📍 ${s.reason}`);
    if (s.row_number <= 2) lines.push("📦 Nivel bajo: acceso rápido para picking frecuente.");
    else if (s.row_number >= 4) lines.push("📦 Nivel alto: ideal para stock de reserva o baja rotación.");
    lines.push(`🏷️ Rack ${s.rack_code} · Fila ${s.row_number} · Columna ${s.column_number}`);
    return lines;
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      {/* ── Warehouse Header + Selector ── */}
      <div className="flex items-center gap-3 mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
        <Warehouse className="w-4 h-4 text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-emerald-400 uppercase tracking-widest font-bold">Almacén destino</p>
          <div className="relative mt-0.5">
            <select
              value={warehouseId}
              onChange={(e) => onWarehouseChange(e.target.value)}
              className="w-full appearance-none bg-transparent text-sm font-semibold text-text-primary pr-6 cursor-pointer focus:outline-none"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] text-text-muted">Items pendientes</p>
          <p className="text-sm font-bold text-emerald-400">{items.filter(i => !i.position_label && i.quantity_received > 0).length}/{items.filter(i => i.quantity_received > 0).length}</p>
        </div>
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-6">
        {/* ── Item List ── */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Items a ubicar</h4>
          {items.filter(i => i.quantity_received > 0).map((item, idx) => (
            <div
              key={idx}
              className={cn(
                "w-full text-left p-3 rounded-xl border transition-all text-sm",
                activeItemIdx === idx
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-border hover:bg-surface/50"
              )}
            >
              <button
                onClick={() => { onActiveItemChange(idx); setExpanded3DIdx(null); }}
                className="w-full text-left"
              >
                <p className="font-medium text-text-primary truncate">{item.product_name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-text-muted">{roundQty(item.quantity_received)} UN</span>
                  {item.position_label ? (
                    <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {item.position_label}
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-500">Sin ubicar</span>
                  )}
                </div>
              </button>
              {/* UA Type selector */}
              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
                {SU_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newItems = [...items];
                      newItems[idx] = { ...newItems[idx], su_type: opt.value };
                      onItemsChange(newItems);
                    }}
                    className={cn(
                      "flex-1 text-[9px] py-1 rounded-md transition-all text-center font-medium",
                      item.su_type === opt.value
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "text-text-muted hover:bg-muted border border-transparent"
                    )}
                    title={`${opt.label} (máx ${opt.maxWeight})`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Right Panel ── */}
        <div>
          {/* Mode Tabs */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              {activeItem?.product_name || "Seleccionar item"}
            </h4>
            <div className="flex items-center gap-1.5">
              {([
                { key: "suggestions" as const, label: "Sugerencias IA", color: "emerald" },
                { key: "manual" as const, label: "Seleccionar Posición", color: "indigo" },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setViewMode(tab.key); setExpanded3DIdx(null); setManualRackCode(null); }}
                  className={cn(
                    "text-[9px] px-2.5 py-1 rounded-full font-medium transition-colors",
                    viewMode === tab.key
                      ? `bg-${tab.color}-500/10 text-${tab.color}-500`
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Strategy badge */}
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 mb-3">
            <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-emerald-400">
                {viewMode === "suggestions" ? "Propuesta GRIXI AI — Zona por Categoría"
                  : "Selección manual — Elige rack y posición"}
              </p>
              <p className="text-[9px] text-text-muted">
                {viewMode === "suggestions"
                  ? "Selecciona una sugerencia para ver su ubicación 3D en el almacén"
                  : "Haz click en un rack del mapa para ver sus posiciones en 3D"
                }
              </p>
            </div>
          </div>

          {/* ═══ MANUAL MODE: Rack Map + 3D ═══ */}
          {viewMode === "manual" ? (
            <div className="space-y-3">
              {/* Rack Position Grid with top-down map */}
              <RackPositionGrid
                warehouseId={warehouseId}
                selectedPositionId={activeItem?.position_id}
                suggestedPositionId={itemSuggestions[0]?.position_id}
                onSelectPosition={handleDirectPositionSelect}
                onRackSelect={(rackCode) => setManualRackCode(rackCode)}
              />

              {/* 3D Preview for selected rack */}
              {manualRackCode && (
                <div className="rounded-xl border border-indigo-500/20 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/5 border-b border-indigo-500/15">
                    <Box className="w-3 h-3 text-indigo-400" />
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                      Vista 3D — {warehouseName} → {manualRackCode}
                    </span>
                  </div>
                  <Suspense fallback={
                    <div className="h-[220px] bg-[#0d0f1e] flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                    </div>
                  }>
                    <PutawaySelector3D
                      warehouseId={warehouseId}
                      warehouseName={`${warehouseName} → ${manualRackCode}`}
                      suggestedPositions={[{ position_id: "", rack_code: manualRackCode, row_number: 1, column_number: 1 }]}
                      selectedPositionId={activeItem?.position_id}
                      onSelectPosition={(pos) => handleDirectPositionSelect({ id: pos.id, label: pos.label })}
                    />
                  </Suspense>
                </div>
              )}
            </div>

          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
              <span className="ml-3 text-sm text-text-muted">Calculando mejores posiciones...</span>
            </div>
          ) : itemSuggestions.length === 0 ? (
            <div className="text-center py-8 text-text-muted space-y-3">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No se encontraron sugerencias</p>
              <p className="text-xs">Prueba seleccionar posición manualmente.</p>
              <button onClick={() => setViewMode("manual")}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-400 transition-colors font-medium">
                <Box className="w-3.5 h-3.5" /> Seleccionar posición
              </button>
            </div>

          ) : (
            /* ═══ SUGGESTIONS MODE ═══ */
            <div className="space-y-2">
              {itemSuggestions.map((s, idx) => {
                const isSelected = activeItem?.position_id === s.position_id;
                const isExpanded = expanded3DIdx === idx;
                return (
                  <div key={s.position_id}>
                    <motion.button
                      onClick={() => handleSuggestionClick(idx, s)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition-all",
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                          : "border-border hover:border-emerald-500/30 hover:bg-surface/50"
                      )}
                      whileHover={{ scale: 1.005 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold",
                            isSelected ? "bg-emerald-500 text-white" : "bg-muted text-text-primary"
                          )}>
                            {idx === 0 ? <Star className="w-4 h-4" /> : `#${idx + 1}`}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-text-primary font-mono">{s.position_label}</p>
                            <p className="text-xs text-text-muted">{s.reason}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                              s.score >= 90 ? "bg-emerald-500/10 text-emerald-500" :
                              s.score >= 70 ? "bg-amber-500/10 text-amber-500" :
                              "bg-slate-500/10 text-slate-500"
                            )}>
                              {s.score}
                            </div>
                            <p className="text-[9px] text-text-muted mt-0.5">Score</p>
                          </div>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                        </div>
                      </div>
                    </motion.button>

                    {/* Expanded 3D Preview + AI Justification */}
                    <AnimatePresence>
                      {isExpanded && isSelected && (
                        <motion.div
                          ref={preview3DRef}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-3">
                            {/* AI Justification */}
                            <div className="flex items-start gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Por qué esta posición</p>
                                {getEnhancedJustification(s, idx).map((line, li) => (
                                  <p key={li} className="text-[10px] text-text-secondary leading-relaxed">{line}</p>
                                ))}
                              </div>
                            </div>

                            {/* 3D Preview */}
                            <Suspense fallback={
                              <div className="h-[200px] bg-[#0d0f1e] rounded-lg flex items-center justify-center">
                                <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                              </div>
                            }>
                              <div className="rounded-lg overflow-hidden">
                                <PutawaySelector3D
                                  warehouseId={warehouseId}
                                  warehouseName={`${warehouseName} → ${s.rack_code}`}
                                  suggestedPositions={[{
                                    position_id: s.position_id,
                                    rack_code: s.rack_code,
                                    row_number: s.row_number,
                                    column_number: s.column_number,
                                  }]}
                                  selectedPositionId={s.position_id}
                                  onSelectPosition={(pos) => handleDirectPositionSelect({ id: pos.id, label: pos.label })}
                                />
                              </div>
                            </Suspense>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Switch to manual */}
              <div className="flex items-center justify-center pt-1">
                <button onClick={() => setViewMode("manual")}
                  className="text-[10px] text-indigo-500 hover:text-indigo-400 transition-colors flex items-center gap-1 font-medium">
                  <Box className="w-3 h-3" /> Seleccionar posición manualmente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════
// STEP 4: Review & Post
// ══════════════════════════════════════════════════════
function Step4Review({
  po, items, deliveryNote, carrier, plateNumber, result, isPending,
}: {
  po: PurchaseOrderForGR;
  items: ItemVerification[];
  deliveryNote: string;
  carrier: string;
  plateNumber: string;
  result: { success: boolean; message: string } | null;
  isPending: boolean;
}) {
  const totalReceived = parseFloat(items.reduce((a, i) => a + i.quantity_received, 0).toFixed(2));
  const totalRejected = parseFloat(items.reduce((a, i) => a + i.quantity_rejected, 0).toFixed(2));
  const allPositioned = items.filter(i => i.quantity_received > 0).every(i => i.position_label);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      {result ? (
        <div className={cn(
          "text-center py-12 rounded-2xl border",
          result.success
            ? "bg-emerald-500/5 border-emerald-500/20"
            : "bg-rose-500/5 border-rose-500/20"
        )}>
          {result.success ? (
            <>
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
              <h3 className="text-xl font-semibold text-emerald-500 mb-2">Entrada Contabilizada</h3>
              <p className="text-sm text-text-muted">{result.message}</p>
            </>
          ) : (
            <>
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-rose-500" />
              <h3 className="text-xl font-semibold text-rose-500 mb-2">Error</h3>
              <p className="text-sm text-text-muted">{result.message}</p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
              <p className="text-2xl font-bold text-emerald-500">{totalReceived}</p>
              <p className="text-[10px] text-text-muted">Recibidos</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-center">
              <p className="text-2xl font-bold text-rose-500">{totalRejected}</p>
              <p className="text-[10px] text-text-muted">Rechazados</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-center">
              <p className="text-2xl font-bold text-blue-500">{items.length}</p>
              <p className="text-[10px] text-text-muted">Items</p>
            </div>
            <div className={cn(
              "p-3 rounded-xl border text-center",
              allPositioned ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20"
            )}>
              <p className={cn("text-2xl font-bold", allPositioned ? "text-emerald-500" : "text-amber-500")}>
                {allPositioned ? "✓" : "!"}
              </p>
              <p className="text-[10px] text-text-muted">{allPositioned ? "Ubicados" : "Pendientes"}</p>
            </div>
          </div>

          {/* Order Info */}
          <div className="p-4 rounded-xl border border-border bg-surface/30 mb-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-text-muted">OC:</span> <span className="text-text-primary font-medium">{po.po_number}</span></div>
              <div><span className="text-text-muted">Proveedor:</span> <span className="text-text-primary font-medium">{po.vendor_name}</span></div>
              <div><span className="text-text-muted">Tipo:</span> <span className="text-text-primary font-medium">Entrada de mercancía por orden de compra</span></div>
              <div><span className="text-text-muted">Fecha:</span> <span className="text-text-primary">{new Date().toLocaleDateString("es-EC")}</span></div>
              {deliveryNote && <div><span className="text-text-muted">Guía:</span> <span className="text-text-primary">{deliveryNote}</span></div>}
              {carrier && <div><span className="text-text-muted">Transportista:</span> <span className="text-text-primary">{carrier}</span></div>}
              {plateNumber && <div><span className="text-text-muted">Placa:</span> <span className="text-text-primary font-mono">{plateNumber}</span></div>}
            </div>
          </div>

          {/* Items Summary */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_60px_60px_70px_120px] gap-0 bg-surface px-4 py-2 text-[10px] font-medium text-text-muted uppercase tracking-wider">
              <span>Material</span>
              <span className="text-center">Cant.</span>
              <span className="text-center">Rech.</span>
              <span className="text-center">UA</span>
              <span className="text-right">Ubicación</span>
            </div>
            {items.filter(i => i.quantity_received > 0).map((item, idx) => {
              const suLabel = SU_TYPE_OPTIONS.find(o => o.value === item.su_type);
              return (
                <div key={idx} className="grid grid-cols-[1fr_60px_60px_70px_120px] gap-0 px-4 py-2.5 border-t border-border items-center">
                  <div>
                    <p className="text-sm text-text-primary">{item.product_name}</p>
                    {item.lot_number && <p className="text-[9px] text-text-muted font-mono">Lote: {item.lot_number}</p>}
                  </div>
                  <span className="text-sm text-center text-emerald-500 font-medium">{Math.round(item.quantity_received * 100) / 100}</span>
                  <span className="text-sm text-center text-rose-500 font-medium">{item.quantity_rejected ? Math.round(item.quantity_rejected * 100) / 100 : "—"}</span>
                  <span className="text-[10px] text-center text-brand-light font-medium">{suLabel?.icon} {suLabel?.label || item.su_type}</span>
                  <span className="text-xs text-right font-mono text-text-muted">{item.position_label || "Auto"}</span>
                </div>
              );
            })}
          </div>

          {isPending && (
            <div className="mt-6 flex items-center justify-center gap-3 py-4">
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
              <span className="text-sm text-text-muted">Contabilizando entrada...</span>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
