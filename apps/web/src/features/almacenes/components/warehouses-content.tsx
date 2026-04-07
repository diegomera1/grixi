"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

import {
  Warehouse,
  MapPin,
  Layers,
  Thermometer,
  Box,
  ArrowRight,

  AlertTriangle,
  CheckCircle2,
  Activity,
  Eye,
  Package,
  LayoutDashboard,
  Search,
  Filter,
  ShoppingCart,
  ArrowDownToLine,

  FlaskConical,
  ClipboardList,
  Sparkles,
  CircleHelp,
  Cuboid,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const WarehouseOverview3D = dynamic(() => import("./warehouse-overview-3d"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-220px)] min-h-[400px] rounded-2xl bg-[#080b18] border border-indigo-500/15 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
        <p className="text-xs text-indigo-300/50">Cargando vista 3D...</p>
      </div>
    </div>
  ),
});
import { WmsDashboard } from "./wms-dashboard";
import { WmsOperations } from "./wms-operations";
import { SalesOrdersTab } from "./sales-orders-tab";

import { LotsTab } from "./lots-tab";
import { PhysicalCountsTab } from "./physical-counts-tab";
import { AiAnalysisTab } from "./ai-analysis-tab";
import { WmsTour } from "./wms-tour";
import StockHierarchyView from "./stock-hierarchy-view";
import LotDetailDrawer from "./lot-detail-drawer";
import { WarehouseDetailDrawer } from "./warehouse-detail-drawer";
import type { PhysicalCountRow } from "../actions/wms-queries";
import type {
  WmsTab,
  WarehouseData,
  WmsDashboardKpis,
  WmsAiInsight,
  SalesOrderRow,
  GoodsReceiptRow,
  GoodsIssueRow,
  TransferOrderRow,
  InventoryMovementRow,
  LotTrackingRow,
  ExpiringLotSummary,
} from "../types";

type WarehousesContentProps = {
  warehouses: WarehouseData[];
  salesOrders: SalesOrderRow[];
  goodsReceipts: GoodsReceiptRow[];
  goodsIssues: GoodsIssueRow[];
  transfers: TransferOrderRow[];
  movements: InventoryMovementRow[];
  insights: WmsAiInsight[];
  dashboardKpis: WmsDashboardKpis;
  products: { id: string; name: string; sku: string }[];
  lots: LotTrackingRow[];
  physicalCounts: PhysicalCountRow[];
  expiringLotsList?: ExpiringLotSummary[];
};

// ─── Tab Config ─────────────────────────────────────────
const TABS: { id: WmsTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "almacenes", label: "Almacenes", icon: Warehouse },
  { id: "operaciones", label: "Mov. Material", icon: ArrowDownToLine },
  { id: "pedidos", label: "Pedidos", icon: ShoppingCart },
  { id: "lotes", label: "Lotes", icon: FlaskConical },
  { id: "conteos", label: "Inv. Físico", icon: ClipboardList },
  { id: "inventario", label: "Inventario", icon: Package },
  // Removed standalone "movimientos" tab - now unified into operaciones
  { id: "analisis", label: "Análisis IA", icon: Sparkles },
];

// ─── Type Config ────────────────────────────────────────
const typeConfig: Record<
  string,
  { label: string; icon: typeof Warehouse; gradient: string; bg: string; color: string; accentHex: string }
> = {
  standard: {
    label: "Estándar",
    icon: Warehouse,
    gradient: "from-indigo-500 to-blue-600",
    bg: "bg-indigo-500/8",
    color: "text-indigo-600 dark:text-indigo-400",
    accentHex: "#6366F1",
  },
  cross_docking: {
    label: "Cross-Docking",
    icon: Layers,
    gradient: "from-amber-500 to-orange-600",
    bg: "bg-amber-500/8",
    color: "text-amber-600 dark:text-amber-400",
    accentHex: "#F59E0B",
  },
  cold_storage: {
    label: "Cámara Fría",
    icon: Thermometer,
    gradient: "from-cyan-500 to-blue-600",
    bg: "bg-cyan-500/8",
    color: "text-cyan-600 dark:text-cyan-400",
    accentHex: "#06B6D4",
  },
};

// ─── Occupancy Ring ─────────────────────────────────────
function OccupancyRing({
  value,
  size = 80,
  strokeWidth = 6,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color =
    value > 85 ? "#EF4444" : value > 60 ? "#F59E0B" : "#10B981";

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────
export function WarehousesContent({
  warehouses,
  salesOrders,
  goodsReceipts,
  goodsIssues,
  transfers,
  movements,
  insights,
  dashboardKpis,
  products,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  lots: _lots,
  physicalCounts,
  expiringLotsList,
}: WarehousesContentProps) {
  // Extract warehouse list for operation modals
  // Always start with "dashboard" to match SSR — restore from sessionStorage after mount
  const [activeTab, setActiveTab] = useState<WmsTab>("dashboard");
  const [mounted, setMounted] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const router = useRouter();

  const handleRefreshData = useCallback(() => {
    router.refresh();
  }, [router]);

  // Restore tab + mark mounted (avoids hydration mismatch)
  useEffect(() => {
    const saved = sessionStorage.getItem("almacenes-active-tab") as WmsTab | null;
    if (saved && TABS.some(t => t.id === saved)) {
      setActiveTab(saved); // eslint-disable-line
    }
    setMounted(true);

    // Auto-start tutorial for first-time users (after UI settles)
    if (!localStorage.getItem("grixi-wms-tour-seen")) {
      const timer = setTimeout(() => setTourOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Persist active tab for back navigation
  useEffect(() => {
    if (mounted) sessionStorage.setItem("almacenes-active-tab", activeTab);
  }, [activeTab, mounted]);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredWarehouse, setHoveredWarehouse] = useState<string | null>(null);
  const [selectedWarehouseId] = useState<string | null>(null);
  const [almacenesView, setAlmacenesView] = useState<"3d" | "cards">("cards");
  const [focusedWarehouseId, setFocusedWarehouseId] = useState<string | null>(null);
  const [detailDrawerWarehouse, setDetailDrawerWarehouse] = useState<string | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);

  // Warehouse list for child components
  const warehouseList = useMemo(() => warehouses.map(w => ({ id: w.id, name: w.name })), [warehouses]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCreateIssueFromSO = (_soId: string, _warehouseId: string, _soNumber: string) => {
    // Navigate to operaciones tab - GI Wizard is used there
    setActiveTab("operaciones");
  };

  // Aggregate KPIs across all warehouses
  const kpis = useMemo(() => {
    const totalRacks = warehouses.reduce((s, w) => s + w.rackCount, 0);
    const totalPositions = warehouses.reduce((s, w) => s + w.totalPositions, 0);
    const totalOccupied = warehouses.reduce((s, w) => s + w.occupiedPositions, 0);
    const avgOccupancy = totalPositions > 0 ? Math.round((totalOccupied / totalPositions) * 100) : 0;
    const activeCount = warehouses.filter((w) => w.is_active).length;
    const criticalCount = warehouses.filter(w => w.occupancy > 90).length;
    const totalAvailable = totalPositions - totalOccupied;
    return { totalRacks, totalPositions, totalOccupied, avgOccupancy, activeCount, criticalCount, totalAvailable };
  }, [warehouses]);

  const filteredWarehouses = useMemo(() => {
    if (!searchQuery) return warehouses;
    return warehouses.filter(w =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.location && w.location.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [warehouses, searchQuery]);

  // Recent movements for dashboard feed
  const recentMovementsForDashboard = useMemo(() => {
    return movements.slice(0, 20).map(m => ({
      id: m.id,
      type: m.movement_type,
      product: m.product_name,
      warehouse: m.warehouse_name,
      quantity: m.quantity,
      time: (() => {
        const diff = Date.now() - new Date(m.created_at).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Ahora";
        if (mins < 60) return `${mins}m`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
      })(),
      sap_type: m.sap_movement_type,
    }));
  }, [movements]);

  // Compute daily movement trends for last 7 days
  const movementTrends = useMemo(() => {
    const days: { date: string; label: string; entradas: number; salidas: number; traspasos: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("es-EC", { weekday: "short", day: "2-digit" });
      const dayMovements = movements.filter(m => m.created_at.startsWith(dateStr));
      days.push({
        date: dateStr,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        entradas: dayMovements.filter(m => m.movement_type === "inbound").reduce((s, m) => s + m.quantity, 0),
        salidas: dayMovements.filter(m => m.movement_type === "outbound").reduce((s, m) => s + m.quantity, 0),
        traspasos: dayMovements.filter(m => m.movement_type === "transfer").reduce((s, m) => s + m.quantity, 0),
      });
    }
    // If all zeros (no recent movements), generate simulated SAP-like data for demo
    const anyData = days.some(d => d.entradas > 0 || d.salidas > 0 || d.traspasos > 0);
    if (!anyData) {
      const bases = [120, 95, 110, 140, 85, 130, 105];
      const offsets = [32, 18, 27, 11, 38, 22, 14];
      days.forEach((d, i) => {
        d.entradas = bases[i] + offsets[i];
        d.salidas = Math.floor(bases[i] * 0.75) + offsets[(i + 3) % 7];
        d.traspasos = Math.floor(bases[i] * 0.2) + offsets[(i + 5) % 7];
      });
    }
    return days;
  }, [movements]);

  // Tab badges (counts)
  const tabBadges: Partial<Record<WmsTab, number>> = {
    pedidos: salesOrders.filter(o => o.status === "pending" || o.status === "confirmed").length,
    operaciones: goodsReceipts.filter(g => g.status !== "posted").length + goodsIssues.filter(g => g.status !== "posted").length,
  };

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* ── Header + Tabs ────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4" data-tour="wms-header">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
              <Warehouse size={20} className="text-brand" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">Gestión de Almacenes</h2>
              <p className="text-[11px] text-text-secondary">WMS — Warehouse Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTourOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-text-muted transition-all hover:border-brand/30 hover:text-brand hover:bg-brand/5 group"
            >
              <CircleHelp size={13} className="transition-colors group-hover:text-brand" />
              <span className="hidden sm:inline">Tutorial</span>
            </button>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {kpis.activeCount} activos
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-7 border-b border-border sm:flex sm:items-center sm:gap-1 sm:-mx-1 sm:px-1" data-tour="wms-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all relative",
                "sm:justify-start sm:px-4",
                activeTab === tab.id
                  ? "text-brand"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              <tab.icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              {/* Badge */}
              {tabBadges[tab.id] !== undefined && tabBadges[tab.id]! > 0 && (
                <span className="absolute -top-0.5 right-1 sm:static sm:ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                  {tabBadges[tab.id]}
                </span>
              )}
              {mounted && activeTab === tab.id && (
                <div
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ────────────────────────── */}
      <div className="flex flex-1 flex-col">
      <AnimatePresence mode="wait">
        {/* ── Dashboard Tab ─────────────────── */}
        {activeTab === "dashboard" && (
          <WmsDashboard
            key="dashboard"
            kpis={dashboardKpis}
            insights={insights}
            warehouses={warehouses}
            recentMovements={recentMovementsForDashboard}
            movementTrends={movementTrends}
            operationCounts={{
              goodsReceipts: {
                pending: goodsReceipts.filter(gr => gr.status === "pending").length,
                posted: goodsReceipts.filter(gr => gr.status === "posted").length,
                total: goodsReceipts.length,
              },
              goodsIssues: {
                pending: goodsIssues.filter(gi => gi.status === "pending").length,
                posted: goodsIssues.filter(gi => gi.status === "posted").length,
                total: goodsIssues.length,
              },
              transfers: {
                pending: transfers.filter(t => t.status === "pending").length,
                posted: transfers.filter(t => t.status === "posted" || t.status === "completed").length,
                total: transfers.length,
              },
              salesOrders: {
                pending: salesOrders.filter(so => so.status === "pending").length,
                confirmed: salesOrders.filter(so => so.status === "confirmed").length,
                picking: salesOrders.filter(so => so.status === "picking").length,
                shipped: salesOrders.filter(so => so.status === "shipped" || so.status === "delivered").length,
                total: salesOrders.length,
              },
            }}
            onNavigateTab={(tab) => setActiveTab(tab as WmsTab)}
            expiringLotsList={expiringLotsList}
          />
        )}

        {/* ── Almacenes Tab ─────────────────── */}
        {activeTab === "almacenes" && (
          <motion.div key="almacenes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5" data-tour="almacenes-content">
            {/* Toolbar: search + filter + view toggle */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Buscar almacén por nombre o ubicación..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-4 text-xs text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
                />
              </div>
              {/* Filter */}
              <button className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-muted shrink-0">
                <Filter size={14} />
                Filtros
              </button>
              {/* View toggle */}
              <div className="flex items-center rounded-xl border border-border bg-surface p-0.5 shrink-0">
                <button
                  onClick={() => setAlmacenesView("cards")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    almacenesView === "cards"
                      ? "bg-brand text-white shadow-sm"
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  <LayoutGrid size={13} />
                  Tarjetas
                </button>
                <button
                  onClick={() => setAlmacenesView("3d")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    almacenesView === "3d"
                      ? "bg-brand text-white shadow-sm"
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  <Cuboid size={13} />
                  3D
                </button>
              </div>
            </div>

            {/* 3D Holographic View — horizontal banner when selected */}
            <AnimatePresence>
              {almacenesView === "3d" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <WarehouseOverview3D initialSelectedId={focusedWarehouseId} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Warehouse cards grid */}
            {almacenesView === "cards" && <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredWarehouses.map((warehouse, index) => {
                const cfg = typeConfig[warehouse.type] || typeConfig.standard;
                const TypeIcon = cfg.icon;
                const emptyPositions = warehouse.totalPositions - warehouse.occupiedPositions;
                const healthStatus =
                  warehouse.occupancy > 90
                    ? { label: "Crítico", color: "text-red-500", bg: "bg-red-500/10", icon: AlertTriangle }
                    : warehouse.occupancy > 70
                    ? { label: "Alto", color: "text-amber-500", bg: "bg-amber-500/10", icon: Activity }
                    : { label: "Óptimo", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 };
                const HealthIcon = healthStatus.icon;
                const isHovered = hoveredWarehouse === warehouse.id;

                return (
                  <motion.div
                    key={warehouse.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.06, duration: 0.35 }}
                    onMouseEnter={() => setHoveredWarehouse(warehouse.id)}
                    onMouseLeave={() => setHoveredWarehouse(null)}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-surface transition-shadow hover:shadow-lg hover:shadow-black/5"
                  >
                    {/* Top gradient */}
                    <div className={cn("h-1 w-full bg-linear-to-r", cfg.gradient)} />
                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", cfg.bg)}>
                            <TypeIcon size={20} className={cfg.color} />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-text-primary group-hover:text-brand transition-colors">
                              {warehouse.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold", cfg.bg, cfg.color)}>
                                {cfg.label}
                              </span>
                              {warehouse.location && (
                                <span className="flex items-center gap-1 text-[10px] text-text-muted">
                                  <MapPin size={10} />
                                  {warehouse.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={cn("flex items-center gap-1 rounded-full px-2 py-1", healthStatus.bg)}>
                          <HealthIcon size={11} className={healthStatus.color} />
                          <span className={cn("text-[9px] font-bold", healthStatus.color)}>{healthStatus.label}</span>
                        </div>
                      </div>

                      {/* SAP codes */}
                      {warehouse.sap_plant_code && (
                        <div className="mt-2 flex gap-2">
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-text-muted">
                            Plant {warehouse.sap_plant_code}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-text-muted">
                            SLoc {warehouse.sap_storage_location}
                          </span>
                        </div>
                      )}

                      {/* Occupancy */}
                      <div className="mt-4 flex items-center gap-5">
                        <div className="relative flex-shrink-0">
                          <OccupancyRing value={warehouse.occupancy} />
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-black tabular-nums text-text-primary leading-none">
                              {warehouse.occupancy}
                            </span>
                            <span className="text-[9px] font-medium text-text-muted">%</span>
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-2">
                          {[
                            { label: "Racks", value: warehouse.rackCount, color: "text-indigo-500" },
                            { label: "Posiciones", value: warehouse.totalPositions.toLocaleString(), color: "text-blue-500" },
                            { label: "Ocupadas", value: warehouse.occupiedPositions.toLocaleString(), color: "text-emerald-500" },
                            { label: "Disponibles", value: emptyPositions.toLocaleString(), color: "text-slate-500" },
                          ].map((stat) => (
                            <div key={stat.label} className="rounded-lg bg-muted px-2.5 py-1.5 text-center">
                              <p className={cn("text-sm font-bold tabular-nums", stat.color)}>{stat.value}</p>
                              <p className="text-[9px] font-medium text-text-muted">{stat.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Occupancy bar */}
                      <div className="mt-4">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${warehouse.occupancy}%` }}
                            transition={{ duration: 1, ease: "easeOut", delay: 0.3 + index * 0.06 }}
                            style={{
                              backgroundColor: warehouse.occupancy > 85 ? "#EF4444" : warehouse.occupancy > 60 ? "#F59E0B" : "#10B981",
                            }}
                          />
                        </div>
                      </div>

                      {/* Hover details panel */}
                      <AnimatePresence>
                        {isHovered && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3 space-y-2">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-text-muted">Tipo</span>
                                <span className="font-semibold text-text-primary">{cfg.label}</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-text-muted">Ubicación</span>
                                <span className="font-semibold text-text-primary">{warehouse.location || "—"}</span>
                              </div>
                              {warehouse.manager_name && (
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-text-muted">Responsable</span>
                                  <span className="font-semibold text-text-primary">{warehouse.manager_name}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-[10px]">
                                <span className="text-text-muted">Densidad</span>
                                <span className="font-semibold text-text-primary">
                                  {warehouse.rackCount > 0 ? Math.round(warehouse.totalPositions / warehouse.rackCount) : 0} pos/rack
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Action buttons */}
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => setDetailDrawerWarehouse(warehouse.id)}
                          className="group/btn relative flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-brand/20 hover:bg-muted"
                        >
                          <Eye size={14} />
                          Ver Detalle
                        </button>
                        <button
                          onClick={() => {
                            setFocusedWarehouseId(warehouse.id);
                            setAlmacenesView("3d");
                          }}
                          className="group/btn relative flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-brand/25"
                        >
                          <Box size={14} />
                          Vista 3D
                          <ArrowRight size={14} className="transition-transform group-hover/btn:translate-x-0.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>}
          </motion.div>
        )}

        {/* ── Operaciones Tab ─────────────── */}
        {activeTab === "operaciones" && (
          <WmsOperations
            key="operaciones"
            goodsReceipts={goodsReceipts}
            goodsIssues={goodsIssues}
            transfers={transfers}
            movements={movements}
            warehouses={warehouses.map(w => ({ id: w.id, name: w.name }))}
            products={products}
          />
        )}

        {/* ── Pedidos Tab ───────────────── */}
        {activeTab === "pedidos" && (
          <div data-tour="pedidos-content">
            <SalesOrdersTab
              key="pedidos"
              orders={salesOrders}
              onCreateIssue={handleCreateIssueFromSO}
            />
          </div>
        )}

        {/* ── Lotes Tab ────────────────── */}
        {activeTab === "lotes" && (
          <LotsTab
            key="lotes"
            lots={[]}
            onOpenLotDetail={(lotId) => setSelectedLotId(lotId)}
            onNavigateToOperations={() => {
              // Navigate to operations tab
              setActiveTab("operaciones");
            }}
          />
        )}

        {/* ── Inv. Físico (Conteos) Tab ─────── */}
        {activeTab === "conteos" && (
          <PhysicalCountsTab
            counts={physicalCounts}
            warehouses={warehouseList}
            onRefresh={handleRefreshData}
          />
        )}

        {/* ── Inventario Tab (Stock Hierarchy) ── */}
        {activeTab === "inventario" && (
          <motion.div key="inventario" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-tour="inventario-content">
            <StockHierarchyView
              warehouseFilter={selectedWarehouseId || undefined}
              onOpenLotDetail={(lotId) => setSelectedLotId(lotId)}
            />
          </motion.div>
        )}

        {/* Movimientos tab removed — unified into operaciones */}

        {/* ── Análisis IA Tab ────────────── */}
        {activeTab === "analisis" && (
          <div data-tour="analisis-content">
            <AiAnalysisTab
              insights={insights}
              kpis={{
                totalWarehouses: warehouses.length,
                totalPositions: warehouses.reduce((a, w) => a + w.totalPositions, 0),
                occupiedPositions: warehouses.reduce((a, w) => a + w.occupiedPositions, 0),
                avgOccupancy: warehouses.length > 0 ? Math.round(warehouses.reduce((a, w) => a + w.occupancy, 0) / warehouses.length) : 0,
                todayReceipts: dashboardKpis.todayReceipts,
                todayIssues: dashboardKpis.todayIssues,
                pendingOrders: dashboardKpis.pendingOrders,
                pendingTransfers: dashboardKpis.pendingTransfers,
                criticalWarehouses: dashboardKpis.criticalWarehouses,
                totalProducts: dashboardKpis.totalProducts,
                expiringLots: dashboardKpis.expiringLots,
              }}
            />
          </div>
        )}
      </AnimatePresence>
      </div>

      {/* ── WMS Tour ────────────────────────── */}
      <WmsTour
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
        setActiveTab={setActiveTab}
      />

      {/* ── Lot Detail Drawer ─────────────────── */}
      <LotDetailDrawer
        lotId={selectedLotId}
        onClose={() => setSelectedLotId(null)}
        onNavigateToOperations={() => {
          setSelectedLotId(null);
          setActiveTab("operaciones");
        }}
      />

      {/* ── Warehouse Detail Drawer ──────────── */}
      <AnimatePresence>
        {detailDrawerWarehouse && (() => {
          const wh = warehouses.find(w => w.id === detailDrawerWarehouse);
          if (!wh) return null;
          return (
            <>
              <motion.div
                key="drawer-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                onClick={() => setDetailDrawerWarehouse(null)}
              />
              <WarehouseDetailDrawer
                key="drawer"
                warehouseId={wh.id}
                warehouseName={wh.name}
                warehouseType={wh.type}
                warehouseLocation={wh.location}
                occupancy={wh.occupancy}
                totalPositions={wh.totalPositions}
                occupiedPositions={wh.occupiedPositions}
                rackCount={wh.rackCount}
                onClose={() => setDetailDrawerWarehouse(null)}
              />
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
