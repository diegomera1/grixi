"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function moveInventory(
  inventoryId: string,
  fromPositionId: string,
  toPositionId: string,
  warehouseId: string
) {
  const supabase = await createClient();

  // Get the user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Get org
  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!member) return { error: "Sin organización" };

  // Check target position is empty
  const { data: targetPos } = await supabase
    .from("rack_positions")
    .select("status")
    .eq("id", toPositionId)
    .single();
  if (!targetPos || targetPos.status !== "empty") {
    return { error: "La posición destino no está vacía" };
  }

  // Get inventory to find product_id
  const { data: inv } = await supabase
    .from("inventory")
    .select("product_id, quantity")
    .eq("id", inventoryId)
    .single();
  if (!inv) return { error: "Inventario no encontrado" };

  // Move: update inventory position
  const { error: moveErr } = await supabase
    .from("inventory")
    .update({ position_id: toPositionId })
    .eq("id", inventoryId);
  if (moveErr) return { error: moveErr.message };

  // Update old position status to empty
  await supabase
    .from("rack_positions")
    .update({ status: "empty" })
    .eq("id", fromPositionId);

  // Update new position status to occupied
  await supabase
    .from("rack_positions")
    .update({ status: "occupied" })
    .eq("id", toPositionId);

  // Create movement record
  await supabase.from("inventory_movements").insert({
    org_id: member.org_id,
    product_id: inv.product_id,
    from_position_id: fromPositionId,
    to_position_id: toPositionId,
    quantity: inv.quantity,
    movement_type: "transfer",
    reference: `Transferencia 3D por ${user.email}`,
    performed_by: user.id,
  });

  revalidatePath(`/almacenes/${warehouseId}`);
  return { success: true };
}
