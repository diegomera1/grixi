import { Building2, Globe, Palette, Languages, Crown } from "lucide-react";

interface OrgInfoCardProps {
  name: string;
  slug: string;
  plan: string;
  color: string;
  language: string;
  logoUrl?: string;
  t: (key: string) => string;
}

const planBadgeColors: Record<string, { bg: string; text: string }> = {
  enterprise: { bg: "bg-amber-500/15 dark:bg-amber-400/15", text: "text-amber-600 dark:text-amber-400" },
  professional: { bg: "bg-blue-500/15 dark:bg-blue-400/15", text: "text-blue-600 dark:text-blue-400" },
  starter: { bg: "bg-zinc-500/15 dark:bg-zinc-400/15", text: "text-zinc-600 dark:text-zinc-400" },
};

const langName: Record<string, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
};

export function OrgInfoCard({ name, slug, plan, color, language, logoUrl, t }: OrgInfoCardProps) {
  const badge = planBadgeColors[plan] ?? planBadgeColors.starter;

  return (
    <div className="enter-fade stagger-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
      <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
        {t("dash.org.title")}
      </h3>

      {/* Logo + Name */}
      <div className="mb-4 flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="h-10 w-10 rounded-xl object-cover" />
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{name}</p>
          <p className="text-[11px] text-[var(--text-muted)] truncate">{slug}.grixi.ai</p>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Crown size={14} strokeWidth={1.5} />
            <span>{t("dash.org.plan")}</span>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${badge.bg} ${badge.text}`}>
            {plan}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Palette size={14} strokeWidth={1.5} />
            <span>{t("dash.org.color")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border border-[var(--border)]" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-[var(--text-muted)] font-mono">{color}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Languages size={14} strokeWidth={1.5} />
            <span>{t("dash.org.language")}</span>
          </div>
          <span className="text-xs text-[var(--text-primary)]">{langName[language] ?? language}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Globe size={14} strokeWidth={1.5} />
            <span>{t("dash.org.subdomain")}</span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">{slug}.grixi.ai</span>
        </div>
      </div>
    </div>
  );
}
