"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Bot, User, Copy, Check, RefreshCw, Star, ImageIcon, Loader2, MapPin, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { AiChartBlock, parseChartBlocks, parseImageBlocks } from "./ai-chart-block";
import type { ChatMessage as ChatMessageType } from "../types";

type ChatMessageProps = {
  message: ChatMessageType;
  userAvatar?: string | null;
  userName?: string;
  onRegenerate?: () => void;
  isLatestAssistant?: boolean;
  isStreaming?: boolean;
};

/** Parse suggestions block from AI response */
function parseSuggestions(content: string): {
  cleanContent: string;
  suggestions: string[];
} {
  const match = content.match(
    /<!--SUGGESTIONS-->\s*\n?\s*(\[[\s\S]*?\])\s*\n?\s*<!--\/SUGGESTIONS-->/
  );
  if (!match) return { cleanContent: content, suggestions: [] };

  try {
    const suggestions = JSON.parse(match[1]) as string[];
    const cleanContent = content.replace(match[0], "").trim();
    return { cleanContent, suggestions };
  } catch {
    return { cleanContent: content, suggestions: [] };
  }
}

/** Navigation link type */
type NavigateLink = {
  type: "warehouse" | "rack" | "position";
  id?: string;
  warehouseId?: string;
  rackCode?: string;
  label: string;
};

/** Parse NAVIGATE blocks from AI response */
function parseNavigateBlocks(content: string): {
  cleanContent: string;
  navigateLinks: NavigateLink[];
} {
  const regex = /<!--NAVIGATE:(\{[\s\S]*?\})-->/g;
  const links: NavigateLink[] = [];
  let cleanContent = content;

  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const link = JSON.parse(match[1]) as NavigateLink;
      links.push(link);
      cleanContent = cleanContent.replace(match[0], "");
    } catch {
      // skip malformed
    }
  }

  return { cleanContent: cleanContent.trim(), navigateLinks: links };
}

/** Navigate link button component */
function NavigateLinkButton({ link }: { link: NavigateLink }) {
  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent("grixi-ai:navigate", {
        detail: link,
      })
    );
  };

  return (
    <button
      onClick={handleClick}
      className="group/nav flex items-center gap-2 rounded-xl border border-[var(--brand)]/20 bg-[var(--brand)]/5 px-3.5 py-2 text-xs font-semibold text-[var(--brand)] transition-all hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/10 hover:shadow-md hover:shadow-[var(--brand)]/5 active:scale-[0.98]"
    >
      <MapPin size={13} className="shrink-0" />
      <span>{link.label}</span>
      <ExternalLink size={10} className="shrink-0 opacity-0 transition-opacity group-hover/nav:opacity-60" />
    </button>
  );
}

/** AI Image Block — fetches and renders generated image */
function AiImageBlock({ prompt }: { prompt: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      try {
        const res = await fetch("/api/ai/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        if (!res.ok) throw new Error("Failed to generate");
        const data = await res.json();
        if (!cancelled) setImageUrl(data.image);
      } catch {
        if (!cancelled) setError("Error generando imagen");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    generate();
    return () => { cancelled = true; };
  }, [prompt]);

  if (loading) {
    return (
      <div className="my-3 flex h-48 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]">
        <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-[10px]">Generando imagen...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-3 flex h-24 items-center justify-center rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/5">
        <div className="flex items-center gap-2 text-xs text-[var(--error)]">
          <ImageIcon size={14} />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[var(--border)]">
      {imageUrl && (
        <img
          src={imageUrl}
          alt={prompt}
          className="w-full max-h-80 object-contain bg-[var(--bg-muted)]"
        />
      )}
    </div>
  );
}

/** Code block component with syntax highlighting and copy button */
function CodeBlock({
  language,
  children,
}: {
  language: string | undefined;
  children: string;
}) {
  const [copied, setCopied] = useState(false);
  const lang = language || "text";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-xl border border-[var(--border)]">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-[var(--bg-muted)] px-4 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {lang}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-[var(--text-muted)] transition-all hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
        >
          {copied ? (
            <>
              <Check size={10} className="text-[var(--success)]" /> Copiado
            </>
          ) : (
            <>
              <Copy size={10} /> Copiar
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={lang}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          fontSize: "0.75rem",
          lineHeight: "1.5",
          background: "var(--bg-primary)",
          borderRadius: 0,
        }}
        showLineNumbers={children.split("\n").length > 3}
        lineNumberStyle={{
          minWidth: "2em",
          paddingRight: "1em",
          color: "var(--text-muted)",
          opacity: 0.5,
        }}
      >
        {children.trim()}
      </SyntaxHighlighter>
    </div>
  );
}

export function ChatMessage({
  message,
  userAvatar,
  userName = "Tú",
  onRegenerate,
  isLatestAssistant = false,
  isStreaming = false,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  // Parse rich content: suggestions, charts, images
  const { cleanContent, suggestions, charts, imagePrompts, navigateLinks } = useMemo(() => {
    if (isUser) return { cleanContent: message.content, suggestions: [], charts: [], imagePrompts: [], navigateLinks: [] };
    const { cleanContent: c1, suggestions } = parseSuggestions(message.content);
    const { cleanContent: c2, charts } = parseChartBlocks(c1);
    const { cleanContent: c3, imagePrompts } = parseImageBlocks(c2);
    const { cleanContent: c4, navigateLinks } = parseNavigateBlocks(c3);
    return { cleanContent: c4, suggestions, charts, imagePrompts, navigateLinks };
  }, [message.content, isUser]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cleanContent);
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
      <div className={cn("max-w-[75%] min-w-0", isUser ? "text-right" : "")}>
        {/* Name */}
        <p className="mb-1 text-[10px] font-medium text-[var(--text-muted)]">
          {isUser ? userName : "GRIXI AI"}
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
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_li]:text-[var(--text-primary)] [&_p]:text-[var(--text-primary)] [&_strong]:text-[var(--text-primary)]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeString = String(children).replace(/\n$/, "");
                    if (match) {
                      return <CodeBlock language={match[1]}>{codeString}</CodeBlock>;
                    }
                    return (
                      <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-xs font-mono" {...props}>
                        {children}
                      </code>
                    );
                  },
                  pre({ children }) {
                    return <>{children}</>;
                  },
                  // Premium table components
                  table({ children }) {
                    return (
                      <div className="my-3 overflow-x-auto rounded-xl border border-[var(--border)]">
                        <table className="w-full border-collapse text-xs">{children}</table>
                      </div>
                    );
                  },
                  thead({ children }) {
                    return <thead className="bg-[var(--bg-muted)] text-[var(--text-muted)]">{children}</thead>;
                  },
                  th({ children }) {
                    return (
                      <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] first:rounded-tl-xl last:rounded-tr-xl">
                        {children}
                      </th>
                    );
                  },
                  td({ children }) {
                    return (
                      <td className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--text-primary)]">
                        {children}
                      </td>
                    );
                  },
                  tr({ children }) {
                    return <tr className="transition-colors hover:bg-[var(--bg-muted)]/50">{children}</tr>;
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="my-3 border-l-3 border-[var(--brand)] bg-[var(--brand)]/5 pl-4 py-2 rounded-r-lg text-[var(--text-secondary)] italic">
                        {children}
                      </blockquote>
                    );
                  },
                  hr() {
                    return <hr className="my-4 border-[var(--border)]" />;
                  },
                }}
              >
                {cleanContent}
              </ReactMarkdown>
              {/* Inline charts */}
              {charts.length > 0 && charts.map((chart, i) => (
                <AiChartBlock key={`chart-${i}`} config={chart} />
              ))}
              {/* Inline generated images */}
              {imagePrompts.length > 0 && !isStreaming && imagePrompts.map((prompt, i) => (
                <AiImageBlock key={`img-${i}`} prompt={prompt} />
              ))}
              {/* 3D Navigate links */}
              {navigateLinks.length > 0 && !isStreaming && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {navigateLinks.map((link, i) => (
                    <NavigateLinkButton key={`nav-${i}`} link={link} />
                  ))}
                </div>
              )}
              {/* Streaming cursor */}
              {isStreaming && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{
                    duration: 0.7,
                    repeat: Infinity,
                    repeatType: "reverse",
                  }}
                  className="ml-0.5 inline-block h-4 w-0.5 bg-[var(--brand)]"
                />
              )}
            </div>
          )}
        </div>

        {/* Follow-up suggestions */}
        {!isUser &&
          !isStreaming &&
          suggestions.length > 0 &&
          isLatestAssistant && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    // Fire custom event to send this as a message
                    window.dispatchEvent(
                      new CustomEvent("grixi-ai:quick-prompt", {
                        detail: { prompt: s },
                      })
                    );
                  }}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-all hover:border-[var(--brand)]/30 hover:bg-[var(--brand)]/5 hover:text-[var(--text-primary)]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

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

          {/* Favorite */}
          {!isUser && (
            <button
              className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-amber-500"
              title="Guardar como favorito"
            >
              <Star size={11} />
            </button>
          )}

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
          GRIXI AI
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
