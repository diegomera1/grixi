"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, FileText, DollarSign, Eye, Download, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SalesQuote, SalesCustomer, DemoRole, QuoteStatus } from "../types";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS, ROLE_PERMISSIONS } from "../types";
import { CotizacionEditorModal } from "./cotizacion-editor-modal";

type Props = {
  quotes: SalesQuote[];
  customers: SalesCustomer[];
  demoRole: DemoRole;
};

export function CotizacionesTab({ quotes, customers, demoRole }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "all">("all");
  const [showEditor, setShowEditor] = useState(false);
  const [editingQuote, setEditingQuote] = useState<SalesQuote | null>(null);

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      const matchesSearch =
        !search ||
        q.quote_number.toLowerCase().includes(search.toLowerCase()) ||
        q.customer?.business_name?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || q.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [quotes, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: quotes.length };
    for (const q of quotes) {
      counts[q.status] = (counts[q.status] || 0) + 1;
    }
    return counts;
  }, [quotes]);

  const exportCSV = () => {
    const headers = ["# Cotización", "Cliente", "Fecha", "Vigencia", "Monto", "Moneda", "Estado"];
    const rows = filtered.map((q) => [
      q.quote_number,
      q.customer?.trade_name || q.customer?.business_name || "—",
      new Date(q.created_at).toLocaleDateString("es-EC"),
      q.validity_days + " días",
      Number(q.total).toFixed(2),
      q.currency,
      QUOTE_STATUS_LABELS[q.status],
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cotizaciones_grixi_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="text"
            placeholder="Buscar cotización..."
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
            onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-lg bg-[#10B981]/10 px-3 py-1.5 text-[10px] font-semibold text-[#10B981] transition-colors hover:bg-[#10B981]/20 shrink-0"
          >
            <Download size={11} />
            Exportar CSV
          </button>
          {ROLE_PERMISSIONS[demoRole].create && (
            <button
              onClick={() => { setEditingQuote(null); setShowEditor(true); }}
              className="flex items-center gap-1.5 rounded-lg bg-[#8B5CF6] px-3 py-1.5 text-[10px] font-bold text-white shadow-lg shadow-[#8B5CF6]/25 transition-all hover:bg-[#7C3AED] shrink-0"
            >
              <Plus size={12} />
              Nueva Cotización
            </button>
          )}
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-1.5">
        {(
          ["all", "draft", "sent", "viewed", "approved", "rejected", "converted"] as const
        ).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[9px] font-medium transition-all",
              statusFilter === status
                ? status === "all"
                  ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                  : "text-white"
                : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
            )}
            style={
              statusFilter === status && status !== "all"
                ? {
                    backgroundColor: QUOTE_STATUS_COLORS[status],
                    color: "white",
                  }
                : undefined
            }
          >
            {status === "all" ? "Todas" : QUOTE_STATUS_LABELS[status]}
            <span className="ml-1 opacity-60">{statusCounts[status] || 0}</span>
          </button>
        ))}
      </div>

      {/* Quotes Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((quote, i) => (
          <motion.div
            key={quote.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.25 }}
            className={cn(
              "group rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 cursor-pointer",
              "transition-all hover:shadow-md hover:border-[#8B5CF6]/30"
            )}
            onClick={() => { setEditingQuote(quote); setShowEditor(true); }}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#3B82F6]">
                  {quote.quote_number}
                </span>
                <div className="mt-1 flex items-center gap-2">
                  {quote.customer?.logo_url && (
                    <img
                      src={quote.customer.logo_url}
                      alt=""
                      className="h-5 w-5 rounded object-cover"
                    />
                  )}
                  <span className="text-[10px] text-[var(--text-primary)] truncate">
                    {quote.customer?.trade_name || quote.customer?.business_name}
                  </span>
                </div>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-semibold"
                style={{
                  backgroundColor: `${QUOTE_STATUS_COLORS[quote.status]}15`,
                  color: QUOTE_STATUS_COLORS[quote.status],
                }}
              >
                {QUOTE_STATUS_LABELS[quote.status]}
              </span>
            </div>

            {/* Amount */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <DollarSign size={11} className="text-emerald-500" />
                <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                  {Number(quote.total).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </span>
                <span className="text-[9px] text-[var(--text-muted)]">
                  {quote.currency}
                </span>
              </div>
              {quote.discount_percent > 0 && (
                <span className="text-[8px] text-amber-500 font-medium">
                  -{quote.discount_percent}% desc.
                </span>
              )}
            </div>

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {quote.seller?.avatar_url && (
                  <img
                    src={quote.seller.avatar_url}
                    alt=""
                    className="h-4 w-4 rounded-full object-cover"
                  />
                )}
                <span className="text-[8px] text-[var(--text-muted)]">
                  {quote.seller?.full_name}
                </span>
              </div>
              <span className="text-[8px] text-[var(--text-muted)]">
                Validez: {quote.validity_days}d
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <FileText className="h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            No se encontraron cotizaciones
          </p>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <CotizacionEditorModal
          customers={customers}
          existingQuote={editingQuote}
          onClose={() => { setShowEditor(false); setEditingQuote(null); }}
          onSave={() => { setShowEditor(false); setEditingQuote(null); }}
          demoRole={demoRole}
        />
      )}
    </div>
  );
}
