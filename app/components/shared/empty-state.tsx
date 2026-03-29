import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-subtle">
        <Icon size={22} className="text-text-muted" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs text-text-muted">{description}</p>
      )}
    </div>
  );
}
