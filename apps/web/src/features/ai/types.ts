// AI Chat module types

export type AiModule =
  | "general"
  | "almacenes"
  | "finanzas"
  | "compras"
  | "usuarios"
  | "dashboard"
  | "administracion"
  | "flota";

export type Attachment = {
  id: string;
  name: string;
  url: string;
  type: string; // MIME type
  size: number; // bytes
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  attachments: Attachment[];
  model_used: string;
  tokens_used: number;
  created_at: string;
};

export type Conversation = {
  id: string;
  org_id: string;
  user_id: string;
  module: AiModule;
  title: string | null;
  is_pinned: boolean;
  last_message_at: string;
  message_count: number;
  created_at: string;
};

export type ConversationGroup = {
  label: string;
  conversations: Conversation[];
};
