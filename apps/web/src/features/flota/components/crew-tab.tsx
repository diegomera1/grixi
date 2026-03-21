"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, X, FileCheck, AlertTriangle, CheckCircle2,
  Clock, Shield, GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CrewMember } from "../types";
import { CREW_ROLE_LABELS } from "../types";

type CrewCompetency = {
  id: string;
  competency_name: string;
  cert_code: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  issuing_authority: string | null;
  status: "valid" | "expiring" | "expired" | "pending";
};

type TrainingRecord = {
  id: string;
  training_type: string;
  title: string;
  completed_at: string | null;
  score: number | null;
  status: string;
};

function getDocStatus(expiryDate: string | null): { label: string; color: string; icon: typeof CheckCircle2 } {
  if (!expiryDate) return { label: "Sin fecha", color: "#6B7280", icon: Clock };
  const now = new Date();
  const exp = new Date(expiryDate);
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return { label: `Caducado (${Math.abs(diffDays)}d)`, color: "#EF4444", icon: AlertTriangle };
  if (diffDays < 30) return { label: `Vence en ${diffDays}d`, color: "#F59E0B", icon: Clock };
  return { label: "Vigente", color: "#10B981", icon: CheckCircle2 };
}

export function CrewTab({ crew }: { crew: CrewMember[] }) {
  const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null);
  const [competencies, setCompetencies] = useState<CrewCompetency[]>([]);
  const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Load competencies + trainings when a member is selected
  useEffect(() => {
    if (!selectedMember) return;
    setLoading(true);
    const supabase = createClient();
    Promise.all([
      supabase.from("fleet_crew_competencies").select("*").eq("crew_id", selectedMember.id),
      supabase.from("fleet_training_records").select("*").eq("crew_id", selectedMember.id),
    ]).then(([compRes, trainRes]) => {
      setCompetencies((compRes.data || []) as CrewCompetency[]);
      setTrainings((trainRes.data || []) as TrainingRecord[]);
      setLoading(false);
    });
  }, [selectedMember]);

  const validDocs = competencies.filter((c) => {
    const s = getDocStatus(c.expiry_date);
    return s.color === "#10B981";
  }).length;
  const docProgress = competencies.length > 0 ? Math.round((validDocs / competencies.length) * 100) : 0;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {crew.map((member, i) => (
          <motion.button
            key={member.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setSelectedMember(member)}
            className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-left transition-all hover:border-[#0EA5E9]/50 hover:shadow-md group"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#0EA5E9]" />
            <div className="flex items-center gap-3 pt-1">
              {member.employee?.avatar_url ? (
                <img src={member.employee.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-[var(--border)]" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0EA5E9]/10 text-[#0EA5E9] text-xs font-bold">
                  {(member.employee?.full_name || member.role).slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-[#0EA5E9] transition-colors">{member.employee?.full_name || member.role}</p>
                <p className="text-[10px] text-[#0EA5E9] font-medium">{member.rank || CREW_ROLE_LABELS[member.role] || member.role}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Certificaciones</p>
              <div className="flex flex-wrap gap-1">
                {(member.certifications || []).slice(0, 3).map((cert) => (
                  <span key={cert} className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 text-[8px] font-medium text-[var(--text-secondary)]">
                    {cert}
                  </span>
                ))}
                {(member.certifications || []).length > 3 && (
                  <span className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 text-[8px] font-medium text-[var(--text-muted)]">
                    +{member.certifications.length - 3}
                  </span>
                )}
              </div>
            </div>
            {member.boarding_date && (
              <p className="mt-2 text-[9px] text-[var(--text-muted)]">
                A bordo desde {new Date(member.boarding_date).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <FileCheck size={14} className="text-[#0EA5E9]" />
            </div>
          </motion.button>
        ))}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedMember && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMember(null)}
              className="fixed inset-0 bg-black/30 z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-lg z-50 bg-[var(--bg-primary)] border-l border-[var(--border)] overflow-y-auto shadow-2xl"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Users size={16} className="text-[#0EA5E9]" />
                    Perfil de Tripulante
                  </h2>
                  <button onClick={() => setSelectedMember(null)} className="rounded-lg p-1.5 hover:bg-[var(--bg-muted)] transition-colors">
                    <X size={16} className="text-[var(--text-muted)]" />
                  </button>
                </div>

                {/* Profile */}
                <div className="flex items-center gap-4 mb-6">
                  {selectedMember.employee?.avatar_url ? (
                    <img src={selectedMember.employee.avatar_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#0EA5E9]/10 text-[#0EA5E9] text-lg font-bold">
                      {(selectedMember.employee?.full_name || selectedMember.role).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                      {selectedMember.employee?.full_name || selectedMember.role}
                    </h3>
                    <p className="text-xs text-[#0EA5E9] font-medium">
                      {selectedMember.rank || CREW_ROLE_LABELS[selectedMember.role] || selectedMember.role}
                    </p>
                    {selectedMember.boarding_date && (
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        A bordo desde {new Date(selectedMember.boarding_date).toLocaleDateString("es-EC")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Doc Progress Bar */}
                {competencies.length > 0 && (
                  <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Documentación Completa</span>
                      <span className="text-xs font-bold" style={{ color: docProgress === 100 ? "#10B981" : docProgress > 50 ? "#F59E0B" : "#EF4444" }}>
                        {docProgress}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${docProgress}%` }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: docProgress === 100 ? "#10B981" : docProgress > 50 ? "#F59E0B" : "#EF4444" }}
                      />
                    </div>
                    <p className="text-[9px] text-[var(--text-muted)] mt-1">{validDocs} de {competencies.length} documentos vigentes</p>
                  </div>
                )}

                {/* Competencies */}
                <div className="mb-6">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] mb-3">
                    <Shield size={14} className="text-[#0EA5E9]" />
                    Certificaciones STCW
                  </h4>
                  {loading ? (
                    <div className="animate-pulse space-y-2">
                      {[1, 2, 3].map((n) => <div key={n} className="h-12 rounded-lg bg-[var(--bg-muted)]" />)}
                    </div>
                  ) : competencies.length > 0 ? (
                    <div className="space-y-2">
                      {competencies.map((comp) => {
                        const status = getDocStatus(comp.expiry_date);
                        const StatusIcon = status.icon;
                        return (
                          <div key={comp.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                            <div>
                              <p className="text-xs font-medium text-[var(--text-primary)]">{comp.competency_name}</p>
                              <div className="flex items-center gap-2 text-[9px] text-[var(--text-muted)] mt-0.5">
                                {comp.cert_code && <span className="font-mono">{comp.cert_code}</span>}
                                {comp.issuing_authority && <span>· {comp.issuing_authority}</span>}
                                {comp.expiry_date && <span>· Vence: {new Date(comp.expiry_date).toLocaleDateString("es-EC")}</span>}
                              </div>
                            </div>
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold shrink-0"
                              style={{ backgroundColor: `${status.color}15`, color: status.color }}
                            >
                              <StatusIcon size={9} />
                              {status.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] py-4 text-center">Sin certificaciones registradas</p>
                  )}
                </div>

                {/* Trainings */}
                <div>
                  <h4 className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] mb-3">
                    <GraduationCap size={14} className="text-purple-500" />
                    Capacitaciones
                  </h4>
                  {trainings.length > 0 ? (
                    <div className="space-y-2">
                      {trainings.map((tr) => (
                        <div key={tr.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                          <div>
                            <p className="text-xs font-medium text-[var(--text-primary)]">{tr.title}</p>
                            <p className="text-[9px] text-[var(--text-muted)]">{tr.training_type} {tr.completed_at && `· ${new Date(tr.completed_at).toLocaleDateString("es-EC")}`}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${
                            tr.status === "completed" ? "bg-emerald-500/10 text-emerald-600" :
                            tr.status === "failed" ? "bg-red-500/10 text-red-500" :
                            "bg-amber-500/10 text-amber-600"
                          }`}>
                            {tr.status === "completed" ? "✅ Completado" : tr.status === "failed" ? "❌ Falló" : "⏳ Pendiente"}
                            {tr.score !== null && ` (${tr.score}%)`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] py-4 text-center">Sin capacitaciones registradas</p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
