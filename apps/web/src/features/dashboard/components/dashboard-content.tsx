"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Package,
  Warehouse,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Gauge,
  RotateCcw,
  Eye,
  UserPlus,
  FileText,
  BarChart3,
  Sparkles,
  TrendingUp,
  Clock,
  DollarSign,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────

type KPIs = {
  totalUsers: number;
  totalProducts: number;
  totalWarehouses: number;
  recentActivity: number;
  avgOccupancy: number;
  openPOs: number;
};

type AuditLog = {
  id: string;
  action: string;
  resource_type: string;
  new_data: { description?: string } | null;
  created_at: string;
  user: { full_name: string; avatar_url: string | null };
};

type WarehouseStat = {
  id: string;
  name: string;
  type: string;
  location: string;
  rackCount: number;
  totalPositions: number;
  occupiedPositions: number;
  occupancy: number;
};

type PO = {
  id: string;
  po_number: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  priority: string;
  vendor_name: string;
};

type ChartData = { day: string; count: number };
type HeatmapEntry = { date: string; count: number };
type CategoryData = { category: string; count: number };

type DashboardContentProps = {
  user: { name: string; avatar: string | null; role: string };
  kpis: KPIs;
  activityTrend: number;
  activityChartData: ChartData[];
  heatmapData: HeatmapEntry[];
  warehouseStats: WarehouseStat[];
  productsByCategory: CategoryData[];
  recentPOs: PO[];
  recentAudit: AuditLog[];
  financeStats: { monthPOTotal: number; vendorCount: number; pendingApproval: number };
  insights: string[];
};

// ── Config ────────────────────────────────────────────

const kpiConfig = [
  { key: "totalUsers" as const, label: "Usuarios", icon: Users, color: "#7C3AED" },
  { key: "totalProducts" as const, label: "Productos", icon: Package, color: "#3B82F6" },
  { key: "totalWarehouses" as const, label: "Almacenes", icon: Warehouse, color: "#10B981" },
  { key: "avgOccupancy" as const, label: "Ocupación Prom.", icon: Gauge, color: "#F59E0B", suffix: "%" },
  { key: "openPOs" as const, label: "OC Activas", icon: ShoppingCart, color: "#8B5CF6" },
  { key: "recentActivity" as const, label: "Actividad 24h", icon: Activity, color: "#EF4444" },
];

const actionLabels: Record<string, string> = {
  create: "Creó",
  update: "Actualizó",
  delete: "Eliminó",
};

const resourceLabels: Record<string, string> = {
  user: "usuario",
  warehouse: "almacén",
  product: "producto",
  inventory: "inventario",
  role: "rol",
  session: "sesión",
  purchase_order: "orden de compra",
  vendor: "proveedor",
};

const PO_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Borrador", color: "#6B7280", bg: "#F3F4F6" },
  pending_approval: { label: "Pendiente", color: "#F59E0B", bg: "#FEF3C7" },
  approved: { label: "Aprobada", color: "#3B82F6", bg: "#DBEAFE" },
  sent: { label: "Enviada", color: "#8B5CF6", bg: "#EDE9FE" },
  partially_received: { label: "Parcial", color: "#F97316", bg: "#FED7AA" },
  received: { label: "Recibida", color: "#10B981", bg: "#D1FAE5" },
  invoiced: { label: "Facturada", color: "#06B6D4", bg: "#CFFAFE" },
  closed: { label: "Cerrada", color: "#6B7280", bg: "#F3F4F6" },
  cancelled: { label: "Cancelada", color: "#EF4444", bg: "#FEE2E2" },
};

const CATEGORY_COLORS = ["#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#F97316"];

// ── Helpers ───────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Main Component ────────────────────────────────────

export function DashboardContent({
  user,
  kpis,
  activityTrend,
  activityChartData,
  heatmapData,
  warehouseStats,
  productsByCategory,
  recentPOs,
  recentAudit,
  financeStats,
  insights,
}: DashboardContentProps) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      {/* ═══ 1. HERO BANNER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-r from-[var(--bg-surface)] via-[var(--bg-surface)] to-[color-mix(in_srgb,var(--brand)_8%,var(--bg-surface))] p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--brand)] to-[color-mix(in_srgb,var(--brand)_70%,#000)] text-white text-sm font-bold shadow-md">
              {user.avatar ? (
                <Image src={user.avatar} alt={user.name} width={40} height={40} className="h-full w-full rounded-full object-cover" unoptimized />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                {getGreeting()}, {user.name.split(" ")[0]}
              </h2>
              <p className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                <span className="rounded-full bg-[var(--brand-surface)] px-2 py-px text-[10px] font-medium text-[var(--brand)]">
                  {user.role}
                </span>
                <span>·</span>
                <span>
                  {new Date().toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            <div className="flex items-center gap-1.5 rounded-full bg-[var(--success-light)] px-2.5 py-1 text-[10px] font-medium text-[var(--success)]">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" />
              Todos los sistemas operativos
            </div>
          </div>
        </div>
        {/* Decorative gradient orb */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[var(--brand)] opacity-[0.04] blur-3xl" />
      </motion.div>

      {/* ═══ 2. KPI CARDS WITH SPARKLINES ═══ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiConfig.map((kpi, index) => {
          const value = kpis[kpi.key];
          return (
            <motion.div
              key={kpi.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition-all hover:border-[color-mix(in_srgb,var(--brand)_30%,var(--border))] hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${kpi.color}15` }}
                >
                  <kpi.icon size={13} style={{ color: kpi.color }} />
                </div>
                {kpi.key === "recentActivity" && (
                  <div
                    className={cn(
                      "flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-semibold",
                      activityTrend >= 0
                        ? "bg-[var(--success-light)] text-[var(--success)]"
                        : "bg-[var(--error-light)] text-[var(--error)]"
                    )}
                  >
                    {activityTrend >= 0 ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
                    {activityTrend > 0 ? "+" : ""}
                    {activityTrend}%
                  </div>
                )}
              </div>
              <div className="mt-2">
                <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                  {value.toLocaleString()}{kpi.suffix || ""}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)]">{kpi.label}</p>
              </div>
              {/* Mini sparkline */}
              {kpi.key === "recentActivity" && activityChartData.length > 0 && (
                <div className="mt-1 h-[24px] w-full opacity-50">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityChartData}>
                      <defs>
                        <linearGradient id={`spark-${kpi.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={kpi.color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={kpi.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke={kpi.color}
                        strokeWidth={1.5}
                        fill={`url(#spark-${kpi.key})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ═══ ROW: ACTIVITY CHART + HEATMAP ═══ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* ═══ Activity Chart (3/5) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="col-span-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 lg:col-span-3"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Actividad Semanal</h3>
              <p className="text-[10px] text-[var(--text-secondary)]">Eventos registrados por día</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-muted)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
              7 días
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityChartData}>
                <defs>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    boxShadow: "var(--shadow-lg)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="count" stroke="var(--brand)" strokeWidth={2} fill="url(#actGrad)" name="Eventos" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ═══ 3. ACTIVITY HEATMAP (2/5) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="col-span-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 lg:col-span-2"
        >
          <div className="mb-3">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Mapa de Actividad</h3>
            <p className="text-[10px] text-[var(--text-secondary)]">Últimos 90 días</p>
          </div>
          <ActivityHeatmap data={heatmapData} />
        </motion.div>
      </div>

      {/* ═══ 4. WAREHOUSE MINI CARDS ═══ */}
      {warehouseStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Estado de Almacenes</h3>
            <Link href="/almacenes" className="text-[10px] font-medium text-[var(--brand)] hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {warehouseStats.map((w) => (
              <Link
                key={w.id}
                href={`/almacenes/${w.id}`}
                className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition-all hover:border-[var(--brand)] hover:shadow-sm"
              >
                {/* Occupancy Ring */}
                <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center">
                  <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke={w.occupancy >= 90 ? "#EF4444" : w.occupancy >= 70 ? "#F59E0B" : "#10B981"}
                      strokeWidth="3"
                      strokeDasharray={`${w.occupancy * 0.942} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-[9px] font-bold text-[var(--text-primary)]">{w.occupancy}%</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand)]">
                    {w.name}
                  </p>
                  <p className="text-[9px] text-[var(--text-muted)]">
                    {w.rackCount} racks · {w.totalPositions.toLocaleString()} pos
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══ ROW: RECENT POs + INVENTORY CHART ═══ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ═══ 5. RECENT PURCHASE ORDERS ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Órdenes de Compra</h3>
              <p className="text-[10px] text-[var(--text-secondary)]">Últimas órdenes registradas</p>
            </div>
            <Link href="/compras" className="text-[10px] font-medium text-[var(--brand)] hover:underline">
              Ver todas →
            </Link>
          </div>
          {recentPOs.length > 0 ? (
            <div className="space-y-2">
              {recentPOs.map((po) => {
                const statusConfig = PO_STATUS_CONFIG[po.status] || PO_STATUS_CONFIG.draft;
                return (
                  <div
                    key={po.id}
                    className="flex items-center gap-3 rounded-lg bg-[var(--bg-muted)] px-3 py-2 transition-colors hover:bg-[var(--bg-elevated)]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-[var(--text-primary)] tabular-nums">
                          {po.po_number}
                        </span>
                        <span
                          className="rounded-full px-1.5 py-px text-[9px] font-medium"
                          style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
                        >
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="truncate text-[10px] text-[var(--text-muted)]">{po.vendor_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-[var(--text-primary)] tabular-nums">
                        {formatCurrency(po.total)}
                      </p>
                      <p className="text-[9px] text-[var(--text-muted)]">{timeAgo(po.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-[120px] items-center justify-center text-[11px] text-[var(--text-muted)]">
              Sin órdenes recientes
            </div>
          )}
        </motion.div>

        {/* ═══ 6. INVENTORY BY CATEGORY ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
        >
          <div className="mb-3">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Inventario por Categoría</h3>
            <p className="text-[10px] text-[var(--text-secondary)]">Distribución de productos</p>
          </div>
          {productsByCategory.length > 0 ? (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productsByCategory} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      fontSize: "12px",
                      color: "var(--text-primary)",
                    }}
                  />
                  <Bar dataKey="count" name="Productos" radius={[0, 4, 4, 0]} barSize={14}>
                    {productsByCategory.map((_, i) => (
                      <Cell key={`c-${i}`} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[180px] items-center justify-center text-[11px] text-[var(--text-muted)]">
              Sin datos de categorías
            </div>
          )}
        </motion.div>
      </div>

      {/* ═══ ROW: QUICK ACTIONS + FINANCE + AI INSIGHTS ═══ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ═══ 7. QUICK ACTIONS ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
        >
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Acciones Rápidas</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { icon: ShoppingCart, label: "Crear Orden", href: "/compras", color: "#7C3AED" },
              { icon: Eye, label: "Almacén 3D", href: warehouseStats[0] ? `/almacenes/${warehouseStats[0].id}?view=3d` : "/almacenes", color: "#10B981" },
              { icon: Users, label: "Usuarios", href: "/usuarios", color: "#3B82F6" },
              { icon: FileText, label: "Requisición", href: "/compras", color: "#F59E0B" },
              { icon: BarChart3, label: "Finanzas", href: "/finanzas", color: "#06B6D4" },
              { icon: Sparkles, label: "GRIXI AI", href: "/ai", color: "#EF4444" },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-transparent bg-[var(--bg-muted)] p-2.5 text-center transition-all hover:border-[var(--border)] hover:bg-[var(--bg-elevated)] hover:shadow-sm"
              >
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${action.color}15` }}
                >
                  <action.icon size={13} style={{ color: action.color }} />
                </div>
                <span className="text-[9px] font-medium text-[var(--text-secondary)]">{action.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ═══ 9. FINANCIAL HEALTH ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.65 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
        >
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Salud Financiera</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-[var(--bg-muted)] p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#10B98115]">
                <DollarSign size={14} className="text-[#10B981]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                  {formatCurrency(financeStats.monthPOTotal)}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">Compras del mes</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[var(--bg-muted)] p-2.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Truck size={11} className="text-[var(--text-muted)]" />
                  <span className="text-sm font-bold text-[var(--text-primary)]">{financeStats.vendorCount}</span>
                </div>
                <p className="text-[9px] text-[var(--text-muted)]">Proveedores</p>
              </div>
              <div className="rounded-lg bg-[var(--bg-muted)] p-2.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Clock size={11} className="text-[var(--text-muted)]" />
                  <span className="text-sm font-bold text-[var(--text-primary)]">{financeStats.pendingApproval}</span>
                </div>
                <p className="text-[9px] text-[var(--text-muted)]">Pend. Aprobación</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══ 10. AI INSIGHTS BANNER ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="relative overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--brand)_20%,var(--border))] bg-gradient-to-br from-[color-mix(in_srgb,var(--brand)_5%,var(--bg-surface))] to-[var(--bg-surface)] p-4"
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)] to-[color-mix(in_srgb,var(--brand)_60%,#000)] shadow-sm">
              <Zap size={11} className="text-white" />
            </div>
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">GRIXI AI Insights</h3>
          </div>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--brand)]" />
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{insight}</p>
              </div>
            ))}
          </div>
          {/* Decorative */}
          <div className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-[var(--brand)] opacity-[0.06] blur-2xl" />
        </motion.div>
      </div>

      {/* ═══ 8. REAL-TIME ACTIVITY FEED ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.75 }}
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Actividad en Tiempo Real</h3>
            <div className="flex items-center gap-1 rounded-full bg-[var(--success-light)] px-2 py-0.5 text-[9px] font-medium text-[var(--success)]">
              <div className="h-1 w-1 animate-pulse rounded-full bg-[var(--success)]" />
              En vivo
            </div>
          </div>
          <Link href="/administracion" className="text-[10px] font-medium text-[var(--brand)] hover:underline">
            Ver auditoría →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {recentAudit.slice(0, 8).map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="flex items-start gap-2 rounded-lg bg-[var(--bg-muted)] px-3 py-2"
              >
                <div className="h-5 w-5 flex-shrink-0 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                  {log.user.avatar_url ? (
                    <Image src={log.user.avatar_url} alt={log.user.full_name} width={20} height={20} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[8px] font-medium text-[var(--text-muted)]">
                      {log.user.full_name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[11px] text-[var(--text-primary)]">
                    <span className="font-medium">{log.user.full_name}</span>{" "}
                    <span className="text-[var(--text-secondary)]">
                      {actionLabels[log.action] || log.action}{" "}
                      {resourceLabels[log.resource_type] || log.resource_type}
                    </span>
                  </p>
                  <p className="text-[9px] text-[var(--text-muted)]">{timeAgo(log.created_at)}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// ── Activity Heatmap Component ────────────────────────

function ActivityHeatmap({ data }: { data: HeatmapEntry[] }) {
  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // Group into weeks (columns) of 7 days (rows)
  const weeks: HeatmapEntry[][] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  const getColor = (count: number): string => {
    if (count === 0) return "var(--bg-muted)";
    const intensity = count / maxCount;
    if (intensity <= 0.25) return "color-mix(in srgb, var(--brand) 20%, var(--bg-muted))";
    if (intensity <= 0.5) return "color-mix(in srgb, var(--brand) 40%, var(--bg-muted))";
    if (intensity <= 0.75) return "color-mix(in srgb, var(--brand) 65%, var(--bg-muted))";
    return "var(--brand)";
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-[3px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day, di) => (
              <div
                key={`${wi}-${di}`}
                className="h-[10px] w-[10px] rounded-[2px] transition-colors"
                style={{ backgroundColor: getColor(day.count) }}
                title={`${day.date}: ${day.count} eventos`}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-[var(--text-muted)]">
        <span>Menos</span>
        {[0, 0.25, 0.5, 0.75, 1].map((level) => (
          <div
            key={level}
            className="h-[8px] w-[8px] rounded-[2px]"
            style={{ backgroundColor: getColor(level * maxCount) }}
          />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}
