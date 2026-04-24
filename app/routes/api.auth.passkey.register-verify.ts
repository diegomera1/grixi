/**
 * Passkey Registration Verify — API Route
 * POST /api/auth/passkey/register-verify
 * 
 * Verifies the WebAuthn registration response, stores the credential,
 * and marks the user's profile as passkey-enabled.
 */
import { createSupabaseServerClient, createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { PASSKEY_CONFIG, challengeKey, getExpectedOrigins } from "~/lib/passkey/config";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import type { Route } from "./+types/api.auth.passkey.register-verify";

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
  const body = await request.json();
  const { attestation, friendlyName } = body;

  if (!attestation) {
    return Response.json({ error: "Missing attestation response" }, { status: 400, headers });
  }

  // Retrieve stored challenge from KV
  const kv = env.KV_CACHE;
  const expectedChallenge = await kv.get(challengeKey(user.id, "register"));

  if (!expectedChallenge) {
    return Response.json({ error: "Challenge expired or not found" }, { status: 400, headers });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge,
      expectedOrigin: getExpectedOrigins(request),
      expectedRPID: PASSKEY_CONFIG.rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return Response.json({ error: "Verification failed" }, { status: 400, headers });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    // Store credential in database
    const { error: insertError } = await admin.from("user_passkeys").insert({
      user_id: user.id,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString("base64url"),
      counter: Number(credential.counter),
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      transports: credential.transports || [],
      friendly_name: friendlyName || `Passkey ${new Date().toLocaleDateString("es")}`,
    });

    if (insertError) {
      console.error("Failed to store passkey:", insertError);
      return Response.json({ error: "Failed to save passkey" }, { status: 500, headers });
    }

    // Mark profile as passkey-enabled
    await admin.from("profiles")
      .update({ passkey_enabled: true })
      .eq("id", user.id);

    // Clean up challenge
    await kv.delete(challengeKey(user.id, "register"));

    // Audit log
    const tenantSlug = (context as any).tenantSlug as string | null;
    const { data: org } = await admin.from("organizations")
      .select("id").eq("slug", tenantSlug).maybeSingle();

    await logAuditEvent(admin, {
      actorId: user.id,
      action: "passkey.register",
      entityType: "user_passkey",
      organizationId: org?.id,
      metadata: {
        credentialId: credential.id,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        friendlyName: friendlyName || "Passkey",
      },
      ipAddress: getClientIP(request),
    });

    return Response.json({ success: true, verified: true }, { headers });
  } catch (error: any) {
    console.error("Passkey registration verification error:", error);
    return Response.json({ error: error.message || "Verification error" }, { status: 500, headers });
  }
}
