"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Equipment } from "../types";

export function LogisticsTab({ equipment }: { equipment: Equipment[] }) {
  const allBOM = equipment.flatMap((eq) =>
    (eq.bom_items || []).map((item) => ({ ...item, equipmentCode: eq.code, equipmentName: eq.name }))
  );
  const criticalLow = allBOM.filter((b) => b.critical && b.quantity_onboard < b.quantity_required);

  return (
    <div className="space-y-4">
      {/* Critical Low Stock Alert */}
      {criticalLow.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-red-500">
            <AlertTriangle size={14} />
            Repuestos Críticos Bajo Stock ({criticalLow.length})
          </h3>
          <div className="space-y-1.5">
            {criticalLow.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] p-2.5">
                <div>
                  <p className="text-xs font-medium text-[var(--text-primary)]">{item.description}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{item.part_number} · {item.equipmentCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-500">{item.quantity_onboard}/{item.quantity_required}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">{item.lead_time_days}d lead time</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full BOM Table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/50">
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)]">Part #</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)]">Descripción</th>
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)] hidden md:table-cell">Equipo</th>
                <th className="px-4 py-2.5 text-center font-semibold text-[var(--text-muted)]">Stock</th>
                <th className="px-4 py-2.5 text-center font-semibold text-[var(--text-muted)] hidden sm:table-cell">Req.</th>
                <th className="px-4 py-2.5 text-center font-semibold text-[var(--text-muted)] hidden lg:table-cell">Lead Time</th>
              </tr>
            </thead>
            <tbody>
              {allBOM.map((item) => {
                const isLow = item.quantity_onboard < item.quantity_required;
                return (
                  <tr key={item.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-muted)]/20">
                    <td className="px-4 py-2 font-mono text-[#0EA5E9]">{item.part_number}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        {item.critical && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                        <span className="text-[var(--text-primary)]">{item.description}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-[var(--text-muted)] hidden md:table-cell">{item.equipmentCode}</td>
                    <td className={cn("px-4 py-2 text-center font-bold", isLow ? "text-red-500" : "text-[var(--text-primary)]")}>
                      {item.quantity_onboard}
                    </td>
                    <td className="px-4 py-2 text-center text-[var(--text-muted)] hidden sm:table-cell">{item.quantity_required}</td>
                    <td className="px-4 py-2 text-center text-[var(--text-muted)] hidden lg:table-cell">{item.lead_time_days}d</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
