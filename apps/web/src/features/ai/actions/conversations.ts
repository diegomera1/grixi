"use server";

import { createClient } from "@/lib/supabase/server";
import type { Conversation, ChatMessage } from "../types";

/** Fetch user's conversations ordered by last activity */
export async function listConversations(): Promise<{
  conversations: Conversation[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { conversations: [], error: "No autenticado" };

  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("is_pinned", { ascending: false })
    .order("last_message_at", { ascending: false });

  if (error) return { conversations: [], error: error.message };
  return { conversations: (data as Conversation[]) || [] };
}

/** Create a new conversation */
export async function createConversation(
  module: string = "general"
): Promise<{ conversation: Conversation | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { conversation: null, error: "No autenticado" };

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

  if (error) return { conversation: null, error: error.message };
  return { conversation: data as Conversation };
}

/** Delete a conversation and its messages */
export async function deleteConversation(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Delete messages first
  await supabase.from("ai_messages").delete().eq("conversation_id", id);

  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

/** Rename a conversation */
export async function renameConversation(
  id: string,
  title: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("ai_conversations")
    .update({ title })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

/** Toggle pin status */
export async function togglePinConversation(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Get current pin status
  const { data: conv } = await supabase
    .from("ai_conversations")
    .select("is_pinned")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!conv) return { error: "Conversación no encontrada" };

  const { error } = await supabase
    .from("ai_conversations")
    .update({ is_pinned: !conv.is_pinned })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

/** Get messages for a conversation */
export async function getConversationMessages(
  conversationId: string
): Promise<{ messages: ChatMessage[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { messages: [], error: "No autenticado" };

  // Verify user owns this conversation
  const { data: conv } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (!conv) return { messages: [], error: "Conversación no encontrada" };

  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return { messages: [], error: error.message };

  // Parse attachments from jsonb
  const messages = (data || []).map((msg) => ({
    ...msg,
    attachments:
      typeof msg.attachments === "string"
        ? JSON.parse(msg.attachments)
        : msg.attachments || [],
  })) as ChatMessage[];

  return { messages };
}
