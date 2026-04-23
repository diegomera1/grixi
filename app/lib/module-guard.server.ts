/**
 * GRIXI — Module Guard (Server-Side)
 * 
 * Server-side helper for module gating.
 * Use `requireModule()` when org settings are available in the loader.
 * 
 * For client-side gating, use `~/components/shared/module-guard.tsx`.
 * 
 * @module lib/module-guard.server
 */

import { redirect } from "react-router";

/**
 * Validates that a module is enabled for the org.
 * Throws redirect to /dashboard if not enabled.
 * Platform admins always bypass.
 * 
 * @example
 *   requireModule("finanzas", org.settings, isPlatformAdmin, headers);
 */
export function requireModule(
  moduleName: string,
  orgSettings: Record<string, any> | null | undefined,
  isPlatformAdmin: boolean,
  headers: Headers
): void {
  if (isPlatformAdmin) return;
  if (moduleName === "dashboard") return;

  const enabledModules: string[] = orgSettings?.enabled_modules ?? ["dashboard"];

  if (!enabledModules.includes(moduleName)) {
    throw redirect("/dashboard?module_disabled=1", { headers });
  }
}
