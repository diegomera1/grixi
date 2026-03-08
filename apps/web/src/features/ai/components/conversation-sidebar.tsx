"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Pin,
  Trash2,
  Edit3,
  MessageSquare,
  Check,
  X,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Conversation, AiModule } from "../types";
import { GrixiAiLogo } from "./grixi-ai-logo";

type ConversationSidebarProps = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

const MODULE_COLORS: Record<AiModule, string> = {
  general: "#7C3AED",
  almacenes: "#10B981",
  finanzas: "#8B5CF6",
  usuarios: "#F59E0B",
  dashboard: "#06B6D4",
  administracion: "#F43F5E",
};

const MODULE_LABELS: Record<AiModule, string> = {
  general: "General",
  almacenes: "Almacenes",
  finanzas: "Finanzas",
  usuarios: "Usuarios",
  dashboard: "Dashboard",
  administracion: "Admin",
};

function groupConversations(conversations: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const pinned: Conversation[] = [];
  const todayList: Conversation[] = [];
  const yesterdayList: Conversation[] = [];
  const weekList: Conversation[] = [];
  const older: Conversation[] = [];

  for (const conv of conversations) {
    if (conv.is_pinned) {
      pinned.push(conv);
      continue;
    }
    const date = new Date(conv.last_message_at);
    if (date >= today) todayList.push(conv);
    else if (date >= yesterday) yesterdayList.push(conv);
    else if (date >= weekAgo) weekList.push(conv);
    else older.push(conv);
  }

  const groups: { label: string; icon?: string; conversations: Conversation[] }[] = [];
  if (pinned.length > 0) groups.push({ label: "📌 Fijados", conversations: pinned });
  if (todayList.length > 0) groups.push({ label: "Hoy", conversations: todayList });
  if (yesterdayList.length > 0) groups.push({ label: "Ayer", conversations: yesterdayList });
  if (weekList.length > 0) groups.push({ label: "Últimos 7 días", conversations: weekList });
  if (older.length > 0) groups.push({ label: "Anteriores", conversations: older });

  return groups;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onTogglePin,
  collapsed,
}: ConversationSidebarProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const filtered = search
    ? conversations.filter((c) =>
        (c.title || "Nueva conversación")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : conversations;

  const groups = groupConversations(filtered);

  const startEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title || "");
    setMenuOpenId(null);
  };

  const confirmEdit = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  if (collapsed) return null;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 280, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-surface)]"
    >
      {/* Header with logo */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-3">
        <GrixiAiLogo size={28} showText={false} animate={false} />
        <button
          onClick={onNew}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand)] text-white shadow-sm transition-all hover:shadow-md hover:shadow-[var(--brand)]/20"
          title="Nueva conversación"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-1.5">
          <Search size={13} className="shrink-0 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversaciones..."
            className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <MessageSquare size={24} className="text-[var(--text-muted)]" />
            <p className="text-xs text-[var(--text-muted)]">
              {search
                ? "Sin resultados"
                : "No hay conversaciones aún"}
            </p>
            {!search && (
              <button
                onClick={onNew}
                className="mt-1 text-xs font-medium text-[var(--brand)] hover:underline"
              >
                Inicia una nueva
              </button>
            )}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {group.label}
              </p>
              <AnimatePresence>
                {group.conversations.map((conv) => (
                  <motion.div
                    key={conv.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="relative"
                  >
                    <button
                      onClick={() => onSelect(conv.id)}
                      className={cn(
                        "group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-all",
                        activeId === conv.id
                          ? "bg-[var(--brand)]/8 text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]/60"
                      )}
                    >
                      {/* Module color dot */}
                      <div
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            MODULE_COLORS[conv.module as AiModule] || MODULE_COLORS.general,
                        }}
                        title={MODULE_LABELS[conv.module as AiModule] || "General"}
                      />

                      {editingId === conv.id ? (
                        <div className="flex flex-1 items-center gap-1">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" ? confirmEdit() : e.key === "Escape" && setEditingId(null)
                            }
                            className="flex-1 rounded bg-[var(--bg-primary)] px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button onClick={(e) => { e.stopPropagation(); confirmEdit(); }}>
                            <Check size={12} className="text-[var(--success)]" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>
                            <X size={12} className="text-[var(--text-muted)]" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 truncate">
                            {conv.title || "Nueva conversación"}
                          </span>
                          {conv.is_pinned && (
                            <Pin size={10} className="shrink-0 text-[var(--brand)]" />
                          )}
                          {/* Actions menu */}
                          <div
                            className={cn(
                              "shrink-0 transition-opacity",
                              menuOpenId === conv.id
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            )}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(
                                  menuOpenId === conv.id ? null : conv.id
                                );
                              }}
                              className="rounded p-0.5 hover:bg-[var(--bg-muted)]"
                            >
                              <MoreHorizontal size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </button>

                    {/* Context menu */}
                    <AnimatePresence>
                      {menuOpenId === conv.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -5 }}
                          className="absolute right-2 top-full z-50 mt-1 w-36 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(conv);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                          >
                            <Edit3 size={12} /> Renombrar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePin(conv.id);
                              setMenuOpenId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                          >
                            <Pin size={12} /> {conv.is_pinned ? "Desfijar" : "Fijar"}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(conv.id);
                              setMenuOpenId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--error)] hover:bg-red-50 dark:hover:bg-red-950/20"
                          >
                            <Trash2 size={12} /> Eliminar
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
