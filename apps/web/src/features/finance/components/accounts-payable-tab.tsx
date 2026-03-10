"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Clock,
  CalendarCheck,
  Building2,
  Info,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils/cn";
import type { FinanceTransaction, CurrencyCode } from "../types";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

// ── KPI Tooltip definitions ─────────────────────
const KPI_TOOLTIPS: Record<string, string> = {
  "Total Facturas": "Total Invoiced — Suma de todas las facturas recibidas de proveedores. Incluye montos pendientes y ya pagados.",
  "Pagado": "Total Paid — Monto acumulado de pagos realizados a proveedores en el periodo.",
  "Pendiente": "Outstanding Payables — Saldo total pendiente de pago a proveedores. Diferencia entre facturado y pagado.",
  "DPO": "Days Payable Outstanding — Promedio de días que tu empresa tarda en pagar a proveedores. Optimizar sin dañar relaciones comerciales. Benchmark industria: 30-60 días.",
};

// ── KPI With Tooltip ─────────────────────────
function KPIWithTooltip({
  label,
  value,
  icon: Icon,
  color,
  bgClass,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  color: string;
  bgClass: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipText = KPI_TOOLTIPS[label];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 relative">
      <div className="flex items-center justify-between mb-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", bgClass)}>
          <Icon className={cn("w-4 h-4", color)} />
        </div>
        {tooltipText && (
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
                    {tooltipText}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">{value}</p>
      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

export function AccountsPayableTab({
  transactions,
  currency,
  convert,
  onSelectTx,
}: {
  transactions: FinanceTransaction[];
  currency: CurrencyCode;
  convert: (v: number) => number;
  onSelectTx: (tx: FinanceTransaction) => void;
}) {
  const apInvoices = useMemo(
    () => transactions.filter((t) => t.transaction_type === "vendor_invoice"),
    [transactions]
  );
  const apPayments = useMemo(
    () => transactions.filter((t) => t.transaction_type === "vendor_payment"),
    [transactions]
  );

  const totalInvoiced = apInvoices.reduce((s, t) => s + t.amount_usd, 0);
  const totalPaid = apPayments.reduce((s, t) => s + t.amount_usd, 0);
  const outstanding = totalInvoiced - totalPaid;
  const dpo = totalInvoiced > 0 ? Math.round((outstanding / totalInvoiced) * 365) : 0;

  const now = new Date();

  // AP Aging buckets
  const aging = useMemo(() => {
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
    for (const inv of apInvoices) {
      if (inv.status === "cleared") continue;
      const due = inv.due_date ? new Date(inv.due_date) : new Date(inv.created_at);
      const days = Math.floor((now.getTime() - due.getTime()) / 86400000);
      if (days <= 0) buckets.current += inv.amount_usd;
      else if (days <= 30) buckets.d30 += inv.amount_usd;
      else if (days <= 60) buckets.d60 += inv.amount_usd;
      else if (days <= 90) buckets.d90 += inv.amount_usd;
      else buckets.over90 += inv.amount_usd;
    }
    return buckets;
  }, [apInvoices]);

  const agingBars = [
    { label: "Al día", amount: aging.current, color: "#10B981" },
    { label: "1-30 días", amount: aging.d30, color: "#F59E0B" },
    { label: "31-60 días", amount: aging.d60, color: "#F97316" },
    { label: "61-90 días", amount: aging.d90, color: "#EF4444" },
    { label: "90+ días", amount: aging.over90, color: "#DC2626" },
  ];
  const maxAging = Math.max(...agingBars.map((b) => b.amount), 1);

  // Income vs Expense breakdown by month
  const incomeExpenseData = useMemo(() => {
    const monthMap: Record<string, { month: string; ingresos: number; egresos: number }> = {};
    for (const t of transactions) {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("es-EC", { month: "short" }).charAt(0).toUpperCase() + d.toLocaleDateString("es-EC", { month: "short" }).slice(1);
      if (!monthMap[key]) monthMap[key] = { month: label, ingresos: 0, egresos: 0 };

      if (["revenue", "payment_in"].includes(t.category)) {
        monthMap[key].ingresos += t.amount_usd;
      } else {
        monthMap[key].egresos += t.amount_usd;
      }
    }
    return Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
  }, [transactions]);

  // Upcoming payments 
  const upcomingPayments = useMemo(() => {
    return apInvoices
      .filter((t) => t.status !== "cleared" && t.due_date)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 15);
  }, [apInvoices]);

  // Top vendors
  const topVendors = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of apInvoices) {
      if (inv.status === "cleared") continue;
      map[inv.counterparty] = (map[inv.counterparty] || 0) + inv.amount_usd;
    }
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [apInvoices]);

  // By payment method 
  const byMethod = useMemo(() => {
    const map: Record<string, number> = {};
    const methodLabels: Record<string, string> = {
      transfer: "Transferencia",
      check: "Cheque",
      cash: "Efectivo",
      credit_card: "T. Crédito",
      direct_debit: "Débito",
    };
    for (const t of [...apInvoices, ...apPayments]) {
      const key = t.payment_method || "transfer";
      map[key] = (map[key] || 0) + t.amount_usd;
    }
    return Object.entries(map)
      .map(([method, amount]) => ({ method, label: methodLabels[method] || method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [apInvoices, apPayments]);

  const maxMethod = Math.max(...byMethod.map((m) => m.amount), 1);
  const methodColors = ["#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#F43F5E"];

  // Total income vs total expense summary
  const totalIncome = useMemo(() =>
    transactions.filter((t) => ["revenue", "payment_in"].includes(t.category)).reduce((s, t) => s + t.amount_usd, 0),
    [transactions]
  );
  const totalExpense = useMemo(() =>
    transactions.filter((t) => ["expense", "payment_out"].includes(t.category)).reduce((s, t) => s + t.amount_usd, 0),
    [transactions]
  );

  return (
    <div className="space-y-4">
      {/* KPIs with tooltips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIWithTooltip
          label="Total Facturas"
          value={formatCurrencyCompact(convert(totalInvoiced), currency)}
          icon={DollarSign}
          color="text-rose-500"
          bgClass="bg-rose-500/10"
        />
        <KPIWithTooltip
          label="Pagado"
          value={formatCurrencyCompact(convert(totalPaid), currency)}
          icon={TrendingDown}
          color="text-emerald-500"
          bgClass="bg-emerald-500/10"
        />
        <KPIWithTooltip
          label="Pendiente"
          value={formatCurrencyCompact(convert(outstanding), currency)}
          icon={Clock}
          color="text-amber-500"
          bgClass="bg-amber-500/10"
        />
        <KPIWithTooltip
          label="DPO"
          value={`${dpo}d`}
          icon={CalendarCheck}
          color="text-violet-500"
          bgClass="bg-violet-500/10"
        />
      </div>

      {/* Income vs Expense Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Ingresos Totales</p>
            <p className="text-xl font-bold font-mono text-emerald-400">
              {formatCurrencyCompact(convert(totalIncome), currency)}
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500/15 flex items-center justify-center">
            <ArrowDownRight className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <p className="text-[10px] text-rose-400 uppercase tracking-wider font-semibold">Egresos Totales</p>
            <p className="text-xl font-bold font-mono text-rose-400">
              {formatCurrencyCompact(convert(totalExpense), currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AP Aging Chart */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-1">Aging de Cuentas por Pagar</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Antigüedad de obligaciones pendientes</p>
          <div className="space-y-3">
            {agingBars.map((bar) => (
              <div key={bar.label} className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)] w-16 shrink-0">{bar.label}</span>
                <div className="flex-1 h-6 bg-[var(--bg-muted)] rounded-lg overflow-hidden">
                  <motion.div
                    className="h-full rounded-lg flex items-center px-2"
                    style={{ backgroundColor: bar.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(bar.amount / maxAging) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  >
                    {bar.amount > 0 && (
                      <span className="text-[10px] text-white font-mono font-bold whitespace-nowrap">
                        {formatCurrencyCompact(convert(bar.amount), currency)}
                      </span>
                    )}
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Income vs Expense Breakdown Chart */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-1">Ingresos vs Egresos</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Comparación mensual</p>
          <div className="h-[200px]">
            {incomeExpenseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeExpenseData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => formatCurrencyCompact(convert(Number(v)), currency)}
                  />
                  <RechartsTooltip
                    contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "11px", color: "var(--text-primary)" }}
                    formatter={(v) => formatCurrency(convert(Number(v)), currency)}
                  />
                  <Bar dataKey="ingresos" fill="#10B981" radius={[4, 4, 0, 0]} name="Ingresos" />
                  <Bar dataKey="egresos" fill="#F43F5E" radius={[4, 4, 0, 0]} name="Egresos" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
                Esperando datos...
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Vendors */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
            <h3 className="font-semibold text-sm text-[var(--text-primary)]">Top Proveedores</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mb-4">Mayor deuda pendiente</p>
          <div className="space-y-3">
            {topVendors.map((v, i) => (
              <div key={v.name} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs text-[var(--text-primary)] flex-1 truncate">{v.name}</span>
                <span className="text-xs font-mono font-semibold text-rose-500">
                  {formatCurrency(convert(v.amount), currency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* By Payment Method */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-1">Por Método de Pago</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Distribución de pagos</p>
          <div className="space-y-3">
            {byMethod.map((m, i) => (
              <div key={m.method} className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)] w-20 shrink-0">{m.label}</span>
                <div className="flex-1 h-5 bg-[var(--bg-muted)] rounded-lg overflow-hidden">
                  <motion.div
                    className="h-full rounded-lg"
                    style={{ backgroundColor: methodColors[i % methodColors.length] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(m.amount / maxMethod) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <span className="text-[10px] font-mono text-[var(--text-muted)] w-16 text-right">
                  {formatCurrencyCompact(convert(m.amount), currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming Payments Timeline */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Calendario de Pagos</h3>
          <p className="text-xs text-[var(--text-muted)]">Próximas obligaciones por fecha de vencimiento</p>
        </div>
        <div className="divide-y divide-[var(--border)] max-h-[400px] overflow-y-auto">
          {upcomingPayments.map((inv) => {
            const isOverdue = inv.due_date && new Date(inv.due_date) < now;
            const daysUntil = inv.due_date ? Math.ceil((new Date(inv.due_date).getTime() - now.getTime()) / 86400000) : 0;
            return (
              <button
                key={inv.id}
                onClick={() => onSelectTx(inv)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-muted)]/30 transition-colors text-left"
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 text-center",
                  isOverdue ? "bg-rose-500/15" : "bg-[var(--bg-muted)]"
                )}>
                  <span className={cn("text-[10px] font-bold uppercase", isOverdue ? "text-rose-500" : "text-[var(--text-muted)]")}>
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString("es-EC", { month: "short" }).slice(0, 3) : "—"}
                  </span>
                  <span className={cn("text-sm font-bold", isOverdue ? "text-rose-500" : "text-[var(--text-primary)]")}>
                    {inv.due_date ? new Date(inv.due_date).getDate() : "—"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{inv.counterparty}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {inv.invoice_number || inv.sap_document_id} · {inv.payment_terms}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono font-semibold text-rose-500">
                    {formatCurrency(convert(inv.amount_usd), currency)}
                  </p>
                  <p className={cn("text-[10px]", isOverdue ? "text-rose-500 font-bold" : "text-[var(--text-muted)]")}>
                    {isOverdue ? `${Math.abs(daysUntil)}d vencida` : `en ${daysUntil}d`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
