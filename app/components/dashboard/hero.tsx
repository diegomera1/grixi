import { Users, Shield, Lock, Mail } from "lucide-react";
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
  };
  isLive?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function DashboardHero({ userName, orgName, orgColor, kpis, isLive, t }: HeroProps) {
  const welcome = t("dash.welcome", { name: userName });

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
          <h1 className="text-xl font-bold text-white sm:text-2xl font-display">
            {welcome}
          </h1>
          <p className="mt-1 text-sm text-white/70">
            {orgName} — {t("dash.subtitle")}
          </p>
        </div>
        {/* Decorative elements */}
        <div
          className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20"
          style={{ background: `radial-gradient(circle, white, transparent)` }}
        />
        <div
          className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full opacity-10"
          style={{ background: `radial-gradient(circle, white, transparent)` }}
        />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label={t("dash.kpi.members")}
          value={kpis.members}
          icon={Users}
          color="#6366F1"
          staggerIndex={0}
        />
        <KpiCard
          label={t("dash.kpi.roles")}
          value={kpis.roles}
          icon={Shield}
          color="#10B981"
          staggerIndex={1}
        />
        <KpiCard
          label={t("dash.kpi.permissions")}
          value={kpis.permissions}
          icon={Lock}
          color="#F59E0B"
          staggerIndex={2}
        />
        <KpiCard
          label={t("dash.kpi.invitations")}
          value={kpis.pendingInvites}
          icon={Mail}
          color="#EC4899"
          staggerIndex={3}
        />
      </div>
    </div>
  );
}
