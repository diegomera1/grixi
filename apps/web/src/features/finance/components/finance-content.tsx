"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  BarChart3,
  PieChart,
  Layers,
  Zap,
  Building2,
  Receipt,
  CreditCard,
  Banknote,
  RefreshCw,
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

// ── Transaction config ─────────────────────────
const TX_CONFIG: Record<string, { label: string; icon: typeof DollarSign; color: string }> = {
  invoice_revenue: { label: "Factura de venta", icon: Receipt, color: "#10B981" },
  customer_payment: { label: "Cobro de cliente", icon: ArrowUpRight, color: "#06B6D4" },
  vendor_invoice: { label: "Factura proveedor", icon: CreditCard, color: "#F59E0B" },
  vendor_payment: { label: "Pago a proveedor", icon: ArrowDownRight, color: "#EF4444" },
  manual_entry: { label: "Asiento manual", icon: Layers, color: "#8B5CF6" },
  payroll: { label: "Nómina", icon: Building2, color: "#EC4899" },
  tax_payment: { label: "Impuestos", icon: Banknote, color: "#F97316" },
};

const DONUT_COLORS = [
  "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444",
  "#EC4899", "#F97316", "#6366F1", "#14B8A6", "#A855F7",
];

const TABS = [
  { id: "live", label: "En Vivo", icon: Zap },
  { id: "pnl", label: "Desglose P&L", icon: BarChart3 },
  { id: "centers", label: "Centros de Costo", icon: PieChart },
] as const;

type TabId = (typeof TABS)[number]["id"];

type Props = {
  initialTransactions: FinanceTransaction[];
  costCenters: FinanceCostCenter[];
};

export function FinanceContent({ initialTransactions, costCenters }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("live");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const { isSimulating } = useFinanceSimulator();
  const { liveTransactions, kpis, departmentBreakdown } =
    useFinanceRealtime(initialTransactions);

  // Convert KPIs to selected currency
  const convertedKPIs = useMemo(
    () => ({
      totalRevenue: convertCurrency(kpis.totalRevenue, "USD", currency),
      totalExpenses: convertCurrency(kpis.totalExpenses, "USD", currency),
      ebitda: convertCurrency(kpis.ebitda, "USD", currency),
      cashFlow: convertCurrency(kpis.cashFlow, "USD", currency),
      netBalance: convertCurrency(kpis.netBalance, "USD", currency),
    }),
    [kpis, currency]
  );

  // Department donut data
  const deptData = useMemo(() => {
    const raw = departmentBreakdown();
    return raw.slice(0, 8).map((d) => ({
      ...d,
      value: convertCurrency(d.value, "USD", currency),
    }));
  }, [departmentBreakdown, currency]);

  // P&L breakdown (hierarchical)
  const pnlTree = useMemo(() => {
    const txs = [...initialTransactions, ...liveTransactions];
    const revenue = txs
      .filter((t) => t.category === "revenue")
      .reduce((s, t) => s + convertCurrency(t.amount_usd, "USD", currency), 0);
    const paymentIn = txs
      .filter((t) => t.category === "payment_in")
      .reduce((s, t) => s + convertCurrency(t.amount_usd, "USD", currency), 0);
    const expenses = txs
      .filter((t) => t.category === "expense")
      .reduce((s, t) => s + convertCurrency(t.amount_usd, "USD", currency), 0);
    const paymentOut = txs
      .filter((t) => t.category === "payment_out")
      .reduce((s, t) => s + convertCurrency(t.amount_usd, "USD", currency), 0);

    // Group expenses by department
    const expByDept = new Map<string, number>();
    txs.filter((t) => t.category === "expense" || t.category === "payment_out").forEach((t) => {
      const val = expByDept.get(t.department) || 0;
      expByDept.set(t.department, val + convertCurrency(t.amount_usd, "USD", currency));
    });

    return {
      revenue,
      paymentIn,
      grossIncome: revenue + paymentIn,
      expenses,
      paymentOut,
      totalExpenses: expenses + paymentOut,
      ebitda: revenue + paymentIn - expenses - paymentOut,
      expensesByDept: Array.from(expByDept.entries())
        .map(([dept, amount]) => ({ dept, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [initialTransactions, liveTransactions, currency]);

  // Recent cash flow timeline (last 50 live transactions for area chart)
  const cashFlowTimeline = useMemo(() => {
    const recent = liveTransactions.slice(0, 60).reverse();
    let runningIn = 0;
    let runningOut = 0;
    return recent.map((tx, i) => {
      const amt = convertCurrency(tx.amount_usd, "USD", currency);
      if (tx.category === "revenue" || tx.category === "payment_in") {
        runningIn += amt;
      } else {
        runningOut += amt;
      }
      return {
        idx: i,
        inflow: Math.round(runningIn),
        outflow: Math.round(runningOut),
        net: Math.round(runningIn - runningOut),
      };
    });
  }, [liveTransactions, currency]);

  // Aging data (simulated from transactions)
  const agingData = useMemo(() => {
    const buckets = [
      { range: "0-30d", amount: convertedKPIs.totalRevenue * 0.35 },
      { range: "30-60d", amount: convertedKPIs.totalRevenue * 0.25 },
      { range: "60-90d", amount: convertedKPIs.totalRevenue * 0.2 },
      { range: "90-120d", amount: convertedKPIs.totalRevenue * 0.12 },
      { range: "120+d", amount: convertedKPIs.totalRevenue * 0.08 },
    ];
    return buckets.map((b) => ({
      ...b,
      amount: Math.round(b.amount * 0.15), // ~15% of revenue as receivables
    }));
  }, [convertedKPIs.totalRevenue]);

  // Time ago helper
  const timeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diffMs / 1000);
    if (secs < 5) return "ahora";
    if (secs < 60) return `hace ${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `hace ${mins}m`;
    return `hace ${Math.floor(mins / 60)}h`;
  };

  return (
    <div className="space-y-5">
      {/* ── Header ───────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Finanzas
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Centro financiero en tiempo real — datos tipo SAP
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-2 rounded-full bg-[var(--success)]/10 px-3 py-1.5 text-xs font-medium text-[var(--success)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" />
            </span>
            {isSimulating ? "Simulando" : "Conectado"}
          </div>

          {/* Currency selector */}
          <div className="flex rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-0.5">
            {(["USD", "EUR", "GBP"] as CurrencyCode[]).map((cur) => (
              <button
                key={cur}
                onClick={() => setCurrency(cur)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  currency === cur
                    ? "bg-[var(--brand)] text-white shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <span>{CURRENCY_CONFIG[cur].flag}</span>
                {cur}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────── */}
      <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab.id
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="finance-tab"
                className="absolute inset-0 rounded-lg bg-[var(--bg-elevated)] shadow-sm"
                transition={{ type: "spring", duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <tab.icon size={14} />
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === "live" && (
          <motion.div
            key="live"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                {
                  label: "Revenue",
                  value: convertedKPIs.totalRevenue,
                  icon: TrendingUp,
                  color: "#10B981",
                  trend: "+12.5%",
                  positive: true,
                },
                {
                  label: "Gastos",
                  value: convertedKPIs.totalExpenses,
                  icon: TrendingDown,
                  color: "#EF4444",
                  trend: "+8.3%",
                  positive: false,
                },
                {
                  label: "EBITDA",
                  value: convertedKPIs.ebitda,
                  icon: Activity,
                  color: "#8B5CF6",
                  trend: "+15.7%",
                  positive: true,
                },
                {
                  label: "Flujo Caja",
                  value: convertedKPIs.cashFlow,
                  icon: RefreshCw,
                  color: "#06B6D4",
                  trend: "+5.2%",
                  positive: true,
                },
                {
                  label: "Balance Neto",
                  value: convertedKPIs.netBalance,
                  icon: DollarSign,
                  color: "#F59E0B",
                  trend: "+10.1%",
                  positive: true,
                },
              ].map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
                >
                  <div className="absolute -right-3 -top-3 opacity-[0.05]">
                    <kpi.icon size={64} />
                  </div>
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${kpi.color}15` }}
                  >
                    <kpi.icon size={16} style={{ color: kpi.color }} />
                  </div>
                  <motion.p
                    key={`${kpi.label}-${kpi.value}`}
                    initial={{ opacity: 0.7, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 font-mono text-lg font-bold text-[var(--text-primary)]"
                  >
                    {formatCurrencyCompact(kpi.value, currency)}
                  </motion.p>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {kpi.label}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold",
                        kpi.positive
                          ? "text-[var(--success)]"
                          : "text-[var(--error)]"
                      )}
                    >
                      {kpi.trend}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Main grid: Charts + Ticker */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Cash Flow Chart */}
              <div className="col-span-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
                      Flujo de Caja en Vivo
                    </h3>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Ingresos vs egresos acumulados — actualización cada 2s
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#10B981]" />{" "}
                      Ingresos
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#EF4444]" />{" "}
                      Egresos
                    </span>
                  </div>
                </div>
                <div className="h-[200px]">
                  {cashFlowTimeline.length > 2 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cashFlowTimeline}>
                        <defs>
                          <linearGradient
                            id="inflowGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#10B981"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="100%"
                              stopColor="#10B981"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="outflowGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#EF4444"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="100%"
                              stopColor="#EF4444"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis hide />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: "var(--text-muted)",
                            fontSize: 10,
                          }}
                          width={50}
                          tickFormatter={(v) =>
                            formatCurrencyCompact(v, currency)
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            borderRadius: "12px",
                            fontSize: "12px",
                            color: "var(--text-primary)",
                          }}
                          formatter={(v) => formatCurrency(Number(v), currency)}
                        />
                        <Area
                          type="monotone"
                          dataKey="inflow"
                          stroke="#10B981"
                          strokeWidth={2}
                          fill="url(#inflowGrad)"
                          name="Ingresos"
                          isAnimationActive={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="outflow"
                          stroke="#EF4444"
                          strokeWidth={2}
                          fill="url(#outflowGrad)"
                          name="Egresos"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                      <Activity
                        size={20}
                        className="mr-2 animate-pulse"
                      />
                      Esperando datos en vivo...
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction Ticker */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
                    Feed en Vivo
                  </h3>
                  <span className="rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--brand)]">
                    {liveTransactions.length} tx
                  </span>
                </div>
                <div className="max-h-[200px] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                  <AnimatePresence initial={false}>
                    {liveTransactions.slice(0, 20).map((tx) => {
                      const cfg = TX_CONFIG[tx.transaction_type] || {
                        label: tx.transaction_type,
                        icon: DollarSign,
                        color: "#999",
                      };
                      const isPositive =
                        tx.category === "revenue" ||
                        tx.category === "payment_in";
                      const Icon = cfg.icon;
                      return (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0, x: 20, height: 0 }}
                          animate={{ opacity: 1, x: 0, height: "auto" }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.3 }}
                          className="flex items-center gap-2 rounded-lg bg-[var(--bg-muted)]/50 p-2"
                        >
                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                            style={{
                              backgroundColor: `${cfg.color}15`,
                            }}
                          >
                            <Icon
                              size={12}
                              style={{ color: cfg.color }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">
                              {tx.counterparty}
                            </p>
                            <p className="text-[9px] text-[var(--text-muted)]">
                              {cfg.label} · {timeAgo(tx.created_at)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 font-mono text-[11px] font-bold",
                              isPositive
                                ? "text-[var(--success)]"
                                : "text-[var(--error)]"
                            )}
                          >
                            {isPositive ? "+" : "-"}
                            {formatCurrencyCompact(
                              convertCurrency(
                                tx.amount_usd,
                                "USD",
                                currency
                              ),
                              currency
                            )}
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {liveTransactions.length === 0 && (
                    <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                      <Zap
                        size={20}
                        className="mx-auto mb-2 animate-pulse"
                      />
                      Esperando transacciones...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Second row: Expense Donut + AR Aging + Balance */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Expense by Department Donut */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <h3 className="mb-1 text-[13px] font-semibold text-[var(--text-primary)]">
                  Gastos por Departamento
                </h3>
                <p className="mb-3 text-[10px] text-[var(--text-muted)]">
                  Distribución proporcional
                </p>
                <div className="h-[160px]">
                  {deptData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={deptData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={2}
                          dataKey="value"
                          isAnimationActive={false}
                        >
                          {deptData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            borderRadius: "12px",
                            fontSize: "11px",
                          }}
                          formatter={(v) =>
                            formatCurrency(Number(v), currency)
                          }
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
                      Cargando...
                    </div>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {deptData.slice(0, 6).map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            DONUT_COLORS[i % DONUT_COLORS.length],
                        }}
                      />
                      <span className="truncate text-[9px] text-[var(--text-muted)]">
                        {d.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AR Aging */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <h3 className="mb-1 text-[13px] font-semibold text-[var(--text-primary)]">
                  Aging de Cartera
                </h3>
                <p className="mb-3 text-[10px] text-[var(--text-muted)]">
                  Cuentas por cobrar por antigüedad
                </p>
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingData} layout="vertical" barSize={16}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "var(--text-muted)",
                          fontSize: 10,
                        }}
                        tickFormatter={(v) =>
                          formatCurrencyCompact(v, currency)
                        }
                      />
                      <YAxis
                        dataKey="range"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "var(--text-muted)",
                          fontSize: 10,
                        }}
                        width={50}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          fontSize: "11px",
                        }}
                        formatter={(v) =>
                          formatCurrency(Number(v), currency)
                        }
                      />
                      <Bar
                        dataKey="amount"
                        name="Monto"
                        radius={[0, 6, 6, 0]}
                        isAnimationActive={false}
                      >
                        {agingData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={
                              i < 2
                                ? "#10B981"
                                : i < 3
                                ? "#F59E0B"
                                : "#EF4444"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Balance Sheet Mini */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <h3 className="mb-1 text-[13px] font-semibold text-[var(--text-primary)]">
                  Balance General
                </h3>
                <p className="mb-3 text-[10px] text-[var(--text-muted)]">
                  Activos vs Pasivos
                </p>
                <div className="space-y-4">
                  {/* Assets */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--success)]">
                        Activos
                      </span>
                      <motion.span
                        key={convertedKPIs.totalRevenue}
                        initial={{ opacity: 0.5 }}
                        animate={{ opacity: 1 }}
                        className="font-mono font-bold text-[var(--success)]"
                      >
                        {formatCurrencyCompact(
                          convertedKPIs.totalRevenue + convertedKPIs.cashFlow,
                          currency
                        )}
                      </motion.span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#06B6D4]"
                        animate={{
                          width: `${Math.min(
                            ((convertedKPIs.totalRevenue +
                              convertedKPIs.cashFlow) /
                              (convertedKPIs.totalRevenue +
                                convertedKPIs.cashFlow +
                                convertedKPIs.totalExpenses || 1)) *
                              100,
                            100
                          )}%`,
                        }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                  {/* Liabilities */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--error)]">
                        Pasivos
                      </span>
                      <motion.span
                        key={convertedKPIs.totalExpenses}
                        initial={{ opacity: 0.5 }}
                        animate={{ opacity: 1 }}
                        className="font-mono font-bold text-[var(--error)]"
                      >
                        {formatCurrencyCompact(
                          convertedKPIs.totalExpenses,
                          currency
                        )}
                      </motion.span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[#EF4444] to-[#F59E0B]"
                        animate={{
                          width: `${Math.min(
                            (convertedKPIs.totalExpenses /
                              (convertedKPIs.totalRevenue +
                                convertedKPIs.cashFlow +
                                convertedKPIs.totalExpenses || 1)) *
                              100,
                            100
                          )}%`,
                        }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                  {/* Equity */}
                  <div className="rounded-lg bg-[var(--bg-muted)]/50 p-3 text-center">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Patrimonio Neto
                    </span>
                    <motion.p
                      key={convertedKPIs.netBalance}
                      initial={{ scale: 0.95, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={cn(
                        "font-mono text-lg font-bold",
                        convertedKPIs.netBalance >= 0
                          ? "text-[var(--success)]"
                          : "text-[var(--error)]"
                      )}
                    >
                      {formatCurrency(convertedKPIs.netBalance, currency)}
                    </motion.p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Tab: P&L Desglose ─────────────── */}
        {activeTab === "pnl" && (
          <motion.div
            key="pnl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6"
          >
            <h3 className="mb-1 text-base font-semibold text-[var(--text-primary)]">
              Estado de Resultados (P&L)
            </h3>
            <p className="mb-6 text-xs text-[var(--text-muted)]">
              Desglose jerárquico tipo SAP — {CURRENCY_CONFIG[currency].flag}{" "}
              {currency}
            </p>

            <div className="space-y-1">
              {/* Revenue */}
              <PnLRow
                label="Ingresos por Ventas"
                amount={pnlTree.revenue}
                currency={currency}
                type="revenue"
                indent={0}
              />
              <PnLRow
                label="Cobros de Clientes"
                amount={pnlTree.paymentIn}
                currency={currency}
                type="revenue"
                indent={1}
              />
              <PnLRow
                label="TOTAL INGRESOS"
                amount={pnlTree.grossIncome}
                currency={currency}
                type="subtotal"
                indent={0}
                bold
              />

              <div className="my-3 border-t border-[var(--border)]" />

              {/* Expenses */}
              <PnLRow
                label="Gastos Operativos"
                amount={pnlTree.expenses}
                currency={currency}
                type="expense"
                indent={0}
              />
              {pnlTree.expensesByDept.slice(0, 5).map((d) => (
                <PnLRow
                  key={d.dept}
                  label={d.dept}
                  amount={d.amount}
                  currency={currency}
                  type="expense"
                  indent={2}
                />
              ))}
              <PnLRow
                label="Pagos a Proveedores"
                amount={pnlTree.paymentOut}
                currency={currency}
                type="expense"
                indent={1}
              />
              <PnLRow
                label="TOTAL EGRESOS"
                amount={pnlTree.totalExpenses}
                currency={currency}
                type="subtotal"
                indent={0}
                bold
              />

              <div className="my-3 border-t-2 border-[var(--border)]" />

              {/* EBITDA */}
              <PnLRow
                label="EBITDA"
                amount={pnlTree.ebitda}
                currency={currency}
                type="total"
                indent={0}
                bold
              />
            </div>
          </motion.div>
        )}

        {/* ── Tab: Centros de Costo ────────── */}
        {activeTab === "centers" && (
          <motion.div
            key="centers"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {costCenters.map((cc, i) => {
                const budgetConverted = convertCurrency(
                  cc.budget_annual,
                  "USD",
                  currency
                );
                // Find actual spend from department breakdown
                const deptSpend =
                  deptData.find((d) => d.name === cc.department)?.value || 0;
                const pct = budgetConverted > 0
                  ? Math.min((deptSpend / budgetConverted) * 100, 150)
                  : 0;

                return (
                  <motion.div
                    key={cc.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          {cc.department}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {cc.code}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          pct > 100
                            ? "bg-[var(--error)]/10 text-[var(--error)]"
                            : pct > 80
                            ? "bg-[var(--warning)]/10 text-[var(--warning)]"
                            : "bg-[var(--success)]/10 text-[var(--success)]"
                        )}
                      >
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                        <span>
                          Ejecutado: {formatCurrencyCompact(deptSpend, currency)}
                        </span>
                        <span>
                          Presupuesto:{" "}
                          {formatCurrencyCompact(budgetConverted, currency)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor:
                              pct > 100
                                ? "#EF4444"
                                : pct > 80
                                ? "#F59E0B"
                                : "#10B981",
                          }}
                          animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── P&L Row Component ─────────────────────────
function PnLRow({
  label,
  amount,
  currency,
  type,
  indent,
  bold,
}: {
  label: string;
  amount: number;
  currency: CurrencyCode;
  type: "revenue" | "expense" | "subtotal" | "total";
  indent: number;
  bold?: boolean;
}) {
  const colorMap = {
    revenue: "text-[var(--success)]",
    expense: "text-[var(--error)]",
    subtotal: "text-[var(--text-primary)]",
    total: amount >= 0 ? "text-[var(--success)]" : "text-[var(--error)]",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-[var(--bg-muted)]/50",
        bold && "bg-[var(--bg-muted)]/30",
        type === "total" && "bg-[var(--brand-surface)] border border-[var(--brand)]/20"
      )}
      style={{ paddingLeft: `${12 + indent * 24}px` }}
    >
      <span
        className={cn(
          "text-sm",
          bold
            ? "font-bold text-[var(--text-primary)]"
            : "text-[var(--text-secondary)]",
          type === "total" && "text-base font-bold"
        )}
      >
        {indent > 0 && !bold && (
          <span className="mr-2 text-[var(--text-muted)]">
            {indent === 1 ? "├" : "│ └"}
          </span>
        )}
        {label}
      </span>
      <motion.span
        key={amount}
        initial={{ opacity: 0.5, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "font-mono font-bold",
          colorMap[type],
          type === "total" ? "text-lg" : "text-sm"
        )}
      >
        {formatCurrency(amount, currency)}
      </motion.span>
    </motion.div>
  );
}
