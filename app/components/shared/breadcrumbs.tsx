/**
 * Breadcrumbs — Auto-generates breadcrumb trail from route matches
 * 
 * Each route should export: handle.breadcrumb: string
 * Example: export const handle = { breadcrumb: "Dashboard" };
 */
import { useMatches, Link } from "react-router";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbMatch {
  id: string;
  pathname: string;
  handle?: { breadcrumb?: string };
}

export function Breadcrumbs() {
  const matches = useMatches() as BreadcrumbMatch[];
  
  const crumbs = matches
    .filter((m) => m.handle?.breadcrumb)
    .map((m) => ({
      label: m.handle!.breadcrumb!,
      path: m.pathname,
    }));

  if (crumbs.length <= 1) return null;

  return (
    <nav className="mb-4 flex items-center gap-1 text-xs" aria-label="Breadcrumb">
      <Link
        to="/dashboard"
        className="flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:bg-white/5"
        style={{ color: "var(--muted-foreground)" }}
      >
        <Home size={12} />
      </Link>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.path} className="flex items-center gap-1">
            <ChevronRight size={12} style={{ color: "var(--muted-foreground)", opacity: 0.5 }} />
            {isLast ? (
              <span className="font-medium" style={{ color: "var(--foreground)" }}>
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="rounded px-1.5 py-1 transition-colors hover:bg-white/5"
                style={{ color: "var(--muted-foreground)" }}
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
