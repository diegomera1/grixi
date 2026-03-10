"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getAllowedEmails() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("allowed_emails")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function addAllowedEmail(email: string, notes?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const normalized = email.toLowerCase().trim();
  if (!normalized.includes("@")) throw new Error("Email inválido");

  const { error } = await supabase
    .from("allowed_emails")
    .insert({
      email: normalized,
      added_by: user.id,
      notes: notes || null,
    });

  if (error) {
    if (error.code === "23505") throw new Error("Este email ya está en la lista");
    throw new Error(error.message);
  }

  revalidatePath("/administracion");
  return { success: true };
}

export async function removeAllowedEmail(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  // Prevent removing the last email (safety)
  const { count } = await supabase
    .from("allowed_emails")
    .select("*", { count: "exact", head: true });

  if ((count || 0) <= 1) {
    throw new Error("No puedes eliminar el último email autorizado");
  }

  const { error } = await supabase
    .from("allowed_emails")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/administracion");
  return { success: true };
}
