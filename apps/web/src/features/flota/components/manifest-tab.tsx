"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  ClipboardCheck, UserPlus, LogOut, Search, AlertTriangle,
  CheckCircle2, Clock, Shield, XCircle,
} from "lucide-react";
import { registerBoarding, registerDisembarking } from "../actions/manifest-actions";
import type { CrewMember } from "../types";

type ManifestEntry = {
  id: string;
  vessel_id: string;
  person_name: string;
  document_id: string;
  role: string;
  crew_id: string | null;
  boarding_time: string;
  disembarking_time: string | null;
  authorized_by: string | null;
  doc_validation_status: "valid" | "expired_docs" | "pending" | "not_checked";
  doc_warnings: string[] | null;
  notes: string | null;
  created_at: string;
};

type ManifestTabProps = {
  vesselId: string;
  manifest: ManifestEntry[];
  crew: CrewMember[];
};

const STATUS_CONFIG = {
  valid: { label: "Documentos OK", icon: CheckCircle2, color: "#10B981", bg: "rgba(16,185,129,0.1)" },
  expired_docs: { label: "Docs Caducados", icon: XCircle, color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
  pending: { label: "Pendiente", icon: Clock, color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  not_checked: { label: "No Verificado", icon: Shield, color: "#6B7280", bg: "rgba(107,114,128,0.1)" },
};

export function ManifestTab({ vesselId, manifest, crew }: ManifestTabProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [selectedCrewId, setSelectedCrewId] = useState("");
  const [personName, setPersonName] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);

  const onboard = manifest.filter((m) => !m.disembarking_time);
  const history = manifest.filter((m) => !!m.disembarking_time);

  // Auto-fill from crew selection
  const handleCrewSelect = (crewId: string) => {
    setSelectedCrewId(crewId);
    const member = crew.find((c) => c.id === crewId);
    if (member) {
      setPersonName(member.employee?.full_name || member.role);
      setRole(member.rank || member.role);
      setDocumentId("");
    }
  };

  const handleSubmit = () => {
    if (!personName || !documentId || !role) return;
    startTransition(async () => {
      const result = await registerBoarding({
        vesselId,
        personName,
        documentId,
        role,
        crewId: selectedCrewId || undefined,
        notes: notes || undefined,
      });
      if (result.success) {
        if (result.docStatus === "expired_docs") {
          setMessage({ type: "warning", text: `⚠️ ${personName} tiene documentación caducada: ${result.docWarnings?.join(", ")}. Registrado con advertencia.` });
        } else {
          setMessage({ type: "success", text: `✅ ${personName} registrado a bordo correctamente.` });
        }
        setShowForm(false);
        setPersonName("");
        setDocumentId("");
        setRole("");
        setNotes("");
        setSelectedCrewId("");
      } else {
        setMessage({ type: "error", text: `Error: ${result.error}` });
      }
      setTimeout(() => setMessage(null), 8000);
    });
  };

  const handleDisembark = (entryId: string, name: string) => {
    startTransition(async () => {
      const result = await registerDisembarking(entryId);
      if (result.success) {
        setMessage({ type: "success", text: `${name} desembarcado correctamente.` });
      }
      setTimeout(() => setMessage(null), 5000);
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
          <ClipboardCheck size={16} className="text-[#0EA5E9]" />
          Manifiesto del Buque
          <span className="rounded-full bg-[#0EA5E9]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#0EA5E9]">
            {onboard.length} a bordo
          </span>
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-[#0EA5E9] px-4 py-2 text-xs font-medium text-white transition-all hover:bg-[#0EA5E9]/90"
        >
          <UserPlus size={14} />
          Registrar Ingreso
        </button>
      </div>

      {/* Message */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-lg border px-4 py-3 text-xs font-medium ${
            message.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" :
            message.type === "warning" ? "border-amber-500/20 bg-amber-500/10 text-amber-600" :
            "border-red-500/20 bg-red-500/10 text-red-600"
          }`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Registration Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl border border-[#0EA5E9]/30 bg-[#0EA5E9]/5 p-5"
        >
          <h3 className="text-xs font-bold text-[var(--text-primary)] mb-4">Nuevo Registro de Ingreso</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Crew selector */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Tripulante (opcional)</label>
              <select
                value={selectedCrewId}
                onChange={(e) => handleCrewSelect(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
              >
                <option value="">— Persona externa —</option>
                {crew.map((c) => (
                  <option key={c.id} value={c.id}>{c.employee?.full_name || c.role} ({c.rank})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Nombre completo *</label>
              <input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Nombre y apellido"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Documento ID *</label>
              <input
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Cédula / Pasaporte"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Rol / Cargo *</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Capitán, Maquinista, Visitante..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Notas</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivo de ingreso, observaciones..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || !personName || !documentId || !role}
              className="flex items-center gap-2 rounded-lg bg-[#0EA5E9] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              <Shield size={12} />
              {isPending ? "Validando docs..." : "Registrar y Validar"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Currently Onboard */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Actualmente a Bordo ({onboard.length})</h3>
        <div className="space-y-2">
          {onboard.map((entry, i) => {
            const status = STATUS_CONFIG[entry.doc_validation_status] || STATUS_CONFIG.not_checked;
            const StatusIcon = status.icon;
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold"
                    style={{ backgroundColor: status.bg, color: status.color }}
                  >
                    {entry.person_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{entry.person_name}</p>
                    <div className="flex items-center gap-2 text-[9px] text-[var(--text-muted)]">
                      <span>{entry.role}</span>
                      <span>·</span>
                      <span>Doc: {entry.document_id}</span>
                      <span>·</span>
                      <span>{new Date(entry.boarding_time).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    {entry.doc_validation_status === "expired_docs" && entry.doc_warnings?.length && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertTriangle size={10} className="text-red-500" />
                        <span className="text-[9px] font-medium text-red-500">
                          Docs caducados: {entry.doc_warnings.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold"
                    style={{ backgroundColor: status.bg, color: status.color }}
                  >
                    <StatusIcon size={9} />
                    {status.label}
                  </span>
                  <button
                    onClick={() => handleDisembark(entry.id, entry.person_name)}
                    disabled={isPending}
                    className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:border-red-500/30 transition-colors disabled:opacity-50"
                    title="Registrar desembarque"
                  >
                    <LogOut size={12} />
                  </button>
                </div>
              </motion.div>
            );
          })}
          {onboard.length === 0 && (
            <div className="flex flex-col items-center py-8 rounded-xl border border-dashed border-[var(--border)]">
              <ClipboardCheck size={24} className="text-[var(--text-muted)] mb-2" />
              <p className="text-xs text-[var(--text-muted)]">Nadie registrado a bordo</p>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Historial Reciente</h3>
          <div className="space-y-1">
            {history.slice(0, 20).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)]/30 px-3 py-2 text-[10px]">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <span className="font-medium">{entry.person_name}</span>
                  <span className="text-[var(--text-muted)]">({entry.role})</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <span>
                    {new Date(entry.boarding_time).toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}
                    {" "}
                    {new Date(entry.boarding_time).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
                    {" → "}
                    {entry.disembarking_time && new Date(entry.disembarking_time).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
