"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Equipment, VesselZone } from "../types";
import {
  EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_COLORS,
  EQUIPMENT_CRITICALITY_LABELS, EQUIPMENT_CRITICALITY_COLORS,
  ZONE_TYPE_COLORS,
} from "../types";

export function EquipmentTab({ equipment, zones }: { equipment: Equipment[]; zones: VesselZone[] }) {
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [critFilter, setCritFilter] = useState("all");

  const filtered = equipment.filter((e) => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase());
    const matchZone = zoneFilter === "all" || e.zone_id === zoneFilter;
    const matchCrit = critFilter === "all" || e.criticality === critFilter;
    return matchSearch && matchZone && matchCrit;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar equipo..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] py-2 pl-3 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
          />
        </div>
        <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none">
          <option value="all">Todas las zonas</option>
          {zones.filter((z) => equipment.some((e) => e.zone_id === z.id)).map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>
        <select value={critFilter} onChange={(e) => setCritFilter(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none">
          <option value="all">Criticidad</option>
          <option value="critical">Crítico</option>
          <option value="high">Alto</option>
          <option value="medium">Medio</option>
          <option value="low">Bajo</option>
        </select>
        <span className="text-[10px] text-[var(--text-muted)]">{filtered.length} equipos</span>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/50">
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)]">Código</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)]">Equipo</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)] hidden md:table-cell">Zona</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)] hidden lg:table-cell">Fabricante</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)]">Criticidad</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)]">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((eq, i) => {
                const zone = zones.find((z) => z.id === eq.zone_id);
                return (
                  <motion.tr
                    key={eq.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-muted)]/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-[#0EA5E9]">{eq.code}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-[var(--text-primary)]">{eq.name}</p>
                      {eq.model && <p className="text-[10px] text-[var(--text-muted)]">{eq.manufacturer} {eq.model}</p>}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      {zone && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
                          style={{ backgroundColor: `${ZONE_TYPE_COLORS[zone.zone_type]}15`, color: ZONE_TYPE_COLORS[zone.zone_type] }}>
                          {zone.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell text-[var(--text-secondary)]">{eq.manufacturer || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
                        style={{ backgroundColor: `${EQUIPMENT_CRITICALITY_COLORS[eq.criticality]}15`, color: EQUIPMENT_CRITICALITY_COLORS[eq.criticality] }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: EQUIPMENT_CRITICALITY_COLORS[eq.criticality] }} />
                        {EQUIPMENT_CRITICALITY_LABELS[eq.criticality]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
                        style={{ backgroundColor: `${EQUIPMENT_STATUS_COLORS[eq.status]}15`, color: EQUIPMENT_STATUS_COLORS[eq.status] }}>
                        {EQUIPMENT_STATUS_LABELS[eq.status]}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
