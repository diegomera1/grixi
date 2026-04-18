"use client";

import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  DollarSign,
  Users,
  ChevronRight,
  Loader2,
  MapPin,
  Building2,
  Shield,
  TrendingUp,
  Star,
  Phone,
  Mail,
  ExternalLink,
  Eye,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SalesInvoice, SalesCustomer } from "../types";
import { SEGMENT_LABELS, SEGMENT_COLORS } from "../types";
import { formatCurrencyCompact as fmtMoneyCompact } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/lib/utils/currency";
import { GeoDrilldown } from "./geo-drilldown";

// ── Dynamic import of Leaflet (no SSR) ────────────

const LeafletMap = dynamic(
  () => import("./leaflet-map").then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#0f172a] rounded-xl">
        <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
          <Loader2 size={20} className="animate-spin text-[#3B82F6]" />
          <span className="text-[13px]">Cargando mapa...</span>
        </div>
      </div>
    ),
  }
);

// ── Types ─────────────────────────────────────────

type Props = {
  invoices: SalesInvoice[];
  customers: SalesCustomer[];
  currency: CurrencyCode;
  convert: (v: number) => number;
};

// ═══════════════════════════════════════════════════
// WorldHeatmap — wrapper with header + LeafletMap + GeoDrilldown panel
// ═══════════════════════════════════════════════════

export function WorldHeatmap({ invoices, customers, currency, convert }: Props) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<SalesCustomer | null>(null);
  const [showStreetView, setShowStreetView] = useState(false);

  // ── Summary KPIs ────────────────────────────
  const { totalRevenue, activeCountries } = useMemo(() => {
    const countries = new Set<string>();
    let rev = 0;
    for (const c of customers) {
      rev += Number(c.total_revenue || 0);
      if (c.country) countries.add(c.country);
    }
    return { totalRevenue: rev, activeCountries: countries.size };
  }, [customers]);

  // ── Navigation ──────────────────────────────
  const handleCountrySelect = useCallback((country: string | null) => {
    setSelectedCountry(country);
    setSelectedProvince(null);
    setSelectedClient(null);
  }, []);

  const handleProvinceSelect = useCallback((province: string | null) => {
    setSelectedProvince(province);
    setSelectedClient(null);
  }, []);

  const handleBackToWorld = useCallback(() => {
    setSelectedCountry(null);
    setSelectedProvince(null);
    setSelectedClient(null);
    setShowStreetView(false);
  }, []);

  const handleBackToCountry = useCallback(() => {
    setSelectedProvince(null);
    setSelectedClient(null);
  }, []);

  // ── Client selection (bidirectional) ────────
  const handleClientSelect = useCallback((client: SalesCustomer) => {
    setSelectedClient(client);
    setShowStreetView(false);
    if (client.country && !selectedCountry) setSelectedCountry(client.country);
    if (client.province && !selectedProvince) setSelectedProvince(client.province);
  }, [selectedCountry, selectedProvince]);

  const handleClientClose = useCallback(() => {
    setSelectedClient(null);
    setShowStreetView(false);
  }, []);

  const drillLevel = !selectedCountry ? "world" : !selectedProvince ? "country" : "province";

  // ── Country ranking ─────────────────────────
  const countryRanking = useMemo(() => {
    const map = new Map<string, { revenue: number; clients: number }>();
    for (const c of customers) {
      const entry = map.get(c.country) || { revenue: 0, clients: 0 };
      entry.revenue += Number(c.total_revenue || 0);
      entry.clients += 1;
      map.set(c.country, entry);
    }
    return Array.from(map.entries())
      .map(([country, data]) => ({ country, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [customers]);

  // Client invoices for detail panel
  const clientInvoices = useMemo(() => {
    if (!selectedClient) return [];
    return invoices.filter((inv) => inv.customer_id === selectedClient.id);
  }, [invoices, selectedClient]);

  const hasSidePanel = drillLevel !== "world" || selectedClient;

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-[#3B82F6]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            Distribución Geográfica
          </h3>
          <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <span className="cursor-pointer hover:text-[var(--text-primary)]" onClick={handleBackToWorld}>Mundo</span>
            {selectedCountry && (
              <><ChevronRight size={9} /><span className="cursor-pointer hover:text-[var(--text-primary)]" onClick={handleBackToCountry}>{selectedCountry}</span></>
            )}
            {selectedProvince && (
              <><ChevronRight size={9} /><span className="text-[var(--text-primary)] font-semibold">{selectedProvince}</span></>
            )}
            {selectedClient && (
              <><ChevronRight size={9} /><span className="text-[var(--brand)] font-bold">{selectedClient.trade_name || selectedClient.business_name}</span></>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <DollarSign size={9} className="text-emerald-500" />
            <span className="text-[var(--text-muted)]">Revenue</span>
            <span className="font-bold text-emerald-500 tabular-nums">{fmtMoneyCompact(convert(totalRevenue), currency)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={9} className="text-[#3B82F6]" />
            <span className="text-[var(--text-muted)]">Países</span>
            <span className="font-bold text-[var(--text-primary)]">{activeCountries}</span>
          </div>
        </div>
      </div>

      {/* ── Map + Side Panel ──────────────── */}
      <div className="flex gap-3">
        <motion.div
          layout
          className={cn(
            "relative overflow-hidden rounded-xl border border-[var(--border)] transition-all duration-500",
            hasSidePanel ? "w-[58%]" : "w-full"
          )}
          style={{ height: 460 }}
        >
          <LeafletMap
            customers={customers}
            invoices={invoices}
            onCountrySelect={handleCountrySelect}
            onProvinceSelect={handleProvinceSelect}
            selectedCountry={selectedCountry}
            selectedProvince={selectedProvince}
            onClientSelect={handleClientSelect}
            currency={currency}
            convert={convert}
          />
        </motion.div>

        {/* Side Panel — Client Detail OR GeoDrilldown */}
        <AnimatePresence mode="wait">
          {selectedClient ? (
            <motion.div
              key="client-detail"
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "42%" }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="overflow-hidden"
              style={{ height: 460 }}
            >
              <ClientMapDetail
                client={selectedClient}
                clientInvoices={clientInvoices}
                showStreetView={showStreetView}
                onToggleStreetView={() => setShowStreetView(!showStreetView)}
                onClose={handleClientClose}
                currency={currency}
                convert={convert}
              />
            </motion.div>
          ) : drillLevel !== "world" && selectedCountry ? (
            <motion.div
              key="geo-drilldown"
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "42%" }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="overflow-hidden"
              style={{ height: 460 }}
            >
              <GeoDrilldown
                country={selectedCountry}
                customers={customers}
                invoices={invoices}
                selectedProvince={selectedProvince}
                onProvinceClick={handleProvinceSelect}
                onCityClick={() => {}}
                onClose={handleBackToWorld}
                onClientSelect={handleClientSelect}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ── Country Ranking Cards (World view) ── */}
      {drillLevel === "world" && !selectedClient && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8"
        >
          {countryRanking.map((cd, i) => {
            const pct = totalRevenue > 0 ? (cd.revenue / totalRevenue) * 100 : 0;
            return (
              <motion.button
                key={cd.country}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.03 }}
                onClick={() => handleCountrySelect(cd.country)}
                className="group cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-2 text-left transition-all hover:border-[#3B82F6]/30 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{cd.country}</span>
                  <span className="text-[13px] font-bold text-[var(--text-muted)]">{`#${i + 1}`}</span>
                </div>
                <p className="mt-1 text-sm font-bold text-emerald-500 tabular-nums">{fmtMoneyCompact(convert(cd.revenue), currency)}</p>
                <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.3 + i * 0.04, duration: 0.5 }}
                    className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#10B981]"
                  />
                </div>
                <div className="mt-1 flex justify-between text-[13px] text-[var(--text-muted)]">
                  <span>{cd.clients} cl.</span>
                  <span>{pct.toFixed(1)}%</span>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ClientMapDetail — Side panel with full client data + Street View
// ═══════════════════════════════════════════════════

function ClientMapDetail({
  client,
  clientInvoices,
  showStreetView,
  onToggleStreetView,
  onClose,
  currency,
  convert,
}: {
  client: SalesCustomer;
  clientInvoices: SalesInvoice[];
  showStreetView: boolean;
  onToggleStreetView: () => void;
  onClose: () => void;
  currency: CurrencyCode;
  convert: (v: number) => number;
}) {
  const totalRev = Number(client.total_revenue || 0);
  const healthColor = client.health_score >= 80 ? "#10B981" : client.health_score >= 50 ? "#F59E0B" : "#EF4444";
  const segColor = SEGMENT_COLORS[client.segment] || "#6B7280";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-card)] px-3 py-2">
        <button onClick={onClose} className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] transition-colors">
          <X size={12} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {client.logo_url ? (
              <img src={client.logo_url} alt="" className="h-5 w-5 rounded object-cover" />
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-[var(--brand)] to-[#8B5CF6] text-xs font-bold text-white">
                {(client.trade_name || client.business_name).substring(0, 2).toUpperCase()}
              </div>
            )}
            <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
              {client.trade_name || client.business_name}
            </h4>
          </div>
        </div>
        {client.lat && client.lng && (
          <button
            onClick={onToggleStreetView}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold transition-all",
              showStreetView
                ? "bg-[var(--brand)]/20 text-[var(--brand)] border border-[var(--brand)]/30"
                : "bg-[var(--bg-muted)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]/80"
            )}
          >
            <Eye size={9} />
            {showStreetView ? "Datos" : "Street View"}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {showStreetView && client.lat && client.lng ? (
          /* Street View Mode */
          <div className="space-y-2">
            <div className="overflow-hidden rounded-lg border border-[var(--border)]" style={{ height: 280 }}>
              <iframe
                src={`https://maps.google.com/maps?q=&layer=c&cbll=${client.lat},${client.lng}&cbp=12,0,,0,0&output=svembed`}
                style={{ width: "100%", height: "100%", border: "none" }}
                allowFullScreen
                loading="eager"
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-[var(--border)]" style={{ height: 100 }}>
              <iframe
                src={`https://www.google.com/maps?q=${client.lat},${client.lng}&z=15&output=embed`}
                style={{ width: "100%", height: "100%", border: "none" }}
                loading="lazy"
              />
            </div>
            <p className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
              <MapPin size={8} />{client.address || "—"} · {client.city}, {client.country}
            </p>
          </div>
        ) : (
          /* Data Mode */
          <>
            {/* Identity */}
            <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border)] p-2.5">
              <div className="flex items-center gap-2 mb-2">
                {client.logo_url ? (
                  <img src={client.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover ring-1 ring-[var(--border)]" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)] to-[#8B5CF6] text-xs font-bold text-white">
                    {(client.trade_name || client.business_name).substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[var(--text-primary)] truncate">{client.business_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="rounded-full px-1.5 py-0.5 text-[13px] font-bold" style={{ backgroundColor: `${segColor}15`, color: segColor }}>
                      {SEGMENT_LABELS[client.segment] || client.segment}
                    </span>
                    <span className="text-[13px] text-[var(--text-muted)]">{client.sector}</span>
                    {client.code && <span className="text-[13px] text-[var(--text-muted)]">#{client.code}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--text-muted)]">
                <span className="flex items-center gap-0.5"><MapPin size={8} />{client.city}, {client.province || ""}, {client.country}</span>
                {client.phone && <span className="flex items-center gap-0.5"><Phone size={8} />{client.phone}</span>}
                {client.email && <span className="flex items-center gap-0.5"><Mail size={8} />{client.email}</span>}
                {client.website && (
                  <a href={client.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-[var(--brand)] hover:underline">
                    <ExternalLink size={7} />Web
                  </a>
                )}
              </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "Revenue", value: fmtMoneyCompact(convert(totalRev), currency), color: "#10B981", icon: DollarSign },
                { label: "Pedidos", value: String(client.total_orders), color: "#3B82F6", icon: Building2 },
                { label: "Health", value: `${client.health_score}`, color: healthColor, icon: Shield },
                { label: "NPS", value: `${client.nps_score}`, color: "#8B5CF6", icon: Star },
                { label: "Crec. YoY", value: `${client.yoy_growth_pct > 0 ? "+" : ""}${client.yoy_growth_pct.toFixed(0)}%`, color: client.yoy_growth_pct >= 0 ? "#10B981" : "#EF4444", icon: TrendingUp },
                { label: "Retención", value: `${client.retention_rate.toFixed(0)}%`, color: client.retention_rate >= 80 ? "#10B981" : "#F59E0B", icon: Users },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-2 text-center">
                  <kpi.icon size={10} style={{ color: kpi.color }} className="mx-auto mb-0.5" />
                  <p className="text-[13px] font-bold tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Health Bar */}
            <div className="flex items-center gap-2 px-1">
              <span className="text-[13px] text-[var(--text-muted)] w-10">Health</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${client.health_score}%`, backgroundColor: healthColor }} />
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: healthColor }}>{client.health_score}/100</span>
            </div>

            {/* Financial */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-2.5">
              <h5 className="text-xs font-semibold text-[var(--text-primary)] mb-2">💰 Financiero</h5>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <div><span className="text-xs text-[var(--text-muted)] uppercase">Crédito</span><p className="text-xs font-bold text-[var(--text-primary)]">{fmtMoneyCompact(convert(client.credit_limit), currency)}</p></div>
                <div><span className="text-xs text-[var(--text-muted)] uppercase">Usado</span><p className="text-xs font-bold text-[var(--text-primary)]">{fmtMoneyCompact(convert(client.credit_used), currency)}</p></div>
                <div><span className="text-xs text-[var(--text-muted)] uppercase">Pago Prom.</span><p className="text-xs font-bold text-[var(--text-primary)]">{client.payment_avg_days}d (plazo {client.payment_terms}d)</p></div>
                <div><span className="text-xs text-[var(--text-muted)] uppercase">A Tiempo</span><p className="text-xs font-bold" style={{ color: client.on_time_payment_pct >= 80 ? "#10B981" : "#EF4444" }}>{client.on_time_payment_pct.toFixed(0)}%</p></div>
              </div>
            </div>

            {/* Recent Invoices */}
            {clientInvoices.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-2.5">
                <h5 className="text-xs font-semibold text-[var(--text-primary)] mb-1.5">📋 Últimas Facturas ({clientInvoices.length})</h5>
                <div className="space-y-1">
                  {clientInvoices.slice(0, 4).map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[var(--text-primary)]">{inv.invoice_number}</span>
                      <span className="text-[var(--text-muted)]">{new Date(inv.sale_date).toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}</span>
                      <span className="font-bold text-emerald-500 tabular-nums">{fmtMoneyCompact(convert(Number(inv.total_usd)), currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seller */}
            {client.assigned_seller && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-muted)]/30 p-2">
                {client.assigned_seller.avatar_url ? (
                  <img src={client.assigned_seller.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)]/10 text-xs font-bold text-[var(--brand)]">
                    {client.assigned_seller.full_name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{client.assigned_seller.full_name}</p>
                  <p className="text-xs text-[var(--text-muted)]">Ejecutivo Comercial</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
