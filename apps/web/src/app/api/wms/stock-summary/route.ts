import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── Stock Summary: aggregated stock per product + warehouse ──
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("storage_units")
      .select(`
        product_id, warehouse_id, available_quantity,
        warehouses!inner(name)
      `)
      .in("status", ["available", "reserved"])
      .gt("available_quantity", 0);

    if (error) {
      console.error("[Stock Summary] Error:", error);
      return NextResponse.json({ success: false, data: [] }, { status: 500 });
    }

    // Aggregate by product_id + warehouse_id
    const agg: Record<string, { product_id: string; warehouse_id: string; warehouse_name: string; total_stock: number }> = {};

    for (const su of data || []) {
      const wh = su.warehouses as unknown as { name: string };
      const key = `${su.product_id}::${su.warehouse_id}`;
      if (!agg[key]) {
        agg[key] = {
          product_id: su.product_id,
          warehouse_id: su.warehouse_id,
          warehouse_name: wh?.name || "N/A",
          total_stock: 0,
        };
      }
      agg[key].total_stock += Number(su.available_quantity) || 0;
    }

    return NextResponse.json({ success: true, data: Object.values(agg) });
  } catch (err) {
    console.error("[Stock Summary] Error:", err);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
