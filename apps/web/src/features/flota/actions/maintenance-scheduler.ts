"use server";

import { createClient } from "@/lib/supabase/server";
import type { MaintenancePlan } from "../types";

// Check for overdue maintenance plans and auto-generate work orders
export async function checkDuePlans(vesselId: string) {
  const supabase = await createClient();

  // Get overdue plans that have auto_generate_wo enabled
  const { data: overduePlans, error } = await supabase
    .from("fleet_maintenance_plans")
    .select("*, equipment:fleet_equipment(id, code, name, vessel_id)")
    .eq("auto_generate_wo", true)
    .lte("next_due", new Date().toISOString())
    .order("next_due", { ascending: true });

  if (error) return { success: false, error: error.message, generated: 0 };
  if (!overduePlans?.length) return { success: true, generated: 0, message: "No hay planes vencidos" };

  let generated = 0;

  for (const plan of overduePlans) {
    const result = await generateWoFromPlan(plan.id);
    if (result.success) generated++;
  }

  return { success: true, generated, message: `${generated} OT(s) generada(s) automáticamente` };
}

// Generate a work order from a maintenance plan
export async function generateWoFromPlan(planId: string) {
  const supabase = await createClient();

  // Fetch plan with equipment data
  const { data: plan, error: planError } = await supabase
    .from("fleet_maintenance_plans")
    .select("*, equipment:fleet_equipment(id, code, name, vessel_id)")
    .eq("id", planId)
    .single();

  if (planError || !plan) return { success: false, error: "Plan no encontrado" };

  const equipment = plan.equipment as { id: string; code: string; name: string; vessel_id: string } | null;
  if (!equipment) return { success: false, error: "Equipo no encontrado" };

  // Generate WO number
  const woNumber = `WO-PM-${Date.now().toString(36).toUpperCase()}`;

  const title = plan.wo_title_template
    ? plan.wo_title_template.replace("{equipo}", equipment.name).replace("{plan}", plan.name)
    : `${plan.name} — ${equipment.name} (${equipment.code})`;

  // Create the work order
  const { data: wo, error: woError } = await supabase
    .from("fleet_work_orders")
    .insert({
      vessel_id: equipment.vessel_id,
      equipment_id: equipment.id,
      wo_number: woNumber,
      title,
      description: `Orden generada automáticamente por plan de mantenimiento "${plan.name}". ` +
        `Estrategia: ${plan.strategy_type}. ` +
        (plan.regulation_code ? `Normativa: ${plan.regulation_code}. ` : "") +
        (plan.interval_days ? `Intervalo: cada ${plan.interval_days} días. ` : "") +
        (plan.interval_hours ? `Intervalo: cada ${plan.interval_hours} horas. ` : ""),
      priority: plan.wo_priority || "medium",
      status: "planned",
      planned_start: new Date().toISOString(),
      hours_estimated: plan.interval_hours ? Math.min(plan.interval_hours * 0.1, 8) : 4,
    })
    .select("id")
    .single();

  if (woError) return { success: false, error: woError.message };

  // Update the plan: set last_executed and calculate next_due
  const now = new Date();
  let nextDue: Date | null = null;

  if (plan.interval_days) {
    nextDue = new Date(now.getTime() + plan.interval_days * 86400000);
  } else if (plan.interval_hours) {
    // For hour-based, estimate based on 24h/day operation
    nextDue = new Date(now.getTime() + (plan.interval_hours / 24) * 86400000);
  }

  await supabase
    .from("fleet_maintenance_plans")
    .update({
      last_executed: now.toISOString(),
      next_due: nextDue?.toISOString() ?? null,
    })
    .eq("id", planId);

  return { success: true, woId: wo?.id, woNumber };
}

// Fetch all maintenance plans for a vessel
export async function getMaintenancePlans(vesselId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fleet_maintenance_plans")
    .select("*, equipment:fleet_equipment(id, code, name)")
    .order("next_due", { ascending: true, nullsFirst: false });

  if (error) return { plans: [], error: error.message };
  return { plans: data as (MaintenancePlan & { equipment: { id: string; code: string; name: string } | null })[] };
}
