"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useDragControls, useMotionValue } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Shield,
  Warehouse,
  Sparkles,
  DollarSign,
  ShoppingCart,
  Search,
  Bell,
  Moon,
  Sun,
  Settings,
  LogOut,
  X,
  Send,
  Maximize2,
  Square,
  GripVertical,
  History,
  Plus,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { logLogoutEvent } from "@/lib/actions/audit";
import { useThemeTransition } from "@/lib/hooks/use-theme-transition";
import { GrixiAiLogo } from "@/features/ai/components/grixi-ai-logo";
import { createConversation, listConversations, getConversationMessages } from "@/features/ai/actions/conversations";
import type { AiModule, ChatMessage as ChatMessageType, Conversation } from "@/features/ai/types";
import type { User } from "@supabase/supabase-js";
import { WidgetMessageContent } from "./widget-message-content";

// ── Module definitions ──────────────────────────
type NavModule = {
  id: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  color: string;
  glowColor: string;
  category: string;
  aiModule: AiModule;
};

const MODULES: NavModule[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, color: "#06B6D4", glowColor: "rgba(6,182,212,0.3)", category: "PRINCIPAL", aiModule: "dashboard" },
  { id: "finanzas", label: "Finanzas", href: "/finanzas", icon: DollarSign, color: "#8B5CF6", glowColor: "rgba(139,92,246,0.3)", category: "OPERACIONES", aiModule: "finanzas" },
  { id: "compras", label: "Compras", href: "/compras", icon: ShoppingCart, color: "#F97316", glowColor: "rgba(249,115,22,0.3)", category: "OPERACIONES", aiModule: "compras" },
  { id: "almacenes", label: "Almacenes", href: "/almacenes", icon: Warehouse, color: "#10B981", glowColor: "rgba(16,185,129,0.3)", category: "OPERACIONES", aiModule: "almacenes" },
  { id: "usuarios", label: "Usuarios", href: "/usuarios", icon: Users, color: "#F59E0B", glowColor: "rgba(245,158,11,0.3)", category: "EQUIPO", aiModule: "usuarios" },
  { id: "admin", label: "Admin", href: "/administracion", icon: Shield, color: "#F43F5E", glowColor: "rgba(244,63,94,0.3)", category: "EQUIPO", aiModule: "administracion" },
  { id: "ai", label: "GRIXI AI", href: "/ai", icon: Sparkles, color: "#A855F7", glowColor: "rgba(168,85,247,0.3)", category: "INTELIGENCIA", aiModule: "general" },
];

const CATEGORIES = [...new Set(MODULES.map((m) => m.category))];

function openCommandPalette() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
  );
}

// ── Main Component ──────────────────────────────
export function GrixiOrb() {
  const pathname = usePathname();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // Navigation states
  const [state, setState] = useState<"orb" | "peek" | "panel">("orb");
  const [hoveredPeekId, setHoveredPeekId] = useState<string | null>(null);
  const [showUserPopover, setShowUserPopover] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const { theme, toggleTheme } = useThemeTransition();
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // AI Chat states
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<ChatMessageType[]>([]);
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiConvId, setAiConvId] = useState<string | null>(null);
  const [panelSize, setPanelSize] = useState({ w: 380, h: 480 });
  const [widgetConversations, setWidgetConversations] = useState<Conversation[]>([]);
  const [showWidgetHistory, setShowWidgetHistory] = useState(false);
  const panelX = useMotionValue(0);
  const panelY = useMotionValue(0);
  const aiTextareaRef = useRef<HTMLTextAreaElement>(null);
  const aiMessagesEndRef = useRef<HTMLDivElement>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const isResizingRef = useRef(false);
  const dragControls = useDragControls();

  // Load conversations when widget opens
  useEffect(() => {
    if (aiOpen) {
      listConversations().then(({ conversations }) => {
        setWidgetConversations(conversations || []);
      });
    }
  }, [aiOpen]);

  // Load a specific conversation into the widget
  const handleWidgetSelectConv = useCallback(async (conv: Conversation) => {
    setAiConvId(conv.id);
    setShowWidgetHistory(false);
    const { messages } = await getConversationMessages(conv.id);
    setAiMessages(messages || []);
  }, []);

  // Start a new chat in the widget
  const handleWidgetNewChat = useCallback(() => {
    setAiConvId(null);
    setAiMessages([]);
    setShowWidgetHistory(false);
  }, []);

  // Load saved widget position & size from Supabase
  useEffect(() => {
    async function loadLayout() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("user_preferences")
          .select("value")
          .eq("key", "ai_widget_layout")
          .single();
        if (data?.value) {
          const { x, y, w, h } = data.value as { x: number; y: number; w: number; h: number };
          if (typeof x === "number") panelX.set(x);
          if (typeof y === "number") panelY.set(y);
          if (typeof w === "number" && typeof h === "number") {
            setPanelSize({ w, h });
          }
        }
      } catch { /* no saved pref yet */ }
    }
    loadLayout();
  }, []);

  const saveWidgetLayout = useCallback((overrides?: { w?: number; h?: number }) => {
    const payload = {
      x: panelX.get(),
      y: panelY.get(),
      w: overrides?.w ?? panelSize.w,
      h: overrides?.h ?? panelSize.h,
    };
    // Save to Supabase via RPC
    const supabase = createClient();
    supabase.rpc("upsert_user_preference", {
      p_key: "ai_widget_layout",
      p_value: payload,
    }).then(() => {});
  }, [panelSize, panelX, panelY]);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });
  }, []);

  // Auto-scroll AI messages
  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages, aiStreaming]);

  // Auto-resize AI textarea
  useEffect(() => {
    const ta = aiTextareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 100)}px`;
    }
  }, [aiInput]);

  // User info
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuario";
  const userEmail = user?.email || "";
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const userInitial = userName.charAt(0).toUpperCase();

  // Active module
  const activeModule = MODULES.find(
    (m) => pathname === m.href || pathname.startsWith(m.href + "/")
  );
  const activeColor = activeModule?.color || "#7C3AED";
  const currentAiModule: AiModule = activeModule?.aiModule || "general";
  const isAiPage = pathname.startsWith("/ai");

  // ── Navigation handlers ───────────────────
  const handleMouseEnter = useCallback(() => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    if (state === "orb") setState("peek");
  }, [state]);

  const handleMouseLeave = useCallback(() => {
    if (showUserPopover) return;
    collapseTimerRef.current = setTimeout(() => {
      if (state === "peek") setState("orb");
      if (state === "panel") setState("orb");
      setShowUserPopover(false);
    }, 300);
  }, [state, showUserPopover]);

  const handleOrbClick = useCallback(() => {
    setState((prev) => (prev === "panel" ? "orb" : "panel"));
    setShowUserPopover(false);
  }, []);

  const handleNavigate = useCallback(
    (href: string) => {
      router.push(href);
      setState("orb");
      setShowUserPopover(false);
    },
    [router]
  );

  const handleSignOut = useCallback(async () => {
    setShowUserPopover(false);
    setState("orb");
    await logLogoutEvent();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  // ── AI Chat handlers ──────────────────────
  const handleAiSend = useCallback(async () => {
    const text = aiInput.trim();
    if (!text || aiStreaming) return;
    setAiInput("");

    let currentConvId = aiConvId;
    if (!currentConvId) {
      const { conversation } = await createConversation(currentAiModule);
      if (!conversation) return;
      currentConvId = conversation.id;
      setAiConvId(currentConvId);
    }

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

    setAiMessages((prev) => [...prev, userMsg, aiMsg]);
    setAiStreaming(true);

    const controller = new AbortController();
    aiAbortRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: currentConvId,
          message: text,
          module: currentAiModule,
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
              setAiMessages((prev) =>
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
        setAiMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: "Error al conectar con AI" }
              : m
          )
        );
      }
    } finally {
      setAiStreaming(false);
      aiAbortRef.current = null;
      // Refresh widget conversation list
      listConversations().then(({ conversations }) => {
        setWidgetConversations(conversations || []);
      });
    }
  }, [aiInput, aiStreaming, aiConvId, currentAiModule]);

  const handleAiOpenFull = useCallback(() => {
    const url = aiConvId ? `/ai?c=${aiConvId}` : "/ai";
    router.push(url);
    setAiOpen(false);
    setState("orb");
  }, [aiConvId, router]);

  const isPeek = state === "peek";
  const isPanel = state === "panel";

  return (
    <>
      {/* ── AI Chat Panel (floating, bottom-left above orb area) ── */}
      <AnimatePresence>
        {aiOpen && !isAiPage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            drag
            dragMomentum={false}
            dragElastic={0}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={() => saveWidgetLayout()}
            className="fixed bottom-20 left-4 z-[51] flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]/95 shadow-2xl backdrop-blur-xl"
            style={{ width: panelSize.w, height: panelSize.h, x: panelX, y: panelY }}
          >
            {/* Header — drag handle */}
            <div
              className="flex cursor-grab items-center justify-between border-b border-[var(--border)] px-4 py-2.5 active:cursor-grabbing select-none"
              style={{ background: `linear-gradient(135deg, ${activeColor}10, transparent)`, touchAction: "none" }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                dragControls.start(e);
              }}
            >
              <div className="flex items-center gap-2">
                <GrixiAiLogo size={22} showText={false} animate={false} />
                <div>
                  <p className="text-[11px] font-semibold text-[var(--text-primary)]">
                    GRIXI AI
                  </p>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: activeColor }}
                    />
                    <span className="text-[8px] text-[var(--text-muted)]">
                      {activeModule?.label || "General"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleWidgetNewChat}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                  title="Nueva conversación"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => setShowWidgetHistory(!showWidgetHistory)}
                  className={cn(
                    "rounded-lg p-1.5 transition-colors",
                    showWidgetHistory
                      ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                  )}
                  title="Historial"
                >
                  <History size={12} />
                </button>
                <button
                  onClick={handleAiOpenFull}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                  title="Abrir chat completo"
                >
                  <Maximize2 size={12} />
                </button>
                <button
                  onClick={() => setAiOpen(false)}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* History panel */}
            <AnimatePresence>
              {showWidgetHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-b border-[var(--border)]"
                >
                  <div className="max-h-60 overflow-y-auto px-2 py-2">
                    <p className="mb-1.5 px-2 text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Conversaciones recientes
                    </p>
                    {widgetConversations.length === 0 ? (
                      <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                        <MessageSquare size={16} className="text-[var(--text-muted)]" />
                        <p className="text-[10px] text-[var(--text-muted)]">Sin conversaciones</p>
                      </div>
                    ) : (
                      widgetConversations.slice(0, 20).map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => handleWidgetSelectConv(conv)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                            aiConvId === conv.id
                              ? "bg-[var(--brand)]/10 text-[var(--text-primary)]"
                              : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                          )}
                        >
                          <MessageSquare size={11} className="shrink-0 text-[var(--text-muted)]" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium">
                              {conv.title || "Nueva conversación"}
                            </p>
                            <p className="text-[8px] text-[var(--text-muted)]">
                              {new Date(conv.last_message_at).toLocaleDateString("es", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          {conv.is_pinned && (
                            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {aiMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <GrixiAiLogo size={36} showText={false} animate />
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      GRIXI{" "}
                      <span className="bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] bg-clip-text text-transparent">
                        AI
                      </span>
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                      Contexto: {activeModule?.label || "General"}
                    </p>
                  </div>
                  <p className="mt-1 max-w-[220px] text-[10px] leading-relaxed text-[var(--text-secondary)]">
                    Pregunta lo que necesites y obtén respuestas inteligentes al instante.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {aiMessages.map((msg, idx) => {
                    const isLastAssistant =
                      msg.role === "assistant" &&
                      idx === aiMessages.length - 1;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-xl px-3 py-2",
                            msg.role === "user"
                              ? "bg-[var(--brand)] text-white"
                              : "border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                          )}
                        >
                          {msg.content || (isLastAssistant && aiStreaming) ? (
                            <WidgetMessageContent
                              content={msg.content}
                              isUser={msg.role === "user"}
                              isStreaming={isLastAssistant && aiStreaming}
                            />
                          ) : (
                            <span className="flex items-center gap-1 text-[var(--text-muted)]">
                              <motion.span
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1, repeat: Infinity }}
                                className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand)]"
                              />
                              <motion.span
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                                className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand)]"
                              />
                              <motion.span
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                                className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand)]"
                              />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={aiMessagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-[var(--border)] px-3 py-2">
              <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2">
                <textarea
                  ref={aiTextareaRef}
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAiSend();
                    }
                  }}
                  placeholder="Pregunta algo..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                  disabled={aiStreaming}
                />
                {aiStreaming ? (
                  <button
                    onClick={() => {
                      aiAbortRef.current?.abort();
                      setAiStreaming(false);
                    }}
                    className="rounded-lg p-1.5 text-[var(--error)]"
                  >
                    <Square size={12} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={handleAiSend}
                    disabled={!aiInput.trim()}
                    className={cn(
                      "rounded-lg p-1.5 transition-all",
                      aiInput.trim()
                        ? "bg-[var(--brand)] text-white"
                        : "text-[var(--text-muted)]"
                    )}
                  >
                    <Send size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Resize handle — top-right corner (panel is bottom-anchored, so resize grows up+right) */}
            <div
              className="absolute top-0 right-0 flex h-5 w-5 cursor-ne-resize items-start justify-end p-0.5 text-[var(--text-muted)]/40 hover:text-[var(--text-muted)]"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                isResizingRef.current = true;
                const startX = e.clientX;
                const startY = e.clientY;
                const startW = panelSize.w;
                const startH = panelSize.h;

                const onMove = (ev: PointerEvent) => {
                  const newW = Math.min(700, Math.max(280, startW + (ev.clientX - startX)));
                  const newH = Math.min(800, Math.max(300, startH - (ev.clientY - startY)));
                  setPanelSize({ w: newW, h: newH });
                };
                const onUp = () => {
                  isResizingRef.current = false;
                  saveWidgetLayout({ w: panelSize.w, h: panelSize.h });
                  document.removeEventListener("pointermove", onMove);
                  document.removeEventListener("pointerup", onUp);
                };
                document.addEventListener("pointermove", onMove);
                document.addEventListener("pointerup", onUp);
              }}
            >
              <GripVertical size={10} className="rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Orb Container (desktop only, mobile uses MobileNav orb) ── */}
      <div
        ref={containerRef}
        className="fixed bottom-4 left-4 z-50 hidden md:block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* ── User Popover ── */}
        <AnimatePresence>
          {showUserPopover && (
            <motion.div
              initial={{ opacity: 0, x: -8, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="absolute bottom-0 left-[calc(100%+8px)] w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl"
            >
              <div className="px-3 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-9 w-9 shrink-0">
                    <div className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-[var(--brand)]/20">
                      {userAvatar ? (
                        <Image src={userAvatar} alt={userName} width={36} height={36} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[var(--brand)] text-xs font-bold text-white">{userInitial}</div>
                      )}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-surface)] bg-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{userName}</p>
                    <p className="truncate text-[10px] text-[var(--text-muted)]">{userEmail}</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-[var(--border)]" />
              <div className="p-1.5">
                <Link
                  href="/dashboard"
                  onClick={() => { setShowUserPopover(false); setState("orb"); }}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                >
                  <Settings size={13} />
                  Configuración
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                >
                  <LogOut size={13} />
                  Cerrar sesión
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── PEEK: Compact icon strip + tooltip labels ── */}
        <AnimatePresence>
          {isPeek && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 12 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              className="mb-2 overflow-visible rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]/95 p-1.5 shadow-2xl backdrop-blur-xl"
            >
              {MODULES.map((mod, i) => {
                const isActive = activeModule?.id === mod.id;
                return (
                  <motion.button
                    key={mod.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.025 }}
                    onClick={() => handleNavigate(mod.href)}
                    onMouseEnter={() => setHoveredPeekId(mod.id)}
                    onMouseLeave={() => setHoveredPeekId(null)}
                    className={cn(
                      "group relative flex w-full items-center justify-center rounded-xl p-2.5 transition-all duration-150",
                      isActive
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                    )}
                    style={isActive ? { backgroundColor: `${mod.color}12` } : undefined}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="peek-active"
                        className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full"
                        style={{ backgroundColor: mod.color }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    <div className="relative">
                      <div
                        className="absolute inset-0 rounded-md opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"
                        style={{ backgroundColor: mod.glowColor }}
                      />
                      <mod.icon
                        size={17}
                        className="relative transition-transform duration-200 group-hover:scale-110"
                        style={{ color: isActive ? mod.color : undefined }}
                      />
                    </div>
                    {/* Floating tooltip */}
                    <AnimatePresence>
                      {hoveredPeekId === mod.id && (
                        <motion.span
                          initial={{ opacity: 0, x: -4, scale: 0.9 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -4, scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 450, damping: 22 }}
                          className="absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] font-semibold shadow-lg"
                          style={{
                            backgroundColor: "var(--bg-surface)",
                            color: isActive ? mod.color : "var(--text-primary)",
                          }}
                        >
                          {mod.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── PANEL: Full sidebar panel ── */}
        <AnimatePresence>
          {isPanel && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="mb-2 w-[210px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]/95 shadow-2xl backdrop-blur-xl"
            >
              {/* Brand */}
              <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-3.5 py-3">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-lg bg-[var(--brand)] opacity-10 blur-md" />
                  <Image src="/brand/icon.png" alt="GRIXI" width={24} height={24} className="relative rounded-lg" />
                </div>
                <div>
                  <span className="font-serif text-sm font-semibold italic text-[var(--text-primary)]">GRIXI</span>
                  <p className="text-[8px] font-medium text-[var(--text-muted)]">Enterprise Platform</p>
                </div>
              </div>

              {/* Categories */}
              <nav className="px-1.5 py-2">
                {CATEGORIES.map((cat, ci) => {
                  const catModules = MODULES.filter((m) => m.category === cat);
                  return (
                    <div key={cat} className={cn(ci > 0 && "mt-2.5")}>
                      <p className="mb-1 px-2.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        {cat}
                      </p>
                      {catModules.map((mod, i) => {
                        const isActive = activeModule?.id === mod.id;
                        return (
                          <motion.button
                            key={mod.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: ci * 0.04 + i * 0.03 }}
                            onClick={() => handleNavigate(mod.href)}
                            className={cn(
                              "group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150",
                              isActive
                                ? "text-[var(--text-primary)]"
                                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                            )}
                            style={isActive ? { backgroundColor: `${mod.color}12` } : undefined}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="panel-active"
                                className="absolute left-0.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full"
                                style={{ backgroundColor: mod.color }}
                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                              />
                            )}
                            <div className="relative shrink-0">
                              <div
                                className="absolute inset-0 rounded-md opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"
                                style={{ backgroundColor: mod.glowColor }}
                              />
                              <mod.icon
                                size={14}
                                className="relative transition-transform duration-200 group-hover:scale-110"
                                style={{ color: isActive ? mod.color : undefined }}
                              />
                            </div>
                            <span>{mod.label}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  );
                })}
              </nav>

              {/* Search */}
              <div className="border-t border-[var(--border)] px-2 py-1.5">
                <button
                  onClick={openCommandPalette}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
                >
                  <Search size={13} />
                  <span className="flex-1 text-left text-[11px]">Buscar...</span>
                  <kbd className="rounded border border-[var(--border)] bg-[var(--bg-muted)] px-1 py-px text-[8px] font-medium">⌘K</kbd>
                </button>
              </div>

              {/* Utilities */}
              <div className="border-t border-[var(--border)] px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    <button className="relative rounded-lg p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]" title="Notificaciones">
                      <Bell size={14} />
                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--error)]" />
                    </button>
                    {mounted && (
                      <button
                        onClick={(e) => toggleTheme(e)}
                        className="rounded-lg p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
                        title="Cambiar tema"
                      >
                        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowUserPopover(!showUserPopover)}
                    className="rounded-lg p-1.5 transition-all hover:bg-[var(--bg-muted)]"
                    title={userName}
                  >
                    <div className="relative h-6 w-6">
                      <div className="h-6 w-6 overflow-hidden rounded-full ring-1.5 ring-[var(--border)]">
                        {userAvatar ? (
                          <Image src={userAvatar} alt={userName} width={24} height={24} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[var(--brand)] text-[8px] font-bold text-white">{userInitial}</div>
                        )}
                      </div>
                      <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border-[1.5px] border-[var(--bg-surface)] bg-emerald-500" />
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── THE ORB + AI SATELLITE ──────────────── */}
        <div className="flex items-center gap-2">
          {/* Main Orb */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleOrbClick}
            className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl transition-shadow hover:shadow-2xl"
            style={{
              boxShadow: `0 0 20px ${activeColor}20, 0 4px 12px rgba(0,0,0,0.15)`,
            }}
          >
            {/* Glow ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, ${activeColor}40, transparent, ${activeColor}20, transparent, ${activeColor}40)`,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            {/* Active module icon or logo */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-surface)]">
              <AnimatePresence mode="wait">
                {activeModule ? (
                  <motion.div
                    key={activeModule.id}
                    initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.6, rotate: 30 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    className="relative"
                  >
                    <activeModule.icon size={20} style={{ color: activeModule.color }} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="grixi-logo"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  >
                    <Image src="/brand/icon.png" alt="GRIXI" width={22} height={22} className="relative rounded-md" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Active dot */}
            {activeModule && (
              <motion.span
                layoutId="orb-dot"
                className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-surface)]"
                style={{ backgroundColor: activeModule.color }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              />
            )}
          </motion.button>

          {/* ── AI Satellite Bubble (always visible) ── */}
          {!isAiPage && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setAiOpen(!aiOpen)}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-full border shadow-lg transition-all",
                aiOpen
                  ? "border-[#7C3AED]/40 bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white shadow-[#7C3AED]/30"
                  : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[#7C3AED]/30 hover:text-[#A78BFA] hover:shadow-[#7C3AED]/20"
              )}
              title="GRIXI AI"
            >
              {/* Breathing pulse when not open */}
              {!aiOpen && (
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full border border-[#A78BFA]"
                />
              )}
              <Sparkles size={15} className="relative" />
              {/* Context dot */}
              <span
                className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border-[1.5px] border-[var(--bg-surface)]"
                style={{ backgroundColor: activeColor }}
              />
            </motion.button>
          )}
        </div>
      </div>
    </>
  );
}
