import { Users, Shield, Lock, Mail, Bell, Activity, MessageSquare } from "lucide-react";
import { KpiCard } from "~/components/shared/kpi-card";

interface HeroProps {
  userName: string;
  orgName: string;
  orgColor: string;
  kpis: {
    members: number;
    roles: number;
    permissions: number;
    pendingInvites: number;
    unreadNotifications?: number;
    auditEventsToday?: number;
    aiConversations?: number;
  };
  isLive?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return { text: "Buenos días", emoji: "☀️" };
  if (h >= 12 && h < 18) return { text: "Buenas tardes", emoji: "🌤️" };
  return { text: "Buenas noches", emoji: "🌙" };
}

function formatDate(): string {
  return new Date().toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DashboardHero({ userName, orgName, orgColor, kpis, isLive, t }: HeroProps) {
  const greeting = getGreeting();
  const firstName = userName.split(" ")[0];
  const date = formatDate();

  return (
    <div className="space-y-4">
      {/* Hero Banner */}
      <div
        className="enter-fade relative overflow-hidden rounded-2xl px-6 py-6 sm:px-8 sm:py-8"
        style={{
          background: `linear-gradient(135deg, ${orgColor}dd, ${orgColor}88, color-mix(in oklch, ${orgColor} 40%, var(--bg-surface)))`,
        }}
      >
        <div className="relative z-10">
          <h1 className="text-xl font-bold text-white sm:text-2xl font-display flex items-center gap-2">
            {greeting.text}, {firstName} <span className="text-2xl">{greeting.emoji}</span>
          </h1>
          <p className="mt-1 text-sm text-white/70">
            {orgName} — {date}
          </p>
          {isLive && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              En vivo
            </div>
          )}
        </div>
        {/* Decorative elements */}
        <div
          className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, white, transparent)" }}
        />
        <div
          className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, white, transparent)" }}
        />
      </div>

      {/* KPI Row — expanded with new metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <KpiCard label={t("dash.kpi.members")} value={kpis.members} icon={Users} color="#6366F1" staggerIndex={0} />
        <KpiCard label={t("dash.kpi.roles")} value={kpis.roles} icon={Shield} color="#10B981" staggerIndex={1} />
        <KpiCard label={t("dash.kpi.permissions")} value={kpis.permissions} icon={Lock} color="#F59E0B" staggerIndex={2} />
        <KpiCard label={t("dash.kpi.invitations")} value={kpis.pendingInvites} icon={Mail} color="#EC4899" staggerIndex={3} />
        {kpis.unreadNotifications !== undefined && (
          <KpiCard label="Notificaciones" value={kpis.unreadNotifications} icon={Bell} color="#8B5CF6" staggerIndex={4} />
        )}
        {kpis.auditEventsToday !== undefined && (
          <KpiCard label="Eventos hoy" value={kpis.auditEventsToday} icon={Activity} color="#06B6D4" staggerIndex={5} />
        )}
        {kpis.aiConversations !== undefined && (
          <KpiCard label="AI Chats" value={kpis.aiConversations} icon={MessageSquare} color="#F97316" staggerIndex={6} />
        )}
      </div>
    </div>
  );
}
