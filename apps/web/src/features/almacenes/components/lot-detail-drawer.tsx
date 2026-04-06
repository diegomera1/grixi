"use client";

import { useState, useEffect, useMemo, startTransition, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Package, MapPin, Calendar, Clock, AlertTriangle, Truck, Search, Eye,
  Box, Archive, Layers, ArrowRight, Warehouse, Sparkles, Loader2,
  Ban, Send, ShieldAlert,
} from "lucide-react";
import { fetchLotDetail } from "../actions/stock-hierarchy-actions";
import { cn } from "@/lib/utils/cn";
import { SU_TYPE_LABELS, SU_STATUS_LABELS } from "../types";
import type { StorageUnitType, StorageUnitStatus } from "../types";

const MiniWarehouse3D = dynamic(() => import("./mini-warehouse-3d"), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] bg-elevated/50 rounded-xl flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

type LotDetailData = Awaited<ReturnType<typeof fetchLotDetail>>;

type MovementRow = {
  id: string;
  movement_type: string;
  movement_description: string | null;
  quantity: number;
  created_at: string;
  reference_number: string | null;
  sap_movement_type: string | null;
  products: { name: string; sku: string };
};

function SUTypeIcon({ type, className = "" }: { type: string; className?: string }) {
  switch (type) {
    case "palet": return <Layers className={className} />;
    case "tina": return <Box className={className} />;
    case "caja": return <Archive className={className} />;
    case "contenedor": return <Package className={className} />;
    default: return <Box className={className} />;
  }
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    available: "bg-emerald-400",
    reserved: "bg-amber-400",
    picking: "bg-blue-400",
    picked: "bg-purple-400",
    in_transit: "bg-cyan-400",
    empty: "bg-zinc-500",
  };
  return <div className={`w-2 h-2 rounded-full ${colors[status] || "bg-zinc-400"}`} />;
}

export default function LotDetailDrawer({
  lotId,
  onClose,
  onNavigateToOperations,
}: {
  lotId: string | null;
  onClose: () => void;
  onNavigateToOperations?: (action: string) => void;
}) {
  const mini3DRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<LotDetailData>(null);
  const [loading, setLoading] = useState(false);
  const [selected3DWarehouse, setSelected3DWarehouse] = useState<string | null>(null);
  const [renderTimestamp, setRenderTimestamp] = useState(0);
  const [aiRec, setAiRec] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [suWarehouseFilter, setsuWarehouseFilter] = useState<string>("all");
  const [suSearch, setSuSearch] = useState("");

  useEffect(() => {
    if (!lotId) return;
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setSelected3DWarehouse(null);
    });
    const ts = Date.now();
    fetchLotDetail(lotId).then((d) => {
      if (cancelled) return;
      startTransition(() => {
        setData(d);
        setRenderTimestamp(ts);
        setLoading(false);
      });
    });
    return () => { cancelled = true; };
  }, [lotId]);

  const lot = data?.lot;
  const storageUnits = useMemo(() => data?.storageUnits || [], [data?.storageUnits]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const movements = useMemo(() => (data?.movements || []) as any as MovementRow[], [data?.movements]);

  // Action handler
  const handleAction = useCallback(async (action: string, label: string) => {
    if (!lotId || !lot) return;
    setActionLoading(action);
    try {
      const res = await fetch("/api/wms/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_lot_status",
          lot_id: lotId,
          new_status: action,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Lote ${lot.lot_number}`, { description: label });
        // Refresh data
        const refreshed = await fetchLotDetail(lotId);
        startTransition(() => setData(refreshed));
      } else {
        toast.error("Error", { description: result.message || "No se pudo realizar la acción" });
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setActionLoading(null);
    }
  }, [lotId, lot]);

  const daysUntilExpiry = lot?.expiry_date && renderTimestamp > 0
    ? Math.ceil((new Date(lot.expiry_date).getTime() - renderTimestamp) / (1000 * 60 * 60 * 24))
    : null;

  const expiryColor =
    daysUntilExpiry !== null
      ? daysUntilExpiry <= 0
        ? "text-red-400 bg-red-500/10 border-red-500/30"
        : daysUntilExpiry <= 30
        ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
        : daysUntilExpiry <= 90
        ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
        : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      : "";

  const totalSUQuantity = storageUnits.reduce((acc, su) => acc + su.quantity, 0);
  const totalAvailable = storageUnits.reduce((acc, su) => acc + su.available_quantity, 0);
  const totalReserved = storageUnits.reduce((acc, su) => acc + su.reserved_quantity, 0);

  // Lot data with relations cast
  const lotProducts = lot ? (lot as typeof lot & { products?: { name: string; sku: string } }) : null;
  const lotVendors = lot ? (lot as typeof lot & { vendors?: { name: string } }) : null;

  // Group SUs by warehouse for 3D preview
  const warehouseGroups = useMemo(() => {
    const groups = new Map<string, { name: string; positions: { rack_code: string; row_number: number; column_number: number; su_code: string }[] }>();
    for (const su of storageUnits) {
      const existing = groups.get(su.warehouse_id) || { name: su.warehouse_name, positions: [] };
      existing.positions.push({
        rack_code: su.rack_code,
        row_number: su.row_number,
        column_number: su.column_number,
        su_code: su.su_code,
      });
      groups.set(su.warehouse_id, existing);
    }
    return Array.from(groups.entries()).map(([id, grpData]) => ({ id, ...grpData }));
  }, [storageUnits]);

  // Derive active 3D warehouse (auto-select first if none selected)
  const effective3DWarehouse = selected3DWarehouse ?? warehouseGroups[0]?.id ?? null;
  const active3DGroup = warehouseGroups.find((g) => g.id === effective3DWarehouse);

  if (!lotId) return null;

  return (
    <AnimatePresence>
      {lotId && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-[600px] bg-elevated border-l border-border z-50 overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-elevated/95 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <Package className="w-5 h-5 text-brand" />
                  Detalle del Lote
                </h2>
                {lot && (
                  <p className="text-sm text-text-muted font-mono mt-0.5">
                    {lot.lot_number}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-text-muted hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Bar */}
            {lot && (
              <div className="px-6 py-2.5 bg-muted/50 border-b border-border flex items-center gap-2 overflow-x-auto">
                {lot.status === "active" && (
                  <button
                    onClick={() => handleAction("quarantine", "Enviado a cuarentena")}
                    disabled={actionLoading === "quarantine"}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors whitespace-nowrap disabled:opacity-50">
                    {actionLoading === "quarantine" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />} Cuarentena
                  </button>
                )}
                {lot.status === "active" && onNavigateToOperations && (
                  <button
                    onClick={() => { onNavigateToOperations("goods_issue"); onClose(); }}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors whitespace-nowrap">
                    <Send className="w-3 h-3" /> Despachar FEFO
                  </button>
                )}
                {lot.status === "active" && storageUnits.length > 0 && onNavigateToOperations && (
                  <button
                    onClick={() => { onNavigateToOperations("transfer"); onClose(); }}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors whitespace-nowrap">
                    <Truck className="w-3 h-3" /> Traspasar
                  </button>
                )}
                {(lot.status === "expired" || (daysUntilExpiry !== null && daysUntilExpiry <= 0)) && (
                  <button
                    onClick={() => handleAction("consumed", "Marcado para disposición")}
                    disabled={actionLoading === "consumed"}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors whitespace-nowrap disabled:opacity-50">
                    {actionLoading === "consumed" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3 h-3" />} Disposición
                  </button>
                )}
                {lot.status === "quarantine" && (
                  <button
                    onClick={() => handleAction("active", "Liberado de cuarentena")}
                    disabled={actionLoading === "active"}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors whitespace-nowrap disabled:opacity-50">
                    {actionLoading === "active" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />} Liberar
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-surface rounded-xl animate-pulse" />
                ))}
              </div>
            ) : lot ? (
              <div className="p-6 space-y-5">
                {/* ── Material Info ────────────── */}
                <div className="bg-surface border border-border rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-text-primary text-lg">
                        {lotProducts?.products?.name}
                      </h3>
                      <p className="text-sm text-text-muted font-mono">
                        {lotProducts?.products?.sku}
                      </p>
                      {lotVendors?.vendors?.name && (
                        <p className="text-sm text-text-secondary mt-1">
                          Proveedor: {lotVendors.vendors.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Lot Details Grid ─────────── */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface border border-border rounded-xl p-3">
                    <div className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Lote</div>
                    <div className="text-sm font-mono font-bold text-text-primary">{lot.lot_number}</div>
                  </div>

                  {lot.manufacturing_date && (
                    <div className="bg-surface border border-border rounded-xl p-3">
                      <div className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Fabricación</div>
                      <div className="text-sm font-semibold text-text-primary flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(lot.manufacturing_date).toLocaleDateString("es-EC")}
                      </div>
                    </div>
                  )}

                  {lot.expiry_date && (
                    <div className={`rounded-xl p-3 border ${expiryColor}`}>
                      <div className="text-[11px] uppercase tracking-wider mb-1 opacity-70">Vencimiento</div>
                      <div className="text-sm font-semibold flex items-center gap-1">
                        {daysUntilExpiry !== null && daysUntilExpiry <= 0 ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        {new Date(lot.expiry_date).toLocaleDateString("es-EC")}
                        {daysUntilExpiry !== null && (
                          <span className="ml-1 text-xs">
                            ({daysUntilExpiry <= 0 ? "Vencido" : `${daysUntilExpiry} días`})
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-surface border border-border rounded-xl p-3">
                    <div className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Estado</div>
                    <div className={cn("text-sm font-semibold", {
                      "text-emerald-400": lot.status === "active",
                      "text-red-400": lot.status === "expired",
                      "text-amber-500": lot.status === "quarantine",
                      "text-slate-400": lot.status === "consumed" || lot.status === "returned",
                      "text-text-primary": !["active", "expired", "quarantine", "consumed", "returned"].includes(lot.status),
                    })}>
                      {({ active: "Activo", expired: "Vencido", quarantine: "Cuarentena", consumed: "Consumido", returned: "Devuelto" } as Record<string, string>)[lot.status] || lot.status}
                    </div>
                  </div>
                </div>

                {/* ── Quantity Summary ─────────── */}
                <div className="bg-surface border border-border rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-text-primary mb-3">Resumen de Cantidades</h4>

                  {/* Primary: Lot-level quantities */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-text-primary tabular-nums">
                        {Number(lot.total_quantity).toLocaleString("es-EC")}
                      </div>
                      <div className="text-[11px] text-text-muted">Total del Lote</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-400 tabular-nums">
                        {Number(lot.remaining_quantity).toLocaleString("es-EC")}
                      </div>
                      <div className="text-[11px] text-text-muted">Restante</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-text-muted tabular-nums">
                        {(Number(lot.total_quantity) - Number(lot.remaining_quantity)).toLocaleString("es-EC")}
                      </div>
                      <div className="text-[11px] text-text-muted">Consumido</div>
                    </div>
                  </div>

                  {/* Consumption progress bar */}
                  {(() => {
                    const total = Number(lot.total_quantity) || 1;
                    const remaining = Number(lot.remaining_quantity) || 0;
                    const consumed = total - remaining;
                    const consumedPct = Math.round((consumed / total) * 100);
                    return (
                      <>
                        <div className="mt-3 w-full h-3 bg-muted rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${Math.round((remaining / total) * 100)}%` }}
                          />
                          <div
                            className="h-full bg-slate-400 transition-all"
                            style={{ width: `${consumedPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-text-muted">
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Restante ({100 - consumedPct}%)
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-slate-400" /> Consumido ({consumedPct}%)
                          </span>
                        </div>
                      </>
                    );
                  })()}

                  {/* UA breakdown if any */}
                  {storageUnits.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="text-[10px] text-text-muted mb-2 uppercase tracking-wider font-medium">En Unidades de Almacén</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center bg-muted/50 rounded-lg px-2 py-1.5">
                          <div className="text-sm font-bold text-text-primary tabular-nums">{totalSUQuantity.toLocaleString("es-EC")}</div>
                          <div className="text-[9px] text-text-muted">Total UAs</div>
                        </div>
                        <div className="text-center bg-muted/50 rounded-lg px-2 py-1.5">
                          <div className="text-sm font-bold text-emerald-400 tabular-nums">{totalAvailable.toLocaleString("es-EC")}</div>
                          <div className="text-[9px] text-text-muted">Disponible</div>
                        </div>
                        <div className="text-center bg-muted/50 rounded-lg px-2 py-1.5">
                          <div className="text-sm font-bold text-amber-400 tabular-nums">{totalReserved.toLocaleString("es-EC")}</div>
                          <div className="text-[9px] text-text-muted">Reservado</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No UAs warning */}
                  {storageUnits.length === 0 && Number(lot.remaining_quantity) > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2 text-[11px] text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>{Number(lot.remaining_quantity).toLocaleString("es-EC")} UN sin ubicación física. Se requiere crear UAs y asignar posiciones en rack.</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── AI Recommendations ────── */}
                <div className="bg-brand/5 border border-brand/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand/15 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-brand" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-text-primary mb-1">Recomendaciones IA</h4>
                      {aiLoading ? (
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <Loader2 className="w-3 h-3 animate-spin" /> Analizando lote...
                        </div>
                      ) : aiRec ? (
                        <p className="text-xs text-text-secondary leading-relaxed">{aiRec}</p>
                      ) : (
                        <LotAiAnalysis
                          status={lot.status}
                          daysUntilExpiry={daysUntilExpiry}
                          totalAvailable={totalAvailable}
                          totalReserved={totalReserved}
                          lotRemainingQuantity={Number(lot.remaining_quantity)}
                          storageUnitsCount={storageUnits.length}
                          warehouseCount={warehouseGroups.length}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* ── 3D Warehouse Preview ────── */}
                {warehouseGroups.length > 0 && (
                  <div ref={mini3DRef}>
                    <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-brand" />
                      Ubicación en Almacén
                    </h4>

                    {/* Warehouse selector tabs */}
                    {warehouseGroups.length > 1 && (
                      <div className="flex items-center gap-1 mb-2 overflow-x-auto">
                        {warehouseGroups.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => setSelected3DWarehouse(g.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                              effective3DWarehouse === g.id
                                ? "bg-brand/15 text-brand border border-brand/30"
                                : "bg-surface border border-border text-text-muted hover:text-text-primary"
                            }`}
                          >
                            <Warehouse className="w-3 h-3" />
                            {g.name}
                            <span className="text-[10px] font-mono opacity-70">
                              ({g.positions.length})
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Mini 3D */}
                    {active3DGroup && (
                      <MiniWarehouse3D
                        warehouseId={active3DGroup.id}
                        warehouseName={active3DGroup.name}
                        highlightedPositions={active3DGroup.positions}
                      />
                    )}
                  </div>
                )}

                {/* ── Storage Units ────────────── */}
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <Box className="w-4 h-4 text-brand" />
                    Unidades de Almacén ({storageUnits.length})
                  </h4>

                  {/* SU Filters */}
                  {storageUnits.length > 2 && (
                    <div className="flex items-center gap-2 mb-3">
                      {/* Warehouse filter */}
                      {(() => {
                        const whs = [...new Set(storageUnits.map((su) => su.warehouse_name))];
                        if (whs.length <= 1) return null;
                        return (
                          <select value={suWarehouseFilter}
                            onChange={(e) => setsuWarehouseFilter(e.target.value)}
                            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] text-text-primary focus:border-brand focus:outline-none cursor-pointer">
                            <option value="all">🏭 Todos ({storageUnits.length})</option>
                            {whs.map((wh) => (
                              <option key={wh} value={wh}>
                                {wh} ({storageUnits.filter((su) => su.warehouse_name === wh).length})
                              </option>
                            ))}
                          </select>
                        );
                      })()}

                      {/* SU search */}
                      <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
                        <input type="text" placeholder="Buscar UA, rack..."
                          value={suSearch} onChange={(e) => setSuSearch(e.target.value)}
                          className="w-full rounded-lg border border-border bg-surface py-1.5 pl-7 pr-2 text-[11px] text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none" />
                      </div>
                    </div>
                  )}

                  {/* SU List */}
                  {(() => {
                    const filtered = storageUnits.filter((su) => {
                      if (suWarehouseFilter !== "all" && su.warehouse_name !== suWarehouseFilter) return false;
                      if (suSearch) {
                        const q = suSearch.toLowerCase();
                        return su.su_code.toLowerCase().includes(q) ||
                          su.rack_code.toLowerCase().includes(q) ||
                          su.warehouse_name.toLowerCase().includes(q);
                      }
                      return true;
                    });

                    if (filtered.length === 0 && storageUnits.length > 0) {
                      return (
                        <div className="text-center py-6 text-xs text-text-muted">
                          Sin resultados para este filtro
                          <button onClick={() => { setsuWarehouseFilter("all"); setSuSearch(""); }}
                            className="block mx-auto mt-1 text-brand text-[10px] hover:underline">Limpiar filtros</button>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {(suWarehouseFilter !== "all" || suSearch) && filtered.length !== storageUnits.length && (
                          <div className="text-[10px] text-text-muted mb-1">
                            Mostrando {filtered.length} de {storageUnits.length} UAs
                          </div>
                        )}
                        {filtered.map((su) => (
                          <motion.div
                            key={su.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => {
                              // Switch mini 3D to this warehouse and scroll up
                              setSelected3DWarehouse(su.warehouse_id);
                              mini3DRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }}
                            className="bg-surface border border-border rounded-xl p-3 hover:border-brand/30 transition-colors cursor-pointer group/su"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <SUTypeIcon type={su.su_type} className="w-4 h-4 text-brand-light" />
                                <span className="text-sm font-mono font-bold text-text-primary">{su.su_code}</span>
                                <span className="text-xs text-text-muted">
                                  ({SU_TYPE_LABELS[su.su_type as StorageUnitType] || su.su_type})
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <StatusDot status={su.status} />
                                <span className="text-xs text-text-muted">
                                  {SU_STATUS_LABELS[su.status as StorageUnitStatus] || su.status}
                                </span>
                                <Eye className="w-3 h-3 text-text-muted/0 group-hover/su:text-brand transition-colors" />
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                                <MapPin className="w-3 h-3" />
                                <span>{su.warehouse_name}</span>
                                <ArrowRight className="w-3 h-3 text-text-muted/50" />
                                <span className="font-mono">{su.rack_code}-{su.row_number}-{su.column_number}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-bold text-text-primary">{su.quantity} UN</span>
                                {su.reserved_quantity > 0 && (
                                  <span className="text-xs text-amber-400 ml-1">
                                    ({su.reserved_quantity} res.)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Hover hint */}
                            <div className="mt-1.5 text-[9px] text-brand/0 group-hover/su:text-brand/70 transition-colors flex items-center gap-1">
                              <Eye className="w-2.5 h-2.5" />
                              Click para ver ubicación en 3D
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* ── Movement History ─────────── */}
                {movements.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-brand" />
                      Historial de Movimientos
                    </h4>
                    <div className="space-y-1">
                      {movements.map((mov) => (
                        <div
                          key={mov.id}
                          className="flex items-center justify-between py-2 px-3 bg-surface rounded-lg border border-border/50 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-text-muted text-xs">
                              {new Date(mov.created_at).toLocaleDateString("es-EC")}
                            </span>
                            <span className="text-text-primary">
                              {mov.movement_description || mov.movement_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {mov.reference_number && (
                              <span className="text-xs text-brand font-mono">{mov.reference_number}</span>
                            )}
                            <span className="font-semibold text-text-primary">{mov.quantity} UN</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-text-muted">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No se encontró información del lote</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Algorithmic AI-style analysis for a single lot ─────────
function LotAiAnalysis({ status, daysUntilExpiry, totalAvailable, totalReserved, lotRemainingQuantity, storageUnitsCount, warehouseCount }: {
  status: string;
  daysUntilExpiry: number | null;
  totalAvailable: number;
  totalReserved: number;
  lotRemainingQuantity: number;
  storageUnitsCount: number;
  warehouseCount: number;
}) {
  const recommendations: string[] = [];

  if (status === "expired" || (daysUntilExpiry !== null && daysUntilExpiry <= 0)) {
    recommendations.push("⛔ Este lote está vencido. Se recomienda revisión inmediata para disposición o devolución al proveedor.");
  } else if (daysUntilExpiry !== null && daysUntilExpiry <= 7) {
    recommendations.push(`🔴 Vence en ${daysUntilExpiry} día${daysUntilExpiry > 1 ? "s" : ""}. Priorizar despacho FEFO de forma urgente para evitar pérdida total.`);
  } else if (daysUntilExpiry !== null && daysUntilExpiry <= 30) {
    recommendations.push(`⚠️ Vence en ${daysUntilExpiry} días. Considerar priorizar este lote en los próximos despachos usando estrategia FEFO.`);
  }

  if (totalReserved > 0) {
    const pct = totalAvailable + totalReserved > 0 ? Math.round((totalReserved / (totalAvailable + totalReserved)) * 100) : 0;
    recommendations.push(`📌 ${pct}% del stock en UAs está reservado (${totalReserved} UN). Verificar que las órdenes asociadas estén en proceso.`);
  }

  if (storageUnitsCount === 0 && lotRemainingQuantity > 0) {
    recommendations.push(`📍 ${lotRemainingQuantity.toLocaleString("es-EC")} UN sin ubicación física. Se necesita crear unidades de almacén y asignar posiciones en rack para gestión completa.`);
  } else if (storageUnitsCount > 0 && warehouseCount > 1) {
    recommendations.push(`📦 Stock distribuido en ${warehouseCount} almacenes. Considerar consolidación para optimizar picking.`);
  }

  if (status === "quarantine") {
    recommendations.push("🔒 En cuarentena. Pendiente de revisión de calidad antes de liberar para operaciones.");
  }

  if (recommendations.length === 0) {
    recommendations.push("✅ Este lote está en buen estado. No se requieren acciones inmediatas.");
  }

  return (
    <ul className="space-y-1.5">
      {recommendations.map((r, i) => (
        <li key={i} className="text-[11px] text-text-secondary leading-relaxed">{r}</li>
      ))}
    </ul>
  );
}
