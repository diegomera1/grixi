import { History } from "lucide-react";
import { EmptyState } from "~/components/shared/empty-state";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  actor_id: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

interface ActivityTimelineProps {
  logs: AuditLog[];
  t: (key: string, params?: Record<string, string | number>) => string;
}

const actionColors: Record<string, string> = {
  "user": "#6366F1",
  "invitation": "#10B981",
  "organization": "#F59E0B",
  "member": "#3B82F6",
  "role": "#8B5CF6",
};

function getActionColor(action: string): string {
  const prefix = action.split(".")[0];
  return actionColors[prefix] ?? "#71717A";
}

function formatAction(action: string): string {
  return action.replace(/\./g, " · ");
}

function formatRelativeTime(dateStr: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  const weeks = Math.floor(days / 7);

  if (minutes < 1) return t("time.now");
  if (minutes < 60) return t("time.minutes", { n: minutes });
  if (hours < 24) return t("time.hours", { n: hours });
  if (days < 7) return t("time.days", { n: days });
  return t("time.weeks", { n: weeks });
}

export function ActivityTimeline({ logs, t }: ActivityTimelineProps) {
  if (!logs.length) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">
          {t("dash.timeline.title")}
        </h3>
        <EmptyState icon={History} title={t("dash.timeline.empty")} />
      </div>
    );
  }

  return (
    <div className="enter-fade stagger-7 rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">
        {t("dash.timeline.title")}
      </h3>
      <div className="space-y-3">
        {logs.slice(0, 8).map((log, i) => (
          <div
            key={log.id}
            className="enter-slide-left flex items-start gap-3"
            style={{ transitionDelay: `${i * 0.06}s` }}
          >
            {/* Dot */}
            <div className="mt-1.5 flex shrink-0">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: getActionColor(log.action) }}
              />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-primary truncate">
                <span className="font-medium">{formatAction(log.action)}</span>
              </p>
              {log.metadata?.email && (
                <p className="text-[11px] text-text-muted truncate">
                  {log.metadata.email}
                </p>
              )}
            </div>

            {/* Time */}
            <span className="shrink-0 text-[11px] text-text-muted">
              {formatRelativeTime(log.created_at, t)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
