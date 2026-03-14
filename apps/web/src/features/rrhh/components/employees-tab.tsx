"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Grid3X3, List, X, Mail, Phone, MapPin, Calendar,
  Briefcase, Building2, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Employee, Department } from "../types";
import {
  EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_COLORS,
  CONTRACT_TYPE_LABELS,
} from "../types";

type Props = { employees: Employee[]; departments: Department[] };

export function EmployeesTab({ employees, departments }: Props) {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchSearch = search === "" ||
        e.full_name.toLowerCase().includes(search.toLowerCase()) ||
        e.employee_number.toLowerCase().includes(search.toLowerCase()) ||
        e.position.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === "all" || e.department_id === deptFilter;
      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [employees, search, deptFilter, statusFilter]);

  const getDeptName = (id: string | null) => departments.find((d) => d.id === id)?.name || "—";
  const getDeptColor = (id: string | null) => departments.find((d) => d.id === id)?.color || "#6B7280";

  const getSeniority = (hireDate: string) => {
    const years = (Date.now() - new Date(hireDate).getTime()) / (365.25 * 86400000);
    if (years < 1) return `${Math.round(years * 12)} meses`;
    return `${Math.round(years * 10) / 10} años`;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empleado..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#06B6D4]"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
          >
            <option value="all">Todos los departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="hidden sm:block rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="on_leave">En Licencia</option>
            <option value="terminated">Desvinculados</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)]">{filtered.length} empleados</span>
          <div className="flex items-center rounded-lg border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={cn("p-1.5", viewMode === "table" ? "bg-[#06B6D4]/10 text-[#06B6D4]" : "text-[var(--text-muted)]")}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={cn("p-1.5", viewMode === "cards" ? "bg-[#06B6D4]/10 text-[#06B6D4]" : "text-[var(--text-muted)]")}
            >
              <Grid3X3 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Table View */}
      {viewMode === "table" ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/50">
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">Empleado</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)] hidden md:table-cell">Departamento</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)] hidden lg:table-cell">Posición</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)] hidden lg:table-cell">Contrato</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)] hidden xl:table-cell">Antigüedad</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">Estado</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, i) => (
                  <motion.tr
                    key={emp.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setSelectedEmployee(emp)}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-muted)]/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: getDeptColor(emp.department_id) }}
                        >
                          {emp.first_name.charAt(0)}{emp.last_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{emp.full_name}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">{emp.employee_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: `${getDeptColor(emp.department_id)}15`, color: getDeptColor(emp.department_id) }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getDeptColor(emp.department_id) }} />
                        {getDeptName(emp.department_id)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] hidden lg:table-cell">{emp.position}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] hidden lg:table-cell">{CONTRACT_TYPE_LABELS[emp.contract_type]}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] hidden xl:table-cell font-mono">{getSeniority(emp.hire_date)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: `${EMPLOYEE_STATUS_COLORS[emp.status]}15`, color: EMPLOYEE_STATUS_COLORS[emp.status] }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: EMPLOYEE_STATUS_COLORS[emp.status] }} />
                        {EMPLOYEE_STATUS_LABELS[emp.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight size={12} className="text-[var(--text-muted)]" />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((emp, i) => (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelectedEmployee(emp)}
              className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 cursor-pointer transition-all hover:shadow-lg hover:border-[#06B6D4]/30"
            >
              <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: getDeptColor(emp.department_id) }} />
              <div className="flex flex-col items-center text-center pt-2">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold text-white mb-3"
                  style={{ backgroundColor: getDeptColor(emp.department_id) }}
                >
                  {emp.first_name.charAt(0)}{emp.last_name.charAt(0)}
                </div>
                <p className="font-semibold text-[var(--text-primary)] text-sm">{emp.full_name}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{emp.position}</p>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
                  style={{ backgroundColor: `${getDeptColor(emp.department_id)}15`, color: getDeptColor(emp.department_id) }}>
                  {getDeptName(emp.department_id)}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                <span>{emp.employee_number}</span>
                <span>{getSeniority(emp.hire_date)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Employee Detail Sheet */}
      <AnimatePresence>
        {selectedEmployee && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setSelectedEmployee(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl overflow-y-auto"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-2xl text-lg font-bold text-white"
                      style={{ backgroundColor: getDeptColor(selectedEmployee.department_id) }}
                    >
                      {selectedEmployee.first_name.charAt(0)}{selectedEmployee.last_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[var(--text-primary)]">{selectedEmployee.full_name}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">{selectedEmployee.position}</p>
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: `${EMPLOYEE_STATUS_COLORS[selectedEmployee.status]}15`, color: EMPLOYEE_STATUS_COLORS[selectedEmployee.status] }}>
                        {EMPLOYEE_STATUS_LABELS[selectedEmployee.status]}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedEmployee(null)} className="rounded-lg p-2 hover:bg-[var(--bg-muted)] text-[var(--text-muted)]">
                    <X size={16} />
                  </button>
                </div>

                {/* Info Sections */}
                <div className="space-y-6">
                  {/* Contact */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Contacto</h4>
                    {selectedEmployee.email && (
                      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                        <Mail size={13} className="text-[var(--text-muted)]" /> {selectedEmployee.email}
                      </div>
                    )}
                    {selectedEmployee.phone && (
                      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                        <Phone size={13} className="text-[var(--text-muted)]" /> {selectedEmployee.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                      <MapPin size={13} className="text-[var(--text-muted)]" /> {selectedEmployee.city}
                    </div>
                  </div>

                  {/* Work */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Información Laboral</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: Briefcase, label: "# Empleado", value: selectedEmployee.employee_number },
                        { icon: Building2, label: "Departamento", value: getDeptName(selectedEmployee.department_id) },
                        { icon: Calendar, label: "Ingreso", value: new Date(selectedEmployee.hire_date).toLocaleDateString("es-EC") },
                        { icon: Calendar, label: "Antigüedad", value: getSeniority(selectedEmployee.hire_date) },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg bg-[var(--bg-muted)]/50 p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <item.icon size={11} className="text-[var(--text-muted)]" />
                            <span className="text-[9px] text-[var(--text-muted)]">{item.label}</span>
                          </div>
                          <p className="text-xs font-semibold text-[var(--text-primary)]">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Compensation */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Compensación</h4>
                    <div className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-muted)]/30 p-4">
                      <p className="text-[10px] text-[var(--text-muted)]">Salario Base Mensual</p>
                      <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">
                        ${selectedEmployee.base_salary.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">{CONTRACT_TYPE_LABELS[selectedEmployee.contract_type]}</p>
                    </div>
                  </div>

                  {/* Manager */}
                  {selectedEmployee.manager && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Reporta a</h4>
                      <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[10px] font-bold text-[var(--text-primary)]">
                          {selectedEmployee.manager.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[var(--text-primary)]">{selectedEmployee.manager.full_name}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">{selectedEmployee.manager.position}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
