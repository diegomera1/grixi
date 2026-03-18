"use server";

import { createClient } from "@/lib/supabase/server";

type CreateWOInput = {
  vessel_id: string;
  title: string;
  description?: string;
  priority: "critical" | "high" | "medium" | "low";
  equipment_id?: string;
  assigned_to?: string;
  planned_start?: string;
  planned_end?: string;
  hours_estimated?: number;
  cost_estimated?: number;
};

export async function createWorkOrder(input: CreateWOInput) {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Generate WO number
  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-4);
  const woNumber = `WO-${year}-${seq}`;

  const { data, error } = await supabase
    .from("fleet_work_orders")
    .insert({
      vessel_id: input.vessel_id,
      wo_number: woNumber,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      priority: input.priority,
      status: "planned",
      equipment_id: input.equipment_id || null,
      assigned_to: input.assigned_to || null,
      planned_start: input.planned_start || null,
      planned_end: input.planned_end || null,
      hours_estimated: input.hours_estimated || 0,
      cost_estimated: input.cost_estimated || 0,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("[createWorkOrder]", error);
    return { error: error.message };
  }

  return { data, woNumber };
}
