/**
 * Passkey Registration Options — API Route
 * POST /api/auth/passkey/register-options
 * 
 * Generates WebAuthn registration options for the authenticated user.
 * Requires active session (inside authenticated layout).
 */
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { PASSKEY_CONFIG, challengeKey } from "~/lib/passkey/config";
import type { Route } from "./+types/api.auth.passkey.register-options";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const admin = createSupabaseAdminClient(env);

  // Get existing passkeys to exclude
  const { data: existingKeys } = await admin
    .from("user_passkeys")
    .select("credential_id, transports")
    .eq("user_id", user.id);

  const excludeCredentials = (existingKeys || []).map((key: any) => ({
    id: key.credential_id,
    transports: key.transports || [],
  }));

  const options = await generateRegistrationOptions({
    rpName: PASSKEY_CONFIG.rpName,
    rpID: PASSKEY_CONFIG.rpID,
    userName: user.email || user.id,
    userDisplayName: user.user_metadata?.full_name || user.email || "Usuario GRIXI",
    userID: new TextEncoder().encode(user.id),
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    supportedAlgorithmIDs: PASSKEY_CONFIG.supportedAlgorithmIDs,
  });

  // Store challenge in KV (TTL 5 min)
  const kv = env.KV_CACHE;
  await kv.put(
    challengeKey(user.id, "register"),
    options.challenge,
    { expirationTtl: PASSKEY_CONFIG.challengeTTL }
  );

  return Response.json(options, { headers });
}
