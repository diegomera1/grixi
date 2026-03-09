"use client";

import { motion } from "framer-motion";
import { PackageCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import type { GoodsReceipt } from "../types";

type Props = { receipts: GoodsReceipt[] };

export function ReceiptsTab({ receipts }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)]">{receipts.length} recepciones registradas</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/50">
              <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]"># Recepción</th>
              <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]">OC</th>
              <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]">Proveedor</th>
              <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]">Fecha</th>
              <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]">Estado</th>
              <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]">Calidad</th>
              <th className="px-4 py-2.5 font-semibold text-[var(--text-muted)]">Recibió</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((gr, i) => {
              const po = gr.purchase_order as unknown as { po_number: string; vendor?: { name: string; code: string } } | undefined;
              return (
                <motion.tr
                  key={gr.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-[var(--border)] transition-colors hover:bg-[var(--bg-muted)]/50"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-emerald-500">{gr.receipt_number}</td>
                  <td className="px-4 py-3 font-mono text-orange-500">{po?.po_number || "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)]">{po?.vendor?.name || "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {new Date(gr.receipt_date).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      gr.status === "accepted" ? "bg-emerald-500/15 text-emerald-500" :
                      gr.status === "partial" ? "bg-amber-500/15 text-amber-500" :
                      gr.status === "rejected" ? "bg-red-500/15 text-red-500" :
                      "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                    }`}>
                      {gr.status === "accepted" && <CheckCircle2 size={10} />}
                      {gr.status === "partial" && <AlertTriangle size={10} />}
                      {gr.status === "accepted" ? "Aceptada" : gr.status === "partial" ? "Parcial" : gr.status === "rejected" ? "Rechazada" : gr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {gr.quality_check ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500"><CheckCircle2 size={10} />Verificado</span>
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{gr.receiver?.full_name || "—"}</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
