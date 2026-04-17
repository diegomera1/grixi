"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { DemoRole } from "../types";
import { DEMO_ROLE_LABELS, DEMO_ROLE_COLORS } from "../types";

type Props = {
  activeRole: DemoRole;
  onRoleChange: (role: DemoRole) => void;
};

const ROLES: DemoRole[] = ["seller", "supervisor", "manager", "admin"];

export function RoleSwitcher({ activeRole, onRoleChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-all",
          "border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-muted)]",
          "shadow-sm"
        )}
      >
        <Eye size={12} className="text-[var(--text-muted)]" />
        <span className="text-[var(--text-secondary)]">Vista:</span>
        <span
          className="font-bold"
          style={{ color: DEMO_ROLE_COLORS[activeRole] }}
        >
          {DEMO_ROLE_LABELS[activeRole]}
        </span>
        <div
          className="ml-0.5 h-2 w-2 rounded-full"
          style={{ backgroundColor: DEMO_ROLE_COLORS[activeRole] }}
        />
        <ChevronDown
          size={10}
          className={cn(
            "transition-transform text-[var(--text-muted)]",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute right-0 top-full z-50 mt-1 w-44",
                "rounded-xl border border-[var(--border)] bg-[var(--bg-card)]",
                "shadow-lg backdrop-blur-xl"
              )}
            >
              <div className="p-1.5">
                {ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      onRoleChange(role);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      activeRole === role
                        ? "bg-[var(--bg-muted)]"
                        : "hover:bg-[var(--bg-muted)]/60"
                    )}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: DEMO_ROLE_COLORS[role],
                        outline: activeRole === role ? `2px solid ${DEMO_ROLE_COLORS[role]}` : "none",
                        outlineOffset: "2px",
                      }}
                    />
                    <span
                      className={cn(
                        activeRole === role
                          ? "text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)]"
                      )}
                    >
                      {DEMO_ROLE_LABELS[role]}
                    </span>
                    {activeRole === role && (
                      <motion.div
                        layoutId="role-check"
                        className="ml-auto h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: DEMO_ROLE_COLORS[role] }}
                      />
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--text-muted)] leading-tight">
                  Cambia de vista para simular los permisos de cada rol
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
