"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { GripVertical, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PurchaseRequisition, PRStatus } from "../types";
import { PR_STATUS_LABELS, PRIORITY_LABELS, PRIORITY_COLORS } from "../types";
import { updateRequisitionStatus } from "../actions/compras-actions";

type Props = { requisitions: PurchaseRequisition[] };

const COLUMNS: { id: PRStatus; label: string; color: string }[] = [
  { id: "draft", label: "Borrador", color: "#6B7280" },
  { id: "submitted", label: "Enviada", color: "#3B82F6" },
  { id: "approved", label: "Aprobada", color: "#10B981" },
  { id: "converted", label: "Convertida en OC", color: "#8B5CF6" },
];

export function RequisitionsTab({ requisitions }: Props) {
  const [items, setItems] = useState(requisitions);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<PRStatus | null>(null);

  const columns = useMemo(() => {
    const cols: Record<PRStatus, PurchaseRequisition[]> = {
      draft: [], submitted: [], approved: [], rejected: [], converted: [],
    };
    items.forEach((r) => { if (cols[r.status]) cols[r.status].push(r); });
    return cols;
  }, [items]);

  const handleDragStart = useCallback((id: string) => {
    setDragging(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: PRStatus) => {
    e.preventDefault();
    setDragOver(status);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: PRStatus) => {
    e.preventDefault();
    if (!dragging) return;

    setItems((prev) => prev.map((r) => r.id === dragging ? { ...r, status: newStatus } : r));
    setDragging(null);
    setDragOver(null);

    await updateRequisitionStatus(dragging, newStatus);
  }, [dragging]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)]">Arrastra las solicitudes entre columnas para cambiar su estado</p>
        <span className="text-[10px] text-[var(--text-muted)]">{items.length} solicitudes</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, col.id)}
            className={cn(
              "min-h-[400px] rounded-xl border-2 border-dashed p-3 transition-all",
              dragOver === col.id
                ? "border-orange-500 bg-orange-500/5"
                : "border-[var(--border)] bg-[var(--bg-surface)]/50"
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                <span className="text-xs font-semibold text-[var(--text-primary)]">{col.label}</span>
              </div>
              <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                {columns[col.id]?.length || 0}
              </span>
            </div>

            <div className="space-y-2">
              {(columns[col.id] || []).map((pr, i) => (
                <motion.div
                  key={pr.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  draggable
                  onDragStart={() => handleDragStart(pr.id)}
                  className={cn(
                    "cursor-grab rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition-all active:cursor-grabbing hover:shadow-md",
                    dragging === pr.id && "opacity-50 scale-95"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical size={12} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-semibold text-orange-500">{pr.pr_number}</span>
                        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                          style={{ color: PRIORITY_COLORS[pr.priority], backgroundColor: `${PRIORITY_COLORS[pr.priority]}15` }}>
                          {PRIORITY_LABELS[pr.priority]}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-[var(--text-primary)] line-clamp-2">{pr.description}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[9px] text-[var(--text-muted)]">{pr.department}</span>
                        {pr.estimated_amount && (
                          <span className="text-[10px] font-semibold text-[var(--text-primary)]">
                            ${Number(pr.estimated_amount).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <div className="h-4 w-4 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-[7px] font-bold text-[var(--text-muted)]">
                          {pr.requester?.full_name?.charAt(0) || "?"}
                        </div>
                        <span className="text-[8px] text-[var(--text-muted)] truncate">
                          {pr.requester?.full_name || "Usuario"}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
