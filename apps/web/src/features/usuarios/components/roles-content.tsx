"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  Users,
  Check,
  X,
  ArrowLeft,
  Plus,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Role = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  color: string;
  userCount: number;
  permissionIds: string[];
};

type Permission = {
  id: string;
  module: string;
  action: string;
  description: string | null;
};

type RolesContentProps = {
  roles: Role[];
  permissions: Permission[];
};

const moduleLabels: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Usuarios",
  warehouse: "Almacenes",
  audit: "Auditoría",
  admin: "Administración",
  ai: "Inteligencia Artificial",
};

const actionLabels: Record<string, string> = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
  export: "Exportar",
  manage: "Gestionar",
  chat: "Chat",
};

export function RolesContent({ roles, permissions }: RolesContentProps) {
  // Group permissions by module
  const moduleGroups = permissions.reduce(
    (acc, perm) => {
      if (!acc[perm.module]) acc[perm.module] = [];
      acc[perm.module].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Back */}
      <Link
        href="/usuarios"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft size={16} />
        Volver a usuarios
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            Roles y Permisos
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Gestiona los roles y permisos de Grixi Industrial S.A.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-[var(--brand)]/20 active:scale-[0.98]">
          <Plus size={16} />
          Crear rol
        </button>
      </motion.div>

      {/* Role cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role, index) => (
          <motion.div
            key={role.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 transition-all hover:border-[var(--border-hover)] hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: role.color + "18" }}
                >
                  <Shield size={20} style={{ color: role.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--text-primary)]">
                      {role.name}
                    </h3>
                    {role.is_system && (
                      <Lock size={12} className="text-[var(--text-muted)]" />
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {role.description || "Sin descripción"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-1">
                <Users size={12} />
                {role.userCount} usuario{role.userCount !== 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-1">
                <Shield size={12} />
                {role.permissionIds.length} permiso{role.permissionIds.length !== 1 ? "s" : ""}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Permission matrix */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]"
      >
        <div className="border-b border-[var(--border)] bg-[var(--bg-muted)] px-6 py-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Matriz de Permisos
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Permisos asignados a cada rol por módulo
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="min-w-[200px] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Módulo / Acción
                </th>
                {roles.map((role) => (
                  <th
                    key={role.id}
                    className="min-w-[100px] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider"
                    style={{ color: role.color }}
                  >
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {Object.entries(moduleGroups).map(([module, perms]) => (
                perms.map((perm, i) => (
                  <tr key={perm.id} className="transition-colors hover:bg-[var(--bg-muted)]/50">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        {i === 0 && (
                          <span className="rounded-md bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                            {moduleLabels[module] || module}
                          </span>
                        )}
                        <span className="text-sm text-[var(--text-primary)]">
                          {actionLabels[perm.action] || perm.action}
                        </span>
                      </div>
                    </td>
                    {roles.map((role) => (
                      <td key={role.id} className="px-4 py-2.5 text-center">
                        {role.permissionIds.includes(perm.id) ? (
                          <Check size={16} className="mx-auto text-[var(--success)]" />
                        ) : (
                          <X size={16} className="mx-auto text-[var(--text-muted)] opacity-30" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
