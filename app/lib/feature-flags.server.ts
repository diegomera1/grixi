/**
 * Feature Flags — Server-side utilities
 * 
 * Resolves feature flags for a tenant using:
 * 1. KV cache (30s TTL) for performance
 * 2. Supabase tables (feature_flags + feature_flag_overrides)
 * 
 * Usage in loaders:
 *   const flags = await getFeatureFlags(env, orgId);
 *   if (!flags.ai_canvas) redirect("/dashboard");
 */

import type { getCachedOrFetch } from "~/lib/cache/kv";

export type FeatureFlags = Record<string, boolean>;

interface FlagEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  KV_CACHE?: KVNamespace;
}

/**
 * Get all resolved feature flags for an organization.
 * Merges global defaults with per-org overrides.
 */
export async function getFeatureFlags(
  env: FlagEnv,
  organizationId: string | null | undefined,
  kvCache?: { getCachedOrFetch: typeof getCachedOrFetch }
): Promise<FeatureFlags> {
  const cacheKey = `feature_flags:${organizationId || "global"}`;

  // Try KV cache first
  if (env.KV_CACHE && kvCache) {
    try {
      const cached = await kvCache.getCachedOrFetch(
        env.KV_CACHE,
        cacheKey,
        () => fetchFlags(env, organizationId),
        30 // 30 second TTL
      );
      return cached as FeatureFlags;
    } catch {
      // Fall through to direct fetch
    }
  }

  return fetchFlags(env, organizationId);
}

async function fetchFlags(
  env: FlagEnv,
  organizationId: string | null | undefined
): Promise<FeatureFlags> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // Get all global flags
  const { data: flags } = await supabase
    .from("feature_flags")
    .select("key, default_enabled");

  if (!flags) return {};

  // Build defaults
  const result: FeatureFlags = {};
  for (const flag of flags) {
    result[flag.key] = flag.default_enabled;
  }

  // Apply per-org overrides
  if (organizationId) {
    const { data: overrides } = await supabase
      .from("feature_flag_overrides")
      .select("flag_key, enabled")
      .eq("organization_id", organizationId);

    if (overrides) {
      for (const override of overrides) {
        result[override.flag_key] = override.enabled;
      }
    }
  }

  return result;
}

/**
 * Check a single feature flag (convenience function for guards)
 */
export function isFeatureEnabled(
  flags: FeatureFlags,
  key: string,
  defaultValue = false
): boolean {
  return flags[key] ?? defaultValue;
}

/**
 * Server-side guard: throws redirect if feature is disabled
 */
export async function requireFeatureFlag(
  flags: FeatureFlags,
  key: string,
  redirectTo = "/dashboard"
): Promise<void> {
  if (!isFeatureEnabled(flags, key)) {
    const { redirect } = await import("react-router");
    throw redirect(redirectTo);
  }
}
