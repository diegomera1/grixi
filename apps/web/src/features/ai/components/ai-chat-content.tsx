"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  MessageSquare,
  Lightbulb,
  BarChart3,
  Package,
  AlertTriangle,
} from "lucide-react";
import { sendChatMessage } from "@/features/ai/actions/chat";
import { cn } from "@/lib/utils/cn";
import ReactMarkdown from "react-markdown";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const quickPrompts = [
  {
    label: "Estado del inventario",
    prompt: "¿Cuál es el estado actual del inventario en los almacenes?",
    icon: Package,
  },
  {
    label: "Optimizar almacenes",
    prompt: "Dame sugerencias para optimizar la ocupación de los almacenes",
    icon: Lightbulb,
  },
  {
    label: "Resumen de actividad",
    prompt: "Dame un resumen de la actividad reciente en el sistema",
    icon: BarChart3,
  },
  {
    label: "Productos críticos",
    prompt: "¿Qué productos están por debajo del stock mínimo?",
    icon: AlertTriangle,
  },
];

export function AiChatContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const userMessage = text || input.trim();
    if (!userMessage || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Call Server Action
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const { response, error } = await sendChatMessage(history, userMessage);

    const aiMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: error || response,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, aiMsg]);
    setIsLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Welcome screen */
          <div className="flex h-full flex-col items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-light)] shadow-lg shadow-[var(--brand)]/20"
            >
              <Sparkles size={32} className="text-white" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-2 text-2xl font-bold text-[var(--text-primary)]"
            >
              Grixi AI
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8 max-w-md text-center text-sm text-[var(--text-secondary)]"
            >
              Tu asistente inteligente para gestión de almacenes, inventario y análisis de datos.
              Powered by Gemini.
            </motion.p>

            {/* Quick prompts */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid w-full max-w-lg grid-cols-2 gap-3"
            >
              {quickPrompts.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => handleSend(qp.prompt)}
                  className="group flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-left transition-all hover:border-[var(--brand)]/30 hover:shadow-md"
                >
                  <qp.icon size={18} className="mt-0.5 shrink-0 text-[var(--brand)]" />
                  <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                    {qp.label}
                  </span>
                </button>
              ))}
            </motion.div>
          </div>
        ) : (
          /* Chat messages */
          <div className="space-y-6 py-6">
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-light)]">
                      <Bot size={16} className="text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-3",
                      msg.role === "user"
                        ? "bg-[var(--brand)] text-white"
                        : "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_li]:text-[var(--text-primary)] [&_p]:text-[var(--text-primary)] [&_strong]:text-[var(--text-primary)] [&_code]:rounded [&_code]:bg-[var(--bg-muted)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    )}
                    <p
                      className={cn(
                        "mt-2 text-[10px]",
                        msg.role === "user" ? "text-white/60" : "text-[var(--text-muted)]"
                      )}
                    >
                      {msg.timestamp.toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-muted)]">
                      <User size={16} className="text-[var(--text-muted)]" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-light)]">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
                  <Loader2 size={16} className="animate-spin text-[var(--brand)]" />
                  <span className="text-sm text-[var(--text-muted)]">Grixi AI está pensando...</span>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-end gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 focus-within:border-[var(--brand)]">
          <MessageSquare size={18} className="mb-0.5 shrink-0 text-[var(--text-muted)]" />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje..."
            rows={1}
            className="max-h-32 flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-white transition-all hover:shadow-lg hover:shadow-[var(--brand)]/20 disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">
          Grixi AI puede cometer errores. Verifica la información importante.
        </p>
      </div>
    </div>
  );
}
