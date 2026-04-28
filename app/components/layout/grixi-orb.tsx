import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { apiFetch } from "~/lib/api-fetch";
import { useNavigate, useLocation, useRouteLoaderData } from "react-router";
import { motion, AnimatePresence, useDragControls, useMotionValue } from "framer-motion";
import {
  LayoutDashboard, DollarSign, Shield,
  Sparkles, Settings,
  Moon, Sun, LogOut, Search, Bell, X, Send, Plus,
  MessageSquare, History, Maximize2, Square,
  GripVertical, AudioLines,
  Check, CheckCheck, Trash2, ExternalLink,
  Info, CheckCircle2, AlertTriangle, AlertCircle, Zap,
  Warehouse, ShoppingCart, Users, Truck, Bot,
  UserCircle,
} from "lucide-react";
import { useThemeTransition } from "~/lib/hooks/use-theme-transition";
import { GrixiAiLogo } from "~/features/ai/components/grixi-ai-logo";
import { WelcomeScreen } from "~/features/ai/components/welcome-screen";
import { WidgetMessageContent } from "~/features/ai/components/widget-message-content";
import type { AiModule, ChatMessage, Conversation } from "~/features/ai/types";
import type { TenantContext } from "~/routes/authenticated";
import type { Notification } from "~/lib/hooks/use-notifications";
import { createBrowserClient } from "@supabase/ssr";

// ─── Module Definitions ─────────────────────────────────
type NavModule = {
  id: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  color: string;
  glowColor: string;
  category: string;
  aiModule: AiModule;
  adminOnly?: boolean;
  /** Permission key required to see this module. If omitted, always visible. */
  requiredPermission?: string;
  /** If true, user needs ANY of these permissions */
  requiredPermissionAny?: string[];
};

const MODULES: NavModule[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, color: "#06B6D4", glowColor: "rgba(6,182,212,0.3)", category: "PRINCIPAL", aiModule: "dashboard", requiredPermission: "dashboard.view" },
  { id: "finanzas", label: "Finanzas", href: "/finanzas", icon: DollarSign, color: "#8B5CF6", glowColor: "rgba(139,92,246,0.3)", category: "OPERACIONES", aiModule: "finanzas", requiredPermission: "finance.view" },
  { id: "admin", label: "Administrativo", href: "/admin", icon: Shield, color: "#F43F5E", glowColor: "rgba(244,63,94,0.3)", category: "GESTIÓN", aiModule: "administracion", adminOnly: true },
  { id: "configuracion", label: "Configuración", href: "/configuracion", icon: Settings, color: "#F59E0B", glowColor: "rgba(245,158,11,0.3)", category: "GESTIÓN", aiModule: "general", requiredPermissionAny: ["org.configure", "members.manage", "roles.manage"] },
  { id: "ai", label: "GRIXI AI", href: "/ai", icon: Sparkles, color: "#A855F7", glowColor: "rgba(168,85,247,0.3)", category: "INTELIGENCIA", aiModule: "general", requiredPermission: "ai.chat" },
];

const CATEGORIES = [...new Set(MODULES.map((m) => m.category))];

function openCommandPalette() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
  );
}

// ─── Notification Helpers ───────────────────────────────
const NOTIF_TYPE_CONFIG: Record<string, { color: string; Icon: typeof Info }> = {
  info: { color: "#3B82F6", Icon: Info },
  success: { color: "#10B981", Icon: CheckCircle2 },
  warning: { color: "#F59E0B", Icon: AlertTriangle },
  error: { color: "#EF4444", Icon: AlertCircle },
  action: { color: "#8B5CF6", Icon: Zap },
};

const NOTIF_MODULE_ICONS: Record<string, typeof Info> = {
  system: Settings, dashboard: LayoutDashboard, finanzas: DollarSign,
  almacenes: Warehouse, compras: ShoppingCart, rrhh: Users,
  flota: Truck, ai: Sparkles, audit: Shield, team: Users, admin: Shield,
};

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}sem`;
}

interface OrbNotifs {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  deleteNotification: (id: string) => void;
}

// ─── Main Component ─────────────────────────────────────
export function GrixiOrb({ data, notifs }: { data: TenantContext; notifs?: OrbNotifs }) {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useThemeTransition();

  // Navigation state
  const [state, setState] = useState<"orb" | "peek" | "panel">("orb");
  const [hoveredPeekId, setHoveredPeekId] = useState<string | null>(null);
  const [hoveredAi, setHoveredAi] = useState(false);
  const aiHoverTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [showUserPopover, setShowUserPopover] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const isThemeTransitionRef = useRef(false);

  // AI Chat state
  const [aiOpen, setAiOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [panelSize, setPanelSize] = useState({ w: 380, h: 480 });
  const panelX = useMotionValue(0);
  const panelY = useMotionValue(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isResizingRef = useRef(false);
  const dragControls = useDragControls();

  // Supabase lazy init
  const rootData = useRouteLoaderData("root") as { env?: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string } } | undefined;
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);

  function getSupabase() {
    if (supabaseRef.current) return supabaseRef.current;
    const url = rootData?.env?.SUPABASE_URL;
    const key = rootData?.env?.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseRef.current = createBrowserClient(url, key);
    return supabaseRef.current;
  }

  useEffect(() => { setMounted(true); }, []);

  // Scroll AI messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 100)}px`;
    }
  }, [input]);

  // Load conversations when AI panel opens
  useEffect(() => {
    if (aiOpen) loadConversations();
  }, [aiOpen]);

  // ─── Active Module Resolution ───────────────────────
  const activeModule = useMemo(() =>
    MODULES.find(
      (m) => location.pathname === m.href || location.pathname.startsWith(m.href + "/")
    ), [location.pathname]);

  const activeColor = activeModule?.color || "#7C3AED";
  const currentAiModule: AiModule = activeModule?.aiModule || "general";
  const isAiPage = location.pathname.startsWith("/ai");

  // ─── User Info ──────────────────────────────────────
  const userName = data.user.name || data.user.email || "Usuario";
  const userEmail = data.user.email || "";
  const userAvatar = data.user.avatar || null;
  const userInitial = userName.charAt(0).toUpperCase();

  // ─── Navigation Handlers ────────────────────────────
  const handleMouseEnter = useCallback(() => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    if (state === "orb") setState("peek");
  }, [state]);

  const handleMouseLeave = useCallback(() => {
    if (showUserPopover) return;
    // Don't collapse during theme transitions (View Transition API fires mouseleave)
    if (isThemeTransitionRef.current) return;
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
      navigate(href);
      setState("orb");
      setShowUserPopover(false);
    }, [navigate]);

  const handleSignOut = useCallback(() => {
    // 1. Clear ALL supabase auth cookies manually (bulletproof)
    document.cookie.split(";").forEach((c) => {
      const name = c.trim().split("=")[0];
      if (name.startsWith("sb-") || name === "grixi_org") {
        document.cookie = `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    });

    // 2. Try supabase signOut in background (best-effort, don't block)
    try {
      const sb = getSupabase();
      if (sb) sb.auth.signOut().catch(() => {});
    } catch { /* ignore */ }

    // 3. Hard redirect immediately — no SPA navigate, no awaiting
    window.location.href = "/";
  }, []);

  // Filtered modules based on permissions + admin status
  const visibleModules = useMemo(() => {
    const perms = data.permissions || [];
    const isPA = data.isPlatformAdmin;
    return MODULES.filter((m) => {
      // adminOnly modules: only platform admins
      if (m.adminOnly && !isPA) return false;
      // Platform admins see everything
      if (isPA) return true;
      // Check required single permission
      if (m.requiredPermission && !perms.includes(m.requiredPermission)) return false;
      // Check required any permission
      if (m.requiredPermissionAny && !m.requiredPermissionAny.some((k) => perms.includes(k))) return false;
      return true;
    });
  }, [data.isPlatformAdmin, data.permissions]);

  // ─── Supabase Helpers ───────────────────────────────
  async function loadConversations() {
    const sb = getSupabase();
    if (!sb) return;
    const { data: convs } = await sb
      .from("ai_conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(20);
    if (convs) setConversations(convs as Conversation[]);
  }

  async function loadConversation(convId: string) {
    setCurrentConvId(convId);
    setShowHistory(false);
    const sb = getSupabase();
    if (!sb) return;
    const { data: msgs } = await sb
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (msgs) {
      setMessages(msgs.map((m: any) => ({
        ...m,
        attachments: typeof m.attachments === "string" ? JSON.parse(m.attachments) : m.attachments || [],
      })));
    }
  }

  async function startNewConversation() {
    const orgId = data.currentOrg?.id;
    const sb = getSupabase();
    if (!sb) return null;
    const { data: conv, error } = await sb
      .from("ai_conversations")
      .insert({ org_id: orgId, user_id: data.user.id, module: currentAiModule })
      .select()
      .single();
    if (conv && !error) {
      setCurrentConvId(conv.id);
      setMessages([]);
      setShowHistory(false);
    }
    return conv?.id || null;
  }

  // ─── AI Chat Send ──────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isStreaming) return;
    setInput("");

    let convId = currentConvId;
    if (!convId) {
      convId = await startNewConversation();
      if (!convId) return;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      role: "user",
      content: msg,
      attachments: [],
      model_used: "user",
      tokens_used: 0,
      created_at: new Date().toISOString(),
    };

    const aiMsgId = crypto.randomUUID();
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      conversation_id: convId,
      role: "assistant",
      content: "",
      attachments: [],
      model_used: "gemini-2.0-flash-lite",
      tokens_used: 0,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          message: msg,
          modules: [currentAiModule],
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
            const payload = JSON.parse(line.slice(6).trim());
            if (payload.done || payload.error) break;
            if (payload.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, content: m.content + payload.text } : m
                )
              );
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // user stopped
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: "❌ Error al conectar con GRIXI AI." } : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      loadConversations();
    }
  }, [input, isStreaming, currentConvId, currentAiModule, data]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleAiOpenFull = useCallback(() => {
    const url = currentConvId ? `/ai?c=${currentConvId}` : "/ai";
    navigate(url);
    setAiOpen(false);
    setState("orb");
  }, [currentConvId, navigate]);

  const handleWidgetNewChat = useCallback(() => {
    setCurrentConvId(null);
    setMessages([]);
    setShowHistory(false);
  }, []);

  const saveWidgetLayout = useCallback((overrides?: { w?: number; h?: number }) => {
    /* future: persist to user_preferences via Supabase */
  }, []);

  const isPeek = state === "peek";
  const isPanel = state === "panel";

  // ─── Greeting ───────────────────────────────────────
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  return (
    <>
      {/* ── AI Chat Panel (floating, bottom-left above orb) ── */}
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
            className="fixed bottom-20 left-4 z-51 flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl"
            style={{ width: panelSize.w, height: panelSize.h, x: panelX, y: panelY }}
          >
            {/* Header — drag handle */}
            <div
              className="flex cursor-grab items-center justify-between border-b border-border px-4 py-2.5 active:cursor-grabbing select-none"
              style={{ background: `linear-gradient(135deg, ${activeColor}10, transparent)`, touchAction: "none" }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                dragControls.start(e);
              }}
            >
              <div className="flex items-center gap-2">
                <GrixiAiLogo size={22} showText={false} animate={false} />
                <div>
                  <p className="text-[11px] font-semibold text-text-primary">GRIXI AI</p>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activeColor }} />
                    <span className="text-[8px] text-text-muted">
                      {activeModule?.label || "General"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={handleWidgetNewChat} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted hover:text-text-primary" title="Nueva conversación">
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`rounded-lg p-1.5 transition-colors ${showHistory ? "bg-brand/10 text-brand" : "text-text-muted hover:bg-muted hover:text-text-primary"}`}
                  title="Historial"
                >
                  <History size={12} />
                </button>
                <button onClick={handleAiOpenFull} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted hover:text-text-primary" title="Abrir completo">
                  <Maximize2 size={12} />
                </button>
                <button onClick={() => setAiOpen(false)} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted hover:text-text-primary">
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* History panel */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-b border-border"
                >
                  <div className="max-h-60 overflow-y-auto px-2 py-2">
                    <p className="mb-1.5 px-2 text-[8px] font-bold uppercase tracking-wider text-text-muted">
                      Conversaciones recientes
                    </p>
                    {conversations.length === 0 ? (
                      <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                        <MessageSquare size={16} className="text-text-muted" />
                        <p className="text-[10px] text-text-muted">Sin conversaciones</p>
                      </div>
                    ) : (
                      conversations.slice(0, 20).map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => loadConversation(conv.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                            currentConvId === conv.id
                              ? "bg-brand/10 text-text-primary"
                              : "text-text-secondary hover:bg-muted"
                          }`}
                        >
                          <MessageSquare size={11} className="shrink-0 text-text-muted" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium">{conv.title || "Nueva conversación"}</p>
                            <p className="text-[8px] text-text-muted">
                              {new Date(conv.last_message_at).toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-hide">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <GrixiAiLogo size={36} showText={false} animate />
                  <div>
                    <p className="text-xs font-semibold text-text-primary">
                      GRIXI{" "}
                      <span className="bg-linear-to-r from-[#7C3AED] to-[#A78BFA] bg-clip-text text-transparent">AI</span>
                    </p>
                    <p className="mt-1 text-[10px] text-text-muted">
                      Contexto: {activeModule?.label || "General"}
                    </p>
                  </div>
                  <p className="mt-1 max-w-[220px] text-[10px] leading-relaxed text-text-secondary">
                    Pregunta lo que necesites y obtén respuestas inteligentes al instante.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, idx) => {
                    const isLastAssistant = msg.role === "assistant" && idx === messages.length - 1;
                    return (
                      <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-xl px-3 py-2 ${
                            msg.role === "user"
                              ? "bg-brand text-white"
                              : "border border-border bg-bg-primary text-text-primary"
                          }`}
                        >
                          {msg.content || (isLastAssistant && isStreaming) ? (
                            <WidgetMessageContent
                              content={msg.content}
                              isUser={msg.role === "user"}
                              isStreaming={isLastAssistant && isStreaming}
                            />
                          ) : (
                            <span className="flex items-center gap-1 text-text-muted">
                              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
                              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
                              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border px-3 py-2">
              <div className="flex items-end gap-2 rounded-xl border border-border bg-bg-primary px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pregunta algo..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
                  disabled={isStreaming}
                />
                {isStreaming ? (
                  <button
                    onClick={() => { abortRef.current?.abort(); setIsStreaming(false); }}
                    className="rounded-lg p-1.5 text-error"
                  >
                    <Square size={12} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim()}
                    className={`rounded-lg p-1.5 transition-all ${input.trim() ? "bg-brand text-white" : "text-text-muted"}`}
                  >
                    <Send size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Resize handle */}
            <div
              className="absolute top-0 right-0 flex h-5 w-5 cursor-ne-resize items-start justify-end p-0.5 text-text-muted/40 hover:text-text-muted"
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

      {/* ── Orb Container (desktop: hover, mobile: hidden — uses mobile nav) ── */}
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
              className="absolute bottom-0 left-[calc(100%+8px)] w-56 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
            >
              <div className="px-3 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-9 w-9 shrink-0">
                    <div className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-(--brand)/20">
                      {userAvatar ? (
                        <img src={userAvatar} alt={userName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-brand text-xs font-bold text-white">{userInitial}</div>
                      )}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-text-primary">{userName}</p>
                    <p className="truncate text-[10px] text-text-muted">{userEmail}</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-border" />
              <div className="p-1.5">
                <button
                  onClick={() => { handleNavigate("/perfil"); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
                >
                  <UserCircle size={13} />
                  Mi Perfil
                </button>
                <button
                  onClick={() => { handleNavigate("/configuracion"); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
                >
                  <Settings size={13} />
                  Configuración
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-red-500/10 hover:text-red-500"
                >
                  <LogOut size={13} />
                  Cerrar sesión
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── PEEK: Compact icon strip with floating tooltips ── */}
        <AnimatePresence>
          {isPeek && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 12 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              className="mb-2 overflow-visible rounded-2xl border border-border bg-surface/95 p-1.5 shadow-2xl backdrop-blur-xl"
            >
              {visibleModules.map((mod, i) => {
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
                    className={`group relative flex w-full items-center justify-center rounded-xl p-2.5 transition-all duration-150 ${
                      isActive
                        ? "text-text-primary"
                        : "text-text-muted hover:text-text-secondary hover:bg-muted"
                    }`}
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
                          className="absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold shadow-lg"
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

        {/* ── PANEL: Full expanded navigation ── */}
        <AnimatePresence>
          {isPanel && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="mb-2 w-[210px] rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl"
            >
              {/* Brand — Tenant */}
              <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
                <div className="relative shrink-0">
                  {data.currentOrg?.logoUrl ? (
                    <img src={data.currentOrg.logoUrl} alt={data.currentOrg.name} className="h-7 w-7 rounded-lg object-cover ring-1 ring-border" />
                  ) : (
                    <>
                      <div className="absolute inset-0 rounded-lg opacity-10 blur-md" style={{ backgroundColor: data.currentOrg?.settings?.brand_color || '#7C3AED' }} />
                      <div
                        className="relative flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                        style={{ backgroundColor: data.currentOrg?.settings?.brand_color || '#7C3AED' }}
                      >
                        {(data.currentOrg?.name || 'G').charAt(0).toUpperCase()}
                      </div>
                    </>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-text-primary truncate">{data.currentOrg?.name || 'GRIXI'}</p>
                  <p className="text-[8px] font-medium text-text-muted">Powered by GRIXI</p>
                </div>
              </div>

              {/* Categories */}
              <nav className="px-1.5 py-2">
                {CATEGORIES.map((cat, ci) => {
                  const catModules = visibleModules.filter((m) => m.category === cat);
                  if (catModules.length === 0) return null;
                  return (
                    <div key={cat} className={ci > 0 ? "mt-2.5" : ""}>
                      <p className="mb-1 px-2.5 text-[8px] font-bold uppercase tracking-[0.12em] text-text-muted">
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
                            className={`group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 ${
                              isActive
                                ? "text-text-primary"
                                : "text-text-muted hover:text-text-secondary hover:bg-muted"
                            }`}
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
              <div className="border-t border-border px-2 py-1.5">
                <button
                  onClick={openCommandPalette}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-text-muted transition-colors hover:bg-muted hover:text-text-secondary"
                >
                  <Search size={13} />
                  <span className="flex-1 text-left text-[11px]">Buscar...</span>
                  <kbd className="rounded border border-border bg-muted px-1 py-px text-[8px] font-medium">⌘K</kbd>
                </button>
              </div>

              {/* Utilities */}
              <div className="border-t border-border px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    <div className="relative" ref={notifDropdownRef}>
                      <button
                        onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                        className="relative rounded-lg p-2 text-text-muted transition-all hover:bg-muted hover:text-text-secondary"
                        title="Notificaciones"
                      >
                        <Bell size={14} />
                        {(notifs?.unreadCount ?? 0) > 0 && (
                          <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[7px] font-bold text-white shadow-sm">
                            {(notifs?.unreadCount ?? 0) > 99 ? "99+" : notifs?.unreadCount}
                          </span>
                        )}
                      </button>

                      {/* Mini Notification Dropdown */}
                      <AnimatePresence>
                        {showNotifDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute bottom-full left-0 z-80 mb-2 w-80 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Gradient accent */}
                            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-brand to-transparent" />

                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-semibold text-text-primary">Notificaciones</h4>
                                {(notifs?.unreadCount ?? 0) > 0 && (
                                  <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-500">
                                    {notifs?.unreadCount}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5">
                                {(notifs?.unreadCount ?? 0) > 0 && (
                                  <button
                                    onClick={() => notifs?.markAllRead()}
                                    className="rounded-md p-1 text-text-muted hover:bg-muted hover:text-brand"
                                    title="Marcar todas como leídas"
                                  >
                                    <CheckCheck size={12} />
                                  </button>
                                )}
                                <button
                                  onClick={() => setShowNotifDropdown(false)}
                                  className="rounded-md p-1 text-text-muted hover:bg-muted hover:text-text-primary"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>

                            {/* List */}
                            <div className="max-h-72 overflow-y-auto overscroll-contain">
                              {notifs?.loading && notifs.notifications.length === 0 ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                                </div>
                              ) : !notifs || notifs.notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-text-muted">
                                  <Bell size={22} className="mb-1.5 opacity-20" />
                                  <p className="text-[10px]">Sin notificaciones</p>
                                </div>
                              ) : (
                                notifs.notifications.slice(0, 6).map((notif) => {
                                  const tc = NOTIF_TYPE_CONFIG[notif.type] || NOTIF_TYPE_CONFIG.info;
                                  const ModIcon = NOTIF_MODULE_ICONS[notif.module] || Bell;
                                  const isUnread = !notif.read_at;
                                  return (
                                    <div
                                      key={notif.id}
                                      className={`group relative flex gap-2.5 border-b border-border/30 px-3 py-2.5 transition-colors last:border-0 ${isUnread ? "bg-brand/3" : ""} hover:bg-muted/40`}
                                    >
                                      {isUnread && (
                                        <div className="absolute left-1 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-brand" />
                                      )}
                                      <div
                                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                                        style={{ background: `color-mix(in oklch, ${tc.color} 12%, transparent)` }}
                                      >
                                        <ModIcon size={11} style={{ color: tc.color }} strokeWidth={2} />
                                      </div>
                                      <div
                                        className="min-w-0 flex-1 cursor-pointer"
                                        onClick={() => {
                                          if (isUnread) notifs.markAsRead(notif.id);
                                          if (notif.action_url) {
                                            navigate(notif.action_url);
                                            setShowNotifDropdown(false);
                                            setState("orb");
                                          }
                                        }}
                                      >
                                        <p className={`text-[11px] leading-snug ${isUnread ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                                          {notif.title}
                                        </p>
                                        {notif.body && (
                                          <p className="mt-0.5 line-clamp-1 text-[10px] text-text-muted">{notif.body}</p>
                                        )}
                                        <span className="mt-0.5 text-[9px] text-text-muted">
                                          {formatTimeAgo(notif.created_at)}
                                          {notif.actor_name && ` · ${notif.actor_name}`}
                                        </span>
                                      </div>
                                      <div className="flex shrink-0 flex-col items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                        {isUnread && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); notifs.markAsRead(notif.id); }}
                                            className="rounded p-0.5 text-text-muted hover:bg-muted hover:text-brand"
                                            title="Marcar como leída"
                                          >
                                            <Check size={10} />
                                          </button>
                                        )}
                                        <button
                                          onClick={(e) => { e.stopPropagation(); notifs.deleteNotification(notif.id); }}
                                          className="rounded p-0.5 text-text-muted hover:bg-red-500/10 hover:text-red-500"
                                          title="Eliminar"
                                        >
                                          <Trash2 size={10} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* Footer */}
                            {notifs && notifs.notifications.length > 0 && (
                              <div className="border-t border-border px-3 py-2">
                                <button
                                  onClick={() => {
                                    navigate("/notificaciones");
                                    setShowNotifDropdown(false);
                                    setState("orb");
                                  }}
                                  className="flex w-full items-center justify-center gap-1 rounded-lg py-1 text-[10px] font-medium text-brand transition-colors hover:bg-brand/5"
                                >
                                  Ver todas
                                  <ExternalLink size={9} />
                                </button>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {mounted && (
                      <button
                        onClick={(e) => {
                          // Guard: prevent orb collapse during view transition
                          isThemeTransitionRef.current = true;
                          if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
                          toggleTheme(e);
                          // Release guard after transition settles
                          setTimeout(() => { isThemeTransitionRef.current = false; }, 600);
                        }}
                        className="rounded-lg p-2 text-text-muted transition-all hover:bg-muted hover:text-text-secondary"
                        title="Cambiar tema"
                      >
                        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowUserPopover(!showUserPopover)}
                    className="rounded-lg p-1.5 transition-all hover:bg-muted"
                    title={userName}
                  >
                    <div className="relative h-6 w-6">
                      <div className="h-6 w-6 overflow-hidden rounded-full ring-1.5 ring-border">
                        {userAvatar ? (
                          <img src={userAvatar} alt={userName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-brand text-[8px] font-bold text-white">{userInitial}</div>
                        )}
                      </div>
                      <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border-[1.5px] border-surface bg-emerald-500" />
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
            className="relative flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface shadow-xl transition-shadow hover:shadow-2xl"
            style={{
              boxShadow: `0 0 14px ${activeColor}15, 0 4px 12px rgba(0,0,0,0.15)`,
            }}
          >
            {/* Conic gradient ring */}
            <div
              className="orb-ring absolute -inset-px rounded-full"
              style={{
                background: `conic-gradient(from 0deg, ${activeColor}25, transparent 40%, ${activeColor}15, transparent 80%, ${activeColor}25)`,
              }}
            />
            {/* Active module icon or logo */}
            <div className="relative flex h-[42px] w-[42px] items-center justify-center rounded-full bg-surface">
              <AnimatePresence mode="wait">
                {activeModule ? (
                  <motion.div
                    key={activeModule.id}
                    initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.6, rotate: 30 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
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
                    <Sparkles size={20} className="text-brand" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Active dot */}
            {activeModule && (
              <motion.span
                layoutId="orb-dot"
                className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface"
                style={{ backgroundColor: activeModule.color }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              />
            )}
          </motion.button>

          {/* ── AI Satellite Bubble ── */}
          {!isAiPage && (
            <div
              className="relative"
              onMouseEnter={() => {
                if (aiHoverTimerRef.current) clearTimeout(aiHoverTimerRef.current);
                setHoveredAi(true);
              }}
              onMouseLeave={() => {
                aiHoverTimerRef.current = setTimeout(() => setHoveredAi(false), 400);
              }}
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setAiOpen(!aiOpen)}
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border shadow-lg transition-all ${
                  aiOpen
                    ? "border-[#7C3AED]/40 bg-linear-to-br from-[#7C3AED] to-[#A78BFA] text-white shadow-[#7C3AED]/30"
                    : "border-border bg-surface text-text-muted hover:border-[#7C3AED]/30 hover:text-[#A78BFA] hover:shadow-[#7C3AED]/20"
                }`}
                title="GRIXI AI"
              >
                {/* Breathing pulse */}
                {!aiOpen && (
                  <div className="ai-breathing absolute inset-0 rounded-full border border-[#A78BFA]/60" />
                )}
                <Sparkles size={15} className="relative" />
                {/* Context dot */}
                <span
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border-[1.5px] border-surface"
                  style={{ backgroundColor: activeColor }}
                />
              </motion.button>

              {/* Voice button — appears on AI hover */}
              <AnimatePresence>
                {hoveredAi && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.5, x: -8 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.5, x: -8 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-[#A78BFA] shadow-lg transition-all hover:border-[#7C3AED]/40 hover:text-[#7C3AED] hover:shadow-[0_0_12px_rgba(124,58,237,0.2)]"
                    title="GRIXI Voice"
                  >
                    <AudioLines size={13} className="relative" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile Orb (simplified, visible on small screens) ── */}
      <div className="fixed bottom-4 left-4 z-50 md:hidden">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setState(state === "panel" ? "orb" : "panel")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-[#7C3AED] to-[#A78BFA] shadow-lg shadow-purple-500/25"
          style={{ animation: "pulse-glow 3s ease-in-out infinite" }}
        >
          <Sparkles className="text-white" size={20} />
        </motion.button>

        {/* Mobile panel */}
        <AnimatePresence>
          {isPanel && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setState("orb")}
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              />
              <motion.div
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed bottom-20 left-4 z-50 w-72 rounded-2xl border border-border bg-surface p-4 shadow-xl"
              >
                {/* Mobile nav header */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {data.currentOrg?.logoUrl ? (
                      <img src={data.currentOrg.logoUrl} alt={data.currentOrg.name} className="h-8 w-8 rounded-lg object-cover ring-1 ring-border" />
                    ) : (
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: data.currentOrg?.settings?.brand_color || '#7C3AED' }}
                      >
                        {(data.currentOrg?.name || 'G').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-text-primary">{data.currentOrg?.name || 'GRIXI'}</p>
                      <p className="text-[10px] text-text-muted">Powered by GRIXI</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {mounted && (
                      <button onClick={(e) => {
                        isThemeTransitionRef.current = true;
                        if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
                        toggleTheme(e);
                        setTimeout(() => { isThemeTransitionRef.current = false; }, 600);
                      }} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted hover:text-text-primary" title={theme === "dark" ? "Modo claro" : "Modo oscuro"}>
                        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                      </button>
                    )}
                    <button onClick={() => setState("orb")} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-muted hover:text-text-primary">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Mobile nav items */}
                <nav className="mb-3 space-y-0.5">
                  {visibleModules.map((nav) => {
                    const isActive = location.pathname === nav.href || location.pathname.startsWith(nav.href + "/");
                    return (
                      <button
                        key={nav.href}
                        onClick={() => handleNavigate(nav.href)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                          isActive
                            ? "text-text-primary"
                            : "text-text-secondary hover:bg-muted hover:text-text-primary"
                        }`}
                        style={isActive ? { backgroundColor: `${nav.color}12`, color: nav.color } : undefined}
                      >
                        <nav.icon size={15} />
                        <span>{nav.label}</span>
                      </button>
                    );
                  })}
                </nav>

                {/* AI Button */}
                <button
                  onClick={() => { setAiOpen(true); setState("orb"); }}
                  className="flex w-full items-center gap-2.5 rounded-xl bg-linear-to-r from-[#7C3AED] to-[#A78BFA] px-3 py-2.5 text-xs font-semibold text-white transition-all hover:opacity-90"
                >
                  <Sparkles size={15} />
                  <span>GRIXI AI</span>
                </button>

                {/* User */}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    {userAvatar ? (
                      <img src={userAvatar} alt="" className="h-6 w-6 rounded-full" />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                        {userInitial}
                      </div>
                    )}
                    <span className="text-[11px] font-medium text-text-secondary truncate max-w-[120px]">
                      {userName.split(" ")[0]}
                    </span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                    title="Cerrar sesión"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
