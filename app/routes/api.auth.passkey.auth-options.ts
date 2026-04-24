/**
 * Passkey Authentication Options — API Route (PUBLIC)
 * POST /api/auth/passkey/auth-options
 * 
 * Generates WebAuthn authentication options.
 * This route is PUBLIC (no session required) — used from the login page.
 */
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { PASSKEY_CONFIG, challengeKey } from "~/lib/passkey/config";
import type { Route } from "./+types/api.auth.passkey.auth-options";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;
  const admin = createSupabaseAdminClient(env);

  // Discoverable credentials — no email needed
  // The authenticator will present all available passkeys for grixi.ai
  const options = await generateAuthenticationOptions({
    rpID: PASSKEY_CONFIG.rpID,
    userVerification: "preferred",
  });

  // Store challenge in KV with a temporary ID
  // For discoverable credentials, we use the challenge itself as the key
  const kv = env.KV_CACHE;
  await kv.put(
    `PASSKEY_AUTH_CHALLENGE:${options.challenge}`,
    JSON.stringify({ challenge: options.challenge, createdAt: Date.now() }),
    { expirationTtl: PASSKEY_CONFIG.challengeTTL }
  );

  return Response.json(options);
}
