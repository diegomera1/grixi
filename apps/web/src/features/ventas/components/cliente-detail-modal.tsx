"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Building2,
  Users,
  Clock,
  DollarSign,
  BarChart3,
  Target,
  Mail,
  Phone,
  Globe,
  MapPin,
  Shield,
  CreditCard,
  TrendingUp,
  Package,
  Calendar,
  FileText,
  MessageSquare,
  Video,
  Briefcase,
  UserCheck,
  Star,
  Award,
  Sparkles,
  ExternalLink,
  Maximize,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { cn } from "@/lib/utils/cn";
import type {
  SalesCustomer,
  SalesContact,
  SalesActivity,
  SalesInvoice,
  SalesQuote,
  SalesOpportunity,
  CustomerSegment,
  DemoRole,
} from "../types";
import {
  SEGMENT_LABELS,
  SEGMENT_COLORS,
  CONTACT_ROLE_LABELS,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_COLORS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
} from "../types";
import {
  fetchCustomerById,
  fetchContacts,
  fetchActivities,
  fetchInvoicesByCustomer,
  fetchQuotesByCustomer,
  fetchOpportunitiesByCustomer,
} from "../actions/ventas-actions";

// ── Activity Icon Map ─────────────────────────────

const ACTIVITY_ICONS: Record<string, typeof Mail> = {
  call: Phone,
  email: Mail,
  meeting: Video,
  note: MessageSquare,
  visit: MapPin,
  follow_up: Clock,
  demo: Briefcase,
  proposal: FileText,
};

// ── Tab Type ──────────────────────────────────────

type DetailTab = "general" | "contactos" | "timeline" | "ventas" | "analisis" | "oportunidades" | "presentacion";

const DETAIL_TABS: { id: DetailTab; label: string; icon: typeof Building2 }[] = [
  { id: "presentacion", label: "Presentación", icon: Award },
  { id: "general", label: "General", icon: Building2 },
  { id: "contactos", label: "Contactos", icon: Users },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "ventas", label: "Ventas", icon: DollarSign },
  { id: "analisis", label: "Análisis", icon: BarChart3 },
  { id: "oportunidades", label: "Oportunidades", icon: Target },
];

// ── Health Score Gauge ────────────────────────────

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="68" height="68" className="-rotate-90">
        <circle cx="34" cy="34" r="28" fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle
          cx="34" cy="34" r="28" fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000"
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

// ── General Tab ───────────────────────────────────

function GeneralTab({ customer }: { customer: SalesCustomer }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Company Info */}
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h4 className="mb-3 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Datos de la Empresa
          </h4>
          <div className="space-y-2.5">
            {[
              { label: "Razón Social", value: customer.business_name },
              { label: "Nombre Comercial", value: customer.trade_name },
              { label: "RUC/NIT", value: customer.tax_id },
              { label: "Sector", value: customer.sector },
              { label: "Tamaño", value: customer.company_size },
              { label: "Código SAP", value: customer.sap_customer_code },
            ].map((field) => (
              <div key={field.label} className="flex justify-between">
                <span className="text-[9px] text-[var(--text-muted)]">{field.label}</span>
                <span className="text-[9px] font-medium text-[var(--text-primary)]">
                  {field.value || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h4 className="mb-3 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Ubicación
          </h4>
          <div className="space-y-2.5">
            {[
              { icon: MapPin, value: customer.address },
              { icon: Globe, value: `${customer.city}, ${customer.country}` },
              { icon: Globe, value: customer.website },
            ].map((field, i) => (
              <div key={i} className="flex items-center gap-2">
                <field.icon size={10} className="text-[var(--text-muted)]" />
                <span className="text-[9px] text-[var(--text-primary)]">
                  {field.value || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Financial Info */}
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h4 className="mb-3 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Indicadores
          </h4>
          <div className="flex items-center justify-around">
            <div className="text-center">
              <HealthGauge score={customer.health_score} />
              <p className="mt-1 text-[8px] text-[var(--text-muted)]">Salud</p>
            </div>
            <div className="text-center">
              <div
                className="inline-flex rounded-full px-3 py-1.5 text-xs font-bold"
                style={{
                  backgroundColor: `${SEGMENT_COLORS[customer.segment]}15`,
                  color: SEGMENT_COLORS[customer.segment],
                }}
              >
                {SEGMENT_LABELS[customer.segment]}
              </div>
              <p className="mt-1 text-[8px] text-[var(--text-muted)]">Segmento RFM</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h4 className="mb-3 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Financiero
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Ingresos Totales", value: `$${(customer.total_revenue / 1000).toFixed(1)}K`, icon: DollarSign, color: "#10B981" },
              { label: "Total Pedidos", value: customer.total_orders, icon: Package, color: "#3B82F6" },
              { label: "Crédito Límite", value: `$${(customer.credit_limit / 1000).toFixed(0)}K`, icon: CreditCard, color: "#8B5CF6" },
              { label: "Crédito Usado", value: `$${(customer.credit_used / 1000).toFixed(0)}K`, icon: Shield, color: "#F59E0B" },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg bg-[var(--bg-muted)] p-2.5 text-center">
                <kpi.icon size={12} className="mx-auto mb-1" style={{ color: kpi.color }} />
                <p className="text-xs font-bold text-[var(--text-primary)]">{kpi.value}</p>
                <p className="text-[7px] text-[var(--text-muted)]">{kpi.label}</p>
              </div>
            ))}
          </div>
        </div>

        {customer.assigned_seller && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <h4 className="mb-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Vendedor Asignado
            </h4>
            <div className="flex items-center gap-3">
              {customer.assigned_seller.avatar_url ? (
                <img src={customer.assigned_seller.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3B82F6]/10">
                  <UserCheck size={14} className="text-[#3B82F6]" />
                </div>
              )}
              <span className="text-[10px] font-medium text-[var(--text-primary)]">
                {customer.assigned_seller.full_name}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Contactos Tab ─────────────────────────────────

function ContactosTab({ contacts }: { contacts: SalesContact[] }) {
  if (contacts.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-[10px] text-[var(--text-muted)]">
        Sin contactos registrados
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {contacts.map((c) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
        >
          <div className="flex items-center gap-3">
            {c.avatar_url ? (
              <img src={c.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3B82F6]/10 text-[9px] font-bold text-[#3B82F6]">
                {c.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-primary)]">{c.full_name}</p>
              {c.role && (
                <span className="rounded-full bg-[var(--bg-muted)] px-1.5 py-0.5 text-[7px] font-medium text-[var(--text-muted)]">
                  {CONTACT_ROLE_LABELS[c.role]}
                </span>
              )}
            </div>
            {c.is_primary && (
              <Star size={10} className="ml-auto text-amber-500 fill-amber-500" />
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {c.email && (
              <div className="flex items-center gap-1.5">
                <Mail size={9} className="text-[var(--text-muted)]" />
                <span className="text-[8px] text-[var(--text-secondary)]">{c.email}</span>
              </div>
            )}
            {c.phone && (
              <div className="flex items-center gap-1.5">
                <Phone size={9} className="text-[var(--text-muted)]" />
                <span className="text-[8px] text-[var(--text-secondary)]">{c.phone}</span>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Timeline Tab ──────────────────────────────────

function TimelineTab({ activities }: { activities: SalesActivity[] }) {
  if (activities.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-[10px] text-[var(--text-muted)]">
        Sin actividades registradas
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--border)]" />
      <div className="space-y-3">
        {activities.map((act, i) => {
          const Icon = ACTIVITY_ICONS[act.activity_type] || MessageSquare;
          const color = ACTIVITY_TYPE_COLORS[act.activity_type] || "#6B7280";
          return (
            <motion.div
              key={act.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="relative flex gap-4 pl-8"
            >
              <div
                className="absolute left-2 top-1 flex h-5 w-5 items-center justify-center rounded-full"
                style={{ backgroundColor: `${color}15` }}
              >
                <Icon size={10} style={{ color }} />
              </div>
              <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-[var(--text-primary)]">
                      {act.title}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[7px] font-medium"
                      style={{ backgroundColor: `${color}15`, color }}
                    >
                      {ACTIVITY_TYPE_LABELS[act.activity_type]}
                    </span>
                  </div>
                  <span className="text-[8px] text-[var(--text-muted)]">
                    {new Date(act.created_at).toLocaleDateString("es-EC", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {act.description && (
                  <p className="mt-1.5 text-[9px] text-[var(--text-secondary)] line-clamp-2">
                    {act.description}
                  </p>
                )}
                {act.performer && (
                  <div className="mt-2 flex items-center gap-1.5">
                    {act.performer.avatar_url ? (
                      <img src={act.performer.avatar_url} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                    ) : (
                      <Users size={8} className="text-[var(--text-muted)]" />
                    )}
                    <span className="text-[7px] text-[var(--text-muted)]">
                      {act.performer.full_name}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Ventas Tab ────────────────────────────────────

function VentasDetailTab({ invoices, customer }: { invoices: SalesInvoice[]; customer: SalesCustomer }) {
  // Monthly revenue evolution
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
  const chartData = months.map((month, i) => {
    const monthInv = invoices.filter((inv) => new Date(inv.sale_date).getMonth() === i);
    return { month, revenue: monthInv.reduce((s, inv) => s + Number(inv.total_usd), 0) };
  });

  const avgTicket = invoices.length > 0
    ? invoices.reduce((s, inv) => s + Number(inv.total_usd), 0) / invoices.length
    : 0;

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--text-primary)]">${(customer.total_revenue / 1000).toFixed(1)}K</p>
          <p className="text-[8px] text-[var(--text-muted)]">Ingresos Totales</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--text-primary)]">{invoices.length}</p>
          <p className="text-[8px] text-[var(--text-muted)]">Facturas</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--text-primary)]">${(avgTicket / 1000).toFixed(1)}K</p>
          <p className="text-[8px] text-[var(--text-muted)]">Ticket Promedio</p>
        </div>
      </div>

      {/* Evolution Chart */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <h4 className="mb-3 text-[10px] font-semibold text-[var(--text-primary)]">Evolución de Ventas</h4>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="custRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 8, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 10 }} formatter={(v) => [`$${Number(v).toLocaleString()}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} fill="url(#custRevGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/50">
              {["Factura", "Fecha", "Total", "Status"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[8px] font-semibold text-[var(--text-muted)] uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.slice(0, 10).map((inv) => (
              <tr key={inv.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-muted)]/30 transition-colors">
                <td className="px-3 py-2 text-[9px] font-medium text-[var(--text-primary)]">{inv.invoice_number}</td>
                <td className="px-3 py-2 text-[9px] text-[var(--text-secondary)]">
                  {new Date(inv.sale_date).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td className="px-3 py-2 text-[9px] font-bold text-[var(--text-primary)] tabular-nums">
                  ${Number(inv.total_usd).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[7px] font-semibold"
                    style={{
                      backgroundColor: `${INVOICE_STATUS_COLORS[inv.status]}15`,
                      color: INVOICE_STATUS_COLORS[inv.status],
                    }}
                  >
                    {INVOICE_STATUS_LABELS[inv.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Análisis Tab ──────────────────────────────────

function AnalisisTab({ invoices }: { invoices: SalesInvoice[] }) {
  const frequency = invoices.length > 0 ? (invoices.length / 6).toFixed(1) : "0";

  // Status distribution for bar chart
  const statusData = Object.entries(
    invoices.reduce<Record<string, number>>((acc, inv) => {
      const label = INVOICE_STATUS_LABELS[inv.status] || inv.status;
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, count]) => ({ name, count }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
          <p className="text-2xl font-bold text-[#3B82F6]">{frequency}</p>
          <p className="text-[8px] text-[var(--text-muted)]">Compras / Mes</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
          <p className="text-2xl font-bold text-[#10B981]">{invoices.length}</p>
          <p className="text-[8px] text-[var(--text-muted)]">Transacciones Total</p>
        </div>
      </div>

      {statusData.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h4 className="mb-2 text-[10px] font-semibold text-[var(--text-primary)]">Distribución por Estado</h4>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 8, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 10 }} />
                <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <h4 className="mb-2 text-[10px] font-semibold text-[var(--text-primary)]">
          Análisis de compra por disponibilidad de datos
        </h4>
        <p className="text-[9px] text-[var(--text-muted)]">
          El análisis de productos más comprados requiere datos de invoice_items asociados a este cliente.
          Se muestran las métricas de frecuencia y tendencia disponibles.
        </p>
      </div>
    </div>
  );
}

// ── Presentación Tab ──────────────────────────────

const DONUT_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444"];

function PresentacionTab({
  customer,
  contacts,
  invoices,
  opportunities,
}: {
  customer: SalesCustomer;
  contacts: SalesContact[];
  invoices: SalesInvoice[];
  opportunities: SalesOpportunity[];
}) {
  function fmtUSD(v: number): string {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toLocaleString()}`;
  }

  const avgTicket = invoices.length > 0
    ? invoices.reduce((s, inv) => s + Number(inv.total_usd), 0) / invoices.length
    : 0;

  const creditUsedPct = Math.min(100, (customer.credit_used / Math.max(customer.credit_limit, 1)) * 100);
  const paidCount = invoices.filter((i) => i.status === "paid").length;
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;
  const pendingCount = invoices.filter((i) => i.status === "draft" || i.status === "confirmed" || i.status === "invoiced" || i.status === "partially_paid").length;

  const relationYears = customer.first_purchase_date
    ? Math.max(1, Math.floor((Date.now() - new Date(customer.first_purchase_date).getTime()) / (365.25 * 86400000)))
    : 0;

  const monthlyRevenue = invoices.reduce<Record<string, number>>((acc, inv) => {
    const d = new Date(inv.sale_date);
    const key = d.toLocaleDateString("es-EC", { month: "short" });
    acc[key] = (acc[key] || 0) + Number(inv.total_usd);
    return acc;
  }, {});
  const revenueChart = Object.entries(monthlyRevenue).map(([month, revenue]) => ({ month, revenue }));

  const categories = Array.isArray(customer.top_categories) ? customer.top_categories : [];
  const catTotal = categories.length;
  const donutData = categories.map((cat, i) => ({
    name: cat as string,
    value: catTotal > 0 ? Math.round(100 / catTotal) + (i === 0 ? 100 % catTotal : 0) : 0,
  }));

  const statusPie = [
    { name: "Pagadas", value: paidCount, color: "#10B981" },
    { name: "Pendientes", value: pendingCount, color: "#F59E0B" },
    { name: "Vencidas", value: overdueCount, color: "#EF4444" },
  ].filter(s => s.value > 0);

  const pipelineTotal = opportunities.reduce((s, o) => s + Number(o.amount), 0);

  const daysSinceContact = customer.last_contact_date
    ? Math.floor((Date.now() - new Date(customer.last_contact_date).getTime()) / 86400000)
    : null;

  const contractDaysLeft = customer.contract_end_date
    ? Math.max(0, Math.floor((new Date(customer.contract_end_date).getTime() - Date.now()) / 86400000))
    : null;

  function PresentacionStars({ rating }: { rating: number }) {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} size={12}
            className={cn(s <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-[var(--border)]")} />
        ))}
        <span className="ml-1 text-[10px] font-bold text-[var(--text-primary)]">{rating.toFixed(1)}</span>
      </div>
    );
  }

  function MiniGauge({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
    const pct = Math.min(100, (value / max) * 100);
    const circ = 2 * Math.PI * 22;
    const off = circ - (pct / 100) * circ;
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <svg width="52" height="52" className="-rotate-90">
            <circle cx="26" cy="26" r="22" fill="none" stroke="var(--border)" strokeWidth="3" />
            <circle cx="26" cy="26" r="22" fill="none" stroke={color} strokeWidth="3"
              strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color }}>
            {Math.round(pct)}%
          </span>
        </div>
        <span className="text-[7px] text-[var(--text-muted)] text-center leading-tight">{label}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      {/* ═══ B1: HERO IDENTITY ═══ */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-card)] via-[var(--bg-card)] to-[var(--bg-muted)]/40 p-6">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[var(--brand)]/5 blur-3xl" />
        <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-[#8B5CF6]/5 blur-3xl" />
        <div className="relative flex items-start gap-5">
          <div className="shrink-0">
            {customer.logo_url ? (
              <img src={customer.logo_url} alt="" className="h-16 w-16 rounded-2xl object-cover shadow-md ring-2 ring-[var(--border)]" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[#8B5CF6] text-lg font-bold text-white shadow-md">
                {(customer.trade_name || customer.business_name).substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-[var(--text-primary)]">{customer.trade_name || customer.business_name}</h2>
              {relationYears > 0 && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[7px] font-bold text-emerald-600">
                  ✦ Cliente {relationYears} {relationYears === 1 ? "año" : "años"}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">{customer.business_name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]"><MapPin size={10} />{customer.city}, {customer.province || ""}, {customer.country}</span>
              <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]"><Globe size={10} />{customer.sector}</span>
              {customer.phone && <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]"><Phone size={10} />{customer.phone}</span>}
              {customer.email && <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]"><Mail size={10} />{customer.email}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full px-2 py-0.5 text-[8px] font-bold" style={{ backgroundColor: `${SEGMENT_COLORS[customer.segment]}15`, color: SEGMENT_COLORS[customer.segment] }}>{SEGMENT_LABELS[customer.segment]}</span>
              {customer.sap_customer_code && <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[8px] font-medium text-[var(--text-muted)]">SAP {customer.sap_customer_code}</span>}
              <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[8px] font-medium text-[var(--text-muted)]">RUC: {customer.tax_id || "—"}</span>
              <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[8px] font-medium text-[var(--text-muted)]">{customer.primary_product_line}</span>
              {customer.contract_type !== "Spot" && <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[8px] font-bold text-blue-600">📋 {customer.contract_type}</span>}
              {customer.website && <a href={customer.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[8px] font-medium text-[var(--brand)] hover:bg-[var(--brand)]/20"><ExternalLink size={8} />Web</a>}
            </div>
            <div className="mt-2 flex items-center gap-4">
              {customer.founded_year && <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]"><Calendar size={10} />Fundada {customer.founded_year}</span>}
              {customer.employee_count && <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]"><Users size={10} />{customer.employee_count.toLocaleString()} empleados</span>}
              <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]"><Briefcase size={10} />{customer.industry_code}</span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-4">
            <div className="text-center"><HealthGauge score={customer.health_score} /><p className="mt-1 text-[7px] text-[var(--text-muted)]">Health</p></div>
            <div className="text-center"><HealthGauge score={customer.nps_score} /><p className="mt-1 text-[7px] text-[var(--text-muted)]">NPS</p></div>
            <div className="text-center"><PresentacionStars rating={customer.satisfaction_rating} /><p className="mt-1 text-[7px] text-[var(--text-muted)]">Satisfacción</p></div>
          </div>
        </div>
      </div>

      {/* ═══ B2: GEOLOCATION ═══ */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <h4 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-primary)]"><MapPin size={12} className="text-[var(--brand)]" />Ubicación y Street View</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            {customer.lat && customer.lng ? (
              <iframe src={`https://www.google.com/maps?q=${customer.lat},${customer.lng}&z=15&output=embed`} width="100%" height="200" style={{ border: 0 }} loading="lazy" className="rounded-xl" />
            ) : <div className="flex h-[200px] items-center justify-center bg-[var(--bg-muted)] text-[10px] text-[var(--text-muted)]">Sin coordenadas</div>}
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            {customer.lat && customer.lng ? (
              <iframe src={`https://www.google.com/maps?q=${customer.lat},${customer.lng}&layer=c&cbll=${customer.lat},${customer.lng}&cbp=11,0,0,0,0&output=svembed`} width="100%" height="200" style={{ border: 0 }} loading="lazy" className="rounded-xl" />
            ) : <div className="flex h-[200px] items-center justify-center bg-[var(--bg-muted)] text-[10px] text-[var(--text-muted)]">Street View no disponible</div>}
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[9px] text-[var(--text-secondary)]"><MapPin size={10} className="text-[var(--brand)]" />{customer.address || "—"} · {customer.city}, {customer.province || ""}, {customer.country}</p>
      </div>

      {/* ═══ B3: SCORECARD 6 KPIs ═══ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Ingresos Totales", value: fmtUSD(customer.total_revenue), icon: DollarSign, color: "#10B981" },
          { label: "Total Pedidos", value: customer.total_orders.toLocaleString(), icon: Package, color: "#3B82F6" },
          { label: "Ticket Promedio", value: fmtUSD(avgTicket), icon: TrendingUp, color: "#8B5CF6" },
          { label: "Crecimiento YoY", value: `${customer.yoy_growth_pct > 0 ? "+" : ""}${customer.yoy_growth_pct.toFixed(1)}%`, icon: TrendingUp, color: customer.yoy_growth_pct >= 0 ? "#10B981" : "#EF4444" },
          { label: "NPS Score", value: `${customer.nps_score}/100`, icon: Star, color: "#F59E0B" },
          { label: "Satisfacción", value: `${customer.satisfaction_rating.toFixed(1)}/5`, icon: Star, color: "#F59E0B" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 transition-shadow hover:shadow-sm">
            <div className="flex items-center gap-1.5"><div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: `${kpi.color}15` }}><kpi.icon size={12} style={{ color: kpi.color }} /></div></div>
            <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{kpi.value}</p>
            <p className="text-[7px] font-medium text-[var(--text-muted)] uppercase tracking-wider">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ═══ B4: EVOLUCIÓN INGRESOS ═══ */}
      {revenueChart.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-primary)]"><BarChart3 size={12} className="text-[var(--brand)]" />Evolución de Ingresos</h4>
            <span className="text-[8px] font-bold" style={{ color: customer.yoy_growth_pct >= 0 ? "#10B981" : "#EF4444" }}>
              {customer.yoy_growth_pct > 0 ? "↑" : "↓"} {Math.abs(customer.yoy_growth_pct).toFixed(1)}% YoY
            </span>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChart}>
                <defs><linearGradient id="presGrd" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--brand)" stopOpacity={0.25} /><stop offset="95%" stopColor="var(--brand)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtUSD(v)} />
                <Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 10 }} formatter={(v: unknown) => [fmtUSD(Number(v)), "Ingresos"]} />
                <Area type="monotone" dataKey="revenue" stroke="var(--brand)" strokeWidth={2.5} fill="url(#presGrd)" dot={{ r: 3, fill: "var(--brand)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ═══ B5: SALUD FINANCIERA ═══ */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <h4 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-primary)]"><Shield size={12} className="text-[var(--brand)]" />Salud Financiera</h4>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-[var(--bg-muted)]/50 p-4">
            <p className="text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Cupo de Crédito</p>
            <div className="mt-2 flex justify-between text-[9px]"><span className="text-[var(--text-secondary)]">Utilizado: <strong>{fmtUSD(customer.credit_used)}</strong></span><span className="text-[var(--text-muted)]">Límite: {fmtUSD(customer.credit_limit)}</span></div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${creditUsedPct}%`, background: creditUsedPct > 80 ? "linear-gradient(90deg,#F59E0B,#EF4444)" : creditUsedPct > 50 ? "linear-gradient(90deg,#3B82F6,#F59E0B)" : "linear-gradient(90deg,#10B981,#3B82F6)" }} /></div>
            <div className="mt-2 flex justify-between"><span className="text-[9px] font-bold text-[var(--text-primary)]">{fmtUSD(customer.credit_limit - customer.credit_used)} disponible</span><span className="text-[9px] font-semibold" style={{ color: creditUsedPct > 80 ? "#EF4444" : "#10B981" }}>{creditUsedPct.toFixed(0)}%</span></div>
          </div>
          <div className="rounded-xl bg-[var(--bg-muted)]/50 p-4">
            <p className="text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Pago</p>
            <div className="mt-3 flex items-center justify-around">
              <MiniGauge value={customer.on_time_payment_pct} max={100} color="#10B981" label="A tiempo" />
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--text-primary)]">{customer.payment_avg_days}d</p>
                <p className="text-[7px] text-[var(--text-muted)]">Prom. pago</p>
                <p className="text-[7px]" style={{ color: customer.payment_avg_days <= customer.payment_terms ? "#10B981" : "#EF4444" }}>
                  {customer.payment_avg_days <= customer.payment_terms ? "✓" : "⚠"} vs {customer.payment_terms}d
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-[var(--bg-muted)]/50 p-4">
            <p className="text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Facturas</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-24 w-24"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusPie} dataKey="value" cx="50%" cy="50%" innerRadius={18} outerRadius={34} paddingAngle={3} strokeWidth={0}>{statusPie.map((s, i) => <Cell key={i} fill={s.color} />)}</Pie></PieChart></ResponsiveContainer></div>
              <div className="space-y-1">{statusPie.map((s) => (<div key={s.name} className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} /><span className="text-[8px] text-[var(--text-secondary)]">{s.name}: <strong>{s.value}</strong></span></div>))}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ B6: MIX DE PRODUCTOS ═══ */}
      {donutData.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h4 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-primary)]"><Package size={12} className="text-[var(--brand)]" />Mix de Productos</h4>
          <div className="flex items-center gap-6">
            <div className="h-36 w-36 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={4} strokeWidth={0}>{donutData.map((_d, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 10 }} /></PieChart></ResponsiveContainer></div>
            <div className="flex-1 space-y-2">
              {donutData.map((cat, i) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="flex-1 text-[10px] font-medium text-[var(--text-primary)]">{cat.name}</span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full rounded-full" style={{ width: `${cat.value}%`, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} /></div>
                  <span className="text-[9px] font-bold text-[var(--text-primary)] tabular-nums w-8 text-right">{cat.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ B7: PIPELINE ═══ */}
      {opportunities.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h4 className="mb-3 flex items-center justify-between text-[10px] font-semibold text-[var(--text-primary)]">
            <span className="flex items-center gap-1.5"><Target size={12} className="text-[var(--brand)]" />Pipeline Activo</span>
            <span className="text-[10px] font-bold text-[var(--brand)]">{fmtUSD(pipelineTotal)}</span>
          </h4>
          <div className="space-y-2">{opportunities.map((opp) => (
            <div key={opp.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-[var(--bg-muted)]/50 transition-colors">
              <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: opp.stage?.color || "#6B7280" }} />
              <div className="flex-1 min-w-0"><p className="truncate text-[9px] font-semibold text-[var(--text-primary)]">{opp.name}</p><p className="text-[8px] text-[var(--text-muted)]">{opp.stage?.name} · {opp.probability}%</p></div>
              <span className="text-[10px] font-bold text-[var(--text-primary)] tabular-nums">{fmtUSD(Number(opp.amount))}</span>
            </div>
          ))}</div>
        </div>
      )}

      {/* ═══ B8: RESUMEN RELACIÓN ═══ */}
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--bg-card)] to-[var(--bg-muted)]/30 p-4">
        <h4 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-primary)]"><Briefcase size={12} className="text-[var(--brand)]" />Resumen de Relación</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Calendar, label: "Relación", value: relationYears > 0 ? `${relationYears} años` : "Nuevo", sub: customer.first_purchase_date ? `Desde ${new Date(customer.first_purchase_date).toLocaleDateString("es-EC", { month: "long", year: "numeric" })}` : "" },
            { icon: Mail, label: "Último Contacto", value: daysSinceContact !== null ? `Hace ${daysSinceContact}d` : "—", sub: customer.last_contact_date ? new Date(customer.last_contact_date).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" }) : "" },
            { icon: FileText, label: "Contrato", value: customer.contract_type, sub: contractDaysLeft !== null ? `${contractDaysLeft} días restantes` : "Sin contrato" },
            { icon: DollarSign, label: "Valor de Vida", value: fmtUSD(customer.lifetime_value), sub: `${fmtUSD(customer.annual_revenue_usd)} / año` },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <div className="flex items-center gap-1.5 text-[8px] text-[var(--text-muted)] uppercase tracking-wider"><item.icon size={10} />{item.label}</div>
              <p className="mt-1.5 text-[11px] font-bold text-[var(--text-primary)]">{item.value}</p>
              <p className="text-[8px] text-[var(--text-secondary)]">{item.sub}</p>
            </div>
          ))}
        </div>
        {customer.assigned_seller && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--bg-muted)]/30 p-2">
            {customer.assigned_seller.avatar_url ? <img src={customer.assigned_seller.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand)]/10"><UserCheck size={12} className="text-[var(--brand)]" /></div>}
            <div><p className="text-[9px] font-semibold text-[var(--text-primary)]">{customer.assigned_seller.full_name}</p><p className="text-[7px] text-[var(--text-muted)]">Ejecutivo Comercial</p></div>
          </div>
        )}
      </div>

      {/* ═══ B9: BENCHMARK ═══ */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <h4 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-primary)]"><BarChart3 size={12} className="text-[var(--brand)]" />Benchmark vs. Sector</h4>
        <div className="space-y-3">
          {[
            { label: "Health Score", value: customer.health_score, avg: 68, max: 100, unit: "" },
            { label: "NPS", value: customer.nps_score, avg: 55, max: 100, unit: "" },
            { label: "Retención", value: Math.round(customer.retention_rate), avg: 72, max: 100, unit: "%" },
            { label: "Pago a Tiempo", value: Math.round(customer.on_time_payment_pct), avg: 65, max: 100, unit: "%" },
          ].map((m) => {
            const isAbove = m.value >= m.avg;
            return (
              <div key={m.label} className="flex items-center gap-3">
                <span className="w-24 text-[9px] font-medium text-[var(--text-secondary)]">{m.label}</span>
                <div className="relative flex-1 h-4">
                  <div className="absolute inset-0 rounded-full bg-[var(--border)]/50" />
                  <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${(m.value / m.max) * 100}%`, backgroundColor: isAbove ? "#10B981" : "#EF4444", opacity: 0.8 }} />
                  <div className="absolute inset-y-0 w-0.5 bg-[var(--text-muted)]" style={{ left: `${(m.avg / m.max) * 100}%` }} />
                </div>
                <span className="w-10 text-right text-[9px] font-bold" style={{ color: isAbove ? "#10B981" : "#EF4444" }}>{m.value}{m.unit}</span>
              </div>
            );
          })}
          <p className="text-right text-[7px] text-[var(--text-muted)]">│ = Promedio del sector</p>
        </div>
      </div>

      {/* ═══ B10: FACTURAS ═══ */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h4 className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-primary)]"><FileText size={12} className="text-[var(--brand)]" />Facturas</h4>
          <div className="flex items-center gap-2">{[{ l: "Pagadas", c: paidCount, co: "#10B981" }, { l: "Pendientes", c: pendingCount, co: "#F59E0B" }, { l: "Vencidas", c: overdueCount, co: "#EF4444" }].map((s) => <span key={s.l} className="rounded-full px-2 py-0.5 text-[7px] font-bold" style={{ backgroundColor: `${s.co}15`, color: s.co }}>{s.c} {s.l}</span>)}</div>
        </div>
        <table className="w-full"><thead><tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/50">{["Factura","Fecha","Total USD","Status","Método"].map((h) => <th key={h} className="px-4 py-2 text-left text-[8px] font-semibold text-[var(--text-muted)] uppercase">{h}</th>)}</tr></thead>
          <tbody>{invoices.slice(0, 8).map((inv) => (
            <tr key={inv.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-muted)]/30 transition-colors">
              <td className="px-4 py-2 text-[9px] font-medium text-[var(--text-primary)]">{inv.invoice_number}</td>
              <td className="px-4 py-2 text-[9px] text-[var(--text-secondary)]">{new Date(inv.sale_date).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}</td>
              <td className="px-4 py-2 text-[9px] font-bold text-[var(--text-primary)] tabular-nums">${Number(inv.total_usd).toLocaleString()}</td>
              <td className="px-4 py-2"><span className="rounded-full px-2 py-0.5 text-[7px] font-semibold" style={{ backgroundColor: `${INVOICE_STATUS_COLORS[inv.status]}15`, color: INVOICE_STATUS_COLORS[inv.status] }}>{INVOICE_STATUS_LABELS[inv.status]}</span></td>
              <td className="px-4 py-2 text-[9px] text-[var(--text-muted)]">{inv.payment_method || "—"}</td>
            </tr>
          ))}</tbody>
        </table>
        {invoices.length > 8 && <div className="px-4 py-2 text-center text-[8px] text-[var(--text-muted)]">+{invoices.length - 8} facturas más</div>}
      </div>

      {/* ═══ B11: AI RECOMMENDATIONS ═══ */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--brand)]/20 bg-gradient-to-br from-[var(--brand)]/5 to-[#8B5CF6]/5 p-4">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--brand)]/10 blur-3xl" />
        <div className="relative">
          <h4 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-primary)]"><Sparkles size={12} className="text-[var(--brand)]" />Recomendaciones GRIXI AI</h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { tag: "Venta Cruzada", title: "Expansión de línea", desc: `Con ${customer.total_orders} pedidos en ${categories[0] || "su línea"}, explorar ${categories[1] || "complementarios"} y ${categories[2] || "servicios"}.`, color: "#3B82F6" },
              { tag: "Financiero", title: creditUsedPct < 50 ? "Ampliar volumen" : "Revisar cupo", desc: creditUsedPct < 50 ? `Solo usa ${creditUsedPct.toFixed(0)}% del cupo. ${fmtUSD(customer.credit_limit - customer.credit_used)} disponibles.` : `Uso al ${creditUsedPct.toFixed(0)}%. ${creditUsedPct > 80 ? "Evaluar ampliación." : "Monitorear."}`, color: "#10B981" },
              { tag: contractDaysLeft !== null && contractDaysLeft < 60 ? "⚠️ Urgente" : "Renovación", title: contractDaysLeft !== null && contractDaysLeft < 60 ? "Contrato por vencer" : "Planificar renovación", desc: contractDaysLeft !== null ? `${customer.contract_type} vence en ${contractDaysLeft}d. ${contractDaysLeft < 30 ? "Reunión inmediata." : "Preparar propuesta."}` : "Sin contrato. Proponer acuerdo marco.", color: contractDaysLeft !== null && contractDaysLeft < 60 ? "#EF4444" : "#8B5CF6" },
              { tag: "Retención", title: customer.churn_risk === "low" ? "Programa VIP" : "Acción requerida", desc: customer.churn_risk === "low" ? `NPS ${customer.nps_score}, retención ${customer.retention_rate.toFixed(0)}%. Programa fidelización premium.` : `Riesgo ${customer.churn_risk.toUpperCase()}. NPS ${customer.nps_score}. ${customer.nps_score < 50 ? "Reunión urgente." : "Mejorar post-venta."}`, color: customer.churn_risk === "low" ? "#F59E0B" : "#EF4444" },
            ].map((rec, i) => (
              <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
                <span className="rounded-full px-1.5 py-0.5 text-[7px] font-bold" style={{ backgroundColor: `${rec.color}15`, color: rec.color }}>{rec.tag}</span>
                <p className="mt-1.5 text-[9px] font-semibold text-[var(--text-primary)]">{rec.title}</p>
                <p className="mt-1 text-[8px] leading-relaxed text-[var(--text-secondary)]">{rec.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ B12: CONTACTOS ═══ */}
      {contacts.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h4 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-primary)]"><Users size={12} className="text-[var(--brand)]" />Equipo de Contacto ({contacts.length})</h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{contacts.map((c) => (
            <div key={c.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-3">
              <div className="flex items-center gap-2">
                {c.avatar_url ? <img src={c.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand)]/10 text-[8px] font-bold text-[var(--brand)]">{c.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div>}
                <div className="flex-1 min-w-0"><p className="truncate text-[9px] font-semibold text-[var(--text-primary)]">{c.full_name}</p>{c.role && <span className="rounded-full bg-[var(--bg-muted)] px-1.5 py-0.5 text-[7px] text-[var(--text-muted)]">{CONTACT_ROLE_LABELS[c.role]}</span>}</div>
                {c.is_primary && <Star size={10} className="text-amber-500 fill-amber-500" />}
              </div>
              <div className="mt-2 space-y-1">
                {c.email && <p className="flex items-center gap-1 text-[8px] text-[var(--text-secondary)]"><Mail size={8} />{c.email}</p>}
                {c.phone && <p className="flex items-center gap-1 text-[8px] text-[var(--text-secondary)]"><Phone size={8} />{c.phone}</p>}
              </div>
            </div>
          ))}</div>
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <div className="flex items-center gap-2 py-3 text-[var(--text-muted)]">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-[8px]">Ficha Comercial generada por GRIXI · {new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" })}</span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>
    </div>
  );
}

// ── Oportunidades Tab ─────────────────────────────

function OportunidadesTab({
  opportunities,
  quotes,
}: {
  opportunities: SalesOpportunity[];
  quotes: SalesQuote[];
}) {
  return (
    <div className="space-y-4">
      {/* Opportunities */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <h4 className="mb-3 text-[10px] font-semibold text-[var(--text-primary)]">
          Oportunidades ({opportunities.length})
        </h4>
        {opportunities.length === 0 ? (
          <p className="text-[9px] text-[var(--text-muted)]">Sin oportunidades abiertas</p>
        ) : (
          <div className="space-y-2">
            {opportunities.map((opp) => (
              <div key={opp.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--bg-muted)] transition-colors">
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: opp.stage?.color || "#6B7280" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[9px] font-medium text-[var(--text-primary)]">{opp.name}</p>
                  <p className="text-[8px] text-[var(--text-muted)]">
                    {opp.stage?.name} · {opp.probability}%
                  </p>
                </div>
                <span className="text-[9px] font-bold text-[var(--text-primary)] tabular-nums">
                  ${Number(opp.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quotes */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <h4 className="mb-3 text-[10px] font-semibold text-[var(--text-primary)]">
          Cotizaciones ({quotes.length})
        </h4>
        {quotes.length === 0 ? (
          <p className="text-[9px] text-[var(--text-muted)]">Sin cotizaciones</p>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <div key={q.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--bg-muted)] transition-colors">
                <FileText size={12} className="shrink-0 text-[var(--text-muted)]" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[9px] font-medium text-[var(--text-primary)]">{q.quote_number}</p>
                  <p className="text-[8px] text-[var(--text-muted)]">
                    {new Date(q.created_at).toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[7px] font-semibold"
                  style={{
                    backgroundColor: `${QUOTE_STATUS_COLORS[q.status]}15`,
                    color: QUOTE_STATUS_COLORS[q.status],
                  }}
                >
                  {QUOTE_STATUS_LABELS[q.status]}
                </span>
                <span className="text-[9px] font-bold text-[var(--text-primary)] tabular-nums">
                  ${Number(q.total).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Main Modal
// ═══════════════════════════════════════════════════

type Props = {
  customerId: string;
  onClose: () => void;
  demoRole: DemoRole;
};

export function ClienteDetailModal({ customerId, onClose, demoRole }: Props) {
  const [tab, setTab] = useState<DetailTab>("presentacion");
  const [customer, setCustomer] = useState<SalesCustomer | null>(null);
  const [contacts, setContacts] = useState<SalesContact[]>([]);
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [quotes, setQuotes] = useState<SalesQuote[]>([]);
  const [opportunities, setOpportunities] = useState<SalesOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [cust, conts, acts, invs, qts, opps] = await Promise.all([
        fetchCustomerById(customerId),
        fetchContacts(customerId),
        fetchActivities(customerId),
        fetchInvoicesByCustomer(customerId),
        fetchQuotesByCustomer(customerId),
        fetchOpportunitiesByCustomer(customerId),
      ]);
      setCustomer(cust);
      setContacts(conts);
      setActivities(acts);
      setInvoices(invs);
      setQuotes(qts);
      setOpportunities(opps);
      setLoading(false);
    }
    load();
  }, [customerId]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative flex h-[90vh] w-[90vw] max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-4 border-b border-[var(--border)] px-6 py-4">
            {customer?.logo_url ? (
              <img src={customer.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover ring-2 ring-[var(--border)]" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3B82F6]/10">
                <Building2 size={18} className="text-[#3B82F6]" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                {customer?.trade_name || customer?.business_name || "Cargando..."}
              </h2>
              <p className="text-[10px] text-[var(--text-muted)]">
                {customer?.code} · {customer?.city}, {customer?.country}
              </p>
            </div>
            {customer && (
              <div
                className="rounded-full px-3 py-1 text-[9px] font-bold"
                style={{
                  backgroundColor: `${SEGMENT_COLORS[customer.segment]}15`,
                  color: SEGMENT_COLORS[customer.segment],
                }}
              >
                {SEGMENT_LABELS[customer.segment]}
              </div>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-muted)]"
            >
              <X size={16} className="text-[var(--text-muted)]" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--border)] px-6">
            {DETAIL_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-medium transition-all relative",
                  tab === t.id
                    ? "text-[#3B82F6]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                )}
              >
                <t.icon size={12} />
                {t.label}
                {tab === t.id && (
                  <motion.div
                    layoutId="detail-tab-indicator"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#3B82F6] rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-20 rounded-xl bg-[var(--bg-muted)]" />
                <div className="h-40 rounded-xl bg-[var(--bg-muted)]" />
                <div className="h-20 rounded-xl bg-[var(--bg-muted)]" />
              </div>
            ) : customer ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {tab === "presentacion" && (
                    <PresentacionTab customer={customer} contacts={contacts} invoices={invoices} opportunities={opportunities} />
                  )}
                  {tab === "general" && <GeneralTab customer={customer} />}
                  {tab === "contactos" && <ContactosTab contacts={contacts} />}
                  {tab === "timeline" && <TimelineTab activities={activities} />}
                  {tab === "ventas" && <VentasDetailTab invoices={invoices} customer={customer} />}
                  {tab === "analisis" && <AnalisisTab invoices={invoices} />}
                  {tab === "oportunidades" && (
                    <OportunidadesTab opportunities={opportunities} quotes={quotes} />
                  )}
                </motion.div>
              </AnimatePresence>
            ) : (
              <p className="text-center text-[10px] text-[var(--text-muted)]">Cliente no encontrado</p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
