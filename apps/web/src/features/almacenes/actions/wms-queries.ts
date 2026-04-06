/**
 * Server-only data queries for the WMS module.
 * These are NOT "use server" actions — they are plain async functions
 * called only from Server Components. This avoids polluting the
 * RSC payload with Server Action hashes.
 */

import { createClient } from "@/lib/supabase/server";

const DEMO_ORG_ID = "a0000000-0000-0000-0000-000000000001";

export type PhysicalCountRow = {
  id: string;
  count_number: string;
  warehouse_id: string;
  warehouse_name: string;
  count_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  total_positions: number;
  counted_positions: number;
  variance_count: number;
  notes: string | null;
  created_at: string;
};

export async function fetchPhysicalCounts(): Promise<PhysicalCountRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("physical_counts")
      .select("*, warehouses(name)")
      .eq("org_id", DEMO_ORG_ID)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[WMS] Error fetching physical counts:", error);
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => {
      const wh = row.warehouses as { name: string } | null;
      return {
        id: row.id as string,
        count_number: row.count_number as string,
        warehouse_id: row.warehouse_id as string,
        warehouse_name: wh?.name || "Desconocido",
        count_type: row.count_type as string,
        status: row.status as string,
        start_date: row.start_date as string | null,
        end_date: row.end_date as string | null,
        total_positions: (row.total_positions as number) || 0,
        counted_positions: (row.counted_positions as number) || 0,
        variance_count: (row.variance_count as number) || 0,
        notes: row.notes as string | null,
        created_at: row.created_at as string,
      };
    });
  } catch (err) {
    console.error("[WMS] Error fetching counts:", err);
    return [];
  }
}
