"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { formatCurrencyCompact } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/lib/utils/currency";
import {
  Search,
  Filter,
  MapPin,
  Building2,
  Star,
  Phone,
  Globe,
  Heart,
  Users,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SalesCustomer, DemoRole, SellerProfile, CustomerSegment } from "../types";
import {
  SEGMENT_LABELS,
  SEGMENT_COLORS,
  STATUS_LABELS,
} from "../types";
import { ClienteDetailModal } from "./cliente-detail-modal";

// ── Health Score Gauge ─────────────────────────────

function HealthGauge({ score }: { score: number }) {
  const color =
    score >= 80 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="44" height="44" className="-rotate-90">
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke="var(--border)"
          strokeWidth="3"
        />
        <motion.circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
        />
      </svg>
      <span
        className="absolute text-xs font-bold"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

// ── Customer Card ─────────────────────────────────

function CustomerCard({
  customer,
  index,
  onClick,
  currency,
  convert,
}: {
  customer: SalesCustomer;
  index: number;
  onClick: () => void;
  currency: CurrencyCode;
  convert: (v: number) => number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4",
        "transition-all hover:shadow-md hover:border-[#3B82F6]/30"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Logo */}
        {customer.logo_url ? (
          <img
            src={customer.logo_url}
            alt=""
            className="h-10 w-10 rounded-lg object-cover ring-1 ring-[var(--border)]"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-sm font-bold text-[var(--text-muted)]">
            {customer.business_name[0]}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-[var(--text-primary)]">
              {customer.trade_name || customer.business_name}
            </h4>
            <span className="shrink-0 text-sm text-[var(--text-muted)]">
              {customer.code}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <MapPin size={9} />
            <span>
              {customer.city}, {customer.country}
            </span>
            {customer.sector && (
              <>
                <span>·</span>
                <Building2 size={9} />
                <span>{customer.sector}</span>
              </>
            )}
          </div>
        </div>

        <HealthGauge score={customer.health_score} />
      </div>

      {/* Bottom row */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-sm font-semibold"
          style={{
            backgroundColor: `${SEGMENT_COLORS[customer.segment]}15`,
            color: SEGMENT_COLORS[customer.segment],
          }}
        >
          {SEGMENT_LABELS[customer.segment]}
        </span>
        <span className="text-sm text-[var(--text-muted)]">
          {STATUS_LABELS[customer.status]}
        </span>
        <span className="ml-auto text-[13px] font-bold text-[var(--text-primary)]">
          {formatCurrencyCompact(convert(customer.total_revenue), currency)}
        </span>
        <span className="text-sm text-[var(--text-muted)]">
          {customer.total_orders} ventas
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.open(`/ventas/presentacion?cliente=${customer.id}`, '_blank');
          }}
          className="flex items-center gap-1 rounded-md bg-gradient-to-r from-[#06B6D4] to-[#3B82F6] px-2 py-0.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:shadow-md opacity-0 group-hover:opacity-100"
        >
          <Presentation size={8} />
          Presentación
        </button>
      </div>

      {/* Seller */}
      {customer.assigned_seller && (
        <div className="mt-2 flex items-center gap-1.5">
          {customer.assigned_seller.avatar_url ? (
            <img
              src={customer.assigned_seller.avatar_url}
              alt=""
              className="h-4 w-4 rounded-full object-cover"
            />
          ) : (
            <div className="h-4 w-4 rounded-full bg-[var(--bg-muted)]" />
          )}
          <span className="text-sm text-[var(--text-muted)]">
            {customer.assigned_seller.full_name}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Export ────────────────────────────────────

type Props = {
  customers: SalesCustomer[];
  sellers: SellerProfile[];
  demoRole: DemoRole;
  currency: CurrencyCode;
  convert: (v: number) => number;
};

export function ClientesTab({ customers, sellers, demoRole, currency, convert }: Props) {
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment | "all">(
    "all"
  );

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        !search ||
        c.business_name.toLowerCase().includes(search.toLowerCase()) ||
        c.trade_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.country.toLowerCase().includes(search.toLowerCase());

      const matchesSegment =
        segmentFilter === "all" || c.segment === segmentFilter;

      return matchesSearch && matchesSegment;
    });
  }, [customers, search, segmentFilter]);

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: customers.length };
    for (const c of customers) {
      counts[c.segment] = (counts[c.segment] || 0) + 1;
    }
    return counts;
  }, [customers]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="text"
            placeholder="Buscar cliente, código, país..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] py-2 pl-9 pr-4",
              "text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
              "focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/30"
            )}
          />
        </div>

        {/* Segment pills */}
        <div className="flex flex-wrap gap-1.5">
          {(
            ["all", "champion", "loyal", "new", "at_risk", "dormant", "prospect"] as const
          ).map((seg) => (
            <button
              key={seg}
              onClick={() => setSegmentFilter(seg)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                segmentFilter === seg
                  ? seg === "all"
                    ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                    : `text-white`
                  : "bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
              style={
                segmentFilter === seg && seg !== "all"
                  ? {
                      backgroundColor: SEGMENT_COLORS[seg],
                      color: "white",
                    }
                  : undefined
              }
            >
              {seg === "all" ? "Todos" : SEGMENT_LABELS[seg]}
              <span className="ml-1 opacity-60">
                {segmentCounts[seg] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Customer Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((customer, i) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            index={i}
            onClick={() => setSelectedCustomerId(customer.id)}
            currency={currency}
            convert={convert}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <Users className="h-8 w-8 text-[var(--text-muted)]" />
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            No se encontraron clientes
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedCustomerId && (
        <ClienteDetailModal
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          demoRole={demoRole}
        />
      )}
    </div>
  );
}
