import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Pin, PinOff, Pencil, Trash2, Check, X,
  MessageSquare, ChevronLeft,
} from "lucide-react";
import type { Conversation, ConversationGroup } from "../types";

type SidebarProps = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
};

/** Group conversations by time period */
function groupConversations(conversations: Conversation[]): ConversationGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

  const pinned: Conversation[] = [];
  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const week: Conversation[] = [];
  const older: Conversation[] = [];

  for (const c of conversations) {
    if (c.is_pinned) { pinned.push(c); continue; }
    const d = new Date(c.last_message_at || c.created_at);
    if (d >= todayStart) today.push(c);
    else if (d >= yesterdayStart) yesterday.push(c);
    else if (d >= weekStart) week.push(c);
    else older.push(c);
  }

  const groups: ConversationGroup[] = [];
  if (pinned.length) groups.push({ label: "📌 Fijadas", conversations: pinned });
  if (today.length) groups.push({ label: "Hoy", conversations: today });
  if (yesterday.length) groups.push({ label: "Ayer", conversations: yesterday });
  if (week.length) groups.push({ label: "Última semana", conversations: week });
  if (older.length) groups.push({ label: "Anteriores", conversations: older });
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
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? conversations.filter(
        (c) =>
          (c.title || "Nueva conversación")
            .toLowerCase()
            .includes(search.toLowerCase())
      )
    : conversations;

  const groups = groupConversations(filtered);

  const startEditing = useCallback((conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title || "");
    setTimeout(() => editRef.current?.focus(), 50);
  }, []);

  const confirmRename = useCallback(() => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
  }, [editingId, editTitle, onRename]);

  return (
    <AnimatePresence>
      {!isCollapsed && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="flex h-full flex-col border-r border-border bg-surface overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-3 pt-4 pb-2">
            <h2 className="text-sm font-semibold text-text-primary">Conversaciones</h2>
            <div className="flex gap-1">
              <button
                onClick={onNew}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted hover:text-brand"
                title="Nueva conversación"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={onToggleCollapse}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted hover:text-text-primary"
                title="Cerrar sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5">
              <Search size={14} className="text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted outline-none"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin">
            {groups.length === 0 && (
              <p className="px-2 pt-8 text-center text-xs text-text-muted">
                No hay conversaciones
              </p>
            )}

            {groups.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  {group.label}
                </p>

                {group.conversations.map((conv) => {
                  const isActive = conv.id === activeId;
                  const isEditing = editingId === conv.id;
                  const isDeleting = deleteConfirm === conv.id;

                  return (
                    <motion.div
                      key={conv.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`group relative mb-0.5 flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-all cursor-pointer ${
                        isActive
                          ? "bg-brand/10 text-brand"
                          : "text-text-secondary hover:bg-muted hover:text-text-primary"
                      }`}
                      onClick={() => !isEditing && onSelect(conv.id)}
                    >
                      <MessageSquare size={14} className="shrink-0 opacity-50" />

                      {isEditing ? (
                        <div className="flex flex-1 items-center gap-1">
                          <input
                            ref={editRef}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmRename();
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="flex-1 rounded bg-muted px-1.5 py-0.5 text-xs text-text-primary outline-none ring-1 ring-brand/30"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button onClick={(e) => { e.stopPropagation(); confirmRename(); }} className="text-green-500">
                            <Check size={12} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="text-text-muted">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="flex-1 truncate">
                          {conv.title || "Nueva conversación"}
                        </span>
                      )}

                      {/* Actions — only on hover or if active */}
                      {!isEditing && (isActive || true) && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isDeleting ? (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); setDeleteConfirm(null); }}
                                className="rounded p-1 text-red-400 hover:bg-red-500/10"
                                title="Confirmar eliminar"
                              >
                                <Check size={11} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                                className="rounded p-1 text-text-muted hover:bg-muted"
                                title="Cancelar"
                              >
                                <X size={11} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); onTogglePin(conv.id); }}
                                className="rounded p-1 text-text-muted hover:text-amber-400 hover:bg-muted"
                                title={conv.is_pinned ? "Desfijar" : "Fijar"}
                              >
                                {conv.is_pinned ? <PinOff size={11} /> : <Pin size={11} />}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); startEditing(conv); }}
                                className="rounded p-1 text-text-muted hover:text-brand hover:bg-muted"
                                title="Renombrar"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(conv.id); }}
                                className="rounded p-1 text-text-muted hover:text-red-400 hover:bg-red-500/10"
                                title="Eliminar"
                              >
                                <Trash2 size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
