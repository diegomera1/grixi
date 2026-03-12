"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const file = formData.get("avatar") as File;
  if (!file || file.size === 0) throw new Error("No se proporcionó archivo");

  // Validate file
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Formato no permitido. Usa JPG, PNG o WebP.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("El archivo excede 5MB");
  }

  // Upload to avatars bucket with user ID as filename
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${user.id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(fileName, file, {
      upsert: true, // Overwrite existing
      contentType: file.type,
    });

  if (uploadError) throw new Error(`Error al subir: ${uploadError.message}`);

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(fileName);

  // Update profile with new avatar URL (add cache buster)
  const avatarUrl = `${publicUrl}?v=${Date.now()}`;
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (updateError) throw new Error(`Error al actualizar perfil: ${updateError.message}`);

  revalidatePath("/usuarios/me");
  revalidatePath("/dashboard");
  return { avatarUrl };
}
