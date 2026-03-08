"use server";

import { createClient } from "@/lib/supabase/server";
import type { Attachment } from "../types";

/** Upload a file to the AI attachments bucket */
export async function uploadAttachment(
  formData: FormData,
  conversationId: string
): Promise<{ attachment: Attachment | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { attachment: null, error: "No autenticado" };

  const file = formData.get("file") as File;
  if (!file) return { attachment: null, error: "No se proporcionó archivo" };

  // Validate file size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    return { attachment: null, error: "El archivo es demasiado grande (máx 10MB)" };
  }

  const fileId = crypto.randomUUID();
  const ext = file.name.split(".").pop() || "bin";
  const storagePath = `${user.id}/${conversationId}/${fileId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("ai-attachments")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return { attachment: null, error: `Error al subir: ${uploadError.message}` };
  }

  // Get public URL (signed for private bucket)
  const { data: urlData } = await supabase.storage
    .from("ai-attachments")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 day signed URL

  const attachment: Attachment = {
    id: fileId,
    name: file.name,
    url: urlData?.signedUrl || "",
    type: file.type,
    size: file.size,
  };

  return { attachment };
}

/** Delete a file from the AI attachments bucket */
export async function deleteAttachment(
  storagePath: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Ensure user can only delete their own files
  if (!storagePath.startsWith(user.id)) {
    return { error: "No autorizado" };
  }

  const { error } = await supabase.storage
    .from("ai-attachments")
    .remove([storagePath]);

  if (error) return { error: error.message };
  return {};
}
