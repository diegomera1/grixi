"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Warehouse,
  ShoppingCart,
  DollarSign,
  Users,
  LayoutDashboard,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { AiModule, Attachment } from "../types";
import type { LucideIcon } from "lucide-react";

type ChatInputProps = {
  onSend: (message: string, attachments: Attachment[]) => void;
  onUpload: (file: File) => Promise<Attachment | null>;
  isLoading: boolean;
  modules: AiModule[];
  onModulesChange: (modules: AiModule[]) => void;
};

const MODULES: { value: AiModule; label: string; icon: LucideIcon; color: string }[] = [
  { value: "general", label: "General", icon: Sparkles, color: "#7C3AED" },
  { value: "almacenes", label: "Almacenes", icon: Warehouse, color: "#10B981" },
  { value: "compras", label: "Compras", icon: ShoppingCart, color: "#F97316" },
  { value: "finanzas", label: "Finanzas", icon: DollarSign, color: "#8B5CF6" },
  { value: "usuarios", label: "Usuarios", icon: Users, color: "#F59E0B" },
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard, color: "#06B6D4" },
  { value: "administracion", label: "Admin", icon: Shield, color: "#F43F5E" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatInput({
  onSend,
  onUpload,
  isLoading,
  modules,
  onModulesChange,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showModules, setShowModules] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isLoading || uploading) return;
    onSend(text, attachments);
    setInput("");
    setAttachments([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, attachments, isLoading, uploading, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const attachment = await onUpload(file);
      if (attachment) {
        setAttachments((prev) => [...prev, attachment]);
      }
    }
    setUploading(false);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // Toggle a module on/off
  const toggleModule = (mod: AiModule) => {
    if (mod === "general") {
      // If general is selected, deselect all others
      onModulesChange(["general"]);
      return;
    }
    let next: AiModule[] = modules.filter((m) => m !== "general");
    if (next.includes(mod)) {
      next = next.filter((m) => m !== mod);
    } else {
      next = [...next, mod];
    }
    // If nothing selected, fall back to general
    if (next.length === 0) next = ["general"];
    onModulesChange(next);
  };

  // Get display info for active modules
  const activeModules = MODULES.filter((m) => modules.includes(m.value));
  const displayLabel =
    modules.includes("general")
      ? "General"
      : activeModules.length === 1
        ? activeModules[0].label
        : `${activeModules.length} módulos`;

  return (
    <div className="shrink-0 px-4 pb-4">
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-primary)]/80 backdrop-blur-sm"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--brand)] bg-[var(--bg-surface)] p-12">
              <Paperclip size={32} className="text-[var(--brand)]" />
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Suelta el archivo aquí
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Imágenes, PDF, Excel, CSV (máx 10MB)
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachments preview */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 flex flex-wrap gap-2 overflow-hidden"
          >
            {attachments.map((att) => (
              <motion.div
                key={att.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              >
                {att.type.startsWith("image/") ? (
                  <ImageIcon size={14} className="text-[var(--brand)]" />
                ) : (
                  <FileText size={14} className="text-[var(--brand)]" />
                )}
                <div className="flex flex-col">
                  <span className="max-w-[120px] truncate text-xs font-medium text-[var(--text-primary)]">
                    {att.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {formatFileSize(att.size)}
                  </span>
                </div>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input container */}
      <div
        onDragOver={handleDragOver}
        className={cn(
          "relative rounded-2xl border bg-[var(--bg-primary)] transition-all duration-200",
          isDragOver
            ? "border-[var(--brand)] shadow-lg shadow-[var(--brand)]/10"
            : "border-[var(--border)] focus-within:border-[var(--brand)] focus-within:shadow-lg focus-within:shadow-[var(--brand)]/5"
        )}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pregunta cualquier cosa sobre tu empresa..."
          rows={1}
          className="w-full resize-none bg-transparent px-4 pb-2 pt-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          disabled={isLoading}
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between border-t border-[var(--border)]/50 px-3 py-1.5">
          <div className="flex items-center gap-1">
            {/* File upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isLoading}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] disabled:opacity-40"
              title="Adjuntar archivo"
            >
              <Paperclip size={15} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.csv,.xlsx,.xls"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
            />

            {/* Module selector */}
            <div className="relative">
              <button
                onClick={() => setShowModules(!showModules)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
              >
                {/* Show icons of active modules */}
                <div className="flex -space-x-1">
                  {activeModules.slice(0, 3).map((m) => (
                    <m.icon
                      key={m.value}
                      size={13}
                      style={{ color: m.color }}
                    />
                  ))}
                </div>
                <span>{displayLabel}</span>
              </button>

              <AnimatePresence>
                {showModules && (
                  <>
                    {/* Backdrop to close */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowModules(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      className="absolute bottom-full left-0 z-50 mb-2 w-48 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl"
                    >
                      <p className="border-b border-[var(--border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Contexto de módulos
                      </p>
                      {MODULES.map((m) => {
                        const isActive = modules.includes(m.value);
                        const Icon = m.icon;
                        return (
                          <button
                            key={m.value}
                            onClick={() => toggleModule(m.value)}
                            className={cn(
                              "flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-all",
                              isActive
                                ? "bg-[var(--brand)]/8 text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                            )}
                          >
                            <Icon
                              size={14}
                              style={{ color: isActive ? m.color : undefined }}
                              className={cn(!isActive && "opacity-40")}
                            />
                            <span className="flex-1 text-left">{m.label}</span>
                            {isActive && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: m.color }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {uploading && (
              <span className="text-[10px] text-[var(--text-muted)]">
                Subiendo...
              </span>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={
              (!input.trim() && attachments.length === 0) ||
              isLoading ||
              uploading
            }
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
              input.trim() || attachments.length > 0
                ? "bg-[var(--brand)] text-white shadow-md shadow-[var(--brand)]/20 hover:shadow-lg hover:shadow-[var(--brand)]/30"
                : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
            )}
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">
        GRIXI AI puede cometer errores. Verifica la información importante.
      </p>
    </div>
  );
}
