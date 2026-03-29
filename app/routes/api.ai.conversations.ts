/**
 * API Route: /api/ai/conversations
 * CRUD operations for AI conversations.
 * Replaces Next.js Server Actions with React Router v7 resource routes.
 */
import { createSupabaseServerClient } from "~/lib/supabase/client.server";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

export async function loader({ request, context }: { request: Request; context: { cloudflare: { env: Env } } }) {
  const env = context.cloudflare.env;
  const { supabase } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("id");
  const loadMessages = url.searchParams.get("messages") === "true";

  // If specific conversation with messages requested
  if (conversationId && loadMessages) {
    // Verify ownership
    const { data: conv } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!conv) {
      return Response.json({ error: "Conversación no encontrada" }, { status: 404 });
    }

    const { data: messages, error } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Parse attachments from jsonb
    const parsed = (messages || []).map((msg: Record<string, unknown>) => ({
      ...msg,
      attachments:
        typeof msg.attachments === "string"
          ? JSON.parse(msg.attachments as string)
          : msg.attachments || [],
    }));

    return Response.json({ messages: parsed });
  }

  // List all conversations
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("is_pinned", { ascending: false })
    .order("last_message_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ conversations: data || [] });
}

export async function action({ request, context }: { request: Request; context: { cloudflare: { env: Env } } }) {
  const env = context.cloudflare.env;
  const { supabase } = createSupabaseServerClient(request, env);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const method = request.method;

  // ── POST: Create conversation ──
  if (method === "POST") {
    const body = await request.json() as { module?: string };
    const module = body.module || "general";

    // Get user's org
    const { data: membership } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({
        user_id: user.id,
        org_id: membership?.org_id,
        module,
        title: null,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ conversation: data });
  }

  // ── PATCH: Rename or toggle pin ──
  if (method === "PATCH") {
    const body = await request.json() as { id: string; title?: string; togglePin?: boolean };

    if (body.togglePin) {
      const { data: conv } = await supabase
        .from("ai_conversations")
        .select("is_pinned")
        .eq("id", body.id)
        .eq("user_id", user.id)
        .single();

      if (!conv) {
        return Response.json({ error: "No encontrada" }, { status: 404 });
      }

      const { error } = await supabase
        .from("ai_conversations")
        .update({ is_pinned: !conv.is_pinned })
        .eq("id", body.id)
        .eq("user_id", user.id);

      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    if (body.title !== undefined) {
      const { error } = await supabase
        .from("ai_conversations")
        .update({ title: body.title })
        .eq("id", body.id)
        .eq("user_id", user.id);

      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    return Response.json({ error: "No action specified" }, { status: 400 });
  }

  // ── DELETE: Delete conversation + messages ──
  if (method === "DELETE") {
    const body = await request.json() as { id: string };

    // Delete messages first (cascade)
    await supabase.from("ai_messages").delete().eq("conversation_id", body.id);

    const { error } = await supabase
      .from("ai_conversations")
      .delete()
      .eq("id", body.id)
      .eq("user_id", user.id);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
