"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FinanceTransaction, CurrencyCode } from "../types";
import type { FinanceCostCenter } from "../types";
import { formatCurrency, formatCurrencyCompact } from "../utils/currency";

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
    return Object.entries(map)
      .map(([dept, amount]) => ({ dept, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  const maxDeptSpend = Math.max(...spendByDept.map((d) => d.amount), 1);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cost Centers */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-1">Centros de Costo</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Presupuesto vs ejecutado (anual)</p>
          <div className="space-y-4">
            {costCenters.map((cc) => {
              const spent = spendByCenter[cc.code] || 0;
              const budget = cc.budget_annual || 0;
              const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
              const isOver = pct > 80;
              return (
                <div key={cc.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">{cc.code}</span>
                      <span className="text-xs font-medium text-[var(--text-primary)]">{cc.department}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOver ? (
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                      ) : (
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                      )}
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {formatCurrencyCompact(convert(spent), currency)} / {formatCurrencyCompact(convert(budget), currency)}
                      </span>
                    </div>
                  </div>
                  <div className="h-3 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: pct > 80 ? "#EF4444" : pct > 50 ? "#F59E0B" : "#10B981" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-right text-[10px] mt-0.5" style={{ color: pct > 80 ? "#EF4444" : pct > 50 ? "#F59E0B" : "#10B981" }}>
                    {pct.toFixed(1)}%
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Department */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-1">Gasto por Departamento</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Distribución de gasto real acumulado</p>
          <div className="space-y-3">
            {spendByDept.map((d, i) => (
              <div key={d.dept} className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)] w-24 shrink-0 truncate">{d.dept}</span>
                <div className="flex-1 h-6 bg-[var(--bg-muted)] rounded-lg overflow-hidden">
                  <motion.div
                    className="h-full rounded-lg flex items-center px-2"
                    style={{ backgroundColor: deptColors[i % deptColors.length] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(d.amount / maxDeptSpend) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  >
                    {d.amount > maxDeptSpend * 0.15 && (
                      <span className="text-[10px] text-white font-mono font-bold whitespace-nowrap">
                        {formatCurrencyCompact(convert(d.amount), currency)}
                      </span>
                    )}
                  </motion.div>
                </div>
                {d.amount <= maxDeptSpend * 0.15 && (
                  <span className="text-[10px] font-mono text-[var(--text-muted)] w-14 text-right">
                    {formatCurrencyCompact(convert(d.amount), currency)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
