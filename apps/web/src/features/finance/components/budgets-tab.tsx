"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  User,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FinanceTransaction, CurrencyCode } from "../types";
import type { FinanceCostCenter } from "../types";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

// ── Responsible users per department ─────────────
const RESPONSIBLE_USERS: Record<string, string> = {
  "Dirección": "Carlos Mendoza",
  "Finanzas": "María Rodríguez",
  "Contabilidad": "Camila Gutiérrez",
  "Tesorería": "Laura Espinoza",
  "Producción": "Pedro Vásquez",
  "Mantenimiento": "Gabriel Paredes",
  "Control de Procesos": "Fernando Castillo",
  "Calidad": "Diana Morales",
  "Laboratorio": "Elena Bravo",
  "Inspección": "Natalia Salazar",
  "Ventas": "Ana Torres",
  "Marketing": "Valentina Reyes",
  "Postventa": "Adriana Cordero",
  "IT": "Andrés León",
  "Desarrollo": "Sofía Méndez",
  "Infraestructura": "Marcos Peña",
  "Seguridad TI": "Nicolás Zambrano",
  "Logística": "Jorge Herrera",
  "Almacenes": "Miguel Pacheco",
  "Distribución": "Santiago Ramírez",
  "Compras": "Luis Aguilar",
  "RRHH": "Lucía Fernández",
  "Nómina": "Isabella Ortiz",
  "Bienestar": "Carolina Vega",
  "Investigación": "Daniel Cruz",
  "Innovación": "Óscar Delgado",
  "Prototipos": "Rafael Soto",
};

// ── Map sub-departments to cost centers ──────────
const CC_DEPARTMENT_MAP: Record<string, string[]> = {
  CC100: ["Dirección", "Finanzas", "Contabilidad", "Tesorería"],
  CC200: ["Producción", "Mantenimiento", "Control de Procesos"],
  CC300: ["Calidad", "Laboratorio", "Inspección"],
  CC400: ["Ventas", "Marketing", "Postventa"],
  CC500: ["IT", "Desarrollo", "Infraestructura", "Seguridad TI"],
  CC600: ["Logística", "Almacenes", "Distribución", "Compras"],
  CC700: ["RRHH", "Nómina", "Bienestar"],
  CC800: ["Investigación", "Innovación", "Prototipos"],
};

export function BudgetsTab({
  transactions,
  costCenters,
  currency,
  convert,
}: {
  transactions: FinanceTransaction[];
  costCenters: FinanceCostCenter[];
  currency: CurrencyCode;
  convert: (v: number) => number;
}) {
  const [expandedCC, setExpandedCC] = useState<string | null>(null);

  // Compute actual spend per cost center
  const spendByCenter = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of transactions) {
      if (["expense", "payment_out"].includes(t.category)) {
        const key = t.cost_center_code || "NO_CC";
        map[key] = (map[key] || 0) + t.amount_usd;
      }
    }
    return map;
  }, [transactions]);

  // Spend by department
  const spendByDept = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of transactions) {
      if (["expense", "payment_out"].includes(t.category)) {
        map[t.department] = (map[t.department] || 0) + t.amount_usd;
      }
    }
    return map;
  }, [transactions]);

  // Overall
  const totalBudget = costCenters.reduce((s, cc) => s + (cc.budget_annual || 0), 0);
  const totalSpend = Object.values(spendByCenter).reduce((s, v) => s + v, 0);
  const globalPct = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;
  const remaining = totalBudget - totalSpend;

  // Alerts
  const overBudget = costCenters.filter((cc) => {
    const spent = spendByCenter[cc.code] || 0;
    return cc.budget_annual > 0 && spent > cc.budget_annual * 0.8;
  });

  // Get departments for a CC
  const getDepartments = (ccCode: string) => {
    const mapped = CC_DEPARTMENT_MAP[ccCode];
    if (mapped) return mapped;
    // Fallback: find departments from transaction data
    const depts = new Set<string>();
    for (const t of transactions) {
      if (t.cost_center_code === ccCode && ["expense", "payment_out"].includes(t.category)) {
        depts.add(t.department);
      }
    }
    return Array.from(depts);
  };

  const deptColors = ["#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#F43F5E", "#EC4899", "#3B82F6", "#F97316"];

  return (
    <div className="space-y-4">
      {/* Global summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Presupuesto Total</p>
          <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">
            {formatCurrencyCompact(convert(totalBudget), currency)}
          </p>
          <div className="mt-2 h-2 bg-[var(--bg-muted)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: globalPct > 80 ? "#EF4444" : globalPct > 50 ? "#F59E0B" : "#10B981" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(globalPct, 100)}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">{globalPct.toFixed(1)}% ejecutado</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Ejecutado</p>
          <p className="text-2xl font-bold font-mono text-rose-500">
            {formatCurrencyCompact(convert(totalSpend), currency)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Disponible</p>
          <p className={cn("text-2xl font-bold font-mono", remaining >= 0 ? "text-emerald-500" : "text-rose-500")}>
            {formatCurrencyCompact(convert(remaining), currency)}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {overBudget.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-semibold text-amber-500">
              {overBudget.length} centro(s) de costo superan el 80% del presupuesto
            </p>
          </div>
          <div className="space-y-1">
            {overBudget.map((cc) => {
              const spent = spendByCenter[cc.code] || 0;
              const pct = cc.budget_annual > 0 ? (spent / cc.budget_annual) * 100 : 0;
              return (
                <p key={cc.id} className="text-xs text-[var(--text-secondary)]">
                  <span className="font-mono text-amber-500">{cc.code}</span> {cc.department}: {pct.toFixed(0)}% ({formatCurrencyCompact(convert(spent), currency)} / {formatCurrencyCompact(convert(cc.budget_annual), currency)})
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* Cost Centers with Department Hierarchy */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-[var(--brand)]" />
          <h3 className="font-semibold text-sm text-[var(--text-primary)]">Centros de Costo → Departamentos</h3>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4">Presupuesto vs ejecutado por centro — expandir para ver detalle por departamento y responsable</p>
        <div className="space-y-3">
          {costCenters.map((cc) => {
            const spent = spendByCenter[cc.code] || 0;
            const budget = cc.budget_annual || 0;
            const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
            const isOver = pct > 80;
            const isExpanded = expandedCC === cc.code;
            const departments = getDepartments(cc.code);

            return (
              <div key={cc.id} className="rounded-lg border border-[var(--border)] overflow-hidden">
                {/* CC Header — clickable */}
                <button
                  onClick={() => setExpandedCC(isExpanded ? null : cc.code)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-muted)]/30 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-[var(--brand)] shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-[var(--brand)] bg-[var(--brand)]/10 px-1.5 py-0.5 rounded">{cc.code}</span>
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{cc.department}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">({departments.length} departamentos)</span>
                    </div>
                    <div className="h-2.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: pct > 80 ? "#EF4444" : pct > 50 ? "#F59E0B" : "#10B981" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5">
                      {isOver ? (
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                      ) : (
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                      )}
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {formatCurrencyCompact(convert(spent), currency)} / {formatCurrencyCompact(convert(budget), currency)}
                      </span>
                    </div>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: pct > 80 ? "#EF4444" : pct > 50 ? "#F59E0B" : "#10B981" }}
                    >
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </button>

                {/* Expanded: Department breakdown */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] bg-[var(--bg-muted)]/20">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-0 mb-2">
                          <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Departamento</span>
                          <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Responsable</span>
                          <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold text-right">Gasto</span>
                        </div>
                        {departments.map((dept, i) => {
                          const deptSpend = spendByDept[dept] || 0;
                          const deptPct = budget > 0 ? (deptSpend / budget) * 100 : 0;
                          const responsible = RESPONSIBLE_USERS[dept] || "Sin asignar";

                          return (
                            <motion.div
                              key={dept}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center py-2 border-b border-[var(--border)]/50 last:border-0"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: deptColors[i % deptColors.length] }}
                                />
                                <span className="text-xs text-[var(--text-primary)] truncate">{dept}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <User size={10} className="text-[var(--text-muted)]" />
                                <span className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap">{responsible}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-mono font-semibold text-[var(--text-primary)]">
                                  {formatCurrencyCompact(convert(deptSpend), currency)}
                                </span>
                                <span className="text-[9px] text-[var(--text-muted)] ml-1">
                                  ({deptPct.toFixed(0)}%)
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                        {/* CC total footer */}
                        <div className="flex items-center justify-between pt-2 mt-1">
                          <span className="text-[10px] font-semibold text-[var(--text-muted)]">Total {cc.code}</span>
                          <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                            {formatCurrencyCompact(convert(spent), currency)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
