/**
 * Admin Session Guard — KV-based Inactivity Tracking
 *
 * Tracks admin activity timestamps in Cloudflare KV.
 * If no activity within ADMIN_SESSION_TIMEOUT_SECONDS, the admin is
 * redirected to re-authenticate.
 *
 * This is an APPLICATION-LEVEL guard, independent of Supabase Auth session.
 * It adds an extra layer: even if the Supabase token is still valid,
 * the admin must re-verify after inactivity.
 */
import { redirect } from "react-router";

/** Admin session timeout — 30 minutes */
const ADMIN_SESSION_TIMEOUT_SECONDS = 30 * 60;

/** KV key prefix for admin last activity */
const KV_PREFIX = "admin_session:";

/**
 * Check and update admin session activity.
 * Returns true if session is valid, throws redirect if expired.
 */
export async function requireAdminSession(
  userId: string,
  kv: KVNamespace | undefined,
  headers: Headers,
  currentPath: string,
): Promise<void> {
  if (!kv) return; // No KV = skip (dev mode)

  const key = `${KV_PREFIX}${userId}`;
  const lastActivity = await kv.get(key);

  if (lastActivity) {
    const elapsed = Date.now() - parseInt(lastActivity, 10);
    if (elapsed > ADMIN_SESSION_TIMEOUT_SECONDS * 1000) {
      // Session expired — clear and redirect to re-auth
      await kv.delete(key);
      const returnTo = encodeURIComponent(currentPath);
      throw redirect(`/admin/reauth?returnTo=${returnTo}`, { headers });
    }
  }

  // Update activity timestamp (TTL = timeout + buffer)
  await kv.put(key, String(Date.now()), {
    expirationTtl: ADMIN_SESSION_TIMEOUT_SECONDS + 300, // +5min buffer
  });
}

/**
 * Record admin session start (called after successful auth verification).
 */
export async function startAdminSession(
  userId: string,
  kv: KVNamespace | undefined,
): Promise<void> {
  if (!kv) return;
  await kv.put(`${KV_PREFIX}${userId}`, String(Date.now()), {
    expirationTtl: ADMIN_SESSION_TIMEOUT_SECONDS + 300,
  });
}

/**
 * Clear admin session (called on logout or re-auth).
 */
export async function clearAdminSession(
  userId: string,
  kv: KVNamespace | undefined,
): Promise<void> {
  if (!kv) return;
  await kv.delete(`${KV_PREFIX}${userId}`);
}

/**
 * Get remaining session time in seconds.
 * Returns null if no session found.
 */
export async function getAdminSessionRemaining(
  userId: string,
  kv: KVNamespace | undefined,
): Promise<number | null> {
  if (!kv) return ADMIN_SESSION_TIMEOUT_SECONDS;
  const lastActivity = await kv.get(`${KV_PREFIX}${userId}`);
  if (!lastActivity) return null;
  const elapsed = (Date.now() - parseInt(lastActivity, 10)) / 1000;
  return Math.max(0, ADMIN_SESSION_TIMEOUT_SECONDS - elapsed);
}
