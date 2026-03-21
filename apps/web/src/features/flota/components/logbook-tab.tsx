"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, Search, Plus, X,
  MapPin, Send,
} from "lucide-react";
import { saveLogbookEntry } from "../actions/manifest-actions";
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
  dia: { label: "Día", icon: "☀️" },
  noche: { label: "Noche", icon: "🌙" },
};

function timeAgo(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "Ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
}

type LogbookTabProps = {
  vesselId: string;
  logbook: LogbookEntry[];
};

export function LogbookTab({ vesselId, logbook }: LogbookTabProps) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [entryType, setEntryType] = useState("navegacion");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [shift, setShift] = useState<"dia" | "noche">("dia");
  const [seaState, setSeaState] = useState("");
  const [windSpeed, setWindSpeed] = useState("");
  const [waveHeight, setWaveHeight] = useState("");

  const filtered = logbook.filter((entry) => {
    if (filter !== "all" && entry.entry_type !== filter) return false;
    if (search && !entry.title.toLowerCase().includes(search.toLowerCase()) && !entry.content?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSubmit = () => {
    if (!title) return;
    startTransition(async () => {
      await saveLogbookEntry({
        vesselId,
        entryType,
        title,
        content: content || undefined,
        shift,
        seaState: seaState || undefined,
        windSpeed: windSpeed ? parseFloat(windSpeed) : undefined,
        waveHeight: waveHeight ? parseFloat(waveHeight) : undefined,
      });
      setShowForm(false);
      setTitle("");
      setContent("");
      setSeaState("");
      setWindSpeed("");
      setWaveHeight("");
    });
  };

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
              className="h-8 w-44 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? "Cerrar" : "Nueva Entrada"}
          </button>
        </div>
      </div>

      {/* New Entry Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5"
        >
          <h3 className="text-xs font-bold text-[var(--text-primary)] mb-4">Nueva Entrada de Bitácora</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Tipo</label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
              >
                {ENTRY_TYPES.filter((t) => t.value !== "all").map((t) => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Turno</label>
              <div className="flex gap-2">
                {(["dia", "noche"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setShift(s)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      shift === s ? "border-indigo-500 bg-indigo-500/10 text-indigo-600" : "border-[var(--border)] text-[var(--text-muted)]"
                    }`}
                  >
                    {SHIFT_LABELS[s].icon} {SHIFT_LABELS[s].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Título *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Resumen breve"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Descripción</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Detalle de la entrada..."
                rows={3}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Estado del mar</label>
              <select
                value={seaState}
                onChange={(e) => setSeaState(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
              >
                <option value="">— Sin especificar —</option>
                <option value="calm">🟢 Calma (0-1)</option>
                <option value="slight">🟡 Marejadilla (2-3)</option>
                <option value="moderate">🟠 Marejada (4-5)</option>
                <option value="rough">🔴 Mar gruesa (6-7)</option>
                <option value="very_rough">⛔ Muy gruesa (8-9)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Viento (kts)</label>
              <input type="number" value={windSpeed} onChange={(e) => setWindSpeed(e.target.value)} placeholder="0" className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Oleaje (m)</label>
              <input type="number" step="0.1" value={waveHeight} onChange={(e) => setWaveHeight(e.target.value)} placeholder="0.0" className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleSubmit}
              disabled={isPending || !title}
              className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              <Send size={12} />
              {isPending ? "Guardando..." : "Registrar Entrada"}
            </button>
          </div>
        </motion.div>
      )}

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
                  ? "bg-indigo-500 text-white shadow-sm"
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
              <div className="flex flex-col items-center shrink-0 w-8">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--bg-surface)] text-sm group-hover:border-indigo-500 transition-colors">
                  {typeInfo?.icon || "📝"}
                </div>
                {i < filtered.length - 1 && <div className="w-px flex-1 bg-[var(--border)]" />}
              </div>
              <div className="flex-1 pb-4 min-w-0">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 group-hover:border-indigo-500/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-[12px] font-semibold text-[var(--text-primary)]">{entry.title}</h4>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[8px] font-bold text-indigo-500">
                        {shiftInfo.icon} {shiftInfo.label}
                      </span>
                      <span className="text-[9px] text-[var(--text-muted)]">{timeAgo(entry.created_at)}</span>
                    </div>
                  </div>
                  {entry.content && (
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-2">{entry.content}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-[9px] text-[var(--text-muted)]">
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
