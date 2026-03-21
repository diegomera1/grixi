"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  MoreHorizontal,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type User = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  last_active_at: string | null;
  role: { name: string; color: string } | null;
};

type UsersContentProps = {
  users: User[];
  departments: string[];
  roles: string[];
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Sin actividad";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 5) return "En línea";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function isOnline(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 5 * 60 * 1000;
}

export function UsersContent({ users, departments, roles }: UsersContentProps) {
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [sortField, setSortField] = useState<"full_name" | "department" | "last_active_at">("full_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.position?.toLowerCase().includes(q)
      );
    }

    // Department filter
    if (filterDept) {
      result = result.filter((u) => u.department === filterDept);
    }

    // Role filter
    if (filterRole) {
      result = result.filter((u) => u.role?.name === filterRole);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      if (sortField === "full_name") {
        aVal = a.full_name || "";
        bVal = b.full_name || "";
      } else if (sortField === "department") {
        aVal = a.department || "";
        bVal = b.department || "";
      } else if (sortField === "last_active_at") {
        aVal = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
        bVal = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [users, search, filterDept, filterRole, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Usuarios
          </h2>
          <p className="text-[11px] text-[var(--text-secondary)]">
            {filteredUsers.length} miembros de GRIXI Industrial S.A.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-[var(--brand)]/20 active:scale-[0.98]">
          <UserPlus size={16} />
          Agregar usuario
        </button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap items-center gap-3"
      >
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-2.5 pl-9 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--brand)] focus:outline-none"
          />
        </div>

        {/* Department filter */}
        <div className="relative">
          <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-2.5 pl-8 pr-8 text-sm text-[var(--text-secondary)] transition-colors focus:border-[var(--brand)] focus:outline-none"
          >
            <option value="">Departamento</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Role filter */}
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-colors focus:border-[var(--brand)] focus:outline-none"
        >
          <option value="">Rol</option>
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {(filterDept || filterRole || search) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterDept("");
              setFilterRole("");
            }}
            className="text-sm text-[var(--brand)] hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                <th
                  className="cursor-pointer px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
                  onClick={() => toggleSort("full_name")}
                >
                  <div className="flex items-center gap-1">
                    Usuario <SortIcon field="full_name" />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
                  onClick={() => toggleSort("department")}
                >
                  <div className="flex items-center gap-1">
                    Departamento <SortIcon field="department" />
                  </div>
                </th>
                <th className="hidden sm:table-cell px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Rol
                </th>
                <th
                  className="cursor-pointer px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
                  onClick={() => toggleSort("last_active_at")}
                >
                  <div className="flex items-center gap-1">
                    Estado <SortIcon field="last_active_at" />
                  </div>
                </th>
                <th className="hidden md:table-cell px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredUsers.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="group transition-colors hover:bg-[var(--bg-muted)]/50"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0">
                        <div className="h-10 w-10 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                          {user.avatar_url ? (
                            <Image
                              src={user.avatar_url}
                              alt={user.full_name}
                              width={40}
                              height={40}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-medium text-[var(--text-muted)]">
                              {user.full_name?.charAt(0)}
                            </div>
                          )}
                        </div>
                        {isOnline(user.last_active_at) && (
                          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--bg-surface)] bg-[var(--success)]" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {user.full_name}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-5 py-4">
                    <p className="text-sm text-[var(--text-secondary)]">
                      {user.department || "—"}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {user.position || ""}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    {user.role ? (
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: user.role.color + "18",
                          color: user.role.color,
                        }}
                      >
                        {user.role.name}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">Sin rol</span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          isOnline(user.last_active_at)
                            ? "bg-[var(--success)]"
                            : "bg-[var(--text-muted)]"
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs",
                          isOnline(user.last_active_at)
                            ? "font-medium text-[var(--success)]"
                            : "text-[var(--text-muted)]"
                        )}
                      >
                        {timeAgo(user.last_active_at)}
                      </span>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/usuarios/${user.id}`}
                        className="rounded-lg p-2 text-[var(--text-muted)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[var(--bg-surface)] hover:text-[var(--brand)]"
                      >
                        <Eye size={16} />
                      </Link>
                      <button className="rounded-lg p-2 text-[var(--text-muted)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
          <p className="text-xs text-[var(--text-muted)]">
            Mostrando {filteredUsers.length} de {users.length} usuarios
          </p>
        </div>
      </motion.div>
    </div>
  );
}
