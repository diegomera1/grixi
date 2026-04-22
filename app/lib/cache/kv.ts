/**
 * Cloudflare KV Cache — GRIXI
 * 
 * Caches frequently-read, rarely-changing data at the edge.
 * Each key is prefixed with a scope to allow targeted invalidation.
 * 
 * Cache strategy:
 *   - platform_admin:{userId}  → 10 min (changes very rarely)
 *   - user_orgs:{userId}       → 5 min  (changes when membership changes)
 *   - user_perms:{userId}:{orgId} → 3 min (changes when roles are edited)
 *   - org_config:{orgId}       → 5 min  (changes when org settings updated)
 */

// TTL constants (seconds)
export const CACHE_TTL = {
  PLATFORM_ADMIN: 600,   // 10 min — almost never changes
  USER_ORGS: 300,        // 5 min  — changes on membership add/remove
  USER_PERMS: 180,       // 3 min  — changes on role permission edit
  ORG_CONFIG: 300,       // 5 min  — changes on org settings update
} as const;

// Key builders — centralized to ensure consistency
export const cacheKey = {
  platformAdmin: (userId: string) => `platform_admin:${userId}`,
  userOrgs: (userId: string) => `user_orgs:${userId}`,
  userPerms: (userId: string, orgId: string) => `user_perms:${userId}:${orgId}`,
  orgConfig: (orgId: string) => `org_config:${orgId}`,
} as const;

/**
 * Get a value from KV cache, or fetch it and store it.
 * Non-blocking put — doesn't slow down the response.
 */
export async function getCachedOrFetch<T>(
  kv: KVNamespace | undefined,
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<{ data: T; fromCache: boolean }> {
  // If KV is not available (local dev), just fetch directly
  if (!kv) {
    const data = await fetcher();
    return { data, fromCache: false };
  }

  try {
    // Try cache first
    const cached = await kv.get(key, "json");
    if (cached !== null) {
      return { data: cached as T, fromCache: true };
    }
  } catch {
    // KV read failed — fall through to fetcher
  }

  // Cache miss — fetch from source
  const data = await fetcher();

  // Non-blocking put (don't await — fire and forget)
  try {
    kv.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds });
  } catch {
    // KV write failed — no big deal, we have the data
  }

  return { data, fromCache: false };
}

/**
 * Invalidate specific cache keys.
 * Call this in actions that modify cached data.
 */
export async function invalidateCache(
  kv: KVNamespace | undefined,
  keys: string[]
): Promise<void> {
  if (!kv || keys.length === 0) return;

  await Promise.allSettled(
    keys.map(key => kv.delete(key))
  );
}

/**
 * Invalidate all cache related to a user.
 * Call when: membership changes, role changes, profile changes.
 */
export async function invalidateUserCache(
  kv: KVNamespace | undefined,
  userId: string,
  orgIds?: string[]
): Promise<void> {
  if (!kv) return;

  const keys = [
    cacheKey.platformAdmin(userId),
    cacheKey.userOrgs(userId),
  ];

  // Also invalidate per-org permission caches
  if (orgIds) {
    for (const orgId of orgIds) {
      keys.push(cacheKey.userPerms(userId, orgId));
    }
  }

  await invalidateCache(kv, keys);
}

/**
 * Invalidate all cache related to an org.
 * Call when: org settings change, roles change.
 */
export async function invalidateOrgCache(
  kv: KVNamespace | undefined,
  orgId: string
): Promise<void> {
  if (!kv) return;

  await invalidateCache(kv, [
    cacheKey.orgConfig(orgId),
  ]);
}
