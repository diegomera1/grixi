"use client";

import { motion } from "framer-motion";
import { FileText, Shield, AlertTriangle, Clock } from "lucide-react";
import type { FleetCertificate } from "../types";

const CERT_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: "#10B981", bg: "rgba(16,185,129,0.1)", label: "Vigente" },
  expiring_soon: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", label: "Por Vencer" },
  expired: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", label: "Vencido" },
  suspended: { color: "#6B7280", bg: "rgba(107,114,128,0.1)", label: "Suspendido" },
};

const CERT_TYPE_NAMES: Record<string, string> = {
  class: "Certificado de Clase",
  flag: "Certificado de Bandera",
  ISPS: "ISPS (Seguridad)",
  STCW: "STCW (Formación)",
  ISM: "ISM (Gestión Seguridad)",
  MARPOL: "MARPOL (Contaminación)",
  SOPEP: "SOPEP (Plan Emergencia)",
  IOPP: "IOPP (Prev. Hidrocarburos)",
  DOC: "Document of Compliance",
  SMC: "Safety Management Cert.",
  IAPP: "IAPP (Prev. Contaminación Aire)",
  CLC: "CLC (Responsabilidad Civil)",
  loadline: "Línea de Carga International",
  tonnage: "Certificado de Arqueo",
  safety_radio: "Seguridad Radio",
  safety_equip: "Equipo de Seguridad",
  safety_construction: "Seguridad Construcción",
};

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
}

type CertificatesTabProps = {
  certificates: FleetCertificate[];
};

export function CertificatesTab({ certificates }: CertificatesTabProps) {
  const byStatus = {
    active: certificates.filter((c) => c.status === "active"),
    expiring_soon: certificates.filter((c) => c.status === "expiring_soon"),
    expired: certificates.filter((c) => c.status === "expired"),
    suspended: certificates.filter((c) => c.status === "suspended"),
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-emerald-500" />
        <h2 className="text-sm font-bold text-[var(--text-primary)]">Certificados y Regulaciones IMO</h2>
        <span className="text-[10px] text-[var(--text-muted)]">({certificates.length} documentos)</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["active", "expiring_soon", "expired", "suspended"] as const).map((status) => {
          const config = CERT_STATUS_CONFIG[status];
          return (
            <div key={status} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-center">
              <p className="text-2xl font-bold tabular-nums" style={{ color: config.color }}>{byStatus[status].length}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: config.color }} />
                <p className="text-[10px] font-medium" style={{ color: config.color }}>{config.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expiring Soon Alert */}
      {byStatus.expiring_soon.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <h3 className="text-xs font-bold text-amber-500">Requieren Atención Inmediata</h3>
          </div>
          <div className="space-y-2">
            {byStatus.expiring_soon.map((cert) => {
              const days = daysUntil(cert.expiry_date);
              return (
                <div key={cert.id} className="flex items-center justify-between rounded-lg bg-amber-500/5 border border-amber-500/10 px-3 py-2">
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--text-primary)]">
                      {CERT_TYPE_NAMES[cert.cert_type] || cert.cert_type}
                    </p>
                    <p className="text-[9px] text-[var(--text-muted)]">{cert.cert_number} · {cert.issued_by}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold tabular-nums ${days !== null && days < 30 ? "text-red-500" : "text-amber-500"}`}>
                      {days !== null ? `${days} días` : "—"}
                    </p>
                    <p className="text-[8px] text-[var(--text-muted)]">para vencimiento</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Certificate Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {certificates.map((cert, i) => {
          const config = CERT_STATUS_CONFIG[cert.status] || CERT_STATUS_CONFIG.active;
          const days = daysUntil(cert.expiry_date);
          return (
            <motion.div
              key={cert.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:border-[#0EA5E9]/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText size={14} style={{ color: config.color }} />
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase" style={{ backgroundColor: config.bg, color: config.color }}>
                    {config.label}
                  </span>
                </div>
                {days !== null && (
                  <span className={`text-xs font-bold tabular-nums ${days < 30 ? "text-red-500" : days < 90 ? "text-amber-500" : "text-emerald-500"}`}>
                    {days > 0 ? `${days}d` : "Vencido"}
                  </span>
                )}
                {days === null && <span className="text-[10px] text-[var(--text-muted)]">∞</span>}
              </div>
              <h4 className="text-[12px] font-semibold text-[var(--text-primary)] mb-1">
                {CERT_TYPE_NAMES[cert.cert_type] || cert.cert_type}
              </h4>
              <p className="text-[10px] text-[var(--text-muted)] font-mono mb-2">{cert.cert_number}</p>
              <div className="space-y-1 text-[9px] text-[var(--text-secondary)]">
                <p>📋 Emitido por: {cert.issued_by}</p>
                <p>📅 Emisión: {new Date(cert.issue_date).toLocaleDateString("es-EC")}</p>
                {cert.expiry_date && <p>⏰ Vencimiento: {new Date(cert.expiry_date).toLocaleDateString("es-EC")}</p>}
                {cert.surveyor && <p>👤 Surveyor: {cert.surveyor}</p>}
                {cert.renewal_notes && (
                  <p className="mt-1 italic text-[var(--text-muted)]">💬 {cert.renewal_notes}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
