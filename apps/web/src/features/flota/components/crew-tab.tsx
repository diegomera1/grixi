"use client";

import { motion } from "framer-motion";
import type { CrewMember } from "../types";

export function CrewTab({ crew }: { crew: CrewMember[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {crew.map((member, i) => (
        <motion.div
          key={member.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
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
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{member.employee?.full_name || member.role}</p>
              <p className="text-[10px] text-[#0EA5E9] font-medium">{member.rank}</p>
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
            </div>
          </div>
          {member.boarding_date && (
            <p className="mt-2 text-[9px] text-[var(--text-muted)]">
              A bordo desde {new Date(member.boarding_date).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
