"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  Users,
  Info,
  ChevronDown,
  ChevronRight,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FinanceTransaction, CurrencyCode } from "../types";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

// ── KPI Tooltip definitions ─────────────────────
const KPI_TOOLTIPS: Record<string, string> = {
  "Total Facturado": "Total Invoiced — Suma de todas las facturas emitidas a clientes en el periodo. Incluye facturas pendientes y cobradas.",
  "Cobrado": "Collected — Monto total de pagos recibidos de clientes. Incluye pagos parciales y totales.",
  "Pendiente": "Outstanding — Saldo pendiente de cobro. Diferencia entre lo facturado y lo cobrado.",
  "DSO": "Days Sales Outstanding — Promedio de días que tarda tu empresa en cobrar facturas a clientes. Un DSO menor indica una gestión de cobro más eficiente. Benchmark industria: 30-45 días.",
};

// ── Mock partial payment data ────────────────
type InvoicePayment = {
  date: string;
  amount: number;
  method: string;
  reference: string;
};

// Generate deterministic mock payments for invoices
function getMockPayments(invoiceId: string, totalAmount: number): InvoicePayment[] {
  // Use invoice ID hash to deterministically decide which invoices have partial payments
  const hash = invoiceId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const hasPartialPayment = hash % 5 < 2; // ~40% of invoices have partial payments

  if (!hasPartialPayment) return [];

  const paymentCount = (hash % 3) + 1; // 1-3 payments
  const payments: InvoicePayment[] = [];
  let remaining = totalAmount;

  for (let i = 0; i < paymentCount && remaining > 0; i++) {
    const pct = i === paymentCount - 1 ? 0.3 + (hash % 20) / 100 : 0.2 + (hash % 30) / 100;
    const paymentAmount = Math.min(Math.round(totalAmount * pct), remaining);
    if (paymentAmount <= 0) break;
    remaining -= paymentAmount;
    const daysAgo = 5 + i * 15 + (hash % 10);
    const paymentDate = new Date();
    paymentDate.setDate(paymentDate.getDate() - daysAgo);

    payments.push({
      date: paymentDate.toISOString(),
      amount: paymentAmount,
      method: ["Transferencia", "Cheque", "Tarjeta", "Depósito"][hash % 4],
      reference: `PAY-${String(hash).slice(0, 4)}-${i + 1}`,
    });
  }
  return payments;
}

// ── KPI With Tooltip ─────────────────────────
function KPIWithTooltip({
  label,
  value,
  icon: Icon,
  color,
  isDays,
}: {
  label: string;
  value: number | string;
  icon: typeof DollarSign;
  color: string;
  isDays?: boolean;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipText = KPI_TOOLTIPS[label];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 relative">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${color}-500/10`}>
          <Icon className={`w-4 h-4 text-${color}-500`} />
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
      <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">
        {typeof value === "string" ? value : isDays ? `${value}d` : value}
      </p>
      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

export function AccountsReceivableTab({
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
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  // Filter to AR-related transactions
  const arInvoices = useMemo(
    () => transactions.filter((t) => t.transaction_type === "invoice_revenue"),
    [transactions]
  );
  const arPayments = useMemo(
    () => transactions.filter((t) => t.transaction_type === "customer_payment"),
    [transactions]
  );

  const totalInvoiced = arInvoices.reduce((s, t) => s + t.amount_usd, 0);
  const totalCollected = arPayments.reduce((s, t) => s + t.amount_usd, 0);
  const outstanding = totalInvoiced - totalCollected;

  // Aging based on due_date
  const now = new Date();
  const aging = useMemo(() => {
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
    for (const inv of arInvoices) {
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
  }, [arInvoices]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of arInvoices) {
      if (inv.status === "cleared") continue;
      map[inv.counterparty] = (map[inv.counterparty] || 0) + inv.amount_usd;
    }
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [arInvoices]);

  // Pending invoices
  const pendingInvoices = useMemo(
    () => arInvoices.filter((t) => t.status !== "cleared").sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return da - db;
    }),
    [arInvoices]
  );

  // DSO calculation
  const dso = totalInvoiced > 0 ? Math.round((outstanding / totalInvoiced) * 365) : 0;

  const agingBars = [
    { label: "Al día", amount: aging.current, color: "#10B981" },
    { label: "1-30 días", amount: aging.d30, color: "#F59E0B" },
    { label: "31-60 días", amount: aging.d60, color: "#F97316" },
    { label: "61-90 días", amount: aging.d90, color: "#EF4444" },
    { label: "90+ días", amount: aging.over90, color: "#DC2626" },
  ];
  const maxAging = Math.max(...agingBars.map((b) => b.amount), 1);

  return (
    <div className="space-y-4">
      {/* KPIs with tooltips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIWithTooltip
          label="Total Facturado"
          value={formatCurrencyCompact(convert(totalInvoiced), currency)}
          icon={DollarSign}
          color="emerald"
        />
        <KPIWithTooltip
          label="Cobrado"
          value={formatCurrencyCompact(convert(totalCollected), currency)}
          icon={TrendingUp}
          color="cyan"
        />
        <KPIWithTooltip
          label="Pendiente"
          value={formatCurrencyCompact(convert(outstanding), currency)}
          icon={Clock}
          color="amber"
        />
        <KPIWithTooltip
          label="DSO"
          value={`${dso}d`}
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Aging */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-1">Aging de Cartera</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Antigüedad de cuentas por cobrar</p>
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

        {/* Top Customers */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-[var(--text-muted)]" />
            <h3 className="font-semibold text-sm text-[var(--text-primary)]">Top Clientes por Deuda</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mb-4">Saldos pendientes más altos</p>
          <div className="space-y-3">
            {topCustomers.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-violet-500/15 text-violet-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs text-[var(--text-primary)] flex-1 truncate">{c.name}</span>
                <span className="text-xs font-mono font-semibold text-amber-500">
                  {formatCurrency(convert(c.amount), currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Invoices with Partial Payment Detail */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Facturas Pendientes ({pendingInvoices.length})</h3>
          <span className="text-[10px] text-[var(--text-muted)]">Click para ver abonos</span>
        </div>
        <div className="divide-y divide-[var(--border)] max-h-[500px] overflow-y-auto">
          {pendingInvoices.slice(0, 20).map((inv) => {
            const isOverdue = inv.due_date && new Date(inv.due_date) < now;
            const payments = getMockPayments(inv.id, inv.amount_usd);
            const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
            const balance = inv.amount_usd - totalPaid;
            const isExpanded = expandedInvoice === inv.id;
            const hasPayments = payments.length > 0;

            return (
              <div key={inv.id}>
                <button
                  onClick={() => {
                    if (hasPayments) {
                      setExpandedInvoice(isExpanded ? null : inv.id);
                    } else {
                      onSelectTx(inv);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-muted)]/30 transition-colors text-left"
                >
                  {hasPayments && (
                    isExpanded ?
                      <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" /> :
                      <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{inv.counterparty}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {inv.invoice_number || inv.sap_document_id} · Vence: {inv.due_date ? new Date(inv.due_date).toLocaleDateString("es-EC") : "—"}
                    </p>
                  </div>
                  {isOverdue && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 font-bold">VENCIDA</span>
                  )}
                  {hasPayments && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-500 font-bold">
                      ABONOS
                    </span>
                  )}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-semibold text-emerald-500">
                      {formatCurrency(convert(inv.amount_usd), currency)}
                    </span>
                    {hasPayments && (
                      <p className="text-[9px] font-mono text-amber-500">
                        Saldo: {formatCurrencyCompact(convert(balance), currency)}
                      </p>
                    )}
                  </div>
                </button>

                {/* Expanded payment detail */}
                <AnimatePresence>
                  {isExpanded && hasPayments && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mx-4 mb-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CreditCard size={14} className="text-[var(--brand)]" />
                          <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                            Historial de Abonos
                          </span>
                        </div>
                        {/* Payment rows */}
                        <div className="space-y-2 mb-3">
                          {payments.map((p, i) => (
                            <div key={i} className="flex items-center gap-3 text-[11px]">
                              <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                              <span className="text-[var(--text-muted)]">
                                {new Date(p.date).toLocaleDateString("es-EC")}
                              </span>
                              <span className="text-[var(--text-secondary)]">{p.method}</span>
                              <span className="font-mono text-[10px] text-[var(--text-muted)]">{p.reference}</span>
                              <span className="ml-auto font-mono font-semibold text-cyan-500">
                                -{formatCurrency(convert(p.amount), currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* Summary */}
                        <div className="border-t border-[var(--border)] pt-2 space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-[var(--text-muted)]">Monto original</span>
                            <span className="font-mono text-[var(--text-primary)]">
                              {formatCurrency(convert(inv.amount_usd), currency)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-[var(--text-muted)]">Total abonado</span>
                            <span className="font-mono text-cyan-500">
                              -{formatCurrency(convert(totalPaid), currency)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-[var(--text-primary)]">Saldo pendiente</span>
                            <span className={cn(
                              "font-mono",
                              balance > 0 ? "text-amber-500" : "text-emerald-500"
                            )}>
                              {formatCurrency(convert(balance), currency)}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="mt-2 h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${(totalPaid / inv.amount_usd) * 100}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                          <p className="text-[9px] text-[var(--text-muted)] text-center">
                            {Math.round((totalPaid / inv.amount_usd) * 100)}% cobrado
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
