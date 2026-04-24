/**
 * Passkey Authentication Verify — API Route (PUBLIC)
 * POST /api/auth/passkey/auth-verify
 * 
 * Verifies the WebAuthn authentication response, creates a Supabase session
 * via magic link, and returns the session tokens.
 */
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { createBrowserClient } from "@supabase/ssr";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { PASSKEY_CONFIG, getExpectedOrigins } from "~/lib/passkey/config";
import { logAuditEvent, getClientIP } from "~/lib/audit";
import type { Route } from "./+types/api.auth.passkey.auth-verify";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;
  const admin = createSupabaseAdminClient(env);
  const body = await request.json();
  const { assertion, challenge: clientChallenge } = body;

  if (!assertion) {
    return Response.json({ error: "Missing assertion response" }, { status: 400 });
  }

  // Look up the credential in our database
  const credentialId = assertion.id;
  const { data: passkey, error: lookupError } = await admin
    .from("user_passkeys")
    .select("*")
    .eq("credential_id", credentialId)
    .maybeSingle();

  if (!passkey || lookupError) {
    return Response.json({ error: "Passkey not found" }, { status: 400 });
  }

  // Retrieve the stored challenge from KV
  const kv = env.KV_CACHE;
  const challengeKey = `PASSKEY_AUTH_CHALLENGE:${clientChallenge}`;
  const storedChallenge = await kv.get(challengeKey);

  if (!storedChallenge) {
    return Response.json({ error: "Challenge expired" }, { status: 400 });
  }

  try {
    // Reconstruct public key from base64url
    const publicKeyBytes = Uint8Array.from(
      atob(passkey.public_key.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    );

    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: clientChallenge,
      expectedOrigin: getExpectedOrigins(request),
      expectedRPID: PASSKEY_CONFIG.rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: publicKeyBytes,
        counter: Number(passkey.counter),
        transports: passkey.transports || [],
      },
    });

    if (!verification.verified) {
      return Response.json({ error: "Verification failed" }, { status: 400 });
    }

    // Update counter and last_used_at
    await admin.from("user_passkeys")
      .update({
        counter: Number(verification.authenticationInfo.newCounter),
        last_used_at: new Date().toISOString(),
      })
      .eq("id", passkey.id);

    // Clean up challenge
    await kv.delete(challengeKey);

    // Get user email for session creation
    const { data: { user: authUser }, error: userError } = await admin.auth.admin.getUserById(passkey.user_id);

    if (!authUser || userError) {
      return Response.json({ error: "User not found" }, { status: 400 });
    }

    // Create a Supabase session via magic link
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: authUser.email!,
    });

    if (linkError || !linkData) {
      console.error("Failed to generate magic link:", linkError);
      return Response.json({ error: "Session creation failed" }, { status: 500 });
    }

    // Extract token_hash from the generated link
    const linkUrl = new URL(linkData.properties.action_link);
    const tokenHash = linkUrl.searchParams.get("token_hash") || linkUrl.hash?.replace("#", "");
    
    // We need to extract token_hash from the hashed_token property
    const hashed_token = linkData.properties.hashed_token;

    // Audit log
    const tenantSlug = (context as any).tenantSlug as string | null;
    let orgId: string | undefined;
    if (tenantSlug) {
      const { data: org } = await admin.from("organizations")
        .select("id").eq("slug", tenantSlug).maybeSingle();
      orgId = org?.id;
    }

    await logAuditEvent(admin, {
      actorId: passkey.user_id,
      action: "passkey.authenticate",
      entityType: "user_passkey",
      entityId: passkey.id,
      organizationId: orgId,
      metadata: {
        credentialId: passkey.credential_id,
        friendlyName: passkey.friendly_name,
      },
      ipAddress: getClientIP(request),
    });

    // Return the verification data + OTP info for client-side session creation
    return Response.json({
      verified: true,
      email: authUser.email,
      tokenHash: hashed_token,
    });
  } catch (error: any) {
    console.error("Passkey auth verification error:", error);
    return Response.json({ error: error.message || "Verification error" }, { status: 500 });
  }
}
