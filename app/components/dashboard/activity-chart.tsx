import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Activity } from "lucide-react";
import { EmptyState } from "~/components/shared/empty-state";

interface AuditLog {
  id: string;
  action: string;
  created_at: string;
}

interface ActivityChartProps {
  logs: AuditLog[];
  brandColor: string;
  t: (key: string) => string;
}

function groupByDay(logs: AuditLog[]): { day: string; count: number }[] {
  const now = new Date();
  const days: { day: string; count: number }[] = [];
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const dayName = dayNames[date.getDay()];
    const count = logs.filter((l) => l.created_at.startsWith(dateStr)).length;
    days.push({ day: dayName, count });
  }
  return days;
}

export function ActivityChart({ logs, brandColor, t }: ActivityChartProps) {
  const data = groupByDay(logs);
  const hasData = data.some((d) => d.count > 0);

  return (
    <div className="enter-fade stagger-5 rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("dash.activity.title")}
        </h3>
        <span className="text-[11px] text-text-muted">
          {t("dash.activity.last7")}
        </span>
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={brandColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={brandColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: 12,
                color: "var(--text-primary)",
              }}
              labelStyle={{ color: "var(--text-secondary)" }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={brandColor}
              strokeWidth={2}
              fill="url(#chartGradient)"
              dot={{ fill: brandColor, r: 3, strokeWidth: 0 }}
              activeDot={{ fill: brandColor, r: 5, strokeWidth: 2, stroke: "var(--bg-surface)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState icon={Activity} title={t("dash.activity.empty")} />
      )}
    </div>
  );
}
