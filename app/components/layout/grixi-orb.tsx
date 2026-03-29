import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, X, Send, Plus,
  LayoutDashboard, DollarSign, Package, ShoppingCart,
  Users, Shield, Building2, Settings,
  Moon, Sun, LogOut, ChevronRight,
  MessageSquare, Trash2, Pin,
} from "lucide-react";
import { useThemeTransition } from "~/lib/hooks/use-theme-transition";
import { GrixiAiLogo } from "~/features/ai/components/grixi-ai-logo";
import { WelcomeScreen } from "~/features/ai/components/welcome-screen";
import { WidgetMessageContent } from "~/features/ai/components/widget-message-content";
import type { AiModule, ChatMessage, Conversation } from "~/features/ai/types";
import type { TenantContext } from "~/routes/authenticated";
import { createBrowserClient } from "@supabase/ssr";

// ─── Types ─────────────────────────────────────────────
type OrbState = "orb" | "peek" | "panel";

type NavItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  adminOnly?: boolean;
};

// ─── Navigation ────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: DollarSign, label: "Finanzas", href: "/finanzas" },
  { icon: Package, label: "Almacenes", href: "/almacenes" },
  { icon: ShoppingCart, label: "Compras", href: "/compras" },
  { icon: Users, label: "Usuarios", href: "/usuarios" },
  { icon: Shield, label: "Admin", href: "/admin", adminOnly: true },
  { icon: Building2, label: "Organizaciones", href: "/admin/organizations", adminOnly: true },
  { icon: Settings, label: "Auditoría", href: "/admin/audit", adminOnly: true },
];

// ─── Supabase browser client helper ────────────────────
function getSupabaseBrowser() {
  const url = typeof window !== "undefined"
    ? (window as any).__SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || ""
    : "";
  const key = typeof window !== "undefined"
    ? (window as any).__SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ""
    : "";
  return createBrowserClient(url, key);
}

// ─── Main Component ────────────────────────────────────
export function GrixiOrb({ data }: { data: TenantContext }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useThemeTransition();

  // Orb state
  const [state, setState] = useState<OrbState>("orb");
  const [showAi, setShowAi] = useState(false);

  // AI Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeModule, setActiveModule] = useState<AiModule>("general");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load conversations on mount
  useEffect(() => {
    if (showAi) loadConversations();
  }, [showAi]);

  const supabase = useMemo(() => getSupabaseBrowser(), []);

  async function loadConversations() {
    const { data: convs } = await supabase
      .from("ai_conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(20);
    if (convs) setConversations(convs as Conversation[]);
  }

  async function loadConversation(convId: string) {
    setCurrentConvId(convId);
    setShowHistory(false);
    const { data: msgs } = await supabase
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
    const { data: conv, error } = await supabase
      .from("ai_conversations")
      .insert({
        org_id: orgId,
        user_id: data.user.id,
        module: activeModule,
      })
      .select()
      .single();
    if (conv && !error) {
      setCurrentConvId(conv.id);
      setMessages([]);
      setShowHistory(false);
    }
    return conv?.id || null;
  }

  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isStreaming) return;
    setInput("");

    let convId = currentConvId;
    if (!convId) {
      convId = await startNewConversation();
      if (!convId) return;
    }

    // Optimistic user message
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

    const assistantPlaceholder: ChatMessage = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      role: "assistant",
      content: "",
      attachments: [],
      model_used: "gemini-2.0-flash-lite",
      tokens_used: 0,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          message: msg,
          modules: [activeModule],
        }),
      });

      if (!response.ok) throw new Error("AI response failed");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.done) break;
            if (payload.error) throw new Error(payload.error);
            if (payload.text) {
              accumulated += payload.text;
              setMessages((prev) => {
                const copy = [...prev];
                const lastIdx = copy.length - 1;
                if (copy[lastIdx]?.role === "assistant") {
                  copy[lastIdx] = { ...copy[lastIdx], content: accumulated };
                }
                return copy;
              });
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        if (copy[lastIdx]?.role === "assistant") {
          copy[lastIdx] = {
            ...copy[lastIdx],
            content: "❌ Error al conectar con GRIXI AI. Intenta de nuevo.",
          };
        }
        return copy;
      });
    } finally {
      setIsStreaming(false);
      loadConversations();
    }
  }, [input, isStreaming, currentConvId, activeModule, data]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─── Greeting based on time ──────────────────────────
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  // ─── Render: Orb ─────────────────────────────────────
  return (
    <>
      {/* ── ORB BUTTON ────────────────────────────────── */}
      <AnimatePresence>
        {state === "orb" && !showAi && (
          <motion.button
            key="orb"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setState("peek")}
            className="fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-[#7C3AED] to-[#A78BFA] shadow-lg shadow-purple-500/25 transition-shadow hover:shadow-xl hover:shadow-purple-500/30"
            style={{ animation: "pulse-glow 3s ease-in-out infinite" }}
          >
            <Sparkles className="text-white" size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── PEEK STATE ─────────────────────────────────── */}
      <AnimatePresence>
        {state === "peek" && (
          <>
            {/* Backdrop */}
            <motion.div
              key="peek-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setState("orb")}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            />

            {/* Peek Panel */}
            <motion.div
              key="peek-panel"
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-6 left-6 z-50 w-72 rounded-2xl border border-(--border) bg-(--bg-surface) p-4 shadow-xl"
            >
              {/* Header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#7C3AED] to-[#A78BFA]">
                    <Sparkles className="text-white" size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-(--text-primary)">GRIXI</p>
                    <p className="text-[10px] text-(--text-muted)">{data.currentOrg?.name || "Sin organización"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => toggleTheme(e)}
                    className="rounded-lg p-1.5 text-(--text-muted) transition-colors hover:bg-(--bg-muted) hover:text-(--text-primary)"
                    title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
                  >
                    {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                  </button>
                  <button
                    onClick={() => setState("orb")}
                    className="rounded-lg p-1.5 text-(--text-muted) transition-colors hover:bg-(--bg-muted) hover:text-(--text-primary)"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Navigation */}
              <nav className="mb-3 space-y-0.5">
                {NAV_ITEMS.filter((n) => !n.adminOnly || data.isPlatformAdmin).map((nav) => {
                  const isActive = location.pathname === nav.href || location.pathname.startsWith(nav.href + "/");
                  return (
                    <button
                      key={nav.href}
                      onClick={() => {
                        navigate(nav.href);
                        setState("orb");
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                        isActive
                          ? "bg-(--brand)/10 text-(--brand)"
                          : "text-(--text-secondary) hover:bg-(--bg-muted) hover:text-(--text-primary)"
                      }`}
                    >
                      <nav.icon size={15} />
                      <span>{nav.label}</span>
                      {isActive && <ChevronRight size={12} className="ml-auto" />}
                    </button>
                  );
                })}
              </nav>

              {/* AI Button */}
              <button
                onClick={() => { setShowAi(true); setState("orb"); }}
                className="flex w-full items-center gap-2.5 rounded-xl bg-linear-to-r from-[#7C3AED] to-[#A78BFA] px-3 py-2.5 text-xs font-semibold text-white transition-all hover:opacity-90"
              >
                <Sparkles size={15} />
                <span>GRIXI AI</span>
              </button>

              {/* User */}
              <div className="mt-3 flex items-center justify-between border-t border-(--border) pt-3">
                <div className="flex items-center gap-2">
                  {data.user.avatar ? (
                    <img src={data.user.avatar} alt="" className="h-6 w-6 rounded-full" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-(--brand) text-[10px] font-bold text-white">
                      {data.user.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                  )}
                  <span className="text-[11px] font-medium text-(--text-secondary) truncate max-w-[120px]">
                    {data.user.name?.split(" ")[0] || data.user.email}
                  </span>
                </div>
                <button
                  onClick={() => navigate("/auth/signout")}
                  className="rounded-lg p-1.5 text-(--text-muted) transition-colors hover:bg-red-500/10 hover:text-red-500"
                  title="Cerrar sesión"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── AI CHAT WIDGET ─────────────────────────────── */}
      <AnimatePresence>
        {showAi && (
          <>
            {/* Backdrop */}
            <motion.div
              key="ai-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAi(false)}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            />

            {/* AI Panel */}
            <motion.div
              key="ai-panel"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-4 bottom-4 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-(--border) bg-(--bg-surface) shadow-2xl md:inset-x-auto md:bottom-6 md:left-auto md:right-6 md:top-auto md:h-[600px] md:w-[420px]"
            >
              {/* AI Header */}
              <div className="flex items-center justify-between border-b border-(--border) px-4 py-3">
                <div className="flex items-center gap-2">
                  <GrixiAiLogo size={28} showText={false} animate={false} />
                  <div>
                    <span className="text-sm font-bold text-(--text-primary)">
                      GRIXI <span className="bg-linear-to-r from-[#7C3AED] to-[#A78BFA] bg-clip-text text-transparent">AI</span>
                    </span>
                    <p className="text-[9px] text-(--text-muted)">Asistente Inteligente</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setShowHistory(!showHistory); }}
                    className={`rounded-lg p-1.5 transition-colors ${showHistory ? "bg-(--brand)/10 text-(--brand)" : "text-(--text-muted) hover:bg-(--bg-muted) hover:text-(--text-primary)"}`}
                    title="Historial"
                  >
                    <MessageSquare size={14} />
                  </button>
                  <button
                    onClick={() => { setCurrentConvId(null); setMessages([]); setShowHistory(false); }}
                    className="rounded-lg p-1.5 text-(--text-muted) transition-colors hover:bg-(--bg-muted) hover:text-(--text-primary)"
                    title="Nueva conversación"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => setShowAi(false)}
                    className="rounded-lg p-1.5 text-(--text-muted) transition-colors hover:bg-(--bg-muted) hover:text-(--text-primary)"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* History sidebar overlay */}
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ x: -300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -300, opacity: 0 }}
                    className="absolute inset-y-0 left-0 z-10 w-full max-w-xs border-r border-(--border) bg-(--bg-surface) md:w-64"
                  >
                    <div className="p-3">
                      <h3 className="mb-2 text-xs font-semibold text-(--text-muted)">Conversaciones</h3>
                      <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-hide">
                        {conversations.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => loadConversation(c.id)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors ${
                              currentConvId === c.id
                                ? "bg-(--brand)/10 text-(--brand)"
                                : "text-(--text-secondary) hover:bg-(--bg-muted)"
                            }`}
                          >
                            <MessageSquare size={12} className="shrink-0" />
                            <span className="truncate">{c.title || "Sin título"}</span>
                          </button>
                        ))}
                        {conversations.length === 0 && (
                          <p className="py-4 text-center text-[10px] text-(--text-muted)">Sin conversaciones aún</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-hide">
                {messages.length === 0 ? (
                  <WelcomeScreen
                    module={activeModule}
                    onPrompt={(prompt) => sendMessage(prompt)}
                    userName={data.user.name}
                    greeting={greeting}
                  />
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                            msg.role === "user"
                              ? "bg-(--brand) text-white"
                              : "bg-(--bg-muted) text-(--text-primary)"
                          }`}
                        >
                          <WidgetMessageContent
                            content={msg.content}
                            isUser={msg.role === "user"}
                            isStreaming={isStreaming && msg === messages[messages.length - 1] && msg.role === "assistant"}
                          />
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-(--border) px-3 py-2">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe un mensaje..."
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-(--border) bg-(--bg-primary) px-3 py-2 text-xs text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--brand) focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                    disabled={isStreaming}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={isStreaming || !input.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--brand) text-white transition-all hover:opacity-90 disabled:opacity-40"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
