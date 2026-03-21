"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, Search, Filter, Plus,
  ChevronDown, MapPin, Clock,
} from "lucide-react";
import type { LogbookEntry } from "../types";

const ENTRY_TYPES = [
  { value: "all", label: "Todos", icon: "📋" },
  { value: "navegacion", label: "Navegación", icon: "🚢" },
  { value: "incidente", label: "Incidentes", icon: "⚠️" },
  { value: "inspeccion", label: "Inspecciones", icon: "🔍" },
  { value: "cambio_guardia", label: "Cambio Guardia", icon: "🔄" },
  { value: "maniobra", label: "Maniobras", icon: "⚓" },
  { value: "avistamiento", label: "Avistamientos", icon: "👁️" },
  { value: "comunicacion", label: "Comunicaciones", icon: "📡" },
] as const;

const SHIFT_LABELS: Record<string, { label: string; icon: string }> = {
  dia: { label: "Turno Día", icon: "☀️" },
  noche: { label: "Turno Noche", icon: "🌙" },
};

function timeAgo(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "Ahora";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `Hace ${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
}

type LogbookTabProps = {
  logbook: LogbookEntry[];
};

export function LogbookTab({ logbook }: LogbookTabProps) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = logbook.filter((entry) => {
    if (filter !== "all" && entry.entry_type !== filter) return false;
    if (search && !entry.title.toLowerCase().includes(search.toLowerCase()) && !entry.content?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
          <BookOpen size={16} className="text-indigo-500" />
          Bitácora del Buque
          <span className="text-[10px] font-normal text-[var(--text-muted)]">({filtered.length} entradas)</span>
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-44 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#0EA5E9] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Type Filters */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {ENTRY_TYPES.map((type) => {
          const count = type.value === "all" ? logbook.length : logbook.filter((e) => e.entry_type === type.value).length;
          return (
            <button
              key={type.value}
              onClick={() => setFilter(type.value)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
                filter === type.value
                  ? "bg-[#0EA5E9] text-white shadow-sm"
                  : "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span>{type.icon}</span>
              {type.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                filter === type.value ? "bg-white/20" : "bg-[var(--bg-muted)]"
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {filtered.map((entry, i) => {
          const typeInfo = ENTRY_TYPES.find((t) => t.value === entry.entry_type);
          const shiftInfo = SHIFT_LABELS[entry.shift] || SHIFT_LABELS.dia;
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex gap-3 group"
            >
              {/* Timeline line */}
              <div className="flex flex-col items-center shrink-0 w-8">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--bg-surface)] text-sm group-hover:border-[#0EA5E9] transition-colors">
                  {typeInfo?.icon || "📝"}
                </div>
                {i < filtered.length - 1 && <div className="w-px flex-1 bg-[var(--border)]" />}
              </div>

              {/* Content */}
              <div className="flex-1 pb-4 min-w-0">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 group-hover:border-[#0EA5E9]/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-[12px] font-semibold text-[var(--text-primary)]">{entry.title}</h4>
                    <span className="text-[9px] text-[var(--text-muted)] shrink-0 whitespace-nowrap">
                      {timeAgo(entry.created_at)}
                    </span>
                  </div>
                  {entry.content && (
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-2">{entry.content}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-[9px] text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2 py-0.5">
                      {shiftInfo.icon} {shiftInfo.label}
                    </span>
                    {entry.sea_state && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2 py-0.5">
                        🌊 {entry.sea_state}
                      </span>
                    )}
                    {entry.wind_speed !== null && entry.wind_speed !== undefined && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2 py-0.5">
                        💨 {entry.wind_speed} kts
                      </span>
                    )}
                    {entry.wave_height !== null && entry.wave_height !== undefined && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2 py-0.5">
                        🌊 {entry.wave_height}m
                      </span>
                    )}
                    {entry.position_lat && entry.position_lon && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2 py-0.5">
                        <MapPin size={9} /> {entry.position_lat.toFixed(2)}, {entry.position_lon.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12">
            <BookOpen size={32} className="text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-muted)]">No se encontraron entradas</p>
          </div>
        )}
      </div>
    </div>
  );
}
