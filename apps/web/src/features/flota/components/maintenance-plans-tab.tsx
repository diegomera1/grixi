"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock, Clock, Gauge, Wrench, AlertTriangle,
  Play, CheckCircle2, Settings, Zap,
} from "lucide-react";
import { checkDuePlans, generateWoFromPlan } from "../actions/maintenance-scheduler";
import type { MaintenancePlan, Equipment } from "../types";

// ── Helpers ──

const STRATEGY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  time_based: { label: "Basado en tiempo", icon: <Clock size={12} />, color: "#3B82F6" },
  calendar: { label: "Calendario", icon: <CalendarClock size={12} />, color: "#3B82F6" },
  hour_based: { label: "Horas de uso", icon: <Gauge size={12} />, color: "#F59E0B" },
  running_hours: { label: "Horas operación", icon: <Gauge size={12} />, color: "#F59E0B" },
  condition_based: { label: "Condicional", icon: <Zap size={12} />, color: "#8B5CF6" },
  regulation: { label: "Normativa", icon: <Settings size={12} />, color: "#EF4444" },
  predictive: { label: "Predictivo", icon: <Zap size={12} />, color: "#06B6D4" },
};

function getDueStatus(nextDue: string | null): { label: string; color: string; urgent: boolean } {
  if (!nextDue) return { label: "Sin fecha", color: "#6B7280", urgent: false };
  const now = new Date();
  const due = new Date(nextDue);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return { label: `Vencido (${Math.abs(diffDays)}d)`, color: "#EF4444", urgent: true };
  if (diffDays <= 7) return { label: `${diffDays}d restantes`, color: "#F59E0B", urgent: true };
  if (diffDays <= 30) return { label: `${diffDays}d restantes`, color: "#3B82F6", urgent: false };
  return { label: `${diffDays}d restantes`, color: "#10B981", urgent: false };
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Component ──

type MaintenancePlansTabProps = {
  plans: MaintenancePlan[];
  vesselId: string;
};

export function MaintenancePlansTab({ plans, vesselId }: MaintenancePlansTabProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const overdue = plans.filter((p) => {
    if (!p.next_due) return false;
    return new Date(p.next_due) < new Date();
  });

  const handleCheckDue = () => {
    startTransition(async () => {
      const result = await checkDuePlans(vesselId);
      setMessage(result.message || `${result.generated} OT(s) generada(s)`);
      setTimeout(() => setMessage(null), 5000);
    });
  };

  const handleGenerateWo = (planId: string) => {
    startTransition(async () => {
      const result = await generateWoFromPlan(planId);
      if (result.success) {
        setMessage(`OT ${result.woNumber} generada exitosamente`);
      } else {
        setMessage(`Error: ${result.error}`);
      }
      setTimeout(() => setMessage(null), 5000);
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
          <CalendarClock size={16} className="text-[#0EA5E9]" />
          Planes de Mantenimiento
          {overdue.length > 0 && (
            <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-500 animate-pulse">
              {overdue.length} vencidos
            </span>
          )}
        </h2>
        <button
          onClick={handleCheckDue}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-[#0EA5E9] px-4 py-2 text-xs font-medium text-white transition-all hover:bg-[#0EA5E9]/90 disabled:opacity-50"
        >
          <Play size={12} />
          {isPending ? "Verificando..." : "Ejecutar Scheduler"}
        </button>
      </div>

      {/* Message */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-[#0EA5E9]/10 border border-[#0EA5E9]/20 px-4 py-2 text-xs text-[#0EA5E9] font-medium"
        >
          {message}
        </motion.div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">{plans.length}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mt-1">Total planes</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-red-500">{overdue.length}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-red-500 mt-1">Vencidos</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-amber-500">
            {plans.filter((p) => p.auto_generate_wo).length}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-amber-500 mt-1">Auto-OT</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-emerald-500">
            {plans.filter((p) => p.last_executed).length}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 mt-1">Ejecutados</p>
        </div>
      </div>

      {/* Plan List */}
      <div className="space-y-2">
        {plans.map((plan, i) => {
          const strategy = STRATEGY_CONFIG[plan.strategy_type] || STRATEGY_CONFIG.time_based;
          const dueStatus = getDueStatus(plan.next_due);
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {/* Strategy badge */}
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase"
                      style={{ backgroundColor: `${strategy.color}15`, color: strategy.color }}
                    >
                      {strategy.icon}
                      {strategy.label}
                    </span>
                    {/* Due status */}
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold"
                      style={{ backgroundColor: `${dueStatus.color}15`, color: dueStatus.color }}
                    >
                      {dueStatus.urgent && <AlertTriangle size={8} />}
                      {dueStatus.label}
                    </span>
                    {plan.auto_generate_wo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#0EA5E9]/10 px-2 py-0.5 text-[8px] font-bold text-[#0EA5E9]">
                        <Zap size={8} /> Auto-OT
                      </span>
                    )}
                    {plan.regulation_code && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[8px] font-bold text-purple-500">
                        {plan.regulation_code}
                      </span>
                    )}
                  </div>
                  <h4 className="text-[12px] font-semibold text-[var(--text-primary)]">{plan.name}</h4>
                  {plan.equipment && (
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      🔧 {plan.equipment.name} ({plan.equipment.code})
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[9px] text-[var(--text-muted)]">
                    {plan.interval_days && <span>⏱ Cada {plan.interval_days} días</span>}
                    {plan.interval_hours && <span>⏱ Cada {plan.interval_hours}h</span>}
                    <span>Último: {formatDate(plan.last_executed)}</span>
                    <span>Próximo: {formatDate(plan.next_due)}</span>
                  </div>
                </div>
                {/* Generate WO button */}
                {dueStatus.urgent && (
                  <button
                    onClick={() => handleGenerateWo(plan.id)}
                    disabled={isPending}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-[10px] font-medium text-red-500 transition-all hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <Wrench size={10} />
                    Generar OT
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
        {plans.length === 0 && (
          <div className="flex flex-col items-center py-12">
            <CalendarClock size={32} className="text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-muted)]">Sin planes de mantenimiento registrados</p>
          </div>
        )}
      </div>
    </div>
  );
}
