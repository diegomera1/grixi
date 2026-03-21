"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Maximize2, Square } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { GrixiAiLogo } from "./grixi-ai-logo";
import type { AiModule, ChatMessage as ChatMessageType } from "../types";
import { createConversation } from "../actions/conversations";

// Detect module from pathname
function detectModule(pathname: string): AiModule {
  if (pathname.includes("/almacenes")) return "almacenes";
  if (pathname.includes("/compras")) return "compras";
  if (pathname.includes("/finanzas") || pathname.includes("/finance"))
    return "finanzas";
  if (pathname.includes("/usuarios") || pathname.includes("/users"))
    return "usuarios";
  if (
    pathname.includes("/administracion") ||
    pathname.includes("/admin") ||
    pathname.includes("/configuracion")
  )
    return "administracion";
  if (pathname.includes("/flota")) return "flota";
  if (pathname.includes("/dashboard")) return "dashboard";
  return "general";
}

const MODULE_LABELS: Record<AiModule, string> = {
  general: "General",
  almacenes: "Almacenes",
  compras: "Compras",
  finanzas: "Finanzas",
  usuarios: "Usuarios",
  dashboard: "Dashboard",
  administracion: "Admin",
  flota: "Flota",
};

const MODULE_COLORS: Record<AiModule, string> = {
  general: "#7C3AED",
  almacenes: "#10B981",
  compras: "#F97316",
  finanzas: "#8B5CF6",
  usuarios: "#F59E0B",
  dashboard: "#06B6D4",
  administracion: "#F43F5E",
  flota: "#0EA5E9",
};

export function AiFloatingWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const module = detectModule(pathname);
  const isAiPage = pathname.startsWith("/ai");

  // Auto-scroll on new messages — use parent container scroll to avoid page jump in fullscreen
  useEffect(() => {
    const el = messagesEndRef.current;
    if (el) {
      const container = el.closest("[data-chat-scroll]");
      if (container) {
        container.scrollTop = container.scrollHeight;
      } else {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 100)}px`;
    }
  }, [input]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");

    // Create conversation if needed
    let currentConvId = convId;
    if (!currentConvId) {
      const { conversation } = await createConversation(module);
      if (!conversation) return;
      currentConvId = conversation.id;
      setConvId(currentConvId);
    }

    // Add user message
    const userMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      conversation_id: currentConvId,
      role: "user",
      content: text,
      attachments: [],
      model_used: "user",
      tokens_used: 0,
      created_at: new Date().toISOString(),
    };

    // Add AI placeholder
    const aiMsgId = crypto.randomUUID();
    const aiMsg: ChatMessageType = {
      id: aiMsgId,
      conversation_id: currentConvId,
      role: "assistant",
      content: "",
      attachments: [],
      model_used: "default",
      tokens_used: 0,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: currentConvId,
          message: text,
          modules: [module],
          attachments: [],
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6).trim());
            if (data.done || data.error) break;
            if (data.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, content: m.content + data.text }
                    : m
                )
              );
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // stopped
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: "Error al conectar con AI" }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, convId, module]);

  const handleOpenFull = () => {
    const url = convId ? `/ai?c=${convId}` : "/ai";
    router.push(url);
    setIsOpen(false);
  };

  // Don't render on the AI page itself
  if (isAiPage) return null;

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] shadow-xl shadow-[#7C3AED]/30 transition-shadow hover:shadow-2xl hover:shadow-[#7C3AED]/40"
          >
            {/* Pulse ring */}
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute inset-0 rounded-2xl border-2 border-[#A78BFA]"
            />
            {/* Grixi AI Logo as button icon */}
            <GrixiAiLogo size={28} showText={false} animate={false} />
            {/* Module indicator dot */}
            <div
              className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-[var(--bg-primary)]"
              style={{ backgroundColor: MODULE_COLORS[module] }}
              title={MODULE_LABELS[module]}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-gradient-to-r from-[#7C3AED]/10 to-[#A78BFA]/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <GrixiAiLogo size={24} showText={false} animate={false} />
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    GRIXI AI
                  </p>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: MODULE_COLORS[module] }}
                    />
                    <span className="text-[9px] text-[var(--text-muted)]">
                      {MODULE_LABELS[module]}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleOpenFull}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                  title="Abrir chat completo"
                >
                  <Maximize2 size={13} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <GrixiAiLogo size={40} showText={false} animate />
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      GRIXI{" "}
                      <span className="bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] bg-clip-text text-transparent">
                        AI
                      </span>
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                      Contexto: {MODULE_LABELS[module]}
                    </p>
                  </div>
                  <p className="mt-2 max-w-[240px] text-[10px] leading-relaxed text-[var(--text-secondary)]">
                    Pregunta lo que necesites sobre{" "}
                    {MODULE_LABELS[module].toLowerCase()} y obtén respuestas
                    inteligentes al instante.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                          msg.role === "user"
                            ? "bg-[var(--brand)] text-white"
                            : "border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                        )}
                      >
                        {msg.content || (
                          <span className="flex items-center gap-1 text-[var(--text-muted)]">
                            <motion.span
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand)]"
                            />
                            <motion.span
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: 0.2,
                              }}
                              className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand)]"
                            />
                            <motion.span
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: 0.4,
                              }}
                              className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand)]"
                            />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-[var(--border)] px-3 py-2">
              <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Pregunta algo..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                  disabled={isStreaming}
                />
                {isStreaming ? (
                  <button
                    onClick={() => {
                      abortRef.current?.abort();
                      setIsStreaming(false);
                    }}
                    className="rounded-lg p-1.5 text-[var(--error)]"
                  >
                    <Square size={12} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className={cn(
                      "rounded-lg p-1.5 transition-all",
                      input.trim()
                        ? "bg-[var(--brand)] text-white"
                        : "text-[var(--text-muted)]"
                    )}
                  >
                    <Send size={12} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
