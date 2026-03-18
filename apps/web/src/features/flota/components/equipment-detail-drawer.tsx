"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Wrench, Package, Calendar, Activity,
  AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import type { Equipment, WorkOrder, VesselZone } from "../types";
import {
  EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_COLORS,
  EQUIPMENT_CRITICALITY_LABELS, EQUIPMENT_CRITICALITY_COLORS,
  WO_STATUS_LABELS, WO_STATUS_COLORS, WO_PRIORITY_COLORS,
  ZONE_TYPE_COLORS,
} from "../types";

// Map equipment codes to AI-generated photos
const EQUIPMENT_IMAGE_MAP: Record<string, string> = {
  "ENG": "/fleet/engine-main.png",
  "GEN": "/fleet/engine-generator.png",
  "PMP": "/fleet/engine-pump.png",
  "CMP": "/fleet/engine-compressor.png",
  "BLR": "/fleet/engine-boiler.png",
  "CTL": "/fleet/engine-control-panel.png",
  "PNL": "/fleet/engine-control-panel.png",
};

function getEquipmentImage(eq: Equipment): string | null {
  if (eq.image_url) return eq.image_url;
  const code = eq.code?.toUpperCase() || "";
  for (const [prefix, img] of Object.entries(EQUIPMENT_IMAGE_MAP)) {
    if (code.includes(prefix)) return img;
  }
  // Fallback by equipment_type
  const typeMap: Record<string, string> = {
    engine: "/fleet/engine-main.png",
    generator: "/fleet/engine-generator.png",
    pump: "/fleet/engine-pump.png",
    compressor: "/fleet/engine-compressor.png",
    boiler: "/fleet/engine-boiler.png",
    panel: "/fleet/engine-control-panel.png",
  };
  return typeMap[eq.equipment_type?.toLowerCase()] || null;
}

type EquipmentDetailDrawerProps = {
  equipment: Equipment;
  zone: VesselZone | undefined;
  workOrders: WorkOrder[];
  onClose: () => void;
};

export function EquipmentDetailDrawer({ equipment: eq, zone, workOrders, onClose }: EquipmentDetailDrawerProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>("info");
  const relatedWOs = workOrders.filter((wo) => wo.equipment_id === eq.id);
  const bomItems = eq.bom_items || [];
  const plans = eq.maintenance_plans || [];
  const mpPoints = eq.measurement_points || [];
  const equipmentImage = getEquipmentImage(eq);

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto bg-[var(--bg-primary)] border-l border-[var(--border)] shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-primary)]/95 backdrop-blur-md px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] text-[#0EA5E9]">{eq.code}</p>
            <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">{eq.name}</h2>
          </div>
          <button onClick={onClose} className="ml-3 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Equipment Photo */}
          {equipmentImage ? (
            <div className="relative overflow-hidden rounded-xl border border-[var(--border)]">
              <Image src={equipmentImage} alt={eq.name} width={512} height={320} className="h-48 w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                  style={{ backgroundColor: `${EQUIPMENT_STATUS_COLORS[eq.status]}20`, color: EQUIPMENT_STATUS_COLORS[eq.status] }}
                >
                  {EQUIPMENT_STATUS_LABELS[eq.status]}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                  style={{ backgroundColor: `${EQUIPMENT_CRITICALITY_COLORS[eq.criticality]}20`, color: EQUIPMENT_CRITICALITY_COLORS[eq.criticality] }}
                >
                  {EQUIPMENT_CRITICALITY_LABELS[eq.criticality]}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl border border-[var(--border)] bg-[#030712]">
              <div className="text-center">
                <Wrench size={28} className="mx-auto text-[#0EA5E9]/30" />
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">Sin imagen</p>
              </div>
            </div>
          )}

          {/* Status & Criticality Badges */}
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
              style={{ backgroundColor: `${EQUIPMENT_STATUS_COLORS[eq.status]}15`, color: EQUIPMENT_STATUS_COLORS[eq.status] }}
            >
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: EQUIPMENT_STATUS_COLORS[eq.status] }} />
              {EQUIPMENT_STATUS_LABELS[eq.status]}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
              style={{ backgroundColor: `${EQUIPMENT_CRITICALITY_COLORS[eq.criticality]}15`, color: EQUIPMENT_CRITICALITY_COLORS[eq.criticality] }}
            >
              {EQUIPMENT_CRITICALITY_LABELS[eq.criticality]}
            </span>
            {zone && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px]"
                style={{ backgroundColor: `${ZONE_TYPE_COLORS[zone.zone_type]}15`, color: ZONE_TYPE_COLORS[zone.zone_type] }}
              >
                {zone.name}
              </span>
            )}
          </div>

          {/* ── Section: Info General ── */}
          <CollapsibleSection
            id="info"
            title="Información General"
            icon={<Wrench size={13} />}
            expanded={expandedSection === "info"}
            onToggle={() => toggleSection("info")}
          >
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Fabricante", value: eq.manufacturer || "—" },
                { label: "Modelo", value: eq.model || "—" },
                { label: "Serial", value: eq.serial_number || "—" },
                { label: "Tipo", value: eq.equipment_type },
                { label: "Instalación", value: eq.install_date ? new Date(eq.install_date).toLocaleDateString("es-EC", { year: "numeric", month: "short" }) : "—" },
                { label: "Zona", value: zone?.name || "—" },
              ].map((field) => (
                <div key={field.label} className="rounded-lg bg-[var(--bg-muted)]/30 p-2">
                  <p className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">{field.label}</p>
                  <p className="text-xs font-medium text-[var(--text-primary)]">{field.value}</p>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* ── Section: Measurement Points ── */}
          <CollapsibleSection
            id="measurements"
            title={`Puntos de Medida (${mpPoints.length})`}
            icon={<Activity size={13} />}
            expanded={expandedSection === "measurements"}
            onToggle={() => toggleSection("measurements")}
          >
            {mpPoints.length === 0 ? (
              <p className="py-3 text-center text-[10px] text-[var(--text-muted)]">Sin puntos de medida registrados</p>
            ) : (
              <div className="space-y-1.5">
                {mpPoints.map((mp) => (
                  <div key={mp.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2">
                    <div>
                      <p className="text-[11px] font-medium text-[var(--text-primary)]">{mp.name}</p>
                      <p className="text-[9px] text-[var(--text-muted)]">
                        Rango: {mp.min_value ?? "—"} – {mp.max_value ?? "—"} {mp.unit}
                        {mp.alert_threshold && ` · Alerta: ≥${mp.alert_threshold}`}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-secondary)]">{mp.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* ── Section: BOM ── */}
          <CollapsibleSection
            id="bom"
            title={`Repuestos / BOM (${bomItems.length})`}
            icon={<Package size={13} />}
            expanded={expandedSection === "bom"}
            onToggle={() => toggleSection("bom")}
          >
            {bomItems.length === 0 ? (
              <p className="py-3 text-center text-[10px] text-[var(--text-muted)]">Sin BOM cargado</p>
            ) : (
              <div className="space-y-1.5">
                {bomItems.map((item) => {
                  const isLow = item.quantity_onboard < item.quantity_required;
                  return (
                    <div key={item.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {item.critical && <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />}
                          <p className="text-[11px] font-medium text-[var(--text-primary)] truncate">{item.description}</p>
                        </div>
                        <p className="text-[9px] font-mono text-[var(--text-muted)]">{item.part_number}</p>
                      </div>
                      <div className="shrink-0 text-right ml-2">
                        <p className={`text-sm font-bold ${isLow ? "text-red-500" : "text-[var(--text-primary)]"}`}>
                          {item.quantity_onboard}/{item.quantity_required}
                        </p>
                        <p className="text-[8px] text-[var(--text-muted)]">{item.lead_time_days}d lead</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>

          {/* ── Section: Work Orders ── */}
          <CollapsibleSection
            id="wos"
            title={`Órdenes de Trabajo (${relatedWOs.length})`}
            icon={<Wrench size={13} />}
            expanded={expandedSection === "wos"}
            onToggle={() => toggleSection("wos")}
          >
            {relatedWOs.length === 0 ? (
              <p className="py-3 text-center text-[10px] text-[var(--text-muted)]">Sin OTs asociadas</p>
            ) : (
              <div className="space-y-1.5">
                {relatedWOs.map((wo) => (
                  <div key={wo.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] text-[#0EA5E9]">{wo.wo_number}</span>
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[7px] font-bold"
                          style={{ backgroundColor: `${WO_PRIORITY_COLORS[wo.priority]}15`, color: WO_PRIORITY_COLORS[wo.priority] }}
                        >
                          {wo.priority.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-[var(--text-primary)] truncate">{wo.title}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold"
                      style={{ backgroundColor: `${WO_STATUS_COLORS[wo.status]}15`, color: WO_STATUS_COLORS[wo.status] }}
                    >
                      {WO_STATUS_LABELS[wo.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* ── Section: Maintenance Plans ── */}
          <CollapsibleSection
            id="plans"
            title={`Planes de Mantenimiento (${plans.length})`}
            icon={<Calendar size={13} />}
            expanded={expandedSection === "plans"}
            onToggle={() => toggleSection("plans")}
          >
            {plans.length === 0 ? (
              <p className="py-3 text-center text-[10px] text-[var(--text-muted)]">Sin planes registrados</p>
            ) : (
              <div className="space-y-1.5">
                {plans.map((plan) => {
                  const daysUntilDue = plan.next_due
                    ? Math.ceil((new Date(plan.next_due).getTime() - Date.now()) / 86400000)
                    : null;
                  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
                  const isUrgent = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7;

                  return (
                    <div key={plan.id} className="rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium text-[var(--text-primary)]">{plan.name}</p>
                        <span className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 text-[8px] text-[var(--text-secondary)]">
                          {plan.strategy_type.replace("_", " ")}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[9px] text-[var(--text-muted)]">
                        {plan.interval_hours && <span>Cada {plan.interval_hours}h</span>}
                        {plan.interval_days && <span>Cada {plan.interval_days}d</span>}
                        {plan.regulation_code && <span>· {plan.regulation_code}</span>}
                      </div>
                      {daysUntilDue !== null && (
                        <div className="mt-1 flex items-center gap-1">
                          {isOverdue && <AlertTriangle size={10} className="text-red-500" />}
                          <span
                            className={`text-[9px] font-bold ${isOverdue ? "text-red-500" : isUrgent ? "text-amber-500" : "text-[var(--text-muted)]"}`}
                          >
                            {isOverdue ? `Vencido hace ${Math.abs(daysUntilDue)}d` : `Próximo en ${daysUntilDue}d`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>
        </div>
      </motion.div>
    </>
  );
}

// ── Collapsible Section ─────────────────────────

function CollapsibleSection({
  id,
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--bg-muted)]/30"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
          <span className="text-[#0EA5E9]">{icon}</span>
          {title}
        </div>
        {expanded ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
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
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
