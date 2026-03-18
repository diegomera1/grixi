"use server";

import { createClient } from "@/lib/supabase/server";

type ChecklistResultItem = {
  item_id: string;
  item_title: string;
  checked: boolean;
  value?: string;
  notes?: string;
};

type SaveChecklistInput = {
  checklist_id: string;
  vessel_id: string;
  items: ChecklistResultItem[];
  completed_at: string;
};

export async function saveChecklistExecution(input: SaveChecklistInput) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const totalItems = input.items.length;
  const completedItems = input.items.filter((i) => i.checked).length;
  const score = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const { data, error } = await supabase
    .from("fleet_checklist_executions")
    .insert({
      checklist_id: input.checklist_id,
      vessel_id: input.vessel_id,
      executed_by: user.id,
      completed_at: input.completed_at,
      score_pct: score,
      total_items: totalItems,
      completed_items: completedItems,
      results: input.items,
      status: score === 100 ? "passed" : score >= 70 ? "partial" : "failed",
    })
    .select()
    .single();

  if (error) {
    console.error("[saveChecklistExecution]", error);
    return { error: error.message };
  }

  return { data, score };
}
