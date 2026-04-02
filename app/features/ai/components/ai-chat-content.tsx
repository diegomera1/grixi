/**
 * AiChatContent — Main orchestrator component for the AI Chat page
 * Layout: Sidebar | Chat | Canvas (3-panel responsive layout)
 * Handles SSE streaming, conversation management, keyboard shortcuts
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router";
import { apiFetch } from "~/lib/api-fetch";
import { ConversationSidebar } from "./conversation-sidebar";
import { ChatInput } from "./chat-input";
import { ChatMessage, TypingIndicator } from "./chat-message";
import { AiCanvasPanel } from "./ai-canvas-panel";
import { WelcomeScreen } from "./welcome-screen";
import type { ChartConfig } from "./ai-chart-block";
import type { Conversation, ChatMessage as ChatMessageType, AiModule, Attachment } from "../types";
import { PanelLeft } from "lucide-react";

type AiChatContentProps = {
  conversations: Conversation[] | null;
  userName?: string;
  userAvatar?: string;
};

export default function AiChatContent({ conversations: initialConversations, userName, userAvatar }: AiChatContentProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations || []);
  const [activeConvId, setActiveConvId] = useState<string | null>(searchParams.get("c"));
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModules, setSelectedModules] = useState<AiModule[]>(["general"]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasCharts, setCanvasCharts] = useState<ChartConfig[]>([]);
  const [lastCanvasUpdate, setLastCanvasUpdate] = useState<string>();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Greeting based on time of day
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  // ── Load messages when conversation changes ──
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    (async () => {
      try {
        const res = await apiFetch(`/api/ai/conversations?id=${activeConvId}&messages=true`);
        if (res.ok) {
          const data = await res.json() as { messages: ChatMessageType[] };
          setMessages(data.messages || []);
        }
      } catch {
        // fail silently
      }
    })();
  }, [activeConvId]);

  // ── Auto-scroll to bottom ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // ── Sync URL with active conversation ──
  useEffect(() => {
    if (activeConvId) {
      setSearchParams({ c: activeConvId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [activeConvId, setSearchParams]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Cmd+N: New conversation
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleNewConversation();
      }
      // Escape: Toggle sidebar
      if (e.key === "Escape") {
        setSidebarCollapsed((p) => !p);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // ── Conversation CRUD ──
  const handleNewConversation = useCallback(async () => {
    try {
      const res = await apiFetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: selectedModules[0] || "general" }),
      });
      if (res.ok) {
        const data = await res.json() as { conversation: Conversation };
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConvId(data.conversation.id);
        setMessages([]);
      }
    } catch { /* fail silently */ }
  }, [selectedModules]);

  const handleSelectConversation = useCallback((id: string) => {
    if (isStreaming) return;
    setActiveConvId(id);
  }, [isStreaming]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await apiFetch("/api/ai/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch { /* fail silently */ }
  }, [activeConvId]);

  const handleRenameConversation = useCallback(async (id: string, title: string) => {
    try {
      await apiFetch("/api/ai/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title }),
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      );
    } catch { /* fail silently */ }
  }, []);

  const handleTogglePin = useCallback(async (id: string) => {
    try {
      await apiFetch("/api/ai/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, togglePin: true }),
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_pinned: !c.is_pinned } : c))
      );
    } catch { /* fail silently */ }
  }, []);

  const handleToggleModule = useCallback((module: AiModule) => {
    setSelectedModules((prev) => {
      if (prev.includes(module)) {
        return prev.length === 1 ? prev : prev.filter((m) => m !== module);
      }
      return [...prev, module];
    });
  }, []);

  // ── Send message with SSE streaming ──
  const handleSend = useCallback(async (text: string, attachments: Attachment[]) => {
    let convId = activeConvId;

    // Auto-create conversation if none active
    if (!convId) {
      try {
        const res = await apiFetch("/api/ai/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module: selectedModules[0] || "general" }),
        });
        if (res.ok) {
          const data = await res.json() as { conversation: Conversation };
          convId = data.conversation.id;
          setConversations((prev) => [data.conversation, ...prev]);
          setActiveConvId(convId);
        } else {
          return;
        }
      } catch {
        return;
      }
    }

    // Add user message optimistically
    const userMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      role: "user",
      content: text,
      attachments,
      model_used: "",
      tokens_used: 0,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    // Prepare streaming assistant message
    const assistantMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      role: "assistant",
      content: "",
      attachments: [],
      model_used: "gemini-3.1-flash-lite-preview",
      tokens_used: 0,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    // Stream via SSE
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: convId,
          modules: selectedModules,
          attachments,
        }),
        signal: abortController.signal,
      });

      if (!res.ok || !res.body) {
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);

          try {
            const chunk = JSON.parse(jsonStr) as { text?: string; done?: boolean; error?: string };

            if (chunk.error) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  last.content += `\n\n⚠️ Error: ${chunk.error}`;
                }
                return updated;
              });
              break;
            }

            if (chunk.text) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  last.content += chunk.text;
                }
                return [...updated];
              });
            }

            if (chunk.done) {
              // Check for charts in the final content
              const finalContent = (() => {
                const msgs = [...messages, userMsg, assistantMsg];
                const last = msgs[msgs.length - 1];
                return last?.content || "";
              })();

              if (finalContent.includes("<!--CHART:")) {
                setCanvasOpen(true);
                setLastCanvasUpdate(new Date().toISOString());
              }
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            last.content += "\n\n⚠️ Error de conexión. Intenta de nuevo.";
          }
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;

      // Refresh conversations to get updated title
      try {
        const res = await apiFetch("/api/ai/conversations");
        if (res.ok) {
          const data = await res.json() as { conversations: Conversation[] };
          setConversations(data.conversations || []);
        }
      } catch { /* ignore */ }
    }
  }, [activeConvId, selectedModules, messages]);

  const handleOpenCanvas = useCallback((chart: ChartConfig) => {
    setCanvasCharts((prev) => [...prev, chart]);
    setCanvasOpen(true);
    setLastCanvasUpdate(new Date().toISOString());
  }, []);

  // Extract all charts from current messages for canvas
  const allCharts = messages
    .filter((m) => m.role === "assistant" && m.content.includes("<!--CHART:"))
    .flatMap((m) => {
      const charts: ChartConfig[] = [];
      m.content.replace(/<!--CHART:(.*?)-->/gs, (_, json) => {
        try { charts.push(JSON.parse(json)); } catch { /* skip */ }
        return "";
      });
      return charts;
    });

  const combinedCharts = [...allCharts, ...canvasCharts.filter(
    (c) => !allCharts.some((a) => a.title === c.title)
  )];

  return (
    <div className="flex h-full w-full overflow-hidden bg-primary">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        onRename={handleRenameConversation}
        onTogglePin={handleTogglePin}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
      />

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="rounded-lg p-1.5 text-text-muted hover:bg-muted hover:text-text-primary transition-colors"
              title="Abrir sidebar"
            >
              <PanelLeft size={16} />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-text-primary">GRIXI AI</h1>
            <p className="text-[10px] text-text-muted">
              {isStreaming ? "Escribiendo..." : "Asistente inteligente enterprise"}
            </p>
          </div>
          {combinedCharts.length > 0 && (
            <button
              onClick={() => setCanvasOpen((p) => !p)}
              className="rounded-lg px-2.5 py-1 text-[10px] font-medium text-brand bg-brand/10 hover:bg-brand/20 transition-colors"
            >
              Canvas ({combinedCharts.length})
            </button>
          )}
        </header>

        {/* Messages or Welcome */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {messages.length === 0 ? (
            <WelcomeScreen
              module={selectedModules[0] || "general"}
              onPrompt={(prompt) => handleSend(prompt, [])}
              userName={userName}
              greeting={greeting}
            />
          ) : (
            <div className="pb-4">
              {messages.map((msg, i) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
                  isLast={i === messages.length - 1 && msg.role === "assistant"}
                  userAvatar={userAvatar}
                  onOpenCanvas={handleOpenCanvas}
                />
              ))}
              {isStreaming && messages[messages.length - 1]?.role === "user" && (
                <TypingIndicator />
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          isStreaming={isStreaming}
          selectedModules={selectedModules}
          onToggleModule={handleToggleModule}
        />
      </div>

      {/* Canvas Panel */}
      <AiCanvasPanel
        isOpen={canvasOpen}
        onClose={() => setCanvasOpen(false)}
        charts={combinedCharts}
        lastUpdated={lastCanvasUpdate}
      />
    </div>
  );
}
