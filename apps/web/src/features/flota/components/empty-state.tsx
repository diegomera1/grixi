"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-12 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0EA5E9]/5 border border-[#0EA5E9]/10">
        <Icon size={24} className="text-[#0EA5E9]/40" />
      </div>
      <h3 className="mt-4 text-sm font-bold text-[var(--text-primary)]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs text-xs text-[var(--text-muted)]">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-[#0EA5E9] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#0EA5E9]/20 hover:bg-[#0EA5E9]/90 transition-all"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
