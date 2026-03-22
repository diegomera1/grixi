"use client";

import { useState, useTransition, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  ClipboardCheck, UserPlus, LogOut, Search, AlertTriangle,
  CheckCircle2, Clock, Shield, XCircle, Users, History,
  ChevronDown, Anchor, CalendarDays, Filter,
} from "lucide-react";
import { registerBoarding, registerDisembarking } from "../actions/manifest-actions";
import type { CrewMember } from "../types";
import { CREW_ROLE_LABELS } from "../types";

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
  valid: { label: "Docs OK", icon: CheckCircle2, color: "#10B981", bg: "rgba(16,185,129,0.1)" },
  expired_docs: { label: "Caducado", icon: XCircle, color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
  pending: { label: "Pendiente", icon: Clock, color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  not_checked: { label: "No Verificado", icon: Shield, color: "#6B7280", bg: "rgba(107,114,128,0.1)" },
};

function timeAgo(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "Ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatDateTime(date: string) {
  const d = new Date(date);
  return {
    date: d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
  };
}

function getCrewAvatar(crewId: string | null, crew: CrewMember[]): string | null {
  if (!crewId) return null;
  const member = crew.find((c) => c.id === crewId);
  return member?.employee?.avatar_url || null;
}

function getCrewInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function ManifestTab({ vesselId, manifest, crew }: ManifestTabProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [selectedCrewId, setSelectedCrewId] = useState("");
  const [personName, setPersonName] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [crewSearch, setCrewSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "crew" | "visitors">("all");
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);

  const onboard = manifest.filter((m) => !m.disembarking_time);
  const history = manifest.filter((m) => !!m.disembarking_time);

  const filteredHistory = useMemo(() => {
    if (historyFilter === "crew") return history.filter((h) => h.crew_id);
    if (historyFilter === "visitors") return history.filter((h) => !h.crew_id);
    return history;
  }, [history, historyFilter]);

  // Group history by date
  const groupedHistory = useMemo(() => {
    const groups: Record<string, ManifestEntry[]> = {};
    filteredHistory.forEach((entry) => {
      const date = new Date(entry.boarding_time).toLocaleDateString("es-EC", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
      if (!groups[date]) groups[date] = [];
      groups[date].push(entry);
    });
    return groups;
  }, [filteredHistory]);

  // Filtered crew for the picker
  const filteredCrew = useMemo(() => {
    const onboardCrewIds = new Set(onboard.filter((m) => m.crew_id).map((m) => m.crew_id));
    return crew.filter((c) => {
      if (onboardCrewIds.has(c.id)) return false; // Already onboard
      if (!crewSearch) return true;
      const name = c.employee?.full_name || c.role;
      return name.toLowerCase().includes(crewSearch.toLowerCase()) || (c.rank || "").toLowerCase().includes(crewSearch.toLowerCase());
    });
  }, [crew, crewSearch, onboard]);

  const handleCrewSelect = (member: CrewMember) => {
    setSelectedCrewId(member.id);
    setPersonName(member.employee?.full_name || member.role);
    setRole(CREW_ROLE_LABELS[member.role] || member.rank || member.role);
    setDocumentId("");
    setShowForm(true);
    setCrewSearch("");
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
          setMessage({ type: "warning", text: `⚠️ ${personName} registrado con documentación caducada: ${result.docWarnings?.join(", ")}` });
        } else {
          setMessage({ type: "success", text: `✅ ${personName} registrado a bordo correctamente.` });
        }
        resetForm();
      } else {
        setMessage({ type: "error", text: `Error: ${result.error}` });
      }
      setTimeout(() => setMessage(null), 8000);
    });
  };

  const resetForm = () => {
    setShowForm(false);
    setPersonName("");
    setDocumentId("");
    setRole("");
    setNotes("");
    setSelectedCrewId("");
    setCrewSearch("");
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
    <div className="space-y-5">
      {/* ── Header Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-lg bg-[#0EA5E9]/10 p-1.5"><Users size={14} className="text-[#0EA5E9]" /></div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">A Bordo</span>
          </div>
          <p className="text-2xl font-bold text-[#0EA5E9]">{onboard.length}</p>
          <p className="text-[9px] text-[var(--text-muted)]">{onboard.filter((o) => o.crew_id).length} tripulación · {onboard.filter((o) => !o.crew_id).length} visitantes</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-lg bg-emerald-500/10 p-1.5"><CheckCircle2 size={14} className="text-emerald-500" /></div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Docs Válidos</span>
          </div>
          <p className="text-2xl font-bold text-emerald-500">{onboard.filter((o) => o.doc_validation_status === "valid").length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-lg bg-red-500/10 p-1.5"><AlertTriangle size={14} className="text-red-500" /></div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Alertas</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{onboard.filter((o) => o.doc_validation_status === "expired_docs").length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-lg bg-amber-500/10 p-1.5"><History size={14} className="text-amber-500" /></div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Registros</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{manifest.length}</p>
          <p className="text-[9px] text-[var(--text-muted)]">{history.length} históricos</p>
        </div>
      </div>

      {/* ── Message ── */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`rounded-lg border px-4 py-3 text-xs font-medium ${
              message.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" :
              message.type === "warning" ? "border-amber-500/20 bg-amber-500/10 text-amber-600" :
              "border-red-500/20 bg-red-500/10 text-red-600"
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Onboard Section ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <Anchor size={14} className="text-[#0EA5E9]" />
            Actualmente a Bordo
          </h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-[#0EA5E9] px-4 py-2 text-[11px] font-medium text-white transition-all hover:bg-[#0EA5E9]/90 shadow-sm"
          >
            <UserPlus size={13} />
            Registrar Ingreso
          </button>
        </div>

        {/* Registration Form with Crew Picker */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="rounded-xl border border-[#0EA5E9]/20 bg-[#0EA5E9]/5 p-5">
                <h4 className="text-xs font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <UserPlus size={14} className="text-[#0EA5E9]" />
                  Nuevo Registro de Ingreso
                </h4>

                {/* Crew Quick Picker */}
                {!selectedCrewId && (
                  <div className="mb-4">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 block">
                      Seleccionar Tripulante
                    </label>
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        value={crewSearch}
                        onChange={(e) => setCrewSearch(e.target.value)}
                        placeholder="Buscar por nombre o cargo..."
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 max-h-[200px] overflow-y-auto pr-1">
                      {filteredCrew.map((member) => (
                        <button
                          key={member.id}
                          onClick={() => handleCrewSelect(member)}
                          className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-left hover:border-[#0EA5E9]/40 hover:bg-[#0EA5E9]/5 transition-all group"
                        >
                          <div className="relative h-9 w-9 rounded-full overflow-hidden shrink-0 border-2 border-[var(--border)] group-hover:border-[#0EA5E9]/50 transition-colors">
                            {member.employee?.avatar_url ? (
                              <Image
                                src={member.employee.avatar_url}
                                alt={member.employee.full_name}
                                fill
                                className="object-cover"
                                sizes="36px"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-[#0EA5E9]/10 text-[10px] font-bold text-[#0EA5E9]">
                                {getCrewInitials(member.employee?.full_name || member.role)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
                              {member.employee?.full_name || member.role}
                            </p>
                            <p className="text-[9px] text-[var(--text-muted)] truncate">
                              {CREW_ROLE_LABELS[member.role] || member.rank}
                            </p>
                          </div>
                        </button>
                      ))}
                      {/* External visitor */}
                      <button
                        onClick={() => { setSelectedCrewId(""); setShowForm(true); }}
                        className="flex items-center gap-2.5 rounded-lg border border-dashed border-[var(--border)] p-2.5 text-left hover:border-amber-500/40 hover:bg-amber-500/5 transition-all"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 shrink-0">
                          <UserPlus size={14} className="text-amber-500" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-[var(--text-primary)]">Persona Externa</p>
                          <p className="text-[9px] text-[var(--text-muted)]">Visitante, inspector...</p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Manual form fields */}
                {(selectedCrewId || !filteredCrew.length) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {selectedCrewId && (
                      <div className="sm:col-span-2 flex items-center gap-3 rounded-lg bg-[#0EA5E9]/10 border border-[#0EA5E9]/20 p-3 mb-1">
                        {(() => {
                          const member = crew.find((c) => c.id === selectedCrewId);
                          return (
                            <>
                              <div className="relative h-10 w-10 rounded-full overflow-hidden shrink-0 border-2 border-[#0EA5E9]/30">
                                {member?.employee?.avatar_url ? (
                                  <Image src={member.employee.avatar_url} alt={personName} fill className="object-cover" sizes="40px" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-[#0EA5E9]/20 text-[11px] font-bold text-[#0EA5E9]">
                                    {getCrewInitials(personName)}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-bold text-[#0EA5E9]">{personName}</p>
                                <p className="text-[10px] text-[var(--text-muted)]">{role}</p>
                              </div>
                              <button onClick={resetForm} className="text-[9px] text-[var(--text-muted)] hover:text-red-500 transition-colors">
                                Cambiar ✕
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {!selectedCrewId && (
                      <>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Nombre *</label>
                          <input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Nombre completo"
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Rol / Cargo *</label>
                          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Visitante, Inspector..."
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Documento ID *</label>
                      <input value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="Cédula / Pasaporte"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Notas</label>
                      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Motivo, observaciones..."
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                      <button onClick={resetForm} className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        Cancelar
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={isPending || !personName || !documentId || !role}
                        className="flex items-center gap-2 rounded-lg bg-[#0EA5E9] px-5 py-2 text-xs font-medium text-white disabled:opacity-50 transition-all hover:bg-[#0EA5E9]/90"
                      >
                        <Shield size={12} />
                        {isPending ? "Validando..." : "Registrar y Validar Docs"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Onboard Crew Cards */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {onboard.map((entry, i) => {
            const status = STATUS_CONFIG[entry.doc_validation_status] || STATUS_CONFIG.not_checked;
            const StatusIcon = status.icon;
            const avatarUrl = getCrewAvatar(entry.crew_id, crew);
            const boarding = formatDateTime(entry.boarding_time);

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3.5 hover:border-[#0EA5E9]/30 transition-colors group relative"
              >
                {/* Doc status indicator */}
                <div className="absolute top-2.5 right-2.5">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold"
                    style={{ backgroundColor: status.bg, color: status.color }}
                  >
                    <StatusIcon size={9} />
                    {status.label}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative h-12 w-12 rounded-full overflow-hidden shrink-0 border-2 transition-colors"
                    style={{ borderColor: entry.crew_id ? `${status.color}40` : "var(--border)" }}
                  >
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt={entry.person_name} fill className="object-cover" sizes="48px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[13px] font-bold"
                        style={{ backgroundColor: status.bg, color: status.color }}
                      >
                        {getCrewInitials(entry.person_name)}
                      </div>
                    )}
                    {entry.crew_id && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#10B981] border-2 border-[var(--bg-surface)]" title="Tripulante registrado" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-[var(--text-primary)] truncate">{entry.person_name}</p>
                    <p className="text-[10px] font-medium text-[#0EA5E9]">{entry.role}</p>
                    <div className="flex items-center gap-2 text-[9px] text-[var(--text-muted)] mt-1">
                      <span>📋 {entry.document_id}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)] mt-0.5">
                      <Clock size={9} />
                      <span>Abordó {boarding.date} {boarding.time}</span>
                      <span className="text-[var(--text-muted)]/50">({timeAgo(entry.boarding_time)})</span>
                    </div>
                  </div>
                </div>

                {/* Warnings */}
                {entry.doc_validation_status === "expired_docs" && entry.doc_warnings?.length && (
                  <div className="flex items-center gap-1.5 mt-2.5 rounded-lg bg-red-500/5 border border-red-500/10 px-2.5 py-1.5">
                    <AlertTriangle size={10} className="text-red-500 shrink-0" />
                    <span className="text-[9px] font-medium text-red-500 truncate">
                      {entry.doc_warnings.join(", ")}
                    </span>
                  </div>
                )}

                {entry.notes && (
                  <p className="text-[9px] text-[var(--text-muted)] mt-2 italic truncate">📝 {entry.notes}</p>
                )}

                {/* Disembark action */}
                <button
                  onClick={() => handleDisembark(entry.id, entry.person_name)}
                  disabled={isPending}
                  className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] py-1.5 text-[9px] font-medium text-[var(--text-muted)] hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 transition-all disabled:opacity-50 opacity-0 group-hover:opacity-100"
                >
                  <LogOut size={10} />
                  Registrar Desembarque
                </button>
              </motion.div>
            );
          })}

          {onboard.length === 0 && (
            <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 flex flex-col items-center py-12 rounded-xl border border-dashed border-[var(--border)]">
              <ClipboardCheck size={28} className="text-[var(--text-muted)] mb-2" />
              <p className="text-sm text-[var(--text-muted)]">Nadie registrado a bordo</p>
              <p className="text-[10px] text-[var(--text-muted)]">Usa el botón &apos;Registrar Ingreso&apos; para añadir personal</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Historical Records ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <History size={14} className="text-amber-500" />
            Historial de Manifiestos
            <span className="text-[10px] font-normal text-[var(--text-muted)]">({filteredHistory.length} registros)</span>
          </h3>
          <div className="flex items-center gap-1">
            <Filter size={10} className="text-[var(--text-muted)]" />
            {(["all", "crew", "visitors"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setHistoryFilter(f)}
                className={`rounded-md px-2.5 py-1 text-[9px] font-bold transition-all ${
                  historyFilter === f
                    ? "bg-[#0EA5E9]/10 text-[#0EA5E9]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {f === "all" ? "Todos" : f === "crew" ? "Tripulación" : "Visitantes"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(groupedHistory).map(([date, entries]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={11} className="text-[var(--text-muted)]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{date}</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
              <div className="space-y-1.5">
                {entries.map((entry) => {
                  const status = STATUS_CONFIG[entry.doc_validation_status] || STATUS_CONFIG.not_checked;
                  const avatarUrl = getCrewAvatar(entry.crew_id, crew);
                  const boarding = formatDateTime(entry.boarding_time);
                  const disembarking = entry.disembarking_time ? formatDateTime(entry.disembarking_time) : null;
                  // Duration
                  const durMs = entry.disembarking_time ? new Date(entry.disembarking_time).getTime() - new Date(entry.boarding_time).getTime() : 0;
                  const durHrs = Math.floor(durMs / 3600000);
                  const durMins = Math.floor((durMs % 3600000) / 60000);

                  return (
                    <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 hover:bg-[var(--bg-muted)]/30 transition-colors">
                      {/* Avatar */}
                      <div className="relative h-8 w-8 rounded-full overflow-hidden shrink-0 border border-[var(--border)]">
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt={entry.person_name} fill className="object-cover" sizes="32px" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-amber-500/10 text-[9px] font-bold text-amber-500">
                            {getCrewInitials(entry.person_name)}
                          </div>
                        )}
                      </div>

                      {/* Name & Role */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{entry.person_name}</p>
                          {entry.crew_id && (
                            <span className="rounded bg-[#0EA5E9]/10 px-1.5 py-0 text-[7px] font-bold text-[#0EA5E9]">TRIPULANTE</span>
                          )}
                          {!entry.crew_id && (
                            <span className="rounded bg-amber-500/10 px-1.5 py-0 text-[7px] font-bold text-amber-500">VISITANTE</span>
                          )}
                        </div>
                        <p className="text-[9px] text-[var(--text-muted)]">{entry.role}</p>
                      </div>

                      {/* Time range */}
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                          {boarding.time} → {disembarking?.time || "—"}
                        </p>
                        <p className="text-[8px] text-[var(--text-muted)]">
                          {durHrs > 0 ? `${durHrs}h ${durMins}m` : `${durMins}m`}
                          {entry.authorized_by && ` · Auth: ${entry.authorized_by}`}
                        </p>
                      </div>

                      {/* Status dot */}
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: status.color }} title={status.label} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredHistory.length === 0 && (
            <div className="flex flex-col items-center py-8 text-[var(--text-muted)]">
              <History size={20} className="mb-2" />
              <p className="text-xs">Sin registros históricos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
