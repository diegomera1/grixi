"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { WorkOrder, Equipment, CrewMember } from "../types";
import {
  WO_STATUS_LABELS, WO_STATUS_COLORS,
  WO_PRIORITY_LABELS, WO_PRIORITY_COLORS,
} from "../types";
import { WorkOrderForm } from "./work-order-form";

export function WorkOrdersTab({ workOrders, equipment, crew }: { workOrders: WorkOrder[]; equipment: Equipment[]; crew?: CrewMember[] }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);

  const filtered = workOrders.filter((wo) => statusFilter === "all" || wo.status === statusFilter);
  const statusCounts = {
    all: workOrders.length,
    planned: workOrders.filter((w) => w.status === "planned").length,
    in_progress: workOrders.filter((w) => w.status === "in_progress").length,
    completed: workOrders.filter((w) => w.status === "completed").length,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "planned", "in_progress", "completed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-full px-3 py-1 text-[10px] font-medium transition-all",
                statusFilter === s ? "bg-[#0EA5E9] text-white" : "bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {s === "all" ? "Todas" : WO_STATUS_LABELS[s]} ({statusCounts[s]})
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#0EA5E9] px-3 py-1.5 text-[10px] font-bold text-white shadow-lg shadow-[#0EA5E9]/20 hover:bg-[#0EA5E9]/90 transition-all"
        >
          <Plus size={12} />
          Nueva OT
        </button>
      </div>

      <div className="space-y-2">
        {filtered.map((wo, i) => {
          const eq = equipment.find((e) => e.id === wo.equipment_id);
          return (
            <motion.div
              key={wo.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] font-bold text-[#0EA5E9]">{wo.wo_number}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                      style={{ backgroundColor: `${WO_PRIORITY_COLORS[wo.priority]}15`, color: WO_PRIORITY_COLORS[wo.priority] }}>
                      {WO_PRIORITY_LABELS[wo.priority]}
                    </span>
                    {eq && <span className="text-[10px] text-[var(--text-muted)]">· {eq.code} {eq.name}</span>}
                    {wo.created_offline && (
                      <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[7px] font-bold text-amber-500">OFFLINE</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{wo.title}</p>
                  {wo.description && (
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)] line-clamp-2">{wo.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-[var(--text-muted)]">
                    {wo.hours_estimated > 0 && <span>⏱ {wo.hours_estimated}h estimadas</span>}
                    {wo.cost_estimated > 0 && <span>💰 ${wo.cost_estimated.toLocaleString()}</span>}
                    {wo.planned_start && (
                      <span>📅 {new Date(wo.planned_start).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}</span>
                    )}
                    {wo.assignee && (
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 rounded-full bg-[#0EA5E9]/20 text-[7px] text-[#0EA5E9] flex items-center justify-center font-bold">
                          {wo.assignee.full_name.slice(0, 1)}
                        </span>
                        {wo.assignee.full_name}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
                  style={{ backgroundColor: `${WO_STATUS_COLORS[wo.status]}15`, color: WO_STATUS_COLORS[wo.status] }}>
                  {WO_STATUS_LABELS[wo.status]}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Work Order Form Modal */}
      <AnimatePresence>
        {showForm && (
          <WorkOrderForm
            equipment={equipment}
            crew={crew}
            onClose={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
