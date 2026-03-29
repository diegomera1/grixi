import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { AiChartBlock, parseChartBlocks, parseImageBlocks } from "~/features/ai/components/ai-chart-block";

/**
 * Compact markdown renderer for the AI widget.
 * Renders markdown, GFM tables, code blocks, charts, and images
 * in a compact form suitable for the floating widget.
 */
export function WidgetMessageContent({
  content,
  isUser,
  isStreaming = false,
}: {
  content: string;
  isUser: boolean;
  isStreaming?: boolean;
}) {
  const { cleanContent, charts } = useMemo(() => {
    if (isUser) return { cleanContent: content, charts: [], imagePrompts: [] };
    const { cleanContent: c1, charts } = parseChartBlocks(content);
    const { cleanContent: c2 } = parseImageBlocks(c1);
    return { cleanContent: c2, charts };
  }, [content, isUser]);

  if (isUser) {
    return <p className="whitespace-pre-wrap text-xs leading-relaxed">{content}</p>;
  }

  if (!cleanContent && !isStreaming) return null;

  return (
    <div className="widget-markdown text-xs leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeStr = String(children).replace(/\n$/, "");
            if (match) {
              return (
                <div className="my-1.5 overflow-hidden rounded-lg border border-border">
                  <div className="bg-muted px-2 py-1 text-[8px] font-medium uppercase tracking-wider text-text-muted">
                    {match[1]}
                  </div>
                  <pre className="overflow-x-auto bg-bg-primary p-2 text-[10px] leading-relaxed">
                    <code>{codeStr}</code>
                  </pre>
                </div>
              );
            }
            return (
              <code className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono" {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) { return <>{children}</>; },
          table({ children }) {
            return (
              <div className="my-2 overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-[10px]">{children}</table>
              </div>
            );
          },
          thead({ children }) { return <thead className="bg-muted text-text-muted">{children}</thead>; },
          th({ children }) { return <th className="px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-text-muted">{children}</th>; },
          td({ children }) { return <td className="border-t border-border px-2 py-1.5 text-[10px] text-text-primary">{children}</td>; },
          tr({ children }) { return <tr className="transition-colors hover:bg-muted/50">{children}</tr>; },
          h1({ children }) { return <h3 className="mb-1 mt-2 text-xs font-bold text-text-primary">{children}</h3>; },
          h2({ children }) { return <h4 className="mb-1 mt-2 text-xs font-bold text-text-primary">{children}</h4>; },
          h3({ children }) { return <h5 className="mb-1 mt-1.5 text-[11px] font-semibold text-text-primary">{children}</h5>; },
          ul({ children }) { return <ul className="my-1 ml-3 list-disc space-y-0.5 text-xs text-text-primary">{children}</ul>; },
          ol({ children }) { return <ol className="my-1 ml-3 list-decimal space-y-0.5 text-xs text-text-primary">{children}</ol>; },
          li({ children }) { return <li className="text-xs text-text-primary">{children}</li>; },
          p({ children }) { return <p className="mb-1.5 last:mb-0 text-xs text-text-primary">{children}</p>; },
          strong({ children }) { return <strong className="font-semibold text-text-primary">{children}</strong>; },
          blockquote({ children }) {
            return (
              <blockquote className="my-1.5 border-l-2 border-(--brand) bg-brand/5 pl-2 py-1 rounded-r text-text-secondary italic text-[10px]">
                {children}
              </blockquote>
            );
          },
          hr() { return <hr className="my-2 border-border" />; },
          a({ href, children }) {
            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline hover:opacity-80">{children}</a>;
          },
        }}
      >
        {cleanContent}
      </ReactMarkdown>

      {charts.length > 0 &&
        charts.map((chart, i) => (
          <div key={`chart-${i}`} className="my-2">
            <AiChartBlock config={chart} />
          </div>
        ))}

      {isStreaming && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, repeatType: "reverse" }}
          className="ml-0.5 inline-block h-3 w-0.5 bg-brand"
        />
      )}
    </div>
  );
}
