"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { FinanceTransaction, CurrencyCode } from "../types";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

const PAGE_SIZE = 25;

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  invoice_revenue: { label: "Factura Venta", color: "#10B981" },
  customer_payment: { label: "Cobro", color: "#06B6D4" },
  vendor_invoice: { label: "Factura Compra", color: "#F43F5E" },
  vendor_payment: { label: "Pago Proveedor", color: "#F97316" },
  manual_entry: { label: "Asiento Manual", color: "#8B5CF6" },
  payroll: { label: "Nómina", color: "#EC4899" },
  tax_payment: { label: "Impuestos", color: "#F59E0B" },
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-500/15 text-gray-500",
  posted: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cleared: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  reversed: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

type SortField = "created_at" | "amount_usd" | "counterparty" | "department";

export function GeneralLedgerTab({
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
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const departments = useMemo(
    () => [...new Set(transactions.map((t) => t.department))].sort(),
    [transactions]
  );

  const filtered = useMemo(() => {
    let result = [...transactions];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.counterparty?.toLowerCase().includes(q) ||
          t.invoice_number?.toLowerCase().includes(q) ||
          t.sap_document_id?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }
    if (filterType) result = result.filter((t) => t.transaction_type === filterType);
    if (filterCategory) result = result.filter((t) => t.category === filterCategory);
    if (filterStatus) result = result.filter((t) => t.status === filterStatus);
    if (filterDept) result = result.filter((t) => t.department === filterDept);

    result.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      if (sortField === "created_at") {
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
      } else if (sortField === "amount_usd") {
        aVal = a.amount_usd;
        bVal = b.amount_usd;
      } else if (sortField === "counterparty") {
        aVal = a.counterparty || "";
        bVal = b.counterparty || "";
      } else if (sortField === "department") {
        aVal = a.department || "";
        bVal = b.department || "";
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [transactions, search, filterType, filterCategory, filterStatus, filterDept, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const totalIncome = filtered
    .filter((t) => ["revenue", "payment_in"].includes(t.category))
    .reduce((s, t) => s + t.amount_usd, 0);
  const totalExpense = filtered
    .filter((t) => ["expense", "payment_out"].includes(t.category))
    .reduce((s, t) => s + t.amount_usd, 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Registros</p>
          <p className="text-2xl font-bold font-mono text-foreground">{filtered.length.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Débitos</p>
          <p className="text-2xl font-bold font-mono text-emerald-500">{formatCurrencyCompact(convert(totalIncome), currency)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Créditos</p>
          <p className="text-2xl font-bold font-mono text-rose-500">{formatCurrencyCompact(convert(totalExpense), currency)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar factura, SAP doc, contraparte..."
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:outline-none"
          />
        </div>
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(0); }} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          <option value="">Tipo</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          <option value="">Categoría</option>
          <option value="revenue">Revenue</option>
          <option value="expense">Expense</option>
          <option value="payment_in">Cobro</option>
          <option value="payment_out">Pago</option>
          <option value="adjustment">Ajuste</option>
        </select>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          <option value="">Estado</option>
          <option value="posted">Posted</option>
          <option value="cleared">Cleared</option>
          <option value="draft">Draft</option>
          <option value="reversed">Reversed</option>
        </select>
        <select value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setPage(0); }} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          <option value="">Departamento</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {(search || filterType || filterCategory || filterStatus || filterDept) && (
          <button onClick={() => { setSearch(""); setFilterType(""); setFilterCategory(""); setFilterStatus(""); setFilterDept(""); setPage(0); }} className="text-xs text-violet-500 hover:underline">
            Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("created_at")}>
                  <div className="flex items-center gap-1">Fecha <SortIcon field="created_at" /></div>
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("counterparty")}>
                  <div className="flex items-center gap-1">Contraparte <SortIcon field="counterparty" /></div>
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">Doc SAP</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("department")}>
                  <div className="flex items-center gap-1">Depto <SortIcon field="department" /></div>
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">Estado</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("amount_usd")}>
                  <div className="flex items-center gap-1 justify-end">Monto <SortIcon field="amount_usd" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map((tx) => {
                const typeCfg = TYPE_LABELS[tx.transaction_type] || TYPE_LABELS.manual_entry;
                const isPositive = ["revenue", "payment_in"].includes(tx.category);
                return (
                  <motion.tr
                    key={tx.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => onSelectTx(tx)}
                    whileTap={{ scale: 0.995 }}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${typeCfg.color}15`, color: typeCfg.color }}>
                        {typeCfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-foreground font-medium truncate max-w-[180px]">{tx.counterparty}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{tx.invoice_number || "—"}</p>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">{tx.sap_document_id}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{tx.department}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", STATUS_STYLES[tx.status || "posted"])}>
                        {(tx.status || "posted").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={cn("font-mono font-semibold", isPositive ? "text-emerald-500" : "text-rose-500")}>
                        {isPositive ? "+" : "-"}{formatCurrency(convert(tx.amount_usd), currency)}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <span className="text-[10px] text-muted-foreground">
            {filtered.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} de ${filtered.length}` : "Sin resultados"}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground px-2">{totalPages > 0 ? `${page + 1} / ${totalPages}` : "—"}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
