/**
 * /ai — GRIXI AI Assistant page
 * Uses lazy import + Suspense to prevent framer-motion from being bundled into SSR
 */
import { Suspense, lazy, useState, useEffect, type ComponentType } from "react";
import { useOutletContext } from "react-router";
import type { TenantContext } from "./authenticated";
import type { Route } from "./+types/ai";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";

export function meta() {
  return [
    { title: "GRIXI AI — Asistente Inteligente" },
    { name: "description", content: "Asistente de inteligencia artificial enterprise de GRIXI" },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase, headers } = createSupabaseServerClient(request, env);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ conversations: [] }, { headers });

  // Fetch user's conversations ordered by last activity
  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(50);

  return Response.json({ conversations: conversations || [] }, { headers });
}

/** Client-only wrapper — prevents framer-motion SSR crash on Cloudflare Workers */
function ClientOnlyChat(props: {
  conversations: any[];
  userName?: string;
  userAvatar?: string;
}) {
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);

  useEffect(() => {
    import("~/features/ai/components/ai-chat-content").then((m) =>
      setComponent(() => m.default)
    );
  }, []);

  if (!Component) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-xs text-text-muted animate-pulse">Cargando GRIXI AI...</p>
        </div>
      </div>
    );
  }

  return <Component {...props} />;
}

export default function AiPage() {
  const tenantCtx = useOutletContext<TenantContext>();
  const [conversations, setConversations] = useState<any[]>([]);

  // Hydrate conversations from loader
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ai/conversations");
        if (res.ok) {
          const data = await res.json() as { conversations: any[] };
          setConversations(data.conversations || []);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex bg-primary">
      <ClientOnlyChat
        conversations={conversations}
        userName={tenantCtx?.user?.name}
        userAvatar={tenantCtx?.user?.avatar}
      />
    </div>
  );
}
