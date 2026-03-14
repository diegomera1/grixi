"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Star, Trophy, Target, TrendingUp } from "lucide-react";
import type { PerformanceReview, Employee } from "../types";
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_COLORS } from "../types";

type Props = { reviews: PerformanceReview[]; employees: Employee[] };

const SKILL_LABELS = [
  { key: "technical_skills" as const, label: "Técnico", color: "#06B6D4" },
  { key: "communication" as const, label: "Comunicación", color: "#3B82F6" },
  { key: "teamwork" as const, label: "Trabajo en Equipo", color: "#10B981" },
  { key: "leadership" as const, label: "Liderazgo", color: "#8B5CF6" },
  { key: "punctuality" as const, label: "Puntualidad", color: "#F59E0B" },
  { key: "initiative" as const, label: "Iniciativa", color: "#EC4899" },
];

export function EvaluationsTab({ reviews, employees }: Props) {
  const [selectedPeriod, setSelectedPeriod] = useState("2025-H2");
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  const periods = useMemo(() => {
    const seen = new Set<string>();
    return reviews
      .map((r) => r.review_period)
      .filter((p) => { if (seen.has(p)) return false; seen.add(p); return true; })
      .sort()
      .reverse();
  }, [reviews]);

  const periodReviews = useMemo(
    () => reviews.filter((r) => r.review_period === selectedPeriod),
    [reviews, selectedPeriod]
  );

  const stats = useMemo(() => {
    const completed = periodReviews.filter((r) => r.status === "completed" || r.status === "acknowledged");
    const avgScore = completed.length > 0
      ? completed.reduce((s, r) => s + r.overall_score, 0) / completed.length
      : 0;
    return {
      total: periodReviews.length,
      completed: completed.length,
      pending: periodReviews.filter((r) => r.status === "pending").length,
      inProgress: periodReviews.filter((r) => r.status === "in_progress").length,
      avgScore: Math.round(avgScore * 10) / 10,
      completionPct: periodReviews.length > 0 ? Math.round((completed.length / periodReviews.length) * 100) : 0,
    };
  }, [periodReviews]);

  const selectedReview = selectedEmpId
    ? periodReviews.find((r) => r.employee_id === selectedEmpId)
    : null;
  const selectedEmp = selectedEmpId ? employees.find((e) => e.id === selectedEmpId) : null;

  // Top performers
  const topPerformers = useMemo(() =>
    [...periodReviews]
      .filter((r) => r.overall_score > 0)
      .sort((a, b) => b.overall_score - a.overall_score)
      .slice(0, 5)
      .map((r) => ({
        ...r,
        emp: employees.find((e) => e.id === r.employee_id),
      })),
    [periodReviews, employees]
  );

  // Score distribution
  const scoreDistribution = useMemo(() => {
    const brackets = [
      { label: "Excepcional (4.5+)", min: 4.5, max: 5.1, count: 0, color: "#10B981" },
      { label: "Bueno (3.5-4.5)", min: 3.5, max: 4.5, count: 0, color: "#3B82F6" },
      { label: "Adecuado (2.5-3.5)", min: 2.5, max: 3.5, count: 0, color: "#F59E0B" },
      { label: "Mejorable (<2.5)", min: 0, max: 2.5, count: 0, color: "#EF4444" },
    ];
    periodReviews.filter((r) => r.overall_score > 0).forEach((r) => {
      const b = brackets.find((b) => r.overall_score >= b.min && r.overall_score < b.max);
      if (b) b.count++;
    });
    return brackets;
  }, [periodReviews]);

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Evaluaciones", value: stats.total, color: "#06B6D4", icon: Target },
          { label: "Completadas", value: `${stats.completionPct}%`, color: "#10B981", icon: TrendingUp },
          { label: "Promedio General", value: `${stats.avgScore}/5`, color: "#8B5CF6", icon: Star },
          { label: "Pendientes", value: stats.pending, color: "#F59E0B", icon: Target },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg p-1.5" style={{ backgroundColor: `${stat.color}15` }}>
                <stat.icon size={12} style={{ color: stat.color }} />
              </div>
              <span className="text-[10px] text-[var(--text-muted)]">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-[var(--text-primary)]">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Period selector */}
      <select
        value={selectedPeriod}
        onChange={(e) => { setSelectedPeriod(e.target.value); setSelectedEmpId(null); }}
        className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)]"
      >
        {periods.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Radar / Skill Display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          {/* Employee selector */}
          <select
            value={selectedEmpId || ""}
            onChange={(e) => setSelectedEmpId(e.target.value || null)}
            className="w-full mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)]"
          >
            <option value="">Seleccionar empleado para ver detalle...</option>
            {periodReviews
              .filter((r) => r.overall_score > 0)
              .sort((a, b) => {
                const empA = employees.find((e) => e.id === a.employee_id);
                const empB = employees.find((e) => e.id === b.employee_id);
                return (empA?.full_name || "").localeCompare(empB?.full_name || "");
              })
              .map((r) => {
                const emp = employees.find((e) => e.id === r.employee_id);
                return emp ? (
                  <option key={r.id} value={r.employee_id}>
                    {emp.full_name} — {r.overall_score}/5
                  </option>
                ) : null;
              })}
          </select>

          {selectedReview && selectedEmp ? (
            <div>
              {/* Employee Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#06B6D4] text-sm font-bold text-white">
                  {selectedEmp.first_name.charAt(0)}{selectedEmp.last_name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{selectedEmp.full_name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{selectedEmp.position}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-2xl font-bold text-[#06B6D4]">{selectedReview.overall_score}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">de 5.0</p>
                </div>
              </div>

              {/* Skill Bars (radar-like) */}
              <div className="space-y-3">
                {SKILL_LABELS.map((skill, i) => {
                  const value = selectedReview[skill.key];
                  return (
                    <div key={skill.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-medium text-[var(--text-secondary)]">{skill.label}</span>
                        <span className="text-[10px] font-mono font-bold text-[var(--text-primary)]">{value}/5</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: skill.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(value / 5) * 100}%` }}
                          transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comments */}
              {selectedReview.strengths && (
                <div className="mt-5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                  <p className="text-[9px] font-bold text-emerald-500 mb-1">Fortalezas</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{selectedReview.strengths}</p>
                </div>
              )}
              {selectedReview.areas_of_improvement && (
                <div className="mt-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                  <p className="text-[9px] font-bold text-amber-500 mb-1">Áreas de Mejora</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{selectedReview.areas_of_improvement}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Star size={32} className="mx-auto text-[var(--text-muted)] mb-3" />
              <p className="text-sm text-[var(--text-muted)]">Selecciona un empleado para ver su evaluación</p>
            </div>
          )}
        </motion.div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Top Performers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={14} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top Performers</h3>
            </div>
            <div className="space-y-2">
              {topPerformers.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--bg-muted)] cursor-pointer transition-colors"
                  onClick={() => setSelectedEmpId(t.employee_id)}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                    i === 0 ? "bg-amber-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-700" : "bg-[var(--bg-muted)] text-[var(--text-primary)]"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-[var(--text-primary)] truncate">{t.emp?.full_name}</p>
                    <p className="text-[9px] text-[var(--text-muted)]">{t.emp?.position}</p>
                  </div>
                  <span className="text-xs font-bold text-[#06B6D4]">{t.overall_score}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Score Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
          >
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Distribución de Puntajes</h3>
            <div className="space-y-2.5">
              {scoreDistribution.map((bracket, i) => {
                const total = scoreDistribution.reduce((s, b) => s + b.count, 0) || 1;
                return (
                  <div key={bracket.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-[var(--text-secondary)]">{bracket.label}</span>
                      <span className="text-[10px] font-mono font-bold text-[var(--text-primary)]">{bracket.count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: bracket.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(bracket.count / total) * 100}%` }}
                        transition={{ delay: 0.6 + i * 0.08, duration: 0.5 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
