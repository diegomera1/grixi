/**
 * useFeatureFlag — Client-side feature flag hook
 * 
 * Reads flags from TenantContext (populated by the layout loader).
 * 
 * Usage:
 *   const canUseAI = useFeatureFlag("module_ai");
 *   const hasCanvas = useFeatureFlag("ai_canvas");
 *   if (!canUseAI) return <UpgradePrompt />;
 */

import { useOutletContext } from "react-router";
import type { TenantContext } from "~/routes/authenticated";

/**
 * Check if a specific feature flag is enabled for the current tenant.
 */
export function useFeatureFlag(key: string, defaultValue = false): boolean {
  const ctx = useOutletContext<TenantContext>();
  return ctx.featureFlags?.[key] ?? defaultValue;
}

/**
 * Get all feature flags for the current tenant.
 */
export function useFeatureFlags(): Record<string, boolean> {
  const ctx = useOutletContext<TenantContext>();
  return ctx.featureFlags ?? {};
}

/**
 * Component guard — renders children only if flag is enabled
 */
export function FeatureFlagGate({
  flag,
  fallback = null,
  children,
}: {
  flag: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const enabled = useFeatureFlag(flag);
  return enabled ? <>{children}</> : <>{fallback}</>;
}
