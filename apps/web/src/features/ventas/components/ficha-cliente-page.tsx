"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  Search,
  Building2,
  MapPin,
  Globe,
  Phone,
  Mail,
  DollarSign,
  Package,
  CreditCard,
  Shield,
  TrendingUp,
  Users,
  Calendar,
  Award,
  Maximize,
  Minimize,
  ChevronDown,
  ArrowLeft,
  Sparkles,
  FileText,
  X,
  Clock,
  BarChart3,
  Star,
  ExternalLink,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { cn } from "@/lib/utils/cn";
import type {
  SalesCustomer,
  SalesContact,
  SalesInvoice,
  SalesOpportunity,
  SalesQuote,
  InvoiceStatus,
} from "../types";
import {
  SEGMENT_LABELS,
  SEGMENT_COLORS,
  CONTACT_ROLE_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
} from "../types";
import {
  fetchCustomerById,
  fetchContacts,
  fetchInvoicesByCustomer,
  fetchOpportunitiesByCustomer,
  fetchQuotesByCustomer,
} from "../actions/ventas-actions";

// ── Helpers ────────────────────────────────────────

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

function fmtNum(v: number): string {
  return v.toLocaleString("es-EC");
}

// ── Font Scale ─────────────────────────────────────

const FONT_SCALES = [
  { label: "A-", scale: 0.85 },
  { label: "A", scale: 1.0 },
  { label: "A+", scale: 1.15 },
  { label: "A++", scale: 1.3 },
];

// ── Animated Counter ───────────────────────────────

function AnimCounter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 1200;
    const startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (value - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);
  return <>{prefix}{fmtNum(display)}{suffix}</>;
}

// ── Section Wrapper ────────────────────────────────

function Section({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={cn("relative", className)}
    >
      {children}
    </motion.section>
  );
}

// ── Block Card ─────────────────────────────────────

function BlockCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm transition-shadow hover:shadow-md",
      className
    )}>
      {children}
    </div>
  );
}

function BlockTitle({ icon: Icon, title, badge }: { icon: typeof Building2; title: string; badge?: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand)]/10">
        <Icon size={14} className="text-[var(--brand)]" />
      </div>
      <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
      {badge && (
        <span className="ml-auto rounded-full bg-[var(--brand)]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────

type Props = {
  customers: SalesCustomer[];
};

export function FichaClientePage({ customers }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<SalesCustomer | null>(null);
  const [contacts, setContacts] = useState<SalesContact[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [opportunities, setOpportunities] = useState<SalesOpportunity[]>([]);
  const [quotes, setQuotes] = useState<SalesQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [fontScale, setFontScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { scrollYProgress } = useScroll({ container: containerRef });
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  // Load font scale from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("grixi-font-scale");
    if (saved) setFontScale(parseFloat(saved));
  }, []);

  // Save font scale
  const handleFontScale = (scale: number) => {
    setFontScale(scale);
    localStorage.setItem("grixi-font-scale", String(scale));
  };

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Load customer data
  const loadCustomer = useCallback(async (id: string) => {
    setLoading(true);
    setSelectedId(id);
    const [cust, conts, invs, opps, qts] = await Promise.all([
      fetchCustomerById(id),
      fetchContacts(id),
      fetchInvoicesByCustomer(id),
      fetchOpportunitiesByCustomer(id),
      fetchQuotesByCustomer(id),
    ]);
    setCustomer(cust);
    setContacts(conts);
    setInvoices(invs);
    setOpportunities(opps);
    setQuotes(qts);
    setLoading(false);
    // Scroll to top
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ESC to go back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedId) {
        setSelectedId(null);
        setCustomer(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId]);

  // Filtered customers for search
  const filtered = searchQuery.length > 0
    ? customers.filter((c) =>
        (c.trade_name || c.business_name)
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        c.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.country?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.sector?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // ── Chart data prep ─────────────────────────

  const monthlyRevenue = invoices.reduce<Record<string, number>>((acc, inv) => {
    const d = new Date(inv.sale_date);
    const key = d.toLocaleDateString("es-EC", { month: "short", year: "2-digit" });
    acc[key] = (acc[key] || 0) + Number(inv.total_usd);
    return acc;
  }, {});
  const revenueChart = Object.entries(monthlyRevenue).map(([month, revenue]) => ({ month, revenue }));

  const statusCounts = invoices.reduce<Record<string, number>>((acc, inv) => {
    acc[inv.status] = (acc[inv.status] || 0) + 1;
    return acc;
  }, {});
  const statusPie = Object.entries(statusCounts).map(([status, count]) => ({
    name: INVOICE_STATUS_LABELS[status as InvoiceStatus] || status,
    value: count,
    color: INVOICE_STATUS_COLORS[status as InvoiceStatus] || "#6B7280",
  }));

  const avgTicket = invoices.length > 0
    ? invoices.reduce((s, i) => s + Number(i.total_usd), 0) / invoices.length
    : 0;

  // Credit usage
  const creditUsedPct = customer
    ? Math.min(100, (customer.credit_used / Math.max(customer.credit_limit, 1)) * 100)
    : 0;

  return (
    <div
      style={{ fontSize: `${fontScale}rem` }}
      className="relative flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden"
    >
      {/* Progress bar */}
      {selectedId && (
        <motion.div
          className="absolute left-0 top-0 z-50 h-0.5 bg-gradient-to-r from-[var(--brand)] to-[#8B5CF6]"
          style={{ width: progressWidth }}
        />
      )}

      {/* Top Action Bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-primary)] px-6 py-3">
        {selectedId ? (
          <button
            onClick={() => { setSelectedId(null); setCustomer(null); }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft size={14} />
            Volver
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)] to-[#8B5CF6]">
              <Award size={14} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">Modo Presentación</p>
              <p className="text-[9px] text-[var(--text-muted)]">Ficha de Cliente — Comercial & CRM</p>
            </div>
          </div>
        )}
        <div className="flex-1" />
        {/* Font Scale */}
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-0.5">
          {FONT_SCALES.map((fs) => (
            <button
              key={fs.label}
              onClick={() => handleFontScale(fs.scale)}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-semibold transition-all",
                fontScale === fs.scale
                  ? "bg-[var(--brand)] text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {fs.label}
            </button>
          ))}
        </div>
        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
          title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        >
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>
      </div>

      {/* Content Area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto scroll-smooth">
        <AnimatePresence mode="wait">
          {!selectedId ? (
            /* ═══ SEARCH SCREEN ═══ */
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex min-h-full flex-col items-center justify-center px-6 py-20"
            >
              {/* Logo */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--brand)] to-[#8B5CF6] shadow-lg shadow-[var(--brand)]/20"
              >
                <Award size={36} className="text-white" />
              </motion.div>

              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-2 text-2xl font-bold text-[var(--text-primary)]"
              >
                Ficha de Cliente
              </motion.h1>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mb-10 text-sm text-[var(--text-muted)]"
              >
                Busque un cliente para desplegar su presentación ejecutiva
              </motion.p>

              {/* Search Input */}
              <motion.div
                initial={{ y: 20, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="relative w-full max-w-lg"
              >
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, ciudad, país o sector..."
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] py-4 pl-12 pr-4 text-sm text-[var(--text-primary)] shadow-lg transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X size={16} />
                  </button>
                )}
              </motion.div>

              {/* Search Results */}
              <AnimatePresence>
                {filtered.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-4 w-full max-w-lg space-y-1.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-xl"
                    style={{ maxHeight: "360px", overflowY: "auto" }}
                  >
                    {filtered.slice(0, 12).map((c, i) => (
                      <motion.button
                        key={c.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => loadCustomer(c.id)}
                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all hover:bg-[var(--bg-muted)]"
                      >
                        {c.logo_url ? (
                          <img src={c.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-xs font-bold text-[var(--brand)]">
                            {(c.trade_name || c.business_name).substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                            {c.trade_name || c.business_name}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">
                            {c.sector} · {c.city}, {c.country}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-bold text-[var(--text-primary)]">{fmtUSD(c.total_revenue)}</p>
                          <div
                            className="mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                            style={{ backgroundColor: `${SEGMENT_COLORS[c.segment]}15`, color: SEGMENT_COLORS[c.segment] }}
                          >
                            {SEGMENT_LABELS[c.segment]}
                          </div>
                        </div>
                      </motion.button>
                    ))}
                    {filtered.length > 12 && (
                      <p className="py-2 text-center text-[10px] text-[var(--text-muted)]">
                        +{filtered.length - 12} resultados más...
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Stats */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-12 flex items-center gap-8"
              >
                {[
                  { label: "Clientes", value: customers.length },
                  { label: "Países", value: new Set(customers.map((c) => c.country)).size },
                  { label: "Sectores", value: new Set(customers.map((c) => c.sector)).size },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="text-lg font-bold text-[var(--text-primary)]">{stat.value}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{stat.label}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          ) : loading ? (
            /* ═══ LOADING ═══ */
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex min-h-full items-center justify-center py-20"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-3 border-[var(--brand)] border-t-transparent" />
                <p className="text-sm text-[var(--text-muted)]">Preparando presentación...</p>
              </div>
            </motion.div>
          ) : customer ? (
            /* ═══ PRESENTATION TIRA LARGA ═══ */
            <motion.div
              key="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mx-auto max-w-5xl space-y-8 px-6 py-8 pb-20"
            >
              {/* ─── BLOQUE 1: IDENTIDAD ─── */}
              <Section>
                <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-muted)]/30 p-8">
                  {/* Decorative glow */}
                  <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[var(--brand)]/5 blur-3xl" />
                  <div className="absolute -left-20 -bottom-20 h-40 w-40 rounded-full bg-[#8B5CF6]/5 blur-3xl" />

                  <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-8">
                    {/* Logo */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                      className="shrink-0"
                    >
                      {customer.logo_url ? (
                        <img src={customer.logo_url} alt="" className="h-24 w-24 rounded-2xl object-cover shadow-lg ring-4 ring-[var(--border)]" />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[#8B5CF6] text-2xl font-bold text-white shadow-lg">
                          {(customer.trade_name || customer.business_name).substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </motion.div>

                    {/* Info */}
                    <div className="flex-1 text-center md:text-left">
                      <motion.h1
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-2xl font-bold text-[var(--text-primary)]"
                      >
                        {customer.trade_name || customer.business_name}
                      </motion.h1>
                      <motion.p
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.35 }}
                        className="mt-1 text-sm text-[var(--text-secondary)]"
                      >
                        {customer.business_name}
                      </motion.p>
                      <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="mt-3 flex flex-wrap items-center justify-center gap-3 md:justify-start"
                      >
                        {[
                          { icon: MapPin, text: `${customer.city}, ${customer.province || ""}, ${customer.country}` },
                          { icon: Globe, text: customer.sector || "—" },
                          { icon: Building2, text: customer.company_size || "—" },
                          ...(customer.phone ? [{ icon: Phone, text: customer.phone }] : []),
                          ...(customer.email ? [{ icon: Mail, text: customer.email }] : []),
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                            <item.icon size={12} />
                            <span>{item.text}</span>
                          </div>
                        ))}
                      </motion.div>
                      {/* Tags */}
                      <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.45 }}
                        className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start"
                      >
                        <span
                          className="rounded-full px-3 py-1 text-[10px] font-bold"
                          style={{ backgroundColor: `${SEGMENT_COLORS[customer.segment]}15`, color: SEGMENT_COLORS[customer.segment] }}
                        >
                          {SEGMENT_LABELS[customer.segment]}
                        </span>
                        {customer.sap_customer_code && (
                          <span className="rounded-full bg-[var(--bg-muted)] px-3 py-1 text-[10px] font-medium text-[var(--text-muted)]">
                            {customer.sap_customer_code}
                          </span>
                        )}
                        {customer.tax_id && (
                          <span className="rounded-full bg-[var(--bg-muted)] px-3 py-1 text-[10px] font-medium text-[var(--text-muted)]">
                            RUC: {customer.tax_id}
                          </span>
                        )}
                        {customer.website && (
                          <a
                            href={customer.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-full bg-[var(--brand)]/10 px-3 py-1 text-[10px] font-medium text-[var(--brand)] transition-colors hover:bg-[var(--brand)]/20"
                          >
                            <ExternalLink size={10} />
                            Web
                          </a>
                        )}
                      </motion.div>
                    </div>

                    {/* Health Score */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
                      className="shrink-0 text-center"
                    >
                      <div className="relative inline-flex items-center justify-center">
                        <svg width="90" height="90" className="-rotate-90">
                          <circle cx="45" cy="45" r="38" fill="none" stroke="var(--border)" strokeWidth="5" />
                          <circle
                            cx="45" cy="45" r="38" fill="none"
                            stroke={customer.health_score >= 80 ? "#10B981" : customer.health_score >= 50 ? "#F59E0B" : "#EF4444"}
                            strokeWidth="5"
                            strokeDasharray={2 * Math.PI * 38}
                            strokeDashoffset={2 * Math.PI * 38 * (1 - customer.health_score / 100)}
                            strokeLinecap="round"
                            className="transition-all duration-1000"
                          />
                        </svg>
                        <span className="absolute text-xl font-bold text-[var(--text-primary)]">
                          {customer.health_score}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-medium text-[var(--text-muted)]">Health Score</p>
                    </motion.div>
                  </div>

                  {/* Company Details Row */}
                  {(customer.founded_year || customer.employee_count) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="mt-6 flex items-center justify-center gap-6 border-t border-[var(--border)] pt-4 md:justify-start"
                    >
                      {customer.founded_year && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                          <Calendar size={12} />
                          Fundada en {customer.founded_year}
                        </div>
                      )}
                      {customer.employee_count && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                          <Users size={12} />
                          {fmtNum(customer.employee_count)} empleados
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                        <Clock size={12} />
                        Términos: {customer.payment_terms} días
                      </div>
                    </motion.div>
                  )}
                </div>
              </Section>

              {/* ─── BLOQUE 2: GEOLOCALIZACIÓN + STREET VIEW ─── */}
              <Section delay={0.1}>
                <BlockCard>
                  <BlockTitle icon={MapPin} title="Ubicación y Geolocalización" />
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Map */}
                    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                      {customer.lat && customer.lng ? (
                        <iframe
                          src={`https://www.google.com/maps?q=${customer.lat},${customer.lng}&z=15&output=embed`}
                          width="100%"
                          height="280"
                          style={{ border: 0 }}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          className="rounded-xl"
                        />
                      ) : (
                        <div className="flex h-[280px] items-center justify-center bg-[var(--bg-muted)] text-sm text-[var(--text-muted)]">
                          Sin coordenadas disponibles
                        </div>
                      )}
                    </div>
                    {/* Street View */}
                    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                      {customer.lat && customer.lng ? (
                        <iframe
                          src={`https://www.google.com/maps?q=${customer.lat},${customer.lng}&layer=c&cbll=${customer.lat},${customer.lng}&cbp=11,0,0,0,0&output=svembed`}
                          width="100%"
                          height="280"
                          style={{ border: 0 }}
                          loading="lazy"
                          className="rounded-xl"
                        />
                      ) : (
                        <div className="flex h-[280px] items-center justify-center bg-[var(--bg-muted)] text-sm text-[var(--text-muted)]">
                          Street View no disponible
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Address */}
                  <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <MapPin size={14} className="shrink-0 text-[var(--brand)]" />
                    {customer.address || "—"} · {customer.city}, {customer.province || ""}, {customer.country}
                  </div>
                </BlockCard>
              </Section>

              {/* ─── BLOQUE 3: KPIs COMERCIALES ─── */}
              <Section delay={0.15}>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {[
                    { label: "Ingresos Totales", value: customer.total_revenue, prefix: "$", icon: DollarSign, color: "#10B981", fmt: fmtUSD },
                    { label: "Total Pedidos", value: customer.total_orders, icon: Package, color: "#3B82F6", fmt: fmtNum },
                    { label: "Ticket Promedio", value: avgTicket, prefix: "$", icon: TrendingUp, color: "#8B5CF6", fmt: fmtUSD },
                    { label: "Facturas", value: invoices.length, icon: FileText, color: "#F59E0B", fmt: fmtNum },
                  ].map((kpi, i) => (
                    <motion.div
                      key={kpi.label}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 transition-all hover:shadow-md"
                    >
                      <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20" style={{ backgroundColor: kpi.color }} />
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${kpi.color}15` }}>
                          <kpi.icon size={16} style={{ color: kpi.color }} />
                        </div>
                        <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">{kpi.label}</p>
                      </div>
                      <p className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
                        {kpi.fmt(kpi.value)}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </Section>

              {/* ─── BLOQUE 4: SALUD FINANCIERA ─── */}
              <Section delay={0.2}>
                <BlockCard>
                  <BlockTitle icon={Shield} title="Salud Financiera" />
                  <div className="grid gap-6 md:grid-cols-3">
                    {/* Credit gauge */}
                    <div className="rounded-xl bg-[var(--bg-muted)]/50 p-5">
                      <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Cupo de Crédito</p>
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--text-secondary)]">Utilizado: <strong>{fmtUSD(customer.credit_used)}</strong></span>
                          <span className="text-[var(--text-muted)]">Límite: {fmtUSD(customer.credit_limit)}</span>
                        </div>
                        <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--border)]">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${creditUsedPct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{
                              background: creditUsedPct > 80
                                ? "linear-gradient(90deg, #F59E0B, #EF4444)"
                                : creditUsedPct > 50
                                ? "linear-gradient(90deg, #3B82F6, #F59E0B)"
                                : "linear-gradient(90deg, #10B981, #3B82F6)",
                            }}
                          />
                        </div>
                        <p className="mt-1.5 text-right text-[10px] font-semibold" style={{ color: creditUsedPct > 80 ? "#EF4444" : "#10B981" }}>
                          {creditUsedPct.toFixed(0)}% utilizado
                        </p>
                      </div>
                      <p className="mt-3 text-xl font-bold text-[var(--text-primary)]">
                        {fmtUSD(customer.credit_limit - customer.credit_used)}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">Disponible</p>
                    </div>

                    {/* Payment distribution */}
                    <div className="rounded-xl bg-[var(--bg-muted)]/50 p-5">
                      <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Estado de Facturas</p>
                      {statusPie.length > 0 ? (
                        <div className="mt-2 h-[140px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={statusPie}
                                innerRadius={35}
                                outerRadius={55}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {statusPie.map((entry, i) => (
                                  <Cell key={i} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="mt-4 text-center text-[11px] text-[var(--text-muted)]">Sin facturas</p>
                      )}
                      <div className="mt-2 flex flex-wrap justify-center gap-2">
                        {statusPie.map((s) => (
                          <div key={s.name} className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className="text-[9px] text-[var(--text-muted)]">{s.name} ({s.value})</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment terms */}
                    <div className="rounded-xl bg-[var(--bg-muted)]/50 p-5">
                      <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Comportamiento de Pago</p>
                      <div className="mt-4 space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[var(--text-secondary)]">Términos de pago</span>
                            <span className="font-bold text-[var(--text-primary)]">{customer.payment_terms} días</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[var(--text-secondary)]">Moneda preferida</span>
                            <span className="font-bold text-[var(--text-primary)]">{customer.preferred_currency}</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[var(--text-secondary)]">Facturas pagadas</span>
                            <span className="font-bold text-emerald-500">
                              {invoices.filter((i) => i.status === "paid").length} / {invoices.length}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[var(--text-secondary)]">Última compra</span>
                            <span className="font-bold text-[var(--text-primary)]">
                              {customer.last_purchase_at
                                ? new Date(customer.last_purchase_at).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })
                                : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </BlockCard>
              </Section>

              {/* ─── BLOQUE 5: HISTORIAL DE COMPRAS ─── */}
              <Section delay={0.25}>
                <BlockCard>
                  <BlockTitle icon={BarChart3} title="Historial de Compras" badge={`${invoices.length} facturas`} />
                  {revenueChart.length > 0 && (
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueChart}>
                          <defs>
                            <linearGradient id="fichaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtUSD(v)} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                            formatter={(v: unknown) => [fmtUSD(Number(v)), "Ingresos"]}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="var(--brand)" strokeWidth={2.5} fill="url(#fichaGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {/* Recent invoices table */}
                  <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/50">
                          {["Factura", "Fecha", "Total", "Estado"].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.slice(0, 8).map((inv) => (
                          <tr key={inv.id} className="border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--bg-muted)]/30">
                            <td className="px-4 py-2.5 text-xs font-medium text-[var(--text-primary)]">{inv.invoice_number}</td>
                            <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">
                              {new Date(inv.sale_date).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] tabular-nums">{fmtUSD(Number(inv.total_usd))}</td>
                            <td className="px-4 py-2.5">
                              <span
                                className="rounded-full px-2.5 py-0.5 text-[9px] font-semibold"
                                style={{ backgroundColor: `${INVOICE_STATUS_COLORS[inv.status]}15`, color: INVOICE_STATUS_COLORS[inv.status] }}
                              >
                                {INVOICE_STATUS_LABELS[inv.status]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </BlockCard>
              </Section>

              {/* ─── BLOQUE 6: OPORTUNIDADES & COTIZACIONES ─── */}
              <Section delay={0.3}>
                <div className="grid gap-4 md:grid-cols-2">
                  <BlockCard>
                    <BlockTitle icon={TrendingUp} title="Oportunidades Activas" badge={`${opportunities.length}`} />
                    {opportunities.length === 0 ? (
                      <p className="py-8 text-center text-xs text-[var(--text-muted)]">Sin oportunidades abiertas</p>
                    ) : (
                      <div className="space-y-2">
                        {opportunities.slice(0, 6).map((opp) => (
                          <div key={opp.id} className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--bg-muted)]">
                            <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: opp.stage?.color || "#6B7280" }} />
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-xs font-medium text-[var(--text-primary)]">{opp.name}</p>
                              <p className="text-[10px] text-[var(--text-muted)]">{opp.stage?.name} · {opp.probability}%</p>
                            </div>
                            <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">{fmtUSD(Number(opp.amount))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </BlockCard>

                  <BlockCard>
                    <BlockTitle icon={FileText} title="Cotizaciones" badge={`${quotes.length}`} />
                    {quotes.length === 0 ? (
                      <p className="py-8 text-center text-xs text-[var(--text-muted)]">Sin cotizaciones</p>
                    ) : (
                      <div className="space-y-2">
                        {quotes.slice(0, 6).map((q) => (
                          <div key={q.id} className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--bg-muted)]">
                            <FileText size={14} className="shrink-0 text-[var(--text-muted)]" />
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-xs font-medium text-[var(--text-primary)]">{q.quote_number}</p>
                              <p className="text-[10px] text-[var(--text-muted)]">
                                {new Date(q.created_at).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}
                              </p>
                            </div>
                            <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">{fmtUSD(Number(q.total))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </BlockCard>
                </div>
              </Section>

              {/* ─── BLOQUE 7: IA CROSS-SELLING ─── */}
              <Section delay={0.35}>
                <div className="relative overflow-hidden rounded-2xl border border-[var(--brand)]/20 bg-gradient-to-br from-[var(--brand)]/5 to-[#8B5CF6]/5 p-6">
                  <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--brand)]/10 blur-3xl" />
                  <div className="relative">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)] to-[#8B5CF6]">
                        <Sparkles size={14} className="text-white" />
                      </div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">Recomendaciones para su Negocio</h3>
                      <span className="rounded-full bg-[var(--brand)]/10 px-2.5 py-0.5 text-[9px] font-bold text-[var(--brand)]">
                        🤖 GRIXI AI
                      </span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        {
                          title: "Expansión de línea",
                          desc: `${customer.trade_name || "Este cliente"} podría beneficiarse de productos complementarios basados en su historial de ${customer.total_orders} pedidos.`,
                          tag: "Venta Cruzada",
                        },
                        {
                          title: "Optimización de crédito",
                          desc: creditUsedPct < 50
                            ? `Tiene ${(100 - creditUsedPct).toFixed(0)}% de crédito disponible. Oportunidad de incrementar volumen con condiciones especiales.`
                            : `Uso de crédito al ${creditUsedPct.toFixed(0)}%. Considerar ampliación de cupo para facilitar pedidos más grandes.`,
                          tag: "Financiero",
                        },
                        {
                          title: "Frecuencia de compra",
                          desc: invoices.length > 0
                            ? `Promedio de ${(invoices.length / 6).toFixed(1)} compras/mes. Se recomienda programa de fidelización para mantener la frecuencia.`
                            : "Sin historial de compras reciente. Activar con oferta introductoria.",
                          tag: "Retención",
                        },
                      ].map((rec, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.1 }}
                          className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 transition-shadow hover:shadow-md"
                        >
                          <span className="rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[8px] font-bold text-[var(--brand)]">
                            {rec.tag}
                          </span>
                          <p className="mt-2 text-xs font-semibold text-[var(--text-primary)]">{rec.title}</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{rec.desc}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>

              {/* ─── BLOQUE 8: CONTACTOS ─── */}
              <Section delay={0.4}>
                <BlockCard>
                  <BlockTitle icon={Users} title="Contactos del Cliente" badge={`${contacts.length}`} />
                  {contacts.length === 0 ? (
                    <p className="py-8 text-center text-xs text-[var(--text-muted)]">Sin contactos registrados</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {contacts.map((c, i) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.05 }}
                          className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-4 transition-shadow hover:shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            {c.avatar_url ? (
                              <img src={c.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)]/10 text-xs font-bold text-[var(--brand)]">
                                {c.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{c.full_name}</p>
                              {c.role && (
                                <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                                  {CONTACT_ROLE_LABELS[c.role]}
                                </span>
                              )}
                            </div>
                            {c.is_primary && <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />}
                          </div>
                          <div className="mt-3 space-y-1.5">
                            {c.email && (
                              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                                <Mail size={11} className="shrink-0 text-[var(--text-muted)]" />
                                <span className="truncate">{c.email}</span>
                              </div>
                            )}
                            {c.phone && (
                              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                                <Phone size={11} className="shrink-0 text-[var(--text-muted)]" />
                                <span>{c.phone}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </BlockCard>
              </Section>

              {/* ─── FOOTER ─── */}
              <Section delay={0.45}>
                <div className="flex items-center justify-center gap-3 py-8 text-[var(--text-muted)]">
                  <div className="h-px flex-1 bg-[var(--border)]" />
                  <div className="flex items-center gap-2 text-[10px]">
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-[var(--brand)] to-[#8B5CF6]">
                      <span className="text-[7px] font-bold text-white">G</span>
                    </div>
                    Presentación generada por GRIXI · {new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" })}
                  </div>
                  <div className="h-px flex-1 bg-[var(--border)]" />
                </div>
              </Section>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
