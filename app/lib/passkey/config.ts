/**
 * Passkey (WebAuthn) Configuration
 * Centralized config for RP ID, origins, and WebAuthn settings
 */

export const PASSKEY_CONFIG = {
  // Relying Party — grixi.ai works for all *.grixi.ai subdomains
  rpID: "grixi.ai",
  rpName: "GRIXI",

  // Expected origins (production + local dev)
  expectedOrigins: [
    "https://grixi.ai",
    "https://admin.grixi.ai",
    // Tenant subdomains — handled dynamically
  ],

  // Challenge TTL in seconds (stored in KV)
  challengeTTL: 300, // 5 minutes

  // Authenticator settings
  authenticatorSelection: {
    residentKey: "preferred" as const,
    userVerification: "preferred" as const,
    authenticatorAttachment: undefined, // Allow both platform & cross-platform
  },

  // Supported algorithms (ES256, RS256)
  supportedAlgorithmIDs: [-7, -257],
};

/**
 * Build the expected origins list dynamically based on the request
 */
export function getExpectedOrigins(request: Request): string[] {
  const url = new URL(request.url);
  const origins = new Set(PASSKEY_CONFIG.expectedOrigins);
  // Add the current request origin (handles tenant subdomains)
  origins.add(url.origin);
  return Array.from(origins);
}

/**
 * KV key for storing challenges temporarily
 */
export function challengeKey(userId: string, type: "register" | "authenticate"): string {
  return `PASSKEY_CHALLENGE:${type}:${userId}`;
}
