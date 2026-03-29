import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Copy, Check, RefreshCw, Sparkles, User, FileText } from "lucide-react";
import { AiChartBlock, type ChartConfig } from "./ai-chart-block";
import type { ChatMessage as ChatMessageType, Attachment } from "../types";

type ChatMessageProps = {
  message: ChatMessageType;
  isStreaming?: boolean;
  isLast?: boolean;
  onRegenerate?: () => void;
  userAvatar?: string;
  onOpenCanvas?: (chart: ChartConfig) => void;
};

/** Parse markdown-lite: headers, bold, italic, code blocks, lists, tables */
function renderMarkdown(content: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = content.split("\n");
  let inCodeBlock = false;
  let codeContent = "";
  let codeLang = "";
  let codeKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        nodes.push(
          <div key={`code-${codeKey++}`} className="my-2 overflow-x-auto rounded-lg bg-muted p-3">
            {codeLang && (
              <p className="mb-1.5 text-[9px] font-mono uppercase tracking-wider text-text-muted">{codeLang}</p>
            )}
            <pre className="text-xs text-text-primary font-mono leading-relaxed whitespace-pre-wrap">
              {codeContent.trim()}
            </pre>
          </div>
        );
        codeContent = "";
        codeLang = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + "\n";
      continue;
    }

    // Empty line
    if (!line.trim()) {
      nodes.push(<div key={`space-${i}`} className="h-2" />);
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      nodes.push(<h4 key={i} className="mb-1 mt-3 text-xs font-bold text-text-primary">{formatInline(line.slice(4))}</h4>);
      continue;
    }
    if (line.startsWith("## ")) {
      nodes.push(<h3 key={i} className="mb-1 mt-3 text-sm font-bold text-text-primary">{formatInline(line.slice(3))}</h3>);
      continue;
    }
    if (line.startsWith("# ")) {
      nodes.push(<h2 key={i} className="mb-2 mt-3 text-base font-bold text-text-primary">{formatInline(line.slice(2))}</h2>);
      continue;
    }

    // Table rows
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableLines: string[] = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        tableLines.push(lines[j]);
        j++;
      }
      i = j - 1;

      const rows = tableLines
        .filter((tl) => !tl.replace(/[|\-: ]/g, "").trim().length ? false : true)
        .map((tl) =>
          tl.split("|").filter(Boolean).map((cell) => cell.trim())
        );

      if (rows.length > 0) {
        nodes.push(
          <div key={`table-${i}`} className="my-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  {rows[0].map((cell, ci) => (
                    <th key={ci} className="px-3 py-1.5 text-left font-semibold text-text-primary">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} className="border-t border-border">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-text-secondary">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Unordered lists
    if (line.match(/^[\s]*[-*]\s/)) {
      const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
      const text = line.replace(/^[\s]*[-*]\s/, "");
      nodes.push(
        <div key={i} className="flex gap-2 text-text-secondary" style={{ paddingLeft: `${indent * 8 + 4}px` }}>
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
          <span className="text-xs leading-relaxed">{formatInline(text)}</span>
        </div>
      );
      continue;
    }

    // Ordered lists
    if (line.match(/^[\s]*\d+\.\s/)) {
      const num = line.match(/^[\s]*(\d+)\./)?.[1] || "1";
      const text = line.replace(/^[\s]*\d+\.\s/, "");
      nodes.push(
        <div key={i} className="flex gap-2 pl-1 text-text-secondary">
          <span className="shrink-0 text-xs font-medium text-text-muted">{num}.</span>
          <span className="text-xs leading-relaxed">{formatInline(text)}</span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={i} className="text-xs leading-relaxed text-text-secondary">
        {formatInline(line)}
      </p>
    );
  }

  return nodes;
}

/** Format inline: bold, italic, inline code */
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Bold
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);

    const codeIdx = codeMatch ? remaining.indexOf(codeMatch[0]) : Infinity;
    const boldIdx = boldMatch ? remaining.indexOf(boldMatch[0]) : Infinity;

    if (codeIdx === Infinity && boldIdx === Infinity) {
      parts.push(remaining);
      break;
    }

    const firstIdx = Math.min(codeIdx, boldIdx);
    if (firstIdx > 0) {
      parts.push(remaining.slice(0, firstIdx));
    }

    if (codeIdx <= boldIdx && codeMatch) {
      parts.push(
        <code key={keyIdx++} className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-brand">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeIdx + codeMatch[0].length);
    } else if (boldMatch) {
      parts.push(
        <strong key={keyIdx++} className="font-semibold text-text-primary">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldIdx + boldMatch[0].length);
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/** Parse chart blocks embedded in content */
function extractCharts(content: string): { text: string; charts: ChartConfig[] } {
  const charts: ChartConfig[] = [];
  const cleaned = content.replace(/<!--CHART:(.*?)-->/gs, (_, json) => {
    try {
      charts.push(JSON.parse(json) as ChartConfig);
    } catch { /* skip invalid */ }
    return "";
  });
  return { text: cleaned, charts };
}

export function ChatMessage({
  message,
  isStreaming,
  isLast,
  onRegenerate,
  userAvatar,
  onOpenCanvas,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const { text, charts } = useMemo(() => extractCharts(message.content), [message.content]);
  const renderedContent = useMemo(() => renderMarkdown(text), [text]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-3 px-3 py-3 md:px-4 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {/* Avatar */}
      <div className="mt-0.5 shrink-0">
        {isUser ? (
          userAvatar ? (
            <img src={userAvatar} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10">
              <User size={13} className="text-brand" />
            </div>
          )
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10">
            <Sparkles size={13} className="text-brand" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`flex max-w-[85%] flex-col gap-1 ${isUser ? "items-end" : ""}`}>
        {/* Name */}
        <p className="text-[10px] font-semibold text-text-muted">
          {isUser ? "Tú" : "GRIXI AI"}
        </p>

        {/* Message Bubble */}
        <div
          className={`rounded-2xl px-3.5 py-2.5 ${
            isUser
              ? "bg-brand text-white"
              : "bg-surface border border-border"
          }`}
        >
          {isUser ? (
            <p className="text-xs leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="space-y-0.5">{renderedContent}</div>
          )}

          {/* Streaming cursor */}
          {isStreaming && !isUser && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="ml-0.5 inline-block h-3.5 w-0.5 rounded-full bg-brand"
            />
          )}
        </div>

        {/* Charts */}
        {charts.map((chart, i) => (
          <div key={i} className="mt-1 w-full max-w-md">
            <AiChartBlock config={chart} />
            {onOpenCanvas && (
              <button
                onClick={() => onOpenCanvas(chart)}
                className="mt-1 text-[10px] text-brand hover:underline"
              >
                Abrir en Canvas →
              </button>
            )}
          </div>
        ))}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {message.attachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2 py-1 text-[10px] text-text-secondary hover:text-brand"
              >
                {att.type.startsWith("image/") ? (
                  <img src={att.url} alt="" className="h-6 w-6 rounded object-cover" />
                ) : (
                  <FileText size={12} />
                )}
                <span className="max-w-[100px] truncate">{att.name}</span>
              </a>
            ))}
          </div>
        )}

        {/* Actions */}
        {!isUser && !isStreaming && (
          <div className="mt-0.5 flex gap-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-muted hover:text-text-primary"
            >
              {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            {isLast && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-muted hover:text-text-primary"
              >
                <RefreshCw size={11} />
                Regenerar
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Typing indicator — 3 animated dots */
export function TypingIndicator() {
  return (
    <div className="flex gap-3 px-3 py-3 md:px-4">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10">
        <Sparkles size={13} className="text-brand" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface px-4 py-2.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            className="h-1.5 w-1.5 rounded-full bg-brand"
          />
        ))}
      </div>
    </div>
  );
}

