/**
 * Platform Admin Guard
 * 
 * Ensures admin routes are ONLY accessible from grixi.grixi.ai.
 * Other tenants (e.g. nexus.grixi.ai) must NOT access platform admin.
 */

const PLATFORM_TENANT_SLUG = "grixi";

/**
 * Returns true if the current tenant is the platform tenant (grixi.grixi.ai).
 * Admin routes should call this and redirect if false.
 */
export function isPlatformTenant(context: any): boolean {
  const tenantSlug = (context as any).tenantSlug as string | null;
  return tenantSlug === PLATFORM_TENANT_SLUG;
}
