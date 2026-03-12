"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Building2,
  Receipt,
  CreditCard,
  Banknote,
  X,
  FileText,
  Calendar,
  Hash,
  MapPin,
  ChevronsRight,
  CircleDot,
  Clock,
  Landmark,
  Wallet,
  ChevronDown,
  ChevronRight,
  Sparkles,
  BarChart3,
  BookOpen,
  ArrowDownToLine,
  ArrowUpFromLine,
  Target,
  Info,
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
  PieChart as RechartsPie,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils/cn";
import { useFinanceRealtime } from "../hooks/use-finance-realtime";
import { useFinanceSimulator } from "../hooks/use-finance-simulator";
import {
  formatCurrency,
  formatCurrencyCompact,
  convertCurrency,
  CURRENCY_CONFIG,
} from "../utils/currency";
import type {
  FinanceTransaction,
  CurrencyCode,
  FinanceCostCenter,
} from "../types";
import { GeneralLedgerTab } from "./general-ledger-tab";
import { AccountsReceivableTab } from "./accounts-receivable-tab";
import { AccountsPayableTab } from "./accounts-payable-tab";
import { BudgetsTab } from "./budgets-tab";

type FinanceTab = "resumen" | "libro_mayor" | "cxc" | "cxp" | "presupuestos";

const TABS: { id: FinanceTab; label: string; icon: typeof DollarSign }[] = [
  { id: "resumen", label: "Resumen", icon: BarChart3 },
  { id: "libro_mayor", label: "Libro Mayor", icon: BookOpen },
  { id: "cxc", label: "Ctas × Cobrar", icon: ArrowDownToLine },
  { id: "cxp", label: "Ctas × Pagar", icon: ArrowUpFromLine },
  { id: "presupuestos", label: "Presupuestos", icon: Target },
];

// ── Transaction config ─────────────────────────
const TX_CONFIG: Record<string, { label: string; icon: typeof DollarSign; color: string }> = {
  invoice_revenue: { label: "Factura de venta", icon: Receipt, color: "#10B981" },
  customer_payment: { label: "Cobro de cliente", icon: ArrowUpRight, color: "#06B6D4" },
  vendor_invoice: { label: "Factura proveedor", icon: CreditCard, color: "#F59E0B" },
  vendor_payment: { label: "Pago a proveedor", icon: ArrowDownRight, color: "#EF4444" },
  manual_entry: { label: "Asiento manual", icon: FileText, color: "#8B5CF6" },
  payroll: { label: "Nómina", icon: Building2, color: "#EC4899" },
  tax_payment: { label: "Impuestos", icon: Landmark, color: "#F97316" },
};

const DEPT_COLORS = [
  "#10B981", "#06B6D4", "#8B5CF6", "#F59E0B", "#EC4899",
  "#EF4444", "#3B82F6", "#14B8A6", "#F97316", "#6366F1",
];

type Props = {
  initialTransactions: FinanceTransaction[];
  costCenters: FinanceCostCenter[];
};

export function FinanceContent({ initialTransactions, costCenters }: Props) {
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [selectedTx, setSelectedTx] = useState<FinanceTransaction | null>(null);
  const [activeTab, setActiveTab] = useState<FinanceTab>("resumen");
  const { isSimulating } = useFinanceSimulator();

  const { liveTransactions, transactions, kpis, departmentBreakdown } =
    useFinanceRealtime(initialTransactions);

  const allTransactions = useMemo(
    () => {
      const seen = new Set<string>();
      const result: FinanceTransaction[] = [];
      // Live transactions take priority
      for (const t of liveTransactions) {
        if (!seen.has(t.id)) { seen.add(t.id); result.push(t); }
      }
      for (const t of transactions) {
        if (!seen.has(t.id)) { seen.add(t.id); result.push(t); }
      }
      return result;
    },
    [liveTransactions, transactions]
  );

  const c = useCallback(
    (v: number) => convertCurrency(v, "USD", currency),
    [currency]
  );

  // ── CHART DATA ──────────────────────────────────
  // Cash flow time series from live transactions
  const cashFlowData = useMemo(() => {
    const pts: Array<{ time: string; inflows: number; outflows: number }> = [];
    let cumIn = 0;
    let cumOut = 0;
    const sorted = [...liveTransactions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    for (const tx of sorted) {
      const t = new Date(tx.created_at);
      const label = t.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      if (["revenue", "payment_in"].includes(tx.category)) {
        cumIn += tx.amount_usd;
      } else {
        cumOut += tx.amount_usd;
      }
      pts.push({ time: label, inflows: c(cumIn), outflows: c(cumOut) });
    }
    return pts;
  }, [liveTransactions, c]);

  // Department expenses donut
  const donutData = useMemo(() => {
    return Object.entries(departmentBreakdown)
      .map(([name, value]) => ({ name, value: c(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [departmentBreakdown, c]);

  // P&L data
  const pnlData = useMemo(() => {
    const deptExpenses = allTransactions
      .filter((t) => ["expense", "payment_out"].includes(t.category))
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.department] = (acc[t.department] || 0) + t.amount_usd;
        return acc;
      }, {});

    return {
      revenue: c(kpis.totalRevenue),
      expenses: c(kpis.totalExpenses),
      ebitda: c(kpis.ebitda),
      departments: Object.entries(deptExpenses)
        .map(([k, v]) => ({ name: k, amount: c(v) }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [allTransactions, kpis, c]);

  // AR Aging — calculated from real transaction due dates
  const agingData = useMemo(() => {
    const now = Date.now();
    const buckets = { "0-30d": 0, "30-60d": 0, "60-90d": 0, "90+d": 0 };
    const arTransactions = allTransactions.filter(
      (t) => t.transaction_type === "invoice_revenue" && t.due_date
    );
    for (const tx of arTransactions) {
      const dueDate = new Date(tx.due_date!).getTime();
      const daysOverdue = Math.max(0, Math.floor((now - dueDate) / 86400000));
      if (daysOverdue <= 30) buckets["0-30d"] += tx.amount_usd;
      else if (daysOverdue <= 60) buckets["30-60d"] += tx.amount_usd;
      else if (daysOverdue <= 90) buckets["60-90d"] += tx.amount_usd;
      else buckets["90+d"] += tx.amount_usd;
    }
    // Fallback: if no AR transactions, use proportional estimates
    const total = Object.values(buckets).reduce((s, v) => s + v, 0);
    if (total === 0) {
      const outstanding = kpis.totalRevenue * 0.35;
      buckets["0-30d"] = outstanding * 0.45;
      buckets["30-60d"] = outstanding * 0.28;
      buckets["60-90d"] = outstanding * 0.17;
      buckets["90+d"] = outstanding * 0.10;
    }
    return [
      { range: "0-30d", amount: c(buckets["0-30d"]), fill: "#10B981" },
      { range: "30-60d", amount: c(buckets["30-60d"]), fill: "#F59E0B" },
      { range: "60-90d", amount: c(buckets["60-90d"]), fill: "#F97316" },
      { range: "90+d", amount: c(buckets["90+d"]), fill: "#EF4444" },
    ];
  }, [allTransactions, kpis, c]);

  // Recent transactions for feed (last 30)
  // Show ALL transactions — historical + live, deduplicated, with live ones first
  const recentTransactions = useMemo(
    () => {
      const seen = new Set<string>();
      const live = liveTransactions
        .filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; })
        .map(t => ({ ...t, _isLive: true }));
      const historical = transactions
        .filter(t => !t.is_live && !seen.has(t.id))
        .map(t => { seen.add(t.id); return { ...t, _isLive: false }; });
      return [...live, ...historical]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50);
    },
    [liveTransactions, transactions]
  );

  return (
    <div className="space-y-6">
      {/* ── Header + Tabs (same row, matching Compras) ───── */}
      <div className="mb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10">
              <DollarSign size={20} className="text-[var(--brand)]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Finanzas</h2>
              <p className="text-[11px] text-[var(--text-secondary)] hidden sm:block">
                Centro financiero en tiempo real — datos tipo SAP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto">
            {/* Pulse indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-400">
                {isSimulating ? "Tiempo real" : "Conectando..."}
              </span>
            </div>

            {/* Currency selector */}
            <div className="flex flex-wrap gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/50 p-0.5">
              {(Object.keys(CURRENCY_CONFIG) as CurrencyCode[])
                .filter((code) => code !== "GBP")
                .map((code) => {
                const cfg = CURRENCY_CONFIG[code];
                const otherCurrencies = (Object.keys(CURRENCY_CONFIG) as CurrencyCode[]).filter((c) => c !== code && c !== "GBP");
                return (
                  <div key={code} className="relative group">
                    <button
                      onClick={() => setCurrency(code)}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all sm:px-3 sm:gap-1.5 sm:text-xs",
                        currency === code
                          ? "bg-violet-500/20 text-violet-400 shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                      )}
                    >
                      <span className="text-sm sm:text-base">{cfg.flag}</span>
                      <span className="hidden sm:inline">{code}</span>
                    </button>
                    {/* Exchange rate popover — desktop only */}
                    <div className="pointer-events-none invisible absolute left-1/2 top-full z-[60] mt-2 w-56 -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 opacity-0 shadow-2xl transition-all duration-200 group-hover:visible group-hover:opacity-100 max-md:!hidden">
                      <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-[var(--border)] bg-[var(--bg-elevated)]" />
                      <div className="relative">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--border)]">
                          <span className="text-base">{cfg.flag}</span>
                          <div>
                            <p className="text-[11px] font-semibold text-[var(--text-primary)]">{cfg.name} ({code})</p>
                            <p className="text-[9px] text-[var(--text-muted)]">Tasas de cambio</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {otherCurrencies.map((other) => {
                            const otherCfg = CURRENCY_CONFIG[other];
                            const rate = convertCurrency(1, code, other);
                            const isLargeRate = rate >= 100;
                            return (
                              <div key={other} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs">{otherCfg.flag}</span>
                                  <span className="text-[10px] text-[var(--text-secondary)]">{other}</span>
                                </div>
                                <span className="text-[11px] font-mono font-semibold text-[var(--text-primary)]">
                                  {isLargeRate ? rate.toLocaleString("es-ES", { maximumFractionDigits: 0 }) : rate.toFixed(4)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center gap-1.5">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                          <span className="text-[8px] text-[var(--text-muted)]">
                            Tasas en vivo • {new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {/* Tab Navigation — same level as header */}
        <div className="flex items-center gap-1 border-b border-[var(--border)] -mx-1 px-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-all relative shrink-0",
                activeTab === tab.id
                  ? "text-[var(--brand)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="finance-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand)] rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ────────────────────────── */}
      {activeTab === "resumen" && (
        <>
      {/* ── KPI Cards ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPICard
          label="Revenue"
          value={c(kpis.totalRevenue)}
          currency={currency}
          icon={TrendingUp}
          color="emerald"
          trend={12.5}
          tooltip="Ingresos Totales — Suma de todas las facturas de venta y cobros recibidos en el periodo actual."
        />
        <KPICard
          label="Gastos"
          value={c(kpis.totalExpenses)}
          currency={currency}
          icon={TrendingDown}
          color="rose"
          trend={8.3}
          tooltip="Gastos Operativos — Total de egresos incluyendo compras, nómina, impuestos y servicios."
        />
        <KPICard
          label="EBITDA"
          value={c(kpis.ebitda)}
          currency={currency}
          icon={Activity}
          color="violet"
          trend={15.7}
          tooltip="Earnings Before Interest, Taxes, Depreciation & Amortization — Utilidad operativa antes de deducciones financieras. Mide la rentabilidad operativa real del negocio."
        />
        <KPICard
          label="Cash Flow"
          value={c(kpis.cashFlow)}
          currency={currency}
          icon={Wallet}
          color="cyan"
          trend={5.2}
          tooltip="Flujo de Caja — Diferencia neta entre ingresos y egresos en el periodo. Indica la liquidez disponible para operaciones."
        />
        <KPICard
          label="Balance Neto"
          value={c(kpis.netBalance)}
          currency={currency}
          icon={DollarSign}
          color="amber"
          trend={10.1}
          tooltip="Balance Neto — Posición financiera neta considerando todos los activos y pasivos corrientes. Refleja la salud financiera general."
        />
      </div>

      {/* ── Main Grid: Chart + Feed ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cash Flow Chart */}
        <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm">Flujo de Caja</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Ingresos vs egresos acumulados
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                Ingresos
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                Egresos
              </div>
            </div>
          </div>
          <div className="h-[280px]">
            {cashFlowData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#F43F5E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => formatCurrencyCompact(Number(v), currency)}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px", color: "var(--text-primary)" }}
                    formatter={(v) => formatCurrency(Number(v), currency)}
                  />
                  <Area type="monotone" dataKey="inflows" stroke="#10B981" fill="url(#inflowGrad)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="outflows" stroke="#F43F5E" fill="url(#outflowGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)] gap-2">
                <Activity className="w-5 h-5 animate-pulse" />
                Esperando datos en vivo...
              </div>
            )}
          </div>
        </div>

        {/* Live Transaction Feed */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col max-h-[380px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Transacciones</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
              {liveTransactions.length} tx
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
            <AnimatePresence initial={false}>
              {recentTransactions.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-sm gap-2 py-6">
                  <Clock className="w-5 h-5 animate-pulse" />
                  Esperando transacciones...
                </div>
              )}
              {recentTransactions.map((tx) => {
                const cfg = TX_CONFIG[tx.transaction_type] || TX_CONFIG.manual_entry;
                const Icon = cfg.icon;
                const isPositive = ["revenue", "payment_in"].includes(tx.category);
                return (
                  <motion.button
                    key={tx.id}
                    initial={{ opacity: 0, x: 20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -20, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    onClick={() => setSelectedTx(tx)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--bg-muted)]/30 hover:bg-[var(--bg-muted)] border border-transparent hover:border-[var(--border)] transition-all group text-left cursor-pointer"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-[var(--text-primary)]">{tx.counterparty}</p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate">
                        {cfg.label} · {tx.invoice_number || tx.sap_document_id}
                        {(tx as unknown as { _isLive?: boolean })._isLive && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 text-[9px] font-bold">LIVE</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-xs font-mono font-semibold", isPositive ? "text-emerald-400" : "text-rose-400")}>
                        {isPositive ? "+" : "-"}
                        {formatCurrencyCompact(c(tx.amount_usd), currency)}
                      </p>
                    </div>
                    <ChevronsRight className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Bottom Grid: Donut + P&L + AR Aging ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Expenses Donut */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h3 className="font-semibold text-sm mb-1">Gastos por Departamento</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Distribución proporcional</p>
          <div className="h-[200px]">
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    paddingAngle={3}
                    stroke="none"
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "11px" }}
                    formatter={(v) => formatCurrency(Number(v), currency)}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
                Esperando datos...
              </div>
            )}
          </div>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            {donutData.slice(0, 6).map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DEPT_COLORS[i] }} />
                <span className="truncate">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mini P&L */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h3 className="font-semibold text-sm mb-1">Estado de Resultados</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">P&L resumido — {CURRENCY_CONFIG[currency].flag} {currency}</p>
          <div className="space-y-3">
            <PnLRow label="Ingresos Totales" amount={pnlData.revenue} currency={currency} type="revenue" />
            <div className="border-t border-[var(--border)] pt-2">
              <PnLRow label="Gastos Operativos" amount={pnlData.expenses} currency={currency} type="expense" expandable>
                {pnlData.departments.slice(0, 5).map((d) => (
                  <PnLRow key={d.name} label={d.name} amount={d.amount} currency={currency} type="expense" indent />
                ))}
              </PnLRow>
            </div>
            <div className="border-t border-[var(--border)] pt-2">
              <PnLRow label="EBITDA" amount={pnlData.ebitda} currency={currency} type="total" bold />
            </div>
          </div>
        </div>

        {/* AR Aging */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h3 className="font-semibold text-sm mb-1">Aging de Cartera</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Cuentas por cobrar por antigüedad</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData} layout="vertical" barCategoryGap={8}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="range" tick={{ fontSize: 11, fill: "#94A3B8" }} width={50} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "11px" }}
                  formatter={(v) => formatCurrency(Number(v), currency)}
                />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={20}>
                  {agingData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Balance sheet mini */}
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--text-muted)]">Balance General</span>
            </div>
            <div className="space-y-2">
              <BalanceRow label="Activos" amount={c(kpis.totalRevenue * 1.4)} currency={currency} color="emerald" />
              <BalanceRow label="Pasivos" amount={c(kpis.totalExpenses * 0.8)} currency={currency} color="rose" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Cost Centers Section ────────────────── */}
      {costCenters.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h3 className="font-semibold text-sm mb-1">Centros de Costo</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Presupuesto anual vs ejecutado por departamento</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {costCenters.slice(0, 10).map((cc) => {
              const spent = departmentBreakdown[cc.department] || 0;
              const budgetConverted = c(cc.budget_annual);
              const spentConverted = c(spent);
              const pct = budgetConverted > 0 ? Math.min((spentConverted / budgetConverted) * 100, 100) : 0;
              return (
                <div key={cc.id} className="p-3 rounded-lg bg-[var(--bg-muted)]/30 border border-[var(--border)]">
                  <p className="text-[10px] font-mono text-[var(--text-muted)] mb-1">{cc.code}</p>
                  <p className="text-xs font-medium truncate mb-2">{cc.department}</p>
                  <div className="h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: pct > 80 ? "#EF4444" : pct > 50 ? "#F59E0B" : "#10B981" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {formatCurrencyCompact(spentConverted, currency)}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </>
      )}

      {/* ── Transaction Detail Drawer ──────────── */}
      <AnimatePresence>
        {selectedTx && (
          <TransactionDrawer
            transaction={selectedTx}
            currency={currency}
            convert={c}
            onClose={() => setSelectedTx(null)}
          />
        )}
      </AnimatePresence>

      {activeTab === "libro_mayor" && (
        <GeneralLedgerTab
          transactions={allTransactions}
          currency={currency}
          convert={c}
          onSelectTx={setSelectedTx}
        />
      )}

      {activeTab === "cxc" && (
        <AccountsReceivableTab
          transactions={allTransactions}
          currency={currency}
          convert={c}
          onSelectTx={setSelectedTx}
        />
      )}

      {activeTab === "cxp" && (
        <AccountsPayableTab
          transactions={allTransactions}
          currency={currency}
          convert={c}
          onSelectTx={setSelectedTx}
        />
      )}

      {activeTab === "presupuestos" && (
        <BudgetsTab
          transactions={allTransactions}
          costCenters={costCenters}
          currency={currency}
          convert={c}
        />
      )}
    </div>
  );
}

// ── KPI Card ────────────────────────────────────
function KPICard({
  label, value, currency, icon: Icon, color, trend, tooltip,
}: {
  label: string;
  value: number;
  currency: CurrencyCode;
  icon: typeof DollarSign;
  color: string;
  trend: number;
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: "text-emerald-400" },
    rose: { bg: "bg-rose-500/10", text: "text-rose-400", icon: "text-rose-400" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-400", icon: "text-violet-400" },
    cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", icon: "text-cyan-400" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", icon: "text-amber-400" },
  };
  const c = colorMap[color] || colorMap.emerald;

  return (
    <motion.div
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 relative overflow-hidden group card-elevated"
      layout
    >
      {/* Background icon */}
      <Icon className={cn("absolute -right-2 -top-2 w-16 h-16 opacity-[0.04]", c.icon)} />
      <div className="flex items-center justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", c.bg)}>
          <Icon className={cn("w-4.5 h-4.5", c.icon)} />
        </div>
        {tooltip && (
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="rounded-full p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-all"
            >
              <Info size={13} />
            </button>
            <AnimatePresence>
              {showTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-xl"
                >
                  <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {tooltip}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={value}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-2xl font-bold tracking-tight font-mono"
        >
          {formatCurrencyCompact(value, currency)}
        </motion.p>
      </AnimatePresence>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
        <span className={cn("text-[11px] font-semibold", c.text)}>+{trend}%</span>
      </div>
    </motion.div>
  );
}

// ── P&L Row ─────────────────────────────────────
function PnLRow({
  label, amount, currency, type, bold, indent, expandable, children,
}: {
  label: string;
  amount: number;
  currency: CurrencyCode;
  type: "revenue" | "expense" | "total";
  bold?: boolean;
  indent?: boolean;
  expandable?: boolean;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = type === "revenue" ? "text-emerald-500" : type === "expense" ? "text-rose-500" : "text-[var(--text-primary)]";

  return (
    <div>
      <button
        onClick={expandable ? () => setExpanded(!expanded) : undefined}
        className={cn(
          "w-full flex items-center justify-between py-1",
          indent && "pl-4",
          expandable && "cursor-pointer hover:bg-[var(--bg-muted)]/30 rounded-md px-2 -mx-2",
        )}
      >
        <span className={cn("text-xs", bold ? "font-bold" : indent ? "text-[var(--text-muted)]" : "font-medium")}>
          {expandable && (expanded ? <ChevronDown className="inline w-3 h-3 mr-1" /> : <ChevronRight className="inline w-3 h-3 mr-1" />)}
          {label}
        </span>
        <span className={cn("text-xs font-mono", colorClass, bold && "font-bold")}>
          {formatCurrency(amount, currency)}
        </span>
      </button>
      <AnimatePresence>
        {expanded && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-l-2 border-violet-500/30 ml-2 pl-2 space-y-0.5 pt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Balance Row ─────────────────────────────────
function BalanceRow({
  label, amount, currency, color,
}: {
  label: string;
  amount: number;
  currency: CurrencyCode;
  color: string;
}) {
  const colorClass = color === "emerald" ? "bg-emerald-500" : "bg-rose-500";
  const max = amount * 1.3;
  const pct = Math.min((amount / max) * 100, 100);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-14 text-[var(--text-muted)]">{label}</span>
      <div className="flex-1 h-2 bg-[var(--bg-muted)] rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", colorClass)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-mono w-20 text-right">
        {formatCurrencyCompact(amount, currency)}
      </span>
    </div>
  );
}

// ── Transaction Detail Drawer ───────────────────
function TransactionDrawer({
  transaction: tx,
  currency,
  convert,
  onClose,
}: {
  transaction: FinanceTransaction;
  currency: CurrencyCode;
  convert: (v: number) => number;
  onClose: () => void;
}) {
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [notes, setNotes] = useState(tx.notes || "");
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);

  const cfg = TX_CONFIG[tx.transaction_type] || TX_CONFIG.manual_entry;
  const isPositive = ["revenue", "payment_in"].includes(tx.category);

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-500",
    posted: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    cleared: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    reversed: "bg-rose-500/20 text-rose-600 dark:text-rose-400",
  };

  const pmLabels: Record<string, string> = {
    transfer: "Transferencia bancaria",
    check: "Cheque",
    cash: "Efectivo",
    credit_card: "Tarjeta de crédito",
    direct_debit: "Débito directo",
  };

  const handleAnalyze = async () => {
    setAiLoading(true);
    try {
      const { analyzeTransaction } = await import("../actions/analyze-transaction");
      const result = await analyzeTransaction({
        transaction_type: tx.transaction_type,
        category: tx.category,
        department: tx.department,
        amount: tx.amount,
        currency: tx.currency,
        counterparty: tx.counterparty,
        description: tx.description,
        tax_rate: tx.tax_rate,
        tax_amount: tx.tax_amount,
        net_amount: tx.net_amount,
        payment_terms: tx.payment_terms,
        due_date: tx.due_date,
        status: tx.status,
        cost_center_code: tx.cost_center_code,
        gl_account: tx.gl_account,
        invoice_number: tx.invoice_number,
        sap_document_id: tx.sap_document_id,
        created_at: tx.created_at,
        notes: tx.notes,
      });
      setAiAnalysis(result.analysis || result.error || "Sin resultado");
    } catch {
      setAiAnalysis("Error al analizar la transacción");
    }
    setAiLoading(false);
  };

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    try {
      const { updateTransactionNotes } = await import("../actions/analyze-transaction");
      await updateTransactionNotes(tx.id, notes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {
      // silently fail
    }
    setNotesSaving(false);
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      {/* Drawer */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-[var(--bg-surface)] border-l border-[var(--border)] z-50 overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-surface)]/95 backdrop-blur-sm border-b border-[var(--border)] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}
            >
              <cfg.icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-[var(--text-primary)]">{cfg.label}</h2>
              <p className="text-xs text-[var(--text-muted)] font-mono">{tx.sap_document_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[var(--bg-muted)] hover:bg-[var(--bg-muted)]/80 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Amount hero */}
          <div className="text-center py-4">
            <p className={cn(
              "text-4xl font-bold font-mono tracking-tight",
              isPositive ? "text-emerald-500" : "text-rose-500"
            )}>
              {isPositive ? "+" : "-"}{formatCurrency(convert(tx.amount_usd), currency)}
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusColors[tx.status || "posted"])}>
                {(tx.status || "posted").toUpperCase()}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {new Date(tx.created_at).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </div>
          </div>

          {/* Document info */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 divide-y divide-[var(--border)]">
            <DetailRow icon={FileText} label="Nº Factura" value={tx.invoice_number || "—"} />
            <DetailRow icon={Hash} label="Doc. SAP" value={tx.sap_document_id} />
            <DetailRow icon={Building2} label="Contraparte" value={tx.counterparty} />
            <DetailRow icon={MapPin} label="Departamento" value={tx.department} />
            <DetailRow icon={CircleDot} label="Centro de Costo" value={tx.cost_center_code || "—"} />
            <DetailRow icon={Landmark} label="Cuenta Contable" value={tx.gl_account || "—"} />
            <DetailRow icon={Activity} label="Centro de Beneficio" value={tx.profit_center || "—"} />
          </div>

          {/* Financial details */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 divide-y divide-[var(--border)]">
            <DetailRow icon={DollarSign} label="Monto Bruto" value={formatCurrency(convert(tx.amount_usd), currency)} />
            <DetailRow icon={Receipt} label={`IVA (${tx.tax_rate}%)`} value={formatCurrency(convert(tx.tax_amount || 0), currency)} />
            <DetailRow icon={Banknote} label="Monto Neto" value={formatCurrency(convert(tx.net_amount || tx.amount_usd), currency)} highlight />
            <DetailRow icon={CreditCard} label="Método de Pago" value={pmLabels[tx.payment_method] || tx.payment_method} />
            <DetailRow icon={Calendar} label="Condición de Pago" value={tx.payment_terms || "NET30"} />
            <DetailRow icon={Calendar} label="Fecha Vencimiento" value={tx.due_date ? new Date(tx.due_date).toLocaleDateString("es-EC") : "—"} />
          </div>

          {/* Dates */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 divide-y divide-[var(--border)]">
            <DetailRow icon={Calendar} label="Fecha Contabilización" value={tx.posting_date ? new Date(tx.posting_date).toLocaleDateString("es-EC") : "—"} />
            <DetailRow icon={Calendar} label="Fecha Documento" value={tx.document_date ? new Date(tx.document_date).toLocaleDateString("es-EC") : "—"} />
            <DetailRow icon={Clock} label="Creación" value={new Date(tx.created_at).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "medium" })} />
          </div>

          {/* Line items */}
          {tx.line_items && tx.line_items.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">Partidas ({tx.line_items.length})</h4>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {tx.line_items.map((item, i) => (
                  <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--text-primary)]">{item.description}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {item.quantity} × {formatCurrency(convert(item.unit_price), currency)} · Cta: {item.gl_account}
                      </p>
                    </div>
                    <p className="text-xs font-mono font-semibold shrink-0 text-[var(--text-primary)]">
                      {formatCurrency(convert(item.total), currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-4">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Descripción</p>
            <p className="text-xs text-[var(--text-primary)]">{tx.description}</p>
            {tx.reference && (
              <p className="text-[10px] text-[var(--text-muted)] mt-2">Referencia: {tx.reference}</p>
            )}
          </div>

          {/* Currency info */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-4">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Moneda Original</p>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-[var(--text-primary)]">{tx.currency}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {formatCurrency(tx.amount, tx.currency as CurrencyCode)} @ {tx.exchange_rate}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                → {formatCurrency(tx.amount_usd, "USD")} USD
              </span>
            </div>
          </div>

          {/* ── Notes Section ──────────────────────── */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Notas</p>
              {notesSaved && (
                <span className="text-[10px] text-emerald-500 font-medium">✓ Guardado</span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agregar notas sobre esta transacción..."
              className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-violet-500 transition-colors"
              rows={3}
            />
            <button
              onClick={handleSaveNotes}
              disabled={notesSaving || notes === (tx.notes || "")}
              className="mt-2 w-full py-2 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-500 hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {notesSaving ? "Guardando..." : "Guardar notas"}
            </button>
          </div>

          {/* ── AI Analysis Section ─────────────────── */}
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <p className="text-xs font-semibold text-violet-500">GRIXI AI — Análisis</p>
            </div>
            {aiAnalysis ? (
              <div className="prose-finance text-xs text-[var(--text-secondary)] leading-relaxed">
                <ReactMarkdown
                  components={{
                    strong: ({ children }) => <strong className="font-bold text-[var(--text-primary)]">{children}</strong>,
                    em: ({ children }) => <em className="italic text-violet-400">{children}</em>,
                    ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 my-2">{children}</ol>,
                    li: ({ children }) => <li className="text-xs leading-relaxed">{children}</li>,
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    h1: ({ children }) => <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1 mt-3">{children}</h3>,
                    h2: ({ children }) => <h4 className="text-xs font-bold text-[var(--text-primary)] mb-1 mt-2">{children}</h4>,
                    h3: ({ children }) => <h5 className="text-xs font-semibold text-[var(--text-primary)] mb-1 mt-2">{children}</h5>,
                    code: ({ children }) => <code className="px-1 py-0.5 rounded bg-violet-500/10 text-violet-400 font-mono text-[10px]">{children}</code>,
                    hr: () => <hr className="border-[var(--border)] my-3" />,
                  }}
                >
                  {aiAnalysis}
                </ReactMarkdown>
              </div>
            ) : (
              <button
                onClick={handleAnalyze}
                disabled={aiLoading}
                className="w-full py-2.5 rounded-lg text-xs font-medium bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {aiLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                    Analizando con IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Analizar transacción con IA
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Detail Row ──────────────────────────────────
function DetailRow({
  icon: Icon, label, value, highlight,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <span className={cn("text-xs font-mono text-[var(--text-primary)]", highlight && "font-bold")}>{value}</span>
    </div>
  );
}

// ── Stable random for aging data ────────────────
function randomStable(min: number, max: number, seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  const r = x - Math.floor(x);
  return Math.round(min + r * (max - min));
}
