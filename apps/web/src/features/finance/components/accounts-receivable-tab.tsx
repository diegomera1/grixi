"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FinanceTransaction, CurrencyCode } from "../types";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

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
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Facturado", value: totalInvoiced, icon: DollarSign, color: "emerald" },
          { label: "Cobrado", value: totalCollected, icon: TrendingUp, color: "cyan" },
          { label: "Pendiente", value: outstanding, icon: Clock, color: "amber" },
          { label: "DSO", value: dso, icon: AlertTriangle, color: "rose", isDays: true },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-${kpi.color}-500/10`}>
              <kpi.icon className={`w-4 h-4 text-${kpi.color}-500`} />
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">
              {kpi.isDays ? `${kpi.value}d` : formatCurrencyCompact(convert(kpi.value), currency)}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-1">{kpi.label}</p>
          </div>
        ))}
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

      {/* Pending Invoices */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Facturas Pendientes ({pendingInvoices.length})</h3>
        </div>
        <div className="divide-y divide-[var(--border)] max-h-[400px] overflow-y-auto">
          {pendingInvoices.slice(0, 20).map((inv) => {
            const isOverdue = inv.due_date && new Date(inv.due_date) < now;
            return (
              <button
                key={inv.id}
                onClick={() => onSelectTx(inv)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-muted)]/30 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{inv.counterparty}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {inv.invoice_number || inv.sap_document_id} · Vence: {inv.due_date ? new Date(inv.due_date).toLocaleDateString("es-EC") : "—"}
                  </p>
                </div>
                {isOverdue && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 font-bold">VENCIDA</span>
                )}
                <span className="text-xs font-mono font-semibold text-emerald-500 shrink-0">
                  {formatCurrency(convert(inv.amount_usd), currency)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
