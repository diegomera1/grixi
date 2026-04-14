"use client";

import { useState, useMemo, useCallback, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  DollarSign,
  ArrowUpDown,
  ChevronRight,
  Download,
  Package,
  CreditCard,
  Clock,
  FileText,
  TrendingUp,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SalesInvoice, SalesCustomer, DemoRole, InvoiceStatus } from "../types";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "../types";

// ── Helpers ───────────────────────────────────────

const PAYMENT_ICONS: Record<string, { icon: typeof CreditCard; color: string }> = {
  transfer: { icon: CreditCard, color: "#3B82F6" },
  cash: { icon: DollarSign, color: "#10B981" },
  credit: { icon: Clock, color: "#8B5CF6" },
  check: { icon: FileText, color: "#F59E0B" },
  card: { icon: CreditCard, color: "#EC4899" },
};

const PAYMENT_LABELS: Record<string, string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
  credit: "Crédito",
  check: "Cheque",
  card: "Tarjeta",
};

// ── CSV Export ─────────────────────────────────────

function exportToCSV(invoices: SalesInvoice[]) {
  const headers = ["# Factura", "Cliente", "Fecha", "Monto", "Moneda", "Estado", "Vendedor", "Método Pago"];
  const rows = invoices.map((inv) => [
    inv.invoice_number,
    inv.customer?.trade_name || inv.customer?.business_name || "—",
    new Date(inv.sale_date).toLocaleDateString("es-EC"),
    Number(inv.total).toFixed(2),
    inv.currency,
    INVOICE_STATUS_LABELS[inv.status],
    inv.seller?.full_name || "—",
    PAYMENT_LABELS[inv.payment_method || "transfer"] || inv.payment_method || "—",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `ventas_grixi_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function InvoiceDetail({ inv }: { inv: SalesInvoice }) {
  const items = inv.items || [];
  const subtotal = items.reduce((s, item) => s + item.quantity * item.unit_price, 0);
  const costTotal = items.reduce((s, item) => s + item.quantity * (item.cost_price || item.unit_price * 0.65), 0);
  const marginPct = subtotal > 0 ? ((subtotal - costTotal) / subtotal) * 100 : 0;
  const marginColor = marginPct >= 35 ? "#10B981" : marginPct >= 20 ? "#F59E0B" : "#EF4444";
  const PayInfo = PAYMENT_ICONS[inv.payment_method || "transfer"] || PAYMENT_ICONS.transfer;
  const daysOverdue = inv.due_date
    ? Math.max(0, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000))
    : 0;
  const isPastDue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== "paid";

  return (
    <motion.tr
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <td colSpan={8} className="p-0">
        <div className="border-t border-[var(--border)] bg-[var(--bg-muted)]/40 px-6 py-4">
          <div className="grid grid-cols-12 gap-4">

            {/* Left: Items Table */}
            <div className="col-span-7">
              <h4 className="mb-2 text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Detalle de Productos ({items.length} línea{items.length !== 1 ? "s" : ""})
              </h4>
              <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/50">
                      {["#", "Producto", "Cant.", "P.Unit.", "Desc.%", "Subtotal", "Margen"].map((h) => (
                        <th key={h} className="px-2.5 py-1.5 text-left text-[7px] font-semibold text-[var(--text-muted)] uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length > 0 ? (
                      items.map((item, i) => {
                        const lineSubtotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
                        const lineCost = item.quantity * (item.cost_price || item.unit_price * 0.65);
                        const lineMargin = lineSubtotal > 0 ? ((lineSubtotal - lineCost) / lineSubtotal) * 100 : 0;
                        const lineMarginColor = lineMargin >= 35 ? "#10B981" : lineMargin >= 20 ? "#F59E0B" : "#EF4444";
                        return (
                          <tr key={i} className="border-b border-[var(--border)] last:border-0">
                            <td className="px-2.5 py-1.5 text-[8px] tabular-nums text-[var(--text-muted)]">
                              {item.item_number || i + 1}
                            </td>
                            <td className="px-2.5 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[var(--bg-muted)]">
                                  <Package size={8} className="text-[var(--text-muted)]" />
                                </div>
                                <span className="text-[8px] text-[var(--text-primary)] truncate max-w-[140px]">
                                  {item.description}
                                </span>
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5 text-[8px] tabular-nums text-[var(--text-secondary)]">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="px-2.5 py-1.5 text-[8px] tabular-nums text-[var(--text-secondary)]">
                              ${item.unit_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-2.5 py-1.5 text-[8px] tabular-nums text-[var(--text-muted)]">
                              {item.discount_percent ? `${item.discount_percent}%` : "—"}
                            </td>
                            <td className="px-2.5 py-1.5 text-[8px] font-semibold tabular-nums text-[var(--text-primary)]">
                              ${lineSubtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-2.5 py-1.5">
                              <span className="text-[7px] font-bold tabular-nums" style={{ color: lineMarginColor }}>
                                {lineMargin.toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-3 py-4 text-center text-[9px] text-[var(--text-muted)]">
                          Sin detalle de líneas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Breakdown */}
              <div className="mt-3 flex justify-end">
                <div className="w-64 space-y-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                  <div className="flex justify-between text-[8px]">
                    <span className="text-[var(--text-muted)]">Subtotal</span>
                    <span className="tabular-nums text-[var(--text-secondary)]">
                      ${Number(inv.subtotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {inv.discount_percent > 0 && (
                    <div className="flex justify-between text-[8px]">
                      <span className="text-[var(--text-muted)]">Descuento ({inv.discount_percent}%)</span>
                      <span className="tabular-nums text-red-500">
                        -${(Number(inv.subtotal) * inv.discount_percent / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-[8px]">
                    <span className="text-[var(--text-muted)]">IVA ({inv.tax_rate}%)</span>
                    <span className="tabular-nums text-[var(--text-secondary)]">
                      ${Number(inv.tax).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="border-t border-[var(--border)] pt-1 flex justify-between text-[9px]">
                    <span className="font-semibold text-[var(--text-primary)]">Total</span>
                    <span className="font-bold tabular-nums text-[var(--text-primary)]">
                      {inv.currency} ${Number(inv.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {inv.currency !== "USD" && (
                    <div className="flex justify-between text-[7px]">
                      <span className="text-[var(--text-muted)]">Equiv. USD (TC: {inv.exchange_rate})</span>
                      <span className="tabular-nums text-[var(--text-muted)]">
                        ${Number(inv.total_usd).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Info Cards */}
            <div className="col-span-5 space-y-3">

              {/* Margin Gauge */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                <h4 className="mb-2 text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Margen Estimado
                </h4>
                <div className="flex items-end gap-3">
                  <span className="text-lg font-bold tabular-nums" style={{ color: marginColor }}>
                    {marginPct.toFixed(1)}%
                  </span>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(marginPct, 100)}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: marginColor }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[7px] text-[var(--text-muted)]">
                      <span>Costo: ${(costTotal / 1000).toFixed(1)}K</span>
                      <span>Venta: ${(subtotal / 1000).toFixed(1)}K</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment & Financial Info */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                <h4 className="mb-2 text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Información Financiera
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Payment Method */}
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${PayInfo.color}15` }}
                    >
                      <PayInfo.icon size={9} style={{ color: PayInfo.color }} />
                    </div>
                    <div>
                      <p className="text-[7px] text-[var(--text-muted)]">Método</p>
                      <p className="text-[8px] font-medium text-[var(--text-primary)]">
                        {PAYMENT_LABELS[inv.payment_method || "transfer"] || inv.payment_method}
                      </p>
                    </div>
                  </div>

                  {/* Payment Terms */}
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--bg-muted)]">
                      <Calendar size={9} className="text-[var(--text-muted)]" />
                    </div>
                    <div>
                      <p className="text-[7px] text-[var(--text-muted)]">Plazo</p>
                      <p className="text-[8px] font-medium text-[var(--text-primary)]">{inv.payment_terms} días</p>
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-md",
                      isPastDue ? "bg-red-500/10" : "bg-[var(--bg-muted)]"
                    )}>
                      <Clock size={9} className={isPastDue ? "text-red-500" : "text-[var(--text-muted)]"} />
                    </div>
                    <div>
                      <p className="text-[7px] text-[var(--text-muted)]">Vencimiento</p>
                      <p className={cn("text-[8px] font-medium", isPastDue ? "text-red-500" : "text-[var(--text-primary)]")}>
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        {isPastDue && ` (+${daysOverdue}d)`}
                      </p>
                    </div>
                  </div>

                  {/* Currency */}
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--bg-muted)]">
                      <TrendingUp size={9} className="text-[var(--text-muted)]" />
                    </div>
                    <div>
                      <p className="text-[7px] text-[var(--text-muted)]">Moneda</p>
                      <p className="text-[8px] font-medium text-[var(--text-primary)]">{inv.currency}</p>
                    </div>
                  </div>

                  {/* Paid At */}
                  {inv.paid_at && (
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10">
                        <CheckCircle2 size={9} className="text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[7px] text-[var(--text-muted)]">Pagado</p>
                        <p className="text-[8px] font-medium text-emerald-600">
                          {new Date(inv.paid_at).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* SAP Reference */}
                  {inv.sap_invoice_number && (
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--bg-muted)]">
                        <FileText size={9} className="text-[var(--text-muted)]" />
                      </div>
                      <div>
                        <p className="text-[7px] text-[var(--text-muted)]">SAP Ref.</p>
                        <p className="text-[8px] font-medium text-[var(--text-primary)] font-mono">{inv.sap_invoice_number}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {inv.notes && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                  <h4 className="mb-1 text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Notas
                  </h4>
                  <p className="text-[8px] text-[var(--text-secondary)] leading-relaxed">
                    {inv.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </td>
    </motion.tr>
  );
}

// ── Main Component ────────────────────────────────

type Props = {
  invoices: SalesInvoice[];
  customers: SalesCustomer[];
  demoRole: DemoRole;
};

export function VentasTab({ invoices, customers, demoRole }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = invoices.filter((inv) => {
      const customer = inv.customer;
      const matchesSearch =
        !search ||
        inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        customer?.business_name?.toLowerCase().includes(search.toLowerCase()) ||
        customer?.code?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || inv.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      if (sortBy === "amount") return Number(b.total_usd) - Number(a.total_usd);
      return new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime();
    });

    return result;
  }, [invoices, search, statusFilter, sortBy]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: invoices.length };
    for (const inv of invoices) {
      counts[inv.status] = (counts[inv.status] || 0) + 1;
    }
    return counts;
  }, [invoices]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="text"
            placeholder="Buscar factura, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] py-2 pl-9 pr-4",
              "text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
              "focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/30"
            )}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortBy(sortBy === "date" ? "amount" : "date")}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
          >
            <ArrowUpDown size={11} />
            {sortBy === "date" ? "Fecha" : "Monto"}
          </button>
          <button
            onClick={() => exportToCSV(filtered)}
            className="flex items-center gap-1.5 rounded-lg bg-[#10B981]/10 px-3 py-2 text-[10px] font-semibold text-[#10B981] transition-colors hover:bg-[#10B981]/20"
          >
            <Download size={11} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", "draft", "confirmed", "invoiced", "paid", "overdue", "cancelled"] as const).map(
          (status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[9px] font-medium transition-all",
                statusFilter === status
                  ? status === "all"
                    ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                    : "text-white"
                  : "bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
              style={
                statusFilter === status && status !== "all"
                  ? {
                      backgroundColor: INVOICE_STATUS_COLORS[status],
                      color: "white",
                    }
                  : undefined
              }
            >
              {status === "all" ? "Todas" : INVOICE_STATUS_LABELS[status]}
              <span className="ml-1 opacity-60">{statusCounts[status] || 0}</span>
            </button>
          )
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["", "# Factura", "Cliente", "Fecha", "Monto", "Moneda", "Estado", "Vendedor"].map(
                (header) => (
                  <th
                    key={header}
                    className="px-4 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv, i) => (
              <Fragment key={inv.id}>
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => toggleExpand(inv.id)}
                  className={cn(
                    "border-b border-[var(--border)] last:border-0 cursor-pointer transition-colors",
                    expandedId === inv.id
                      ? "bg-[var(--bg-muted)]/60"
                      : "hover:bg-[var(--bg-muted)]"
                  )}
                >
                  {/* Chevron */}
                  <td className="w-8 px-2 py-2.5">
                    <motion.div
                      animate={{ rotate: expandedId === inv.id ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight size={11} className="text-[var(--text-muted)]" />
                    </motion.div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] font-semibold text-[#3B82F6]">
                      {inv.invoice_number}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {inv.customer?.logo_url ? (
                        <img
                          src={inv.customer.logo_url}
                          alt=""
                          className="h-5 w-5 rounded object-cover"
                        />
                      ) : (
                        <div className="h-5 w-5 rounded bg-[var(--bg-muted)]" />
                      )}
                      <span className="text-[10px] text-[var(--text-primary)] truncate max-w-[150px]">
                        {inv.customer?.trade_name || inv.customer?.business_name || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {new Date(inv.sale_date).toLocaleDateString("es-EC", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] font-bold text-[var(--text-primary)] tabular-nums">
                      {Number(inv.total).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {inv.currency}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-[8px] font-semibold"
                      style={{
                        backgroundColor: `${INVOICE_STATUS_COLORS[inv.status]}15`,
                        color: INVOICE_STATUS_COLORS[inv.status],
                      }}
                    >
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {inv.seller?.avatar_url && (
                        <img
                          src={inv.seller.avatar_url}
                          alt=""
                          className="h-4 w-4 rounded-full object-cover"
                        />
                      )}
                      <span className="text-[9px] text-[var(--text-muted)] truncate">
                        {inv.seller?.full_name || "—"}
                      </span>
                    </div>
                  </td>
                </motion.tr>
                <AnimatePresence>
                  {expandedId === inv.id && <InvoiceDetail key={`detail-${inv.id}`} inv={inv} />}
                </AnimatePresence>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <DollarSign className="h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            No se encontraron facturas
          </p>
        </div>
      )}
    </div>
  );
}
