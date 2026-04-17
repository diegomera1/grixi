"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Treemap,
} from "recharts";
import {
  MapPin,
  ChevronRight,
  Users,
  DollarSign,
  Globe,
  BarChart3,
  TrendingUp,
  X,
  ExternalLink,
  Layers,
  Grid3X3,
  LayoutList,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SalesCustomer, SalesInvoice, CustomerSegment } from "../types";
import { SEGMENT_LABELS, SEGMENT_COLORS } from "../types";

// ── Types ─────────────────────────────────────────

type Props = {
  country: string;
  customers: SalesCustomer[];
  invoices: SalesInvoice[];
  selectedProvince: string | null;
  onProvinceClick: (province: string) => void;
  onCityClick: (city: string) => void;
  onClose: () => void;
  onClientSelect?: (client: SalesCustomer) => void;
};

// ── Color palettes ────────────────────────────────

const BAR_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F97316", "#EC4899",
  "#06B6D4", "#F59E0B", "#EF4444", "#14B8A6", "#A855F7",
  "#D946EF", "#0EA5E9",
];

const TREEMAP_COLORS = [
  "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd",
  "#1e40af", "#1e3a8a", "#3730a3", "#4f46e5", "#6366f1",
];

const tooltipStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 10,
  padding: "8px 12px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
};

// ── Main Component ────────────────────────────────

export function GeoDrilldown({
  country,
  customers,
  invoices,
  selectedProvince,
  onProvinceClick,
  onCityClick,
  onClose,
  onClientSelect,
}: Props) {
  const [viewMode, setViewMode] = useState<"bars" | "treemap">("bars");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // ── Filter data for current country ─────────
  const countryCustomers = useMemo(
    () => customers.filter((c) => c.country === country),
    [customers, country]
  );

  // ── Province-level aggregation ──────────────
  const provinceData = useMemo(() => {
    const map = new Map<string, { revenue: number; clients: SalesCustomer[]; invoiceCount: number }>();
    for (const c of countryCustomers) {
      const prov = c.province || "Sin Provincia";
      const current = map.get(prov) || { revenue: 0, clients: [], invoiceCount: 0 };
      current.revenue += Number(c.total_revenue || 0);
      current.clients.push(c);
      map.set(prov, current);
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        clients: data.clients.length,
        invoices: data.invoiceCount,
        avgHealth: data.clients.length > 0
          ? Math.round(data.clients.reduce((s, c) => s + c.health_score, 0) / data.clients.length)
          : 0,
        topSegment: getTopSegment(data.clients),
        _clients: data.clients,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [countryCustomers]);

  // ── City-level aggregation ──────────────────
  const cityData = useMemo(() => {
    if (!selectedProvince) return [];
    const filtered = countryCustomers.filter((c) => (c.province || "Sin Provincia") === selectedProvince);
    const map = new Map<string, { revenue: number; clients: SalesCustomer[]; invoiceCount: number }>();
    for (const c of filtered) {
      const city = c.city || "Sin Ciudad";
      const current = map.get(city) || { revenue: 0, clients: [], invoiceCount: 0 };
      current.revenue += Number(c.total_revenue || 0);
      current.clients.push(c);
      map.set(city, current);
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        clients: data.clients.length,
        invoices: data.invoiceCount,
        avgHealth: data.clients.length > 0
          ? Math.round(data.clients.reduce((s, c) => s + c.health_score, 0) / data.clients.length)
          : 0,
        topSegment: getTopSegment(data.clients),
        _clients: data.clients,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [countryCustomers, selectedProvince]);

  // ── Client-level ────────────────────────────
  const cityClients = useMemo(() => {
    if (!selectedCity || !selectedProvince) return [];
    return countryCustomers
      .filter(
        (c) =>
          (c.province || "Sin Provincia") === selectedProvince &&
          (c.city || "Sin Ciudad") === selectedCity
      )
      .sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue));
  }, [countryCustomers, selectedCity, selectedProvince]);

  // ── Segment distribution ────────────────────
  const segmentDist = useMemo(() => {
    let source: SalesCustomer[];
    if (selectedCity) source = cityClients;
    else if (selectedProvince) source = countryCustomers.filter((c) => (c.province || "Sin Provincia") === selectedProvince);
    else source = countryCustomers;

    const map: Record<string, number> = {};
    for (const c of source) {
      map[c.segment] = (map[c.segment] || 0) + 1;
    }
    return Object.entries(map)
      .map(([segment, count]) => ({
        name: SEGMENT_LABELS[segment as CustomerSegment] || segment,
        value: count,
        fill: SEGMENT_COLORS[segment as CustomerSegment] || "#6B7280",
      }))
      .sort((a, b) => b.value - a.value);
  }, [countryCustomers, cityClients, selectedProvince, selectedCity]);

  // ── KPIs ────────────────────────────────────
  const kpis = useMemo(() => {
    let source: SalesCustomer[];
    if (selectedCity) source = cityClients;
    else if (selectedProvince) source = countryCustomers.filter((c) => (c.province || "Sin Provincia") === selectedProvince);
    else source = countryCustomers;

    const totalRev = source.reduce((s, c) => s + Number(c.total_revenue || 0), 0);
    const avgHealth = source.length > 0 ? Math.round(source.reduce((s, c) => s + c.health_score, 0) / source.length) : 0;
    return { totalRev, clients: source.length, avgHealth };
  }, [countryCustomers, cityClients, selectedProvince, selectedCity]);

  // ── Current chart data ──────────────────────
  const showingProvinces = !selectedProvince;
  const showingCities = selectedProvince && !selectedCity;
  const showingClients = !!selectedCity;
  const currentData = showingProvinces ? provinceData : showingCities ? cityData : [];
  const currentLabel = showingProvinces ? "Provincias" : showingCities ? "Ciudades" : "Clientes";

  const onBarClick = showingProvinces
    ? (name: string) => onProvinceClick(name)
    : showingCities
      ? (name: string) => setSelectedCity(name)
      : undefined;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]" style={{ minHeight: 420 }}>
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-2.5 bg-gradient-to-r from-[#3B82F6]/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#3B82F6]/10">
              <Globe size={12} className="text-[#3B82F6]" />
            </div>
            <div>
              <h2 className="text-[10px] font-bold text-[var(--text-primary)]">
                {showingProvinces ? `Provincias de ${country}` :
                 showingCities ? `Ciudades de ${selectedProvince}` :
                 `Clientes en ${selectedCity}`}
              </h2>
              <p className="text-[7px] text-[var(--text-muted)]">
                {showingProvinces ? "Click en una provincia para ver ciudades" :
                 showingCities ? "Click en una ciudad para ver clientes" :
                 `${cityClients.length} clientes encontrados`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)]"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Content (scrollable) */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { icon: DollarSign, label: "Revenue", value: `$${(kpis.totalRev / 1000).toFixed(0)}K`, color: "#10B981" },
            { icon: Users, label: "Clientes", value: String(kpis.clients), color: "#3B82F6" },
            { icon: TrendingUp, label: "Health", value: `${kpis.avgHealth}/100`, color: kpis.avgHealth >= 70 ? "#10B981" : "#F59E0B" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-2">
              <div className="flex items-center gap-1">
                <kpi.icon size={8} style={{ color: kpi.color }} />
                <span className="text-[6px] text-[var(--text-muted)] uppercase">{kpi.label}</span>
              </div>
              <p className="mt-0.5 text-xs font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Chart (Provinces or Cities) */}
        {!showingClients && currentData.length > 0 && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <BarChart3 size={9} className="text-[#3B82F6]" />
                <h4 className="text-[9px] font-semibold text-[var(--text-primary)]">
                  Revenue por {currentLabel} ({currentData.length})
                </h4>
              </div>
              {/* View Toggle */}
              <div className="flex items-center gap-0.5 rounded-md bg-[var(--bg-muted)] p-0.5">
                <button
                  onClick={() => setViewMode("bars")}
                  className={cn(
                    "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[7px] font-medium transition-all",
                    viewMode === "bars"
                      ? "bg-[var(--bg-card)] text-[#3B82F6] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <LayoutList size={7} /> Barras
                </button>
                <button
                  onClick={() => setViewMode("treemap")}
                  className={cn(
                    "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[7px] font-medium transition-all",
                    viewMode === "treemap"
                      ? "bg-[var(--bg-card)] text-[#8B5CF6] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <Grid3X3 size={7} /> Treemap
                </button>
              </div>
            </div>

            {viewMode === "bars" ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={currentData} layout="vertical" margin={{ left: 0, right: 8, top: 2, bottom: 2 }}>
                    <XAxis
                      type="number"
                      tick={{ fontSize: 7, fill: "var(--text-muted)" }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 8, fill: "var(--text-primary)" }}
                      width={90}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: "var(--bg-muted)", opacity: 0.5 }}
                      formatter={(value) => [`$${(Number(value) / 1000).toFixed(1)}K`, "Revenue"]}
                      labelFormatter={(label) => {
                        const node = currentData.find((d) => d.name === label);
                        return `${label} — ${node?.clients || 0} clientes`;
                      }}
                    />
                    <Bar dataKey="revenue" radius={[0, 5, 5, 0]} cursor="pointer" onClick={(data) => data.name && onBarClick?.(data.name)}>
                      {currentData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} className="transition-opacity hover:opacity-80" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={currentData.map((d, i) => ({
                      ...d,
                      size: d.revenue,
                      fill: TREEMAP_COLORS[i % TREEMAP_COLORS.length],
                    }))}
                    dataKey="size"
                    aspectRatio={4 / 3}
                    stroke="var(--bg-primary)"
                    content={(props: Record<string, unknown>) => {
                      const x = Number(props.x || 0);
                      const y = Number(props.y || 0);
                      const width = Number(props.width || 0);
                      const height = Number(props.height || 0);
                      const name = String(props.name || "");
                      const fill = String(props.fill || TREEMAP_COLORS[Number(props.index || 0) % TREEMAP_COLORS.length]);
                      if (width < 30 || height < 20) return <rect x={x} y={y} width={width} height={height} fill="transparent" />;
                      const node = currentData.find((d) => d.name === name);
                      return (
                        <g onClick={() => onBarClick?.(name)} style={{ cursor: "pointer" }}>
                          <rect x={x} y={y} width={width} height={height} rx={5} fill={fill} className="transition-opacity hover:opacity-80" />
                          {width > 45 && height > 28 && (
                            <>
                              <text x={x + 5} y={y + 12} fill="white" fontSize={8} fontWeight={600}>
                                {name.length > Math.floor(width / 6) ? name.slice(0, Math.floor(width / 6)) + "…" : name}
                              </text>
                              <text x={x + 5} y={y + 22} fill="rgba(255,255,255,0.7)" fontSize={7}>
                                {`$${((node?.revenue || 0) / 1000).toFixed(0)}K · ${node?.clients || 0} cl.`}
                              </text>
                            </>
                          )}
                        </g>
                      );
                    }}
                  />
                </ResponsiveContainer>
              </div>
            )}

            <p className="mt-1.5 text-center text-[7px] text-[var(--text-muted)] italic">
              Click para explorar {showingProvinces ? "ciudades" : "clientes"}
            </p>
          </div>
        )}

        {/* Segment Pie */}
        {segmentDist.length > 0 && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
            <div className="flex items-center gap-1 mb-1.5">
              <Layers size={9} className="text-[#8B5CF6]" />
              <h4 className="text-[9px] font-semibold text-[var(--text-primary)]">Segmentación RFM</h4>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-24 w-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={segmentDist} cx="50%" cy="50%" innerRadius={20} outerRadius={40} paddingAngle={3} dataKey="value">
                      {segmentDist.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value)} clientes`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1">
                {segmentDist.map((seg) => (
                  <div key={seg.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: seg.fill }} />
                      <span className="text-[8px] text-[var(--text-secondary)]">{seg.name}</span>
                    </div>
                    <span className="text-[8px] font-bold text-[var(--text-primary)] tabular-nums">{seg.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Client List (city level) */}
        {showingClients && (
          <div>
            <div className="flex items-center gap-1 mb-2">
              <Users size={9} className="text-[#06B6D4]" />
              <h4 className="text-[9px] font-semibold text-[var(--text-primary)]">
                Clientes en {selectedCity} ({cityClients.length})
              </h4>
            </div>
            <div className="space-y-1.5">
              {cityClients.map((client, i) => (
                <ClientCard key={client.id} client={client} index={i} onSelect={onClientSelect} />
              ))}
            </div>
          </div>
        )}

        {/* Location ranking list */}
        {!showingClients && currentData.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <MapPin size={9} className="text-[#F97316]" />
              <h4 className="text-[9px] font-semibold text-[var(--text-primary)]">
                Ranking de {currentLabel}
              </h4>
            </div>
            <div className="space-y-0.5">
              {currentData.map((node, i) => (
                <button
                  key={node.name}
                  onClick={() => onBarClick?.(node.name)}
                  className="flex w-full items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 transition-all hover:border-[#3B82F6]/30 hover:shadow-sm group text-left"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[8px] font-bold text-[var(--text-muted)] tabular-nums w-3">
                      {`#${i + 1}`}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold text-[var(--text-primary)] truncate">{node.name}</p>
                      <p className="text-[7px] text-[var(--text-muted)]">
                        {node.clients} cl. · Health {node.avgHealth}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-bold text-emerald-500 tabular-nums">
                      {`$${(node.revenue / 1000).toFixed(0)}K`}
                    </span>
                    <ChevronRight size={9} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Client Card ───────────────────────────────────

function ClientCard({ client, index, onSelect }: { client: SalesCustomer; index: number; onSelect?: (client: SalesCustomer) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const initials = (client.trade_name || client.business_name)
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const healthColor =
    client.health_score >= 80 ? "#10B981" : client.health_score >= 50 ? "#F59E0B" : "#EF4444";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <button
        onClick={() => onSelect ? onSelect(client) : setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border bg-[var(--bg-card)] px-2.5 py-2 text-left transition-all group",
          expanded
            ? "border-[#06B6D4]/40 shadow-sm"
            : "border-[var(--border)] hover:border-[#3B82F6]/30"
        )}
      >
        {client.logo_url && !imgError ? (
          <img
            src={client.logo_url}
            alt=""
            onError={() => setImgError(true)}
            className="h-7 w-7 rounded-md object-cover ring-1 ring-[var(--border)]"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[#3B82F6]/20 to-[#06B6D4]/20 text-[7px] font-bold text-[#3B82F6]">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-semibold text-[var(--text-primary)] truncate">
            {client.trade_name || client.business_name}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="inline-block h-1 w-1 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[client.segment] || "#6B7280" }} />
            <span className="text-[7px] text-[var(--text-muted)]">{SEGMENT_LABELS[client.segment] || client.segment}</span>
            <span className="text-[7px] font-semibold tabular-nums" style={{ color: healthColor }}>{client.health_score}pts</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[9px] font-bold text-emerald-500 tabular-nums">
            {`$${(Number(client.total_revenue) / 1000).toFixed(0)}K`}
          </p>
          <p className="text-[6px] text-[var(--text-muted)]">{client.total_orders} órdenes</p>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mx-1.5 mt-0.5 rounded-md border border-[var(--border)] bg-[var(--bg-muted)]/50 p-2.5 space-y-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <InfoRow label="Razón Social" value={client.business_name} />
                <InfoRow label="Código" value={client.code} />
                <InfoRow label="Sector" value={client.sector || "—"} />
                <InfoRow label="Tamaño" value={client.company_size || "—"} />
                <InfoRow label="Tax ID" value={client.tax_id || "—"} />
                <InfoRow label="Crédito" value={`$${Number(client.credit_limit).toLocaleString("en")}`} />
                <InfoRow label="Ticket Prom." value={`$${(Number(client.avg_order_value || 0) / 1000).toFixed(1)}K`} />
                <InfoRow label="NPS" value={String(client.nps_score || 0)} />
              </div>
              {client.address && (
                <div className="flex items-center gap-1 text-[7px] text-[var(--text-muted)]">
                  <MapPin size={7} />
                  <span>{client.address}</span>
                </div>
              )}
              {client.website && (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[7px] text-[#3B82F6] hover:underline"
                >
                  <ExternalLink size={7} />
                  {client.website}
                </a>
              )}
              {/* Health Bar */}
              <div className="flex items-center gap-2">
                <span className="text-[6px] text-[var(--text-muted)] w-7">Health</span>
                <div className="flex-1 h-1 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${client.health_score}%` }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: healthColor }}
                  />
                </div>
                <span className="text-[7px] font-bold tabular-nums" style={{ color: healthColor }}>
                  {client.health_score}/100
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Helpers ───────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[6px] text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
      <p className="text-[8px] font-medium text-[var(--text-primary)] truncate">{value}</p>
    </div>
  );
}

function getTopSegment(clients: SalesCustomer[]): string {
  const map: Record<string, number> = {};
  for (const c of clients) {
    map[c.segment] = (map[c.segment] || 0) + 1;
  }
  const sorted = Object.entries(map).sort(([, a], [, b]) => b - a);
  return sorted[0]?.[0] || "prospect";
}
