"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Circle, Clock, AlertTriangle, Camera,
  ChevronDown, ChevronUp, Plus, Send,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Checklist } from "../types";
import { useOfflineSync } from "../hooks/use-offline-sync";

// ── Types ───────────────────────────────────────

type ChecklistItemState = {
  id: string;
  label: string;
  checked: boolean;
  value?: string;
  notes?: string;
  photo?: string;
  required: boolean;
};

type ChecklistExecution = {
  checklistId: string;
  startedAt: string;
  completedAt?: string;
  executorName: string;
  items: ChecklistItemState[];
  overallNotes: string;
  status: "in_progress" | "completed" | "submitted";
};

// ── Demo Checklist Items ────────────────────────

const DEMO_ITEMS: Record<string, ChecklistItemState[]> = {
  pre_departure: [
    { id: "pd-1", label: "Documentación de zarpe completa", checked: false, required: true },
    { id: "pd-2", label: "Prueba de gobierno del timón", checked: false, required: true },
    { id: "pd-3", label: "Prueba de máquinas (avante/atrás)", checked: false, required: true },
    { id: "pd-4", label: "Sistemas de navegación operativos", checked: false, required: true },
    { id: "pd-5", label: "Equipo de comunicaciones probado", checked: false, required: true },
    { id: "pd-6", label: "Estabilidad verificada (carga segura)", checked: false, required: true },
    { id: "pd-7", label: "Luces de navegación operativas", checked: false, required: true },
    { id: "pd-8", label: "Equipo contra incendios listo", checked: false, required: true },
    { id: "pd-9", label: "Tripulación mínima confirmada", checked: false, required: true },
    { id: "pd-10", label: "Plan de viaje aprobado", checked: false, required: false },
  ],
  engine_room_round: [
    { id: "er-1", label: "Nivel aceite motor principal", checked: false, value: "", required: true },
    { id: "er-2", label: "Temperatura gases escape (todos los cilindros)", checked: false, value: "", required: true },
    { id: "er-3", label: "Presión aceite lubricación", checked: false, value: "", required: true },
    { id: "er-4", label: "Temperatura agua refrigeración HT/LT", checked: false, value: "", required: true },
    { id: "er-5", label: "Nivel tanque de servicio diario", checked: false, value: "", required: true },
    { id: "er-6", label: "Generadores auxiliares: voltaje/frecuencia", checked: false, value: "", required: true },
    { id: "er-7", label: "Presión vapor caldera", checked: false, value: "", required: true },
    { id: "er-8", label: "Fugas visibles de aceite/agua/combustible", checked: false, required: true },
    { id: "er-9", label: "Sentinas: nivel normal", checked: false, required: true },
    { id: "er-10", label: "Ventilación sala de máquinas OK", checked: false, required: false },
  ],
  safety_drill: [
    { id: "sd-1", label: "Alarma general activada", checked: false, required: true },
    { id: "sd-2", label: "Tripulación en estaciones asignadas", checked: false, required: true },
    { id: "sd-3", label: "Botes salvavidas: mecanismo de arriado", checked: false, required: true },
    { id: "sd-4", label: "Chalecos salvavidas disponibles", checked: false, required: true },
    { id: "sd-5", label: "Equipo de bombero probado", checked: false, required: true },
    { id: "sd-6", label: "Mangueras contra incendio presión OK", checked: false, required: true },
    { id: "sd-7", label: "Comunicaciones de emergencia OK", checked: false, required: true },
    { id: "sd-8", label: "EPIRB/SART verificados", checked: false, required: true },
  ],
  cargo_operations: [
    { id: "co-1", label: "Plan de carga/descarga aprobado", checked: false, required: true },
    { id: "co-2", label: "Tank cleaning completado", checked: false, required: true },
    { id: "co-3", label: "Manifold preparado y alineado", checked: false, required: true },
    { id: "co-4", label: "Mangueras/brazos de carga conectados", checked: false, required: true },
    { id: "co-5", label: "Sistemas de inertización/ventilación OK", checked: false, required: true },
    { id: "co-6", label: "Monitoreo O2 en tanques de carga", checked: false, value: "", required: true },
    { id: "co-7", label: "Válvulas de carga posicionadas", checked: false, required: true },
    { id: "co-8", label: "Drenajes cerrados / contención lista", checked: false, required: true },
    { id: "co-9", label: "Comunicación buque-terminal establecida", checked: false, required: true },
    { id: "co-10", label: "Parada de emergencia probada", checked: false, required: true },
  ],
  ism_audit: [
    { id: "ia-1", label: "Certificados clase vigentes", checked: false, required: true },
    { id: "ia-2", label: "DOC/SMC vigentes", checked: false, required: true },
    { id: "ia-3", label: "Registros de mantenimiento actualizados", checked: false, required: true },
    { id: "ia-4", label: "Drills de emergencia documentados", checked: false, required: true },
    { id: "ia-5", label: "No conformidades anteriores cerradas", checked: false, required: true },
    { id: "ia-6", label: "Reportes de accidentes/incidentes al día", checked: false, required: true },
    { id: "ia-7", label: "Manual ISM disponible y actualizado", checked: false, required: true },
    { id: "ia-8", label: "Tripulación familiarizada con procedimientos", checked: false, required: true },
  ],
};

// ── Checklist Tab Component ─────────────────────

export function ChecklistTab({ checklists }: { checklists: Checklist[] }) {
  const [activeChecklist, setActiveChecklist] = useState<string | null>(null);
  const [execution, setExecution] = useState<ChecklistExecution | null>(null);
  const { queueAction, status: offlineStatus } = useOfflineSync();

  const getItems = (checklistType: string): ChecklistItemState[] => {
    return DEMO_ITEMS[checklistType] || DEMO_ITEMS.pre_departure;
  };

  const startChecklist = (cl: Checklist) => {
    setActiveChecklist(cl.id);
    setExecution({
      checklistId: cl.id,
      startedAt: new Date().toISOString(),
      executorName: "Jefe de Máquinas",
      items: getItems(cl.checklist_type),
      overallNotes: "",
      status: "in_progress",
    });
  };

  const toggleItem = (itemId: string) => {
    if (!execution) return;
    setExecution({
      ...execution,
      items: execution.items.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      ),
    });
  };

  const updateItemValue = (itemId: string, value: string) => {
    if (!execution) return;
    setExecution({
      ...execution,
      items: execution.items.map((item) =>
        item.id === itemId ? { ...item, value } : item
      ),
    });
  };

  const updateItemNotes = (itemId: string, notes: string) => {
    if (!execution) return;
    setExecution({
      ...execution,
      items: execution.items.map((item) =>
        item.id === itemId ? { ...item, notes } : item
      ),
    });
  };

  const submitChecklist = async () => {
    if (!execution) return;
    const completed = {
      ...execution,
      completedAt: new Date().toISOString(),
      status: "submitted" as const,
    };
    setExecution(completed);

    // Queue for sync (works offline)
    await queueAction("checklist_execution", "create", {
      checklist_id: completed.checklistId,
      started_at: completed.startedAt,
      completed_at: completed.completedAt,
      executor_name: completed.executorName,
      items: completed.items,
      notes: completed.overallNotes,
    });

    // Reset after short delay
    setTimeout(() => {
      setActiveChecklist(null);
      setExecution(null);
    }, 2000);
  };

  const completedCount = execution?.items.filter((i) => i.checked).length || 0;
  const totalCount = execution?.items.length || 0;
  const allRequiredDone = execution?.items
    .filter((i) => i.required)
    .every((i) => i.checked) || false;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Checklist selector view
  if (!activeChecklist || !execution) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Checklists Disponibles
          </h3>
          {!offlineStatus.isOnline && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Modo Offline
            </span>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {checklists.map((cl, i) => {
            const itemCount = (DEMO_ITEMS[cl.checklist_type] || []).length;
            return (
              <motion.button
                key={cl.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => startChecklist(cl)}
                className="group text-left rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:shadow-md hover:border-[#0EA5E9]/30 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{cl.name}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-muted)] line-clamp-2">{cl.checklist_type.replace(/_/g, " ")}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#0EA5E9]/10 p-1.5 text-[#0EA5E9] group-hover:bg-[#0EA5E9] group-hover:text-white transition-all">
                    <Plus size={12} />
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3 text-[9px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={10} />
                    {itemCount} ítems
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    ~{Math.max(10, itemCount * 3)} min
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  // Active checklist execution
  const activeData = checklists.find((c) => c.id === activeChecklist);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border border-[#0EA5E9]/20 bg-[#030712] p-4">
        <div>
          <p className="text-sm font-bold text-white">{activeData?.name}</p>
          <p className="text-[10px] text-white/40">
            Inicio: {new Date(execution.startedAt).toLocaleTimeString("es-EC")} · {execution.executorName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress ring */}
          <div className="relative h-10 w-10">
            <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
              <circle
                cx="18" cy="18" r="16" fill="none"
                stroke="#0EA5E9"
                strokeWidth="2"
                strokeDasharray={`${progressPct} 100`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
              {completedCount}/{totalCount}
            </span>
          </div>
          {execution.status === "submitted" ? (
            <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-bold text-green-500">
              <CheckCircle2 size={12} />
              Enviado
            </span>
          ) : (
            <button
              onClick={submitChecklist}
              disabled={!allRequiredDone}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                allRequiredDone
                  ? "bg-[#0EA5E9] text-white hover:bg-[#0EA5E9]/80"
                  : "bg-white/5 text-white/30 cursor-not-allowed"
              )}
            >
              <Send size={12} />
              Enviar
            </button>
          )}
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-1">
        {execution.items.map((item, i) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            index={i}
            onToggle={() => toggleItem(item.id)}
            onValueChange={(v) => updateItemValue(item.id, v)}
            onNotesChange={(n) => updateItemNotes(item.id, n)}
          />
        ))}
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Observaciones Generales
        </p>
        <textarea
          value={execution.overallNotes}
          onChange={(e) => setExecution({ ...execution, overallNotes: e.target.value })}
          placeholder="Notas adicionales del inspector..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] resize-none"
          rows={2}
        />
      </div>

      {/* Back button */}
      <button
        onClick={() => { setActiveChecklist(null); setExecution(null); }}
        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        ← Volver a lista de checklists
      </button>
    </div>
  );
}

// ── Individual Item Row ─────────────────────────

function ChecklistItemRow({ item, index, onToggle, onValueChange, onNotesChange }: {
  item: ChecklistItemState;
  index: number;
  onToggle: () => void;
  onValueChange: (v: string) => void;
  onNotesChange: (n: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "rounded-lg border transition-all",
        item.checked
          ? "border-green-500/20 bg-green-500/5"
          : "border-[var(--border)] bg-[var(--bg-surface)]"
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button onClick={onToggle} className="shrink-0">
          {item.checked ? (
            <CheckCircle2 size={18} className="text-green-500" />
          ) : (
            <Circle size={18} className="text-[var(--text-muted)]" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-xs font-medium transition-all",
            item.checked ? "text-green-600 line-through" : "text-[var(--text-primary)]"
          )}>
            {item.label}
            {item.required && <span className="ml-1 text-red-400">*</span>}
          </p>
        </div>

        {/* Value input (for measurement items) */}
        {item.value !== undefined && (
          <input
            type="text"
            value={item.value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="Valor"
            className="w-20 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1 text-[10px] text-center text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
          />
        )}

        <button onClick={() => setExpanded(!expanded)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 pt-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={item.notes || ""}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="Agregar nota..."
                  className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1 text-[10px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                />
                <button className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1 text-[9px] text-[var(--text-muted)] hover:text-[#0EA5E9] transition-colors">
                  <Camera size={10} />
                  Foto
                </button>
              </div>
              {item.notes && (
                <div className="mt-1 flex items-start gap-1 text-[8px] text-amber-500">
                  <AlertTriangle size={8} className="mt-0.5 shrink-0" />
                  <span>{item.notes}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
