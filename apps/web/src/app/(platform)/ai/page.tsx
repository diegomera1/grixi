import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AiChatContent } from "@/features/ai/components/ai-chat-content";
import type { Conversation } from "@/features/ai/types";

export const metadata = {
  title: "GRIXI AI",
};

export default async function AiChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch initial conversations
  let conversations: Conversation[] = [];
  if (user) {
    const { data } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("is_pinned", { ascending: false })
      .order("last_message_at", { ascending: false });

    conversations = (data as Conversation[]) || [];
  }

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Usuario";
  const userAvatar =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null;

  return (
    <Suspense fallback={null}>
      <AiChatContent
        initialConversations={conversations}
        userAvatar={userAvatar}
        userName={userName}
      />
    </Suspense>
  );
}

