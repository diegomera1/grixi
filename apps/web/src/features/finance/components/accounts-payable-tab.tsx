"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingDown,
  Clock,
  CalendarCheck,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FinanceTransaction, CurrencyCode } from "../types";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

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

  // Upcoming payments (next 30 days)
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

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Facturas", value: totalInvoiced, icon: DollarSign, color: "text-rose-500", bg: "bg-rose-500/10" },
          { label: "Pagado", value: totalPaid, icon: TrendingDown, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Pendiente", value: outstanding, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "DPO", value: dpo, icon: CalendarCheck, color: "text-violet-500", bg: "bg-violet-500/10", isDays: true },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", kpi.bg)}>
              <kpi.icon className={cn("w-4 h-4", kpi.color)} />
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">
              {kpi.isDays ? `${kpi.value}d` : formatCurrencyCompact(convert(kpi.value), currency)}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-1">{kpi.label}</p>
          </div>
        ))}
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
