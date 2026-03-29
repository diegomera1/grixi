/**
 * API Route: /api/ai/upload
 * Secure file upload/download via Cloudflare R2 using SecureR2Client.
 */
import { createSupabaseServerClient } from "~/lib/supabase/client.server";
import { SecureR2Client } from "~/lib/storage/r2-client.server";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ASSETS_BUCKET: R2Bucket;
};

/** GET: Serve a file from R2 (proxied, never public) */
export async function loader({ request, context }: { request: Request; context: { cloudflare: { env: Env } } }) {
  const env = context.cloudflare.env;
  const { supabase } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!key) {
    return Response.json({ error: "Missing key parameter" }, { status: 400 });
  }

  try {
    const r2 = new SecureR2Client(env.ASSETS_BUCKET);
    const { body, contentType, size } = await r2.get(key, user.id);

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const status = message.includes("No autorizado") ? 403 : 404;
    return Response.json({ error: message }, { status });
  }
}

/** POST: Upload file / DELETE: Remove file */
export async function action({ request, context }: { request: Request; context: { cloudflare: { env: Env } } }) {
  const env = context.cloudflare.env;
  const { supabase } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  // Get user's org
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const orgId = membership?.org_id || "no-org";

  // ── POST: Upload ──
  if (request.method === "POST") {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const conversationId = formData.get("conversationId") as string | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    try {
      const r2 = new SecureR2Client(env.ASSETS_BUCKET);

      // Validate first
      const validationError = r2.validateFile(file);
      if (validationError) {
        return Response.json({ error: validationError }, { status: 400 });
      }

      const result = await r2.upload({
        userId: user.id,
        orgId,
        prefix: "ai-attachments",
        file,
        contextId: conversationId || undefined,
      });

      return Response.json({
        attachment: {
          id: crypto.randomUUID(),
          name: file.name,
          url: `/api/ai/upload?key=${encodeURIComponent(result.key)}`,
          type: file.type,
          size: result.size,
          key: result.key,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      return Response.json({ error: message }, { status: 500 });
    }
  }

  // ── DELETE: Remove file ──
  if (request.method === "DELETE") {
    const body = await request.json() as { key: string };

    if (!body.key) {
      return Response.json({ error: "Missing key" }, { status: 400 });
    }

    try {
      const r2 = new SecureR2Client(env.ASSETS_BUCKET);
      await r2.delete(body.key, user.id);
      return Response.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      const status = message.includes("No autorizado") ? 403 : 500;
      return Response.json({ error: message }, { status });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
