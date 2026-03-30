/**
 * Platform Admin Guard
 * 
 * Ensures admin routes are ONLY accessible from admin.grixi.ai.
 * Falls back to grixi.grixi.ai for backward compatibility.
 * Other tenants (e.g. nexus.grixi.ai) must NOT access platform admin.
 */

const PLATFORM_TENANT_SLUGS = ["grixi", "admin"];

/**
 * Returns true if the current context is the platform admin portal.
 * Checks both:
 *  1. isPlatformAdminPortal flag (admin.grixi.ai — preferred)
 *  2. Legacy tenantSlug === "grixi" (grixi.grixi.ai — backward compat)
 */
export function isPlatformTenant(context: any): boolean {
  // New: dedicated admin portal
  if ((context as any).isPlatformAdminPortal === true) return true;
  
  // Legacy: grixi.grixi.ai
  const tenantSlug = (context as any).tenantSlug as string | null;
  return tenantSlug !== null && PLATFORM_TENANT_SLUGS.includes(tenantSlug);
}

/**
 * Returns true if accessed from the dedicated admin.grixi.ai portal (not grixi.grixi.ai).
 */
export function isDedicatedAdminPortal(context: any): boolean {
  return (context as any).isPlatformAdminPortal === true;
}
