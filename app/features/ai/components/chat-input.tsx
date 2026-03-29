import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Paperclip, X, Image as ImageIcon, FileText,
  FileSpreadsheet, Sparkles,
  Package, DollarSign, ShoppingCart, Users,
  LayoutDashboard, Shield, Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AiModule, Attachment } from "../types";

type ChatInputProps = {
  onSend: (message: string, attachments: Attachment[]) => void;
  isStreaming: boolean;
  selectedModules: AiModule[];
  onToggleModule: (module: AiModule) => void;
};

type FilePreview = {
  file: File;
  preview?: string;
  uploading: boolean;
  error?: string;
};

const MODULE_CONFIG: { module: AiModule; icon: LucideIcon; label: string; color: string }[] = [
  { module: "general", icon: Sparkles, label: "General", color: "text-brand" },
  { module: "almacenes", icon: Package, label: "Almacenes", color: "text-blue-400" },
  { module: "finanzas", icon: DollarSign, label: "Finanzas", color: "text-emerald-400" },
  { module: "compras", icon: ShoppingCart, label: "Compras", color: "text-orange-400" },
  { module: "usuarios", icon: Users, label: "Usuarios", color: "text-cyan-400" },
  { module: "dashboard", icon: LayoutDashboard, label: "Dashboard", color: "text-indigo-400" },
  { module: "administracion", icon: Shield, label: "Admin", color: "text-rose-400" },
  { module: "flota", icon: Truck, label: "Flota", color: "text-amber-400" },
];

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf") return FileText;
  if (type.includes("spreadsheet") || type.includes("csv") || type.includes("excel")) return FileSpreadsheet;
  return FileText;
}

export function ChatInput({ onSend, isStreaming, selectedModules, onToggleModule }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSend = useCallback(async () => {
    const text = message.trim();
    if (!text && files.length === 0) return;
    if (isStreaming) return;

    // Upload files first
    const uploadedAttachments: Attachment[] = [];

    for (const fp of files) {
      try {
        const formData = new FormData();
        formData.append("file", fp.file);

        const res = await fetch("/api/ai/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json() as { attachment: Attachment };
          uploadedAttachments.push(data.attachment);
        }
      } catch {
        // Silently skip failed uploads
      }
    }

    onSend(text, uploadedAttachments);
    setMessage("");
    setFiles([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [message, files, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const toAdd = Array.from(newFiles).map((file) => {
      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;
      return { file, preview, uploading: false };
    });
    setFiles((prev) => [...prev, ...toAdd]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Drag & drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const canSend = (message.trim() || files.length > 0) && !isStreaming;

  return (
    <div className="border-t border-border bg-surface px-3 pb-3 pt-2 md:px-4">
      {/* Module Selector */}
      <div className="mb-2 flex flex-wrap gap-1">
        {MODULE_CONFIG.map(({ module, icon: Icon, label, color }) => {
          const isSelected = selectedModules.includes(module);
          return (
            <button
              key={module}
              onClick={() => onToggleModule(module)}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
                isSelected
                  ? `bg-brand/10 ${color} ring-1 ring-brand/20`
                  : "text-text-muted hover:bg-muted hover:text-text-secondary"
              }`}
              title={label}
            >
              <Icon size={11} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* File Previews */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 flex flex-wrap gap-2 overflow-hidden"
          >
            {files.map((fp, i) => {
              const FileIcon = getFileIcon(fp.file.type);
              return (
                <motion.div
                  key={i}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="relative flex items-center gap-2 rounded-lg border border-border bg-muted px-2.5 py-1.5"
                >
                  {fp.preview ? (
                    <img src={fp.preview} alt="" className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <FileIcon size={16} className="text-text-muted" />
                  )}
                  <div className="max-w-[120px]">
                    <p className="truncate text-[10px] font-medium text-text-primary">
                      {fp.file.name}
                    </p>
                    <p className="text-[9px] text-text-muted">
                      {(fp.file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-surface p-0.5 shadow-sm hover:text-red-400"
                  >
                    <X size={10} />
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Area */}
      <div
        className={`flex items-end gap-2 rounded-xl border bg-muted/50 px-3 py-2 transition-all ${
          isDragging
            ? "border-brand bg-brand/5"
            : "border-border focus-within:border-brand/30 focus-within:ring-1 focus-within:ring-brand/10"
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mb-0.5 shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted hover:text-brand"
          title="Adjuntar archivo"
        >
          <Paperclip size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.csv,.xlsx,.xls,.txt,.json"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isDragging ? "Suelta archivos aquí..." : "Escribe un mensaje..."}
          rows={1}
          disabled={isStreaming}
          className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none disabled:opacity-50"
        />

        {/* Send button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={!canSend}
          className={`mb-0.5 shrink-0 rounded-lg p-1.5 transition-all ${
            canSend
              ? "bg-brand text-white shadow-sm hover:brightness-110"
              : "text-text-muted opacity-40"
          }`}
          title="Enviar (Enter)"
        >
          <Send size={16} />
        </motion.button>
      </div>

      {/* Drag overlay hint */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-brand bg-brand/5"
          >
            <p className="text-sm font-medium text-brand">Suelta archivos aquí</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
