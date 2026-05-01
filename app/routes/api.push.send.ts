import type { Route } from "./+types/api.push.send";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { requirePlatformAdmin, requirePlatformPermission } from "~/lib/platform-rbac/guard.server";

/**
 * POST /api/push/send — Send a push notification to a user
 * Body: { userId, title, body, url?, orgId }
 * 
 * SECURITY: Requires admin.notifications.broadcast permission
 */
export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;

  // SECURITY: Full RBAC check instead of raw table lookup
  let adminCtx;
  let headers: HeadersInit;
  try {
    const result = await requirePlatformAdmin(request, env, context);
    adminCtx = result.adminCtx;
    headers = result.supabaseHeaders;
    requirePlatformPermission(adminCtx, "admin.notifications.broadcast", headers);
  } catch {
    return Response.json({ error: "Sin permisos" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient(env);

  const body = await request.json();
  const { userId, title, body: notifBody, url = "/dashboard", orgId } = body;

  if (!userId || !title) {
    return Response.json({ error: "userId y title requeridos" }, { status: 400, headers });
  }

  // Get all subscriptions for user
  let query = admin.from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);
  
  if (orgId) {
    query = query.eq("organization_id", orgId);
  }

  const { data: subscriptions } = await query;

  if (!subscriptions || subscriptions.length === 0) {
    return Response.json({ sent: 0, message: "Sin subscriptions activas" }, { headers });
  }

  const payload = JSON.stringify({
    title,
    body: notifBody,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    url,
    tag: `grixi-${Date.now()}`,
  });

  let sent = 0;
  const failed: string[] = [];

  for (const sub of subscriptions) {
    try {
      // Import the VAPID keys from env
      const vapidPublicKey = (env as any).VAPID_PUBLIC_KEY;
      const vapidPrivateKey = (env as any).VAPID_PRIVATE_KEY;
      const vapidSubject = (env as any).VAPID_SUBJECT || "mailto:notifications@grixi.ai";

      if (!vapidPublicKey || !vapidPrivateKey) {
        console.error("[Push Send] VAPID keys not configured");
        return Response.json({ error: "VAPID keys no configuradas" }, { status: 500, headers });
      }

      // Build the JWT for VAPID
      const audience = new URL(sub.endpoint).origin;
      const vapidToken = await createVapidToken(vapidSubject, audience, vapidPrivateKey);

      // Send the push
      const response = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Encoding": "aes128gcm",
          "Authorization": `vapid t=${vapidToken}, k=${vapidPublicKey}`,
          "TTL": "86400",
          "Urgency": "normal",
        },
        body: payload,
      });

      if (response.status === 201 || response.status === 200) {
        sent++;
        // Update last_used_at
        await admin.from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id);
      } else if (response.status === 410 || response.status === 404) {
        // Subscription expired — clean up
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
        failed.push(sub.id);
      } else {
        console.error(`[Push Send] Error ${response.status} for sub ${sub.id}`);
        failed.push(sub.id);
      }
    } catch (err) {
      console.error("[Push Send] Error:", err);
      failed.push(sub.id);
    }
  }

  return Response.json({ sent, failed: failed.length, total: subscriptions.length }, { headers });
}

/**
 * Create a simple VAPID JWT token for Web Push
 * This is a simplified version that works in Cloudflare Workers
 */
async function createVapidToken(
  subject: string,
  audience: string,
  privateKeyBase64: string
): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the private key
  const keyData = base64UrlToArrayBuffer(privateKeyBase64);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
  false,
    ["sign"]
  );

  // Sign
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = arrayBufferToBase64Url(signature);

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
