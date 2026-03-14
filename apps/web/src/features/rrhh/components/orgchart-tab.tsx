"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ZoomIn, ZoomOut, Maximize2, ChevronDown, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Employee, Department } from "../types";

type Props = { employees: Employee[]; departments: Department[] };

type OrgNode = {
  employee: Employee;
  children: OrgNode[];
  isExpanded: boolean;
  depth: number;
};

export function OrgchartTab({ employees, departments }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(
    employees.filter((e) => e.level >= 2).map((e) => e.id)
  ));
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const getDeptColor = (id: string | null) => departments.find((d) => d.id === id)?.color || "#6B7280";
  const getDeptName = (id: string | null) => departments.find((d) => d.id === id)?.name || "—";

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const buildTree = useMemo(() => {
    const ceo = employees.find((e) => e.level === 4);
    if (!ceo) return null;

    const build = (parent: Employee, depth: number): OrgNode => {
      const children = employees
        .filter((e) => e.manager_id === parent.id && e.id !== parent.id)
        .sort((a, b) => b.level - a.level)
        .map((child) => build(child, depth + 1));
      return { employee: parent, children, isExpanded: expandedIds.has(parent.id), depth };
    };
    return build(ceo, 0);
  }, [employees, expandedIds]);

  const getDirectReports = (id: string) => employees.filter((e) => e.manager_id === id).length;

  const renderNode = (node: OrgNode) => {
    const emp = node.employee;
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(emp.id);
    const isHovered = hoveredId === emp.id;

    return (
      <div key={emp.id} className="flex flex-col items-center">
        {/* Node */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
          onMouseEnter={() => setHoveredId(emp.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <div
            className={cn(
              "relative flex flex-col items-center rounded-xl border-2 bg-[var(--bg-surface)] p-3 transition-all cursor-pointer min-w-[140px]",
              isHovered ? "shadow-lg scale-105" : "shadow-sm",
            )}
            style={{
              borderColor: isHovered ? getDeptColor(emp.department_id) : "var(--border)",
            }}
            onClick={() => hasChildren && toggle(emp.id)}
          >
            {/* Avatar */}
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white mb-2"
              style={{ backgroundColor: getDeptColor(emp.department_id) }}
            >
              {emp.first_name.charAt(0)}{emp.last_name.charAt(0)}
            </div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)] text-center leading-tight">{emp.full_name}</p>
            <p className="text-[9px] text-[var(--text-muted)] text-center mt-0.5">{emp.position}</p>
            <span
              className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-medium"
              style={{ backgroundColor: `${getDeptColor(emp.department_id)}15`, color: getDeptColor(emp.department_id) }}
            >
              {getDeptName(emp.department_id)}
            </span>

            {/* Expand/Collapse indicator */}
            {hasChildren && (
              <div
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] z-10"
              >
                {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </div>
            )}
          </div>

          {/* Hover Popover */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                className="absolute left-1/2 -translate-x-1/2 top-full mt-6 z-50 w-52 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-xl"
              >
                <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-[var(--border)] bg-[var(--bg-elevated)]" />
                <div className="relative space-y-2">
                  <div className="flex items-center gap-2">
                    <Users size={11} className="text-[var(--text-muted)]" />
                    <span className="text-[10px] text-[var(--text-muted)]">{getDirectReports(emp.id)} reportes directos</span>
                  </div>
                  {emp.email && (
                    <p className="text-[10px] text-[var(--text-secondary)] truncate">{emp.email}</p>
                  )}
                  {emp.manager && (
                    <div className="pt-1 border-t border-[var(--border)]">
                      <p className="text-[9px] text-[var(--text-muted)]">Reporta a</p>
                      <p className="text-[10px] text-[var(--text-primary)] font-medium">{emp.manager.full_name}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Children connector */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col items-center mt-5">
            <div className="w-px h-4 bg-[var(--border)]" />
            <div className="flex items-start gap-6">
              {node.children.length > 1 && (
                <div className="absolute h-px bg-[var(--border)]" style={{
                  width: `calc(100% - 140px)`,
                  top: 0,
                }} />
              )}
              {node.children.map((child, i) => (
                <div key={child.employee.id} className="flex flex-col items-center">
                  <div className="w-px h-4 bg-[var(--border)]" />
                  {renderNode(child)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.1, 1.5))}
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] text-[var(--text-muted)] ml-2">{Math.round(zoom * 100)}%</span>
        </div>
        <button
          onClick={() => {
            const allIds = employees.filter((e) => e.level >= 1).map((e) => e.id);
            setExpandedIds(new Set(allIds));
          }}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
        >
          <Maximize2 size={12} />
          Expandir todo
        </button>
      </div>

      {/* Org Chart */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 overflow-auto min-h-[500px]">
        <div
          className="flex justify-center"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.3s ease" }}
        >
          {buildTree ? renderNode(buildTree) : (
            <p className="text-sm text-[var(--text-muted)]">No se encontró estructura organizacional</p>
          )}
        </div>
      </div>

      {/* Department Legend */}
      <div className="flex flex-wrap gap-3">
        {departments.map((d) => (
          <div key={d.id} className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            {d.name} ({d.headcount})
          </div>
        ))}
      </div>
    </div>
  );
}
