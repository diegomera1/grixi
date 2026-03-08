"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, User, Copy, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import ReactMarkdown from "react-markdown";
import type { ChatMessage as ChatMessageType } from "../types";

type ChatMessageProps = {
  message: ChatMessageType;
  userAvatar?: string | null;
  userName?: string;
  onRegenerate?: () => void;
  isLatestAssistant?: boolean;
};

export function ChatMessage({
  message,
  userAvatar,
  userName = "Tú",
  onRegenerate,
  isLatestAssistant = false,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("group flex gap-3", isUser ? "flex-row-reverse" : "")}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-muted)] ring-1 ring-[var(--border)]">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <User size={14} className="text-[var(--text-muted)]" />
          )}
        </div>
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] shadow-sm shadow-[#7C3AED]/20">
          <Bot size={14} className="text-white" />
        </div>
      )}

      {/* Content */}
      <div className={cn("max-w-[75%]", isUser ? "text-right" : "")}>
        {/* Name */}
        <p className="mb-1 text-[10px] font-medium text-[var(--text-muted)]">
          {isUser ? userName : "Grixi AI"}
        </p>

        {/* Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-[var(--brand)] text-white"
              : "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
          )}
        >
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {message.attachments.map((att) => (
                <div
                  key={att.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium",
                    isUser
                      ? "bg-white/15 text-white/80"
                      : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"
                  )}
                >
                  {att.type.startsWith("image/") ? "🖼️" : "📄"}
                  <span className="max-w-[100px] truncate">{att.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_li]:text-[var(--text-primary)] [&_p]:text-[var(--text-primary)] [&_strong]:text-[var(--text-primary)] [&_code]:rounded [&_code]:bg-[var(--bg-muted)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:bg-[var(--bg-primary)] [&_table]:border-collapse [&_th]:border [&_th]:border-[var(--border)] [&_th]:bg-[var(--bg-muted)] [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-xs [&_td]:border [&_td]:border-[var(--border)] [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-xs">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp + actions */}
        <div
          className={cn(
            "mt-1.5 flex items-center gap-2",
            isUser ? "justify-end" : "justify-start",
            "opacity-0 transition-opacity group-hover:opacity-100"
          )}
        >
          <span className="text-[10px] text-[var(--text-muted)]">
            {new Date(message.created_at).toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
            title="Copiar"
          >
            {copied ? (
              <Check size={11} className="text-[var(--success)]" />
            ) : (
              <Copy size={11} />
            )}
          </button>

          {/* Regenerate (only for latest assistant message) */}
          {!isUser && isLatestAssistant && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
              title="Regenerar respuesta"
            >
              <RefreshCw size={11} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Typing indicator with animated dots */
export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] shadow-sm shadow-[#7C3AED]/20">
        <Bot size={14} className="text-white" />
      </div>
      <div className="flex flex-col">
        <p className="mb-1 text-[10px] font-medium text-[var(--text-muted)]">
          Grixi AI
        </p>
        <div className="flex items-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
            className="inline-block h-2 w-2 rounded-full bg-[var(--brand)]"
          />
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
            className="inline-block h-2 w-2 rounded-full bg-[var(--brand)]"
          />
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
            className="inline-block h-2 w-2 rounded-full bg-[var(--brand)]"
          />
        </div>
      </div>
    </motion.div>
  );
}
