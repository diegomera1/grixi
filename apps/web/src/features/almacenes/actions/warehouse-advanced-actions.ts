"use server";

import { createClient } from "@/lib/supabase/server";

export async function getWarehouseAdvancedData(warehouseId: string) {
  const supabase = await createClient();

  const [sensorsRes, operatorsRes, ordersRes] = await Promise.all([
    supabase
      .from("iot_sensors")
      .select("*")
      .eq("warehouse_id", warehouseId),
    supabase
      .from("warehouse_operators")
      .select("*")
      .eq("current_warehouse_id", warehouseId)
      .eq("is_active", true),
    supabase
      .from("picking_orders")
      .select("*")
      .eq("warehouse_id", warehouseId)
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false }),
  ]);

  return {
    sensors: sensorsRes.data || [],
    operators: operatorsRes.data || [],
    pickingOrders: ordersRes.data || [],
  };
}

export async function getAllWarehouses() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("warehouses")
    .select("id, name, type")
    .order("name");
  return data || [];
}

export async function getSlottingRecommendations(warehouseId: string) {
  // This could call AI for AI-powered recommendations
  return {
    suggestions: [],
    summary: "Optimización completada",
  };
}
