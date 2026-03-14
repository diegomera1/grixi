"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import type { PayrollRecord, Employee, Department } from "../types";
import { MONTH_LABELS, PAYROLL_STATUS_LABELS } from "../types";

type Props = {
  payroll: PayrollRecord[];
  employees: Employee[];
  departments: Department[];
};

export function PayrollTab({ payroll, employees, departments }: Props) {
  const [selectedPeriod, setSelectedPeriod] = useState("2026-3");
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  const periodYear = parseInt(selectedPeriod.split("-")[0]);
  const periodMonth = parseInt(selectedPeriod.split("-")[1]);

  const periods = useMemo(() => {
    const seen = new Set<string>();
    return payroll
      .map((p) => `${p.period_year}-${p.period_month}`)
      .filter((p) => { if (seen.has(p)) return false; seen.add(p); return true; })
      .sort()
      .reverse();
  }, [payroll]);

  const currentPeriodRecords = useMemo(
    () => payroll.filter((p) => p.period_year === periodYear && p.period_month === periodMonth),
    [payroll, periodYear, periodMonth]
  );

  const totals = useMemo(() => {
    const t = {
      totalIncome: 0, totalDeductions: 0, netPay: 0,
      totalIESS: 0, totalOT: 0, totalBonuses: 0, count: 0,
    };
    currentPeriodRecords.forEach((r) => {
      t.totalIncome += r.total_income;
      t.totalDeductions += r.total_deductions;
      t.netPay += r.net_pay;
      t.totalIESS += r.iess_personal + r.iess_patronal;
      t.totalOT += r.overtime_pay;
      t.totalBonuses += r.bonuses;
      t.count++;
    });
    return t;
  }, [currentPeriodRecords]);

  // Department breakdown
  const deptBreakdown = useMemo(() => {
    const map: Record<string, { name: string; color: string; total: number; count: number }> = {};
    departments.forEach((d) => { map[d.id] = { name: d.name, color: d.color, total: 0, count: 0 }; });

    currentPeriodRecords.forEach((r) => {
      const emp = employees.find((e) => e.id === r.employee_id);
      if (emp?.department_id && map[emp.department_id]) {
        map[emp.department_id].total += r.net_pay;
        map[emp.department_id].count++;
      }
    });
    return Object.values(map).filter((d) => d.total > 0).sort((a, b) => b.total - a.total);
  }, [currentPeriodRecords, employees, departments]);

  const maxDeptTotal = Math.max(...deptBreakdown.map((d) => d.total), 1);

  const selectedRecord = useMemo(
    () => selectedEmployee ? currentPeriodRecords.find((r) => r.employee_id === selectedEmployee) : null,
    [selectedEmployee, currentPeriodRecords]
  );

  const selectedEmpData = selectedEmployee ? employees.find((e) => e.id === selectedEmployee) : null;

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Nómina Total", value: fmt(totals.totalIncome), color: "#06B6D4", icon: DollarSign },
          { label: "Neto a Pagar", value: fmt(totals.netPay), color: "#10B981", icon: TrendingUp },
          { label: "IESS Total", value: fmt(totals.totalIESS), color: "#8B5CF6", icon: TrendingDown },
          { label: "Horas Extra", value: fmt(totals.totalOT), color: "#F59E0B", icon: TrendingUp },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg p-1.5" style={{ backgroundColor: `${stat.color}15` }}>
                <stat.icon size={12} style={{ color: stat.color }} />
              </div>
              <span className="text-[10px] text-[var(--text-muted)]">{stat.label}</span>
            </div>
            <p className="text-lg font-bold text-[var(--text-primary)]">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3">
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)]"
        >
          {periods.map((p) => {
            const [y, m] = p.split("-");
            return <option key={p} value={p}>{MONTH_LABELS[parseInt(m) - 1]} {y}</option>;
          })}
        </select>
        <span className="text-[10px] text-[var(--text-muted)]">{totals.count} recibos</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Pay Receipt (glassmorphism) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden"
        >
          {/* Employee selector */}
          <div className="p-4 border-b border-[var(--border)]">
            <select
              value={selectedEmployee || ""}
              onChange={(e) => setSelectedEmployee(e.target.value || null)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)]"
            >
              <option value="">Seleccionar empleado...</option>
              {currentPeriodRecords.map((r) => {
                const emp = employees.find((e) => e.id === r.employee_id);
                return emp ? (
                  <option key={r.id} value={r.employee_id}>
                    {emp.employee_number} — {emp.full_name}
                  </option>
                ) : null;
              })}
            </select>
          </div>

          {selectedRecord && selectedEmpData ? (
            <div className="p-5">
              {/* Receipt Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Recibo de Nómina</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {MONTH_LABELS[periodMonth - 1]} {periodYear} • {PAYROLL_STATUS_LABELS[selectedRecord.status]}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[var(--text-muted)]">{selectedEmpData.employee_number}</p>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{selectedEmpData.full_name}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{selectedEmpData.position}</p>
                </div>
              </div>

              {/* Income */}
              <div className="mb-4">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-2">Ingresos</h4>
                <div className="space-y-1.5">
                  {[
                    { label: "Salario Base", amount: selectedRecord.base_salary },
                    { label: "Horas Extra", amount: selectedRecord.overtime_pay },
                    { label: "Bonificaciones", amount: selectedRecord.bonuses },
                    { label: "Comisiones", amount: selectedRecord.commissions },
                  ].filter((i) => i.amount > 0).map((item) => (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-[11px] text-[var(--text-secondary)]">{item.label}</span>
                      <span className="text-[11px] font-mono font-medium text-[var(--text-primary)]">{fmt(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1.5 border-t border-[var(--border)]">
                    <span className="text-[11px] font-semibold text-emerald-500">Total Ingresos</span>
                    <span className="text-sm font-bold text-emerald-500">{fmt(selectedRecord.total_income)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="mb-4">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-2">Deducciones</h4>
                <div className="space-y-1.5">
                  {[
                    { label: "IESS Personal (9.45%)", amount: selectedRecord.iess_personal },
                    { label: "Impuesto a la Renta", amount: selectedRecord.income_tax },
                    { label: "Préstamos", amount: selectedRecord.loans },
                    { label: "Otras Deducciones", amount: selectedRecord.other_deductions },
                  ].filter((i) => i.amount > 0).map((item) => (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-[11px] text-[var(--text-secondary)]">{item.label}</span>
                      <span className="text-[11px] font-mono font-medium text-red-400">-{fmt(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1.5 border-t border-[var(--border)]">
                    <span className="text-[11px] font-semibold text-red-500">Total Deducciones</span>
                    <span className="text-sm font-bold text-red-500">-{fmt(selectedRecord.total_deductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="rounded-xl bg-gradient-to-r from-[#06B6D4]/10 to-[#06B6D4]/5 border border-[#06B6D4]/20 p-4 text-center">
                <p className="text-[10px] text-[var(--text-muted)]">Neto a Recibir</p>
                <p className="text-3xl font-bold text-[#06B6D4] mt-1">{fmt(selectedRecord.net_pay)}</p>
              </div>

              {/* Visual Bar */}
              <div className="mt-4 h-3 rounded-full overflow-hidden bg-[var(--bg-muted)] flex">
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(selectedRecord.net_pay / selectedRecord.total_income) * 100}%` }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                />
                <motion.div
                  className="h-full bg-red-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${(selectedRecord.total_deductions / selectedRecord.total_income) * 100}%` }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-emerald-500">Neto {Math.round((selectedRecord.net_pay / selectedRecord.total_income) * 100)}%</span>
                <span className="text-[8px] text-red-400">Deducciones {Math.round((selectedRecord.total_deductions / selectedRecord.total_income) * 100)}%</span>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <DollarSign size={32} className="mx-auto text-[var(--text-muted)] mb-3" />
              <p className="text-sm text-[var(--text-muted)]">Selecciona un empleado para ver su recibo</p>
            </div>
          )}
        </motion.div>

        {/* Department Payroll Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Nómina por Departamento</h3>
          <div className="space-y-3">
            {deptBreakdown.map((dept, i) => (
              <div key={dept.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate max-w-[130px]">{dept.name}</span>
                  <span className="text-[10px] font-mono font-bold text-[var(--text-primary)]">${(dept.total / 1000).toFixed(1)}K</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: dept.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(dept.total / maxDeptTotal) * 100}%` }}
                    transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                  />
                </div>
                <p className="text-[8px] text-[var(--text-muted)] mt-0.5">{dept.count} empleados</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
