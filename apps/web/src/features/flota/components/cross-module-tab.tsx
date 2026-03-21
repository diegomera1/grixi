"use client";

import { motion } from "framer-motion";
import {
  ShoppingCart, DollarSign, Users, ArrowRight,
  Package, FileText, Wrench, Fuel, AlertTriangle,
  TrendingUp, Clock, Shield, Anchor,
} from "lucide-react";
import type { Equipment, WorkOrder, FleetAlert, FleetCertificate, FuelLog, CrewMember } from "../types";

// ── Cross-Module Connection Types ───────────────

type CrossModuleLink = {
  module: string;
  moduleIcon: typeof ShoppingCart;
  moduleColor: string;
  title: string;
  description: string;
  items: { label: string; value: string; trend?: "up" | "down" | "neutral"; urgency?: "high" | "medium" | "low" }[];
};

// ── Main Component ──────────────────────────────

export function CrossModuleTab({ equipment, workOrders, alerts, certificates, fuelLogs, crew }: {
  equipment: Equipment[];
  workOrders: WorkOrder[];
  alerts?: FleetAlert[];
  certificates?: FleetCertificate[];
  fuelLogs?: FuelLog[];
  crew?: CrewMember[];
}) {
  // Derive cross-module data from real fleet data
  const failedEquip = equipment.filter((e) => e.status === "failed" || e.status === "maintenance");
  const pendingWOs = workOrders.filter((wo) => wo.status === "planned" || wo.status === "assigned" || wo.status === "in_progress");
  const criticalAlerts = (alerts || []).filter((a) => !a.resolved_at && (a.severity === "critical" || a.severity === "emergency"));
  const expiringCerts = (certificates || []).filter((c) => c.status === "expiring_soon" || c.status === "expired");
  const totalFuelCost = (fuelLogs || []).slice(0, 30).reduce((s, f) => s + (f.quantity_mt || 0) * 650, 0);
  const totalWOCost = pendingWOs.reduce((s, wo) => s + (wo.cost_estimated || 0), 0);
  const crewCount = crew?.length || 0;

  const connections: CrossModuleLink[] = [
    {
      module: "Compras",
      moduleIcon: ShoppingCart,
      moduleColor: "#F59E0B",
      title: "Requisiciones desde Mantenimiento",
      description: "Órdenes de compra generadas por mantenimiento correctivo y preventivo del buque.",
      items: [
        { label: "OTs pendientes con repuestos", value: `${pendingWOs.length}`, urgency: pendingWOs.length > 5 ? "high" : "medium" },
        { label: "Equipos en falla o mantenimiento", value: `${failedEquip.length}`, urgency: failedEquip.length > 3 ? "high" : "low" },
        { label: "Costo estimado repuestos", value: `$${totalWOCost.toLocaleString()}`, trend: "up" },
        { label: "BOM items críticos bajo stock", value: `${equipment.reduce((s, e) => s + (e.bom_items || []).filter((b) => b.critical && b.quantity_onboard < b.quantity_required).length, 0)}`, urgency: "high" },
      ],
    },
    {
      module: "Finanzas",
      moduleIcon: DollarSign,
      moduleColor: "#10B981",
      title: "Costos Operativos del Buque",
      description: "Impacto financiero de combustible, mantenimiento y certificaciones marítimas.",
      items: [
        { label: "Costo combustible (30d)", value: `$${totalFuelCost.toLocaleString()}`, trend: "up" },
        { label: "Costo mantenimiento activo", value: `$${totalWOCost.toLocaleString()}`, trend: "neutral" },
        { label: "Certificados por renovar", value: `${expiringCerts.length} ($${(expiringCerts.length * 2500).toLocaleString()} est.)`, urgency: expiringCerts.length > 3 ? "high" : "medium" },
        { label: "Multas riesgo por certs vencidos", value: expiringCerts.filter((c) => c.status === "expired").length > 0 ? `$${(expiringCerts.filter((c) => c.status === "expired").length * 15000).toLocaleString()}` : "$0", urgency: expiringCerts.some((c) => c.status === "expired") ? "high" : "low" },
      ],
    },
    {
      module: "RRHH",
      moduleIcon: Users,
      moduleColor: "#8B5CF6",
      title: "Tripulación y Competencias",
      description: "Gestión de tripulación, certificaciones de personal y horas extra por emergencias.",
      items: [
        { label: "Tripulación activa", value: `${crewCount} tripulantes` },
        { label: "Alertas críticas activas", value: `${criticalAlerts.length}`, urgency: criticalAlerts.length > 0 ? "high" : "low" },
        { label: "OTs en ejecución (horas extra)", value: `${workOrders.filter((wo) => wo.status === "in_progress").length}`, trend: workOrders.filter((wo) => wo.status === "in_progress").length > 3 ? "up" : "neutral" },
        { label: "Capacitaciones requeridas por certs", value: `${expiringCerts.filter((c) => c.cert_type === "ISM" || c.cert_type === "ISPS").length}`, urgency: "medium" },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-[#0EA5E9]/20 bg-gradient-to-r from-[#0EA5E9]/5 to-[#8B5CF6]/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#8B5CF6] shadow-lg">
            <Anchor size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Conexiones Cross-Módulo</h3>
            <p className="text-[10px] text-[var(--text-muted)]">
              Impacto del buque en Compras ({pendingWOs.length} OTs) · Finanzas (${(totalFuelCost + totalWOCost).toLocaleString()}) · RRHH ({crewCount} personas)
            </p>
          </div>
        </div>
      </div>

      {/* Module Connections Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {connections.map((conn, idx) => (
          <motion.div
            key={conn.module}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden"
          >
            {/* Module Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]" style={{ borderTopColor: conn.moduleColor, borderTopWidth: 2 }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${conn.moduleColor}15` }}>
                <conn.moduleIcon size={16} style={{ color: conn.moduleColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)]">{conn.module}</span>
                  <ArrowRight size={10} className="text-[var(--text-muted)]" />
                  <span className="text-[9px] text-[var(--text-muted)]">Flota</span>
                </div>
                <p className="text-[9px] text-[var(--text-muted)] truncate">{conn.title}</p>
              </div>
            </div>

            {/* Description */}
            <div className="px-4 py-2 bg-[var(--bg-muted)]/20">
              <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed">{conn.description}</p>
            </div>

            {/* Items */}
            <div className="p-3 space-y-1.5">
              {conn.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2">
                  <span className="text-[10px] text-[var(--text-secondary)]">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    {item.trend === "up" && <TrendingUp size={9} className="text-red-500" />}
                    {item.trend === "down" && <TrendingUp size={9} className="text-green-500 rotate-180" />}
                    {item.urgency === "high" && <AlertTriangle size={9} className="text-red-500" />}
                    <span className={`text-[10px] font-bold ${
                      item.urgency === "high" ? "text-red-500" :
                      item.urgency === "medium" ? "text-amber-500" :
                      "text-[var(--text-primary)]"
                    }`}>
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Action */}
            <div className="px-4 py-2.5 border-t border-[var(--border)]">
              <button className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-medium transition-all hover:bg-[var(--bg-muted)]/50" style={{ color: conn.moduleColor }}>
                Ver en {conn.module} <ArrowRight size={10} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Package, label: "Requisiciones Pend.", value: `${pendingWOs.length}`, color: "#F59E0B", detail: "OTs → Compras" },
          { icon: Fuel, label: "Costo Fuel 30d", value: `$${(totalFuelCost / 1000).toFixed(0)}K`, color: "#EF4444", detail: "→ Finanzas" },
          { icon: Shield, label: "Certs por Vencer", value: `${expiringCerts.length}`, color: "#8B5CF6", detail: "→ RRHH / Legal" },
          { icon: Clock, label: "OTs en Curso", value: `${workOrders.filter((wo) => wo.status === "in_progress").length}`, color: "#0EA5E9", detail: "Crew asignado" },
        ].map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <card.icon size={12} style={{ color: card.color }} />
              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{card.label}</span>
            </div>
            <p className="text-lg font-bold text-[var(--text-primary)]">{card.value}</p>
            <p className="text-[8px] text-[var(--text-muted)] mt-0.5">{card.detail}</p>
          </motion.div>
        ))}
      </div>

      {/* Data Flow Diagram */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <FileText size={11} /> Flujo de Datos Cross-Módulo
        </h4>
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
          {[
            { icon: Wrench, label: "Mantenimiento", sub: `${pendingWOs.length} OTs`, color: "#0EA5E9" },
            { icon: ArrowRight, label: "", sub: "", color: "#6B7280" },
            { icon: ShoppingCart, label: "Compras", sub: "Requisiciones", color: "#F59E0B" },
            { icon: ArrowRight, label: "", sub: "", color: "#6B7280" },
            { icon: DollarSign, label: "Finanzas", sub: "P&L Impact", color: "#10B981" },
            { icon: ArrowRight, label: "", sub: "", color: "#6B7280" },
            { icon: Users, label: "RRHH", sub: "Crew & Certs", color: "#8B5CF6" },
          ].map((node, i) => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0">
              {node.label ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${node.color}15` }}>
                  <node.icon size={18} style={{ color: node.color }} />
                </div>
              ) : (
                <node.icon size={14} className="text-[var(--text-muted)]" />
              )}
              {node.label && (
                <>
                  <span className="text-[9px] font-bold text-[var(--text-primary)]">{node.label}</span>
                  <span className="text-[7px] text-[var(--text-muted)]">{node.sub}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
