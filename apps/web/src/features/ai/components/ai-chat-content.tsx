"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen, Square, PanelRightOpen, PanelRightClose, X } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

// Actions
import {
  listConversations,
  createConversation,
  deleteConversation,
  renameConversation,
  togglePinConversation,
  getConversationMessages,
} from "@/features/ai/actions/conversations";
import { uploadAttachment } from "@/features/ai/actions/attachments";

// Components
import { ConversationSidebar } from "./conversation-sidebar";
import { ChatInput } from "./chat-input";
import { ChatMessage, TypingIndicator } from "./chat-message";
import { WelcomeScreen } from "./welcome-screen";
import { AiCanvasPanel, type CanvasArtifact } from "./ai-canvas-panel";
import { parseChartBlocks, parseImageBlocks } from "./ai-chart-block";

// Types
import type {
  Conversation,
  ChatMessage as ChatMessageType,
  AiModule,
  Attachment,
} from "../types";

type AiChatContentProps = {
  initialConversations?: Conversation[];
  userAvatar?: string | null;
  userName?: string;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

export function AiChatContent({
  initialConversations = [],
  userAvatar,
  userName = "Tú",
}: AiChatContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // State
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(
    searchParams.get("c")
  );
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [modules, setModules] = useState<AiModule[]>(["general"]);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasArtifacts, setCanvasArtifacts] = useState<CanvasArtifact[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Detect mobile and auto-manage sidebar
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isStreaming]);

  // Refresh conversations on mount
  useEffect(() => {
    refreshConversations();
  }, []);

  // Load conversation from URL param on mount
  useEffect(() => {
    const convId = searchParams.get("c");
    if (convId && convId !== activeConvId) {
      handleSelect(convId);
    }
    // Read module param from URL (passed by floating widget)
    const moduleParam = searchParams.get("module") as AiModule | null;
    if (moduleParam && moduleParam !== "general") {
      setModules([moduleParam]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Listen for quick prompt events from suggestions
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.prompt) {
        handleSend(detail.prompt, []);
      }
    };
    window.addEventListener("grixi-ai:quick-prompt", handler);
    return () => window.removeEventListener("grixi-ai:quick-prompt", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for 3D navigation events from AI chat messages
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const params = new URLSearchParams();
      params.set("tab", "3d");
      if (detail.type === "warehouse" && detail.id) {
        params.set("warehouse", detail.id);
      } else if (detail.type === "rack" && detail.warehouseId) {
        params.set("warehouse", detail.warehouseId);
        if (detail.rackCode) params.set("rack", detail.rackCode);
      }
      router.push(`/almacenes?${params.toString()}`);
    };
    window.addEventListener("grixi-ai:navigate", handler);
    return () => window.removeEventListener("grixi-ai:navigate", handler);
  }, [router]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+N — New conversation
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleNew();
      }
      // Escape — Stop generation
      if (e.key === "Escape" && isStreaming) {
        e.preventDefault();
        handleStopGeneration();
      }
      // Cmd+Shift+S — Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "s") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  const refreshConversations = async () => {
    const { conversations: convs } = await listConversations();
    setConversations(convs);
  };

  // Update URL when conversation changes
  const updateUrl = (convId: string | null) => {
    if (convId) {
      router.replace(`${pathname}?c=${convId}`, { scroll: false });
    } else {
      router.replace(pathname, { scroll: false });
    }
  };

  // Select a conversation and load its messages
  const handleSelect = useCallback(
    async (id: string) => {
      setActiveConvId(id);
      updateUrl(id);
      const { messages: msgs } = await getConversationMessages(id);
      setMessages(msgs);

      const conv = conversations.find((c) => c.id === id);
      if (conv) setModules([conv.module as AiModule]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversations, pathname]
  );

  // Create a new conversation
  const handleNew = useCallback(async () => {
    const { conversation } = await createConversation(modules[0] || "general");
    if (conversation) {
      setConversations((prev) => [conversation, ...prev]);
      setActiveConvId(conversation.id);
      setMessages([]);
      updateUrl(conversation.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, pathname]);

  // Delete a conversation
  const handleDelete = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
        updateUrl(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeConvId, pathname]
  );

  // Rename a conversation
  const handleRename = useCallback(async (id: string, title: string) => {
    await renameConversation(id, title);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }, []);

  // Toggle pin
  const handleTogglePin = useCallback(async (id: string) => {
    await togglePinConversation(id);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, is_pinned: !c.is_pinned } : c
      )
    );
  }, []);

  // Upload file
  const handleUpload = useCallback(
    async (file: File): Promise<Attachment | null> => {
      let convId = activeConvId;

      // Auto-create conversation if needed
      if (!convId) {
        const { conversation, error: convError } = await createConversation(modules[0] || "general");
        if (!conversation || convError) {
          console.error("Failed to create conversation for upload:", convError);
          return null;
        }
        convId = conversation.id;
        setConversations((prev) => [conversation, ...prev]);
        setActiveConvId(convId);
        updateUrl(convId);
      }

      const formData = new FormData();
      formData.append("file", file);
      const { attachment, error } = await uploadAttachment(
        formData,
        convId
      );
      if (error) {
        console.error("Upload error:", error);
        return null;
      }
      return attachment;
    },
    [activeConvId, modules]
  );

  // Stop generation
  const handleStopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  // Send a message with streaming
  const handleSend = useCallback(
    async (text: string, attachments: Attachment[] = []) => {
      if ((!text.trim() && attachments.length === 0) || isLoading) return;

      let convId = activeConvId;

      // Auto-create conversation if needed
      if (!convId) {
        const { conversation, error: convError } = await createConversation(modules[0] || "general");
        if (!conversation || convError) {
          console.error("Failed to create conversation:", convError);
          // Show error as a visible message
          const errMsg: ChatMessageType = {
            id: crypto.randomUUID(),
            conversation_id: "error",
            role: "assistant",
            content: `Error al crear la conversación: ${convError || "Error desconocido"}. Por favor recarga la página.`,
            attachments: [],
            model_used: "system",
            tokens_used: 0,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errMsg]);
          return;
        }
        convId = conversation.id;
        setConversations((prev) => [conversation, ...prev]);
        setActiveConvId(convId);
        updateUrl(convId);
      }

      // Optimistically add user message
      const userMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        conversation_id: convId,
        role: "user",
        content: text,
        attachments,
        model_used: "user",
        tokens_used: 0,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setIsStreaming(true);

      // Create streaming AI message placeholder
      const aiMsgId = crypto.randomUUID();
      const aiMsg: ChatMessageType = {
        id: aiMsgId,
        conversation_id: convId,
        role: "assistant",
        content: "",
        attachments: [],
        model_used: "default",
        tokens_used: 0,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Create AbortController for stop generation
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: convId,
            message: text,
            modules,
            attachments,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);

              if (data.error) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? { ...m, content: `Error: ${data.error}` }
                      : m
                  )
                );
                break;
              }

              if (data.done) {
                break;
              }

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
              // Skip malformed JSON
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // User stopped generation
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId && !m.content
                ? { ...m, content: "*(Generación detenida por el usuario)*" }
                : m
            )
          );
        } else {
          const errMsg = err instanceof Error ? err.message : "Error desconocido";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: `Error: ${errMsg}` }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        setIsLoading(false);
        abortControllerRef.current = null;
        refreshConversations();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeConvId, isLoading, modules, pathname]
  );

  // Handle quick prompt from welcome screen
  const handleQuickPrompt = useCallback(
    (prompt: string) => {
      handleSend(prompt, []);
    },
    [handleSend]
  );

  // Find the latest assistant message for the regenerate button
  const lastAssistantIdx = [...messages]
    .reverse()
    .findIndex((m) => m.role === "assistant");
  const lastAssistantId =
    lastAssistantIdx >= 0
      ? messages[messages.length - 1 - lastAssistantIdx]?.id
      : null;

  const greeting = getGreeting();
  const activeConv = conversations.find((c) => c.id === activeConvId);

  // Extract canvas artifacts from messages
  useMemo(() => {
    const artifacts: CanvasArtifact[] = [];
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      const { charts } = parseChartBlocks(msg.content);
      const { imagePrompts } = parseImageBlocks(msg.content);
      for (const chart of charts) {
        artifacts.push({
          id: `chart-${msg.id}-${chart.title}`,
          type: "chart",
          title: chart.title,
          data: chart,
          createdAt: msg.created_at,
        });
      }
      for (const prompt of imagePrompts) {
        artifacts.push({
          id: `img-${msg.id}-${prompt.slice(0, 20)}`,
          type: "image",
          title: prompt.slice(0, 40) + (prompt.length > 40 ? "..." : ""),
          data: prompt,
          createdAt: msg.created_at,
        });
      }
    }
    setCanvasArtifacts(artifacts);
    if (artifacts.length > 0 && !canvasOpen) {
      setCanvasOpen(true);
    }
  }, [messages]);

  return (
    <div className="flex h-[calc(100vh-10rem)] md:h-[calc(100vh-6.5rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] relative">
      {/* Sidebar — overlay on mobile, inline on desktop */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Mobile backdrop */}
            {isMobile && (
              <div
                className="absolute inset-0 z-20 bg-black/50 backdrop-blur-sm md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <div className={cn(
              isMobile && "absolute left-0 top-0 bottom-0 z-30 w-[280px] shadow-2xl"
            )}>
              <ConversationSidebar
                conversations={conversations}
                activeId={activeConvId}
                onSelect={(id) => {
                  handleSelect(id);
                  if (isMobile) setSidebarOpen(false);
                }}
                onNew={() => {
                  handleNew();
                  if (isMobile) setSidebarOpen(false);
                }}
                onDelete={handleDelete}
                onRename={handleRename}
                onTogglePin={handleTogglePin}
                collapsed={!sidebarOpen}
                onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
              />
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Chat header */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-3 md:px-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
              title={sidebarOpen ? "Ocultar panel" : "Mostrar panel"}
            >
              {sidebarOpen ? (
                <PanelLeftClose size={16} />
              ) : (
                <PanelLeftOpen size={16} />
              )}
            </button>
            <div className="min-w-0">
              <h2 className="text-xs md:text-sm font-semibold text-[var(--text-primary)] truncate">
                {activeConvId
                  ? activeConv?.title || "Nueva conversación"
                  : `${greeting}, ${userName.split(" ")[0]}`}
              </h2>
              {activeConvId && (
                <p className="text-[10px] text-[var(--text-muted)]">
                  {activeConv?.message_count || 0} mensajes
                </p>
              )}
            </div>
          </div>

          {/* Stop generation button */}
          {isStreaming && (
            <button
              onClick={handleStopGeneration}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/5 px-3 py-1.5 text-xs font-medium text-[var(--error)] transition-all hover:bg-[var(--error)]/10"
            >
              <Square size={10} fill="currentColor" />
              Detener
            </button>
          )}

          {/* Canvas toggle — hidden on mobile */}
          <button
            onClick={() => setCanvasOpen(!canvasOpen)}
            className={cn(
              "hidden md:flex rounded-lg p-1.5 transition-colors",
              canvasOpen
                ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
            )}
            title={canvasOpen ? "Cerrar Canvas" : "Abrir Canvas"}
          >
            {canvasOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>

        {/* Messages area */}
        <div
          ref={chatContainerRef}
          className={cn(
            "flex-1 overflow-y-auto",
            messages.length === 0 ? "" : "px-4 py-6"
          )}
        >
          {messages.length === 0 ? (
            <WelcomeScreen
              module={modules[0] || "general"}
              onPrompt={handleQuickPrompt}
              userName={userName}
              greeting={greeting}
            />
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  userAvatar={userAvatar}
                  userName={userName}
                  isLatestAssistant={
                    msg.role === "assistant" && msg.id === lastAssistantId
                  }
                  isStreaming={
                    isStreaming &&
                    msg.role === "assistant" &&
                    msg.id === lastAssistantId
                  }
                />
              ))}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          onUpload={handleUpload}
          isLoading={isLoading}
          modules={modules}
          onModulesChange={setModules}
        />
      </div>

      {/* Canvas Panel */}
      <AiCanvasPanel
        artifacts={canvasArtifacts}
        isOpen={canvasOpen}
        onClose={() => setCanvasOpen(false)}
      />
    </div>
  );
}
