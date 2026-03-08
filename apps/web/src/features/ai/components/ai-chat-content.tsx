"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Actions
import { sendChatMessage } from "@/features/ai/actions/chat";
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

// Types
import type { Conversation, ChatMessage as ChatMessageType, AiModule, Attachment } from "../types";

type AiChatContentProps = {
  initialConversations?: Conversation[];
  userAvatar?: string | null;
  userName?: string;
};

export function AiChatContent({
  initialConversations = [],
  userAvatar,
  userName = "Tú",
}: AiChatContentProps) {
  // State
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [module, setModule] = useState<AiModule>("general");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Refresh conversations on mount
  useEffect(() => {
    refreshConversations();
  }, []);

  const refreshConversations = async () => {
    const { conversations: convs } = await listConversations();
    setConversations(convs);
  };

  // Select a conversation and load its messages
  const handleSelect = useCallback(async (id: string) => {
    setActiveConvId(id);
    const { messages: msgs } = await getConversationMessages(id);
    setMessages(msgs);

    // Set module from conversation
    const conv = conversations.find((c) => c.id === id);
    if (conv) setModule(conv.module as AiModule);
  }, [conversations]);

  // Create a new conversation
  const handleNew = useCallback(async () => {
    const { conversation } = await createConversation(module);
    if (conversation) {
      setConversations((prev) => [conversation, ...prev]);
      setActiveConvId(conversation.id);
      setMessages([]);
    }
  }, [module]);

  // Delete a conversation
  const handleDelete = useCallback(async (id: string) => {
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
  }, [activeConvId]);

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
  const handleUpload = useCallback(async (file: File): Promise<Attachment | null> => {
    if (!activeConvId) return null;
    const formData = new FormData();
    formData.append("file", file);
    const { attachment, error } = await uploadAttachment(formData, activeConvId);
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    return attachment;
  }, [activeConvId]);

  // Send a message
  const handleSend = useCallback(
    async (text: string, attachments: Attachment[] = []) => {
      if ((!text.trim() && attachments.length === 0) || isLoading) return;

      let convId = activeConvId;

      // Auto-create conversation if needed
      if (!convId) {
        const { conversation } = await createConversation(module);
        if (!conversation) return;
        convId = conversation.id;
        setConversations((prev) => [conversation, ...prev]);
        setActiveConvId(convId);
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

      // Call server action
      const { response, error } = await sendChatMessage(
        convId,
        text,
        module,
        attachments
      );

      const aiMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        conversation_id: convId,
        role: "assistant",
        content: error || response,
        attachments: [],
        model_used: "gemini-3.1-flash-lite-preview",
        tokens_used: 0,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsLoading(false);

      // Refresh conversations to update title and timestamp
      refreshConversations();
    },
    [activeConvId, isLoading, module]
  );

  // Handle quick prompt from welcome screen
  const handleQuickPrompt = useCallback(
    (prompt: string) => {
      handleSend(prompt, []);
    },
    [handleSend]
  );

  // Find the latest assistant message index for the regenerate button
  const lastAssistantIdx = [...messages]
    .reverse()
    .findIndex((m) => m.role === "assistant");
  const lastAssistantId =
    lastAssistantIdx >= 0
      ? messages[messages.length - 1 - lastAssistantIdx]?.id
      : null;

  return (
    <div className="flex h-[calc(100vh-6.5rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <ConversationSidebar
            conversations={conversations}
            activeId={activeConvId}
            onSelect={handleSelect}
            onNew={handleNew}
            onDelete={handleDelete}
            onRename={handleRename}
            onTogglePin={handleTogglePin}
            collapsed={!sidebarOpen}
            onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
          />
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Chat header */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
              title={sidebarOpen ? "Ocultar panel" : "Mostrar panel"}
            >
              {sidebarOpen ? (
                <PanelLeftClose size={16} />
              ) : (
                <PanelLeftOpen size={16} />
              )}
            </button>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {activeConvId
                  ? conversations.find((c) => c.id === activeConvId)?.title ||
                    "Nueva conversación"
                  : "Grixi AI"}
              </h2>
              {activeConvId && (
                <p className="text-[10px] text-[var(--text-muted)]">
                  {conversations.find((c) => c.id === activeConvId)
                    ?.message_count || 0}{" "}
                  mensajes
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={chatContainerRef}
          className={cn(
            "flex-1 overflow-y-auto",
            messages.length === 0 ? "" : "px-4 py-6"
          )}
        >
          {messages.length === 0 && !activeConvId ? (
            <WelcomeScreen module={module} onPrompt={handleQuickPrompt} />
          ) : messages.length === 0 ? (
            <WelcomeScreen module={module} onPrompt={handleQuickPrompt} />
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
                />
              ))}

              {/* Typing indicator */}
              <AnimatePresence>
                {isLoading && <TypingIndicator />}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          onUpload={handleUpload}
          isLoading={isLoading}
          module={module}
          onModuleChange={setModule}
        />
      </div>
    </div>
  );
}
