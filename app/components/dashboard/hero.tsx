import { Users, Shield, Lock, Mail, Bell, Activity, MessageSquare, Command } from "lucide-react";
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
  const date = new Date();
  const weekday = date.toLocaleDateString("es", { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleDateString("es", { month: "long" });
  // Capitalize first letter
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day} de ${month}`;
}

export function DashboardHero({ userName, orgName, orgColor, kpis, isLive, t }: HeroProps) {
  const greeting = getGreeting();
  const firstName = userName.split(" ")[0];
  const date = formatDate();

  return (
    <div className="space-y-4">
      {/* Hero Banner */}
      <div
        className="enter-fade relative overflow-hidden rounded-2xl px-6 py-5 sm:px-8 sm:py-6"
        style={{
          background: `linear-gradient(135deg, ${orgColor}cc, ${orgColor}77, color-mix(in oklch, ${orgColor} 30%, var(--bg-surface)))`,
        }}
      >
        {/* Content row */}
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl font-display flex items-center gap-2.5">
              {greeting.text}, {firstName}
              <span className="text-2xl leading-none">{greeting.emoji}</span>
            </h1>
            <p className="mt-1 text-sm text-white/60">
              {orgName} — {date}
            </p>
            {isLive && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Datos en tiempo real
              </div>
            )}
          </div>

          {/* Cmd+K hint — desktop only */}
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white active:scale-95"
          >
            <Command size={12} />
            <span className="font-medium">Buscar</span>
            <kbd className="ml-1 rounded border border-white/20 px-1 py-0.5 text-[10px] font-mono leading-none">⌘K</kbd>
          </button>
        </div>

        {/* Decorative circles */}
        <div
          className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, white, transparent)" }}
        />
        <div
          className="absolute -bottom-6 right-12 h-24 w-24 rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, white, transparent)" }}
        />
        <div
          className="absolute -left-4 bottom-0 h-16 w-16 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, white, transparent)" }}
        />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label={t("dash.kpi.members")} value={kpis.members} icon={Users} color="#6366F1" staggerIndex={0} />
        <KpiCard label={t("dash.kpi.roles")} value={kpis.roles} icon={Shield} color="#10B981" staggerIndex={1} />
        <KpiCard label={t("dash.kpi.permissions")} value={kpis.permissions} icon={Lock} color="#F59E0B" staggerIndex={2} />
        <KpiCard label={t("dash.kpi.invitations")} value={kpis.pendingInvites} icon={Mail} color="#EC4899" staggerIndex={3} />
      </div>

      {/* Secondary KPIs — smaller row */}
      {(kpis.unreadNotifications !== undefined || kpis.auditEventsToday !== undefined || kpis.aiConversations !== undefined) && (
        <div className="grid grid-cols-3 gap-3">
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
      )}
    </div>
  );
}
