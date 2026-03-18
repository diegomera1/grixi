"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, CloudOff } from "lucide-react";
import type { Equipment, CrewMember, WOPriority } from "../types";
import { WO_PRIORITY_LABELS, WO_PRIORITY_COLORS } from "../types";
import { useOfflineSync } from "../hooks/use-offline-sync";

type WorkOrderFormProps = {
  equipment: Equipment[];
  crew?: CrewMember[];
  onClose: () => void;
  onCreated?: () => void;
};

type FormData = {
  title: string;
  description: string;
  priority: WOPriority;
  equipment_id: string;
  assigned_to: string;
  planned_start: string;
  planned_end: string;
  hours_estimated: string;
  cost_estimated: string;
};

const INITIAL_FORM: FormData = {
  title: "",
  description: "",
  priority: "medium",
  equipment_id: "",
  assigned_to: "",
  planned_start: "",
  planned_end: "",
  hours_estimated: "",
  cost_estimated: "",
};

export function WorkOrderForm({ equipment, crew, onClose, onCreated }: WorkOrderFormProps) {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { queueAction, status } = useOfflineSync();

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.title.trim()) newErrors.title = "El título es requerido";
    if (form.title.trim().length < 5) newErrors.title = "Mínimo 5 caracteres";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);

    try {
      const woNumber = `WO-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
      await queueAction("work_order", "create", {
        wo_number: woNumber,
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        equipment_id: form.equipment_id || null,
        assigned_to: form.assigned_to || null,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
        hours_estimated: form.hours_estimated ? parseFloat(form.hours_estimated) : 0,
        cost_estimated: form.cost_estimated ? parseFloat(form.cost_estimated) : 0,
        status: "planned",
        created_offline: !status.isOnline,
      });

      setSubmitted(true);
      setTimeout(() => {
        onCreated?.();
        onClose();
      }, 1500);
    } catch (err) {
      console.error("[WO Form] Error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed inset-x-4 top-[15%] z-50 mx-auto max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-8 shadow-2xl text-center"
        >
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-[#10B981]/10">
            <Plus size={24} className="text-[#10B981]" />
          </div>
          <h3 className="mt-3 text-base font-bold text-[var(--text-primary)]">OT Creada</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {status.isOnline ? "Orden de trabajo registrada correctamente" : "Guardada localmente · Se sincronizará al reconectar"}
          </p>
          {!status.isOnline && (
            <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-amber-500">
              <CloudOff size={12} />
              Pendiente de sincronización
            </div>
          )}
        </motion.div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        className="fixed inset-x-4 top-[8%] z-50 mx-auto max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-primary)]/95 backdrop-blur-md px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Nueva Orden de Trabajo</h2>
            <p className="text-[10px] text-[var(--text-muted)]">Crear OT para el buque</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Título *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Ej: Overhaul Cilindro #3"
              className={`mt-1 w-full rounded-lg border ${errors.title ? "border-red-500" : "border-[var(--border)]"} bg-[var(--bg-surface)] px-3 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]`}
            />
            {errors.title && <p className="mt-1 text-[9px] text-red-500">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Detalle del trabajo a realizar..."
              rows={3}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Prioridad</label>
            <div className="mt-1.5 flex gap-1.5">
              {(["low", "medium", "high", "critical"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => update("priority", p)}
                  className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-bold transition-all ${
                    form.priority === p
                      ? "ring-1 ring-offset-1 ring-offset-[var(--bg-primary)]"
                      : "opacity-50 hover:opacity-80"
                  }`}
                  style={{
                    backgroundColor: `${WO_PRIORITY_COLORS[p]}15`,
                    color: WO_PRIORITY_COLORS[p],
                    ...(form.priority === p ? { ringColor: WO_PRIORITY_COLORS[p] } : {}),
                  }}
                >
                  {WO_PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Equipo</label>
            <select
              value={form.equipment_id}
              onChange={(e) => update("equipment_id", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
            >
              <option value="">Sin equipo específico</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.code} — {eq.name}</option>
              ))}
            </select>
          </div>

          {/* Assigned To */}
          {crew && crew.length > 0 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Asignar a</label>
              <select
                value={form.assigned_to}
                onChange={(e) => update("assigned_to", e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
              >
                <option value="">Sin asignar</option>
                {crew.map((c) => (
                  <option key={c.id} value={c.id}>{c.employee?.full_name || c.role} — {c.rank}</option>
                ))}
              </select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Inicio Planificado</label>
              <input
                type="date"
                value={form.planned_start}
                onChange={(e) => update("planned_start", e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Fin Planificado</label>
              <input
                type="date"
                value={form.planned_end}
                onChange={(e) => update("planned_end", e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
              />
            </div>
          </div>

          {/* Hours & Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Horas Estimadas</label>
              <input
                type="number"
                value={form.hours_estimated}
                onChange={(e) => update("hours_estimated", e.target.value)}
                placeholder="0"
                min="0"
                step="0.5"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Costo Estimado ($)</label>
              <input
                type="number"
                value={form.cost_estimated}
                onChange={(e) => update("cost_estimated", e.target.value)}
                placeholder="0"
                min="0"
                step="100"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-primary)]/95 backdrop-blur-md px-5 py-4">
          {!status.isOnline && (
            <div className="flex items-center gap-1 text-[9px] text-amber-500">
              <CloudOff size={10} />
              Se guardará offline
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-[#0EA5E9] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-[#0EA5E9]/20 hover:bg-[#0EA5E9]/90 disabled:opacity-50 transition-all"
            >
              {submitting ? "Creando..." : "Crear OT"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
