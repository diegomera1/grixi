import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEMO_ORG_ID = "a0000000-0000-0000-0000-000000000001";

/**
 * GET /api/wms/available-sus?product_id=xxx[&warehouse_id=yyy]
 * Returns all available storage units for a product,
 * optionally filtered by warehouse. Used for manual picking selection.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("product_id");
    const warehouseId = searchParams.get("warehouse_id");

    if (!productId) {
      return NextResponse.json(
        { success: false, message: "product_id is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    let query = supabase
      .from("storage_units")
      .select(`
        id,
        su_code,
        su_type,
        quantity,
        available_quantity,
        reserved_quantity,
        status,
        warehouse_id,
        position_id,
        lot_id,
        created_at,
        warehouses!inner(name),
        rack_positions!inner(rack_code, row_number, column_number, position_label),
        lot_tracking(lot_number, expiry_date, status)
      `)
      .eq("org_id", DEMO_ORG_ID)
      .eq("product_id", productId)
      .in("status", ["available", "reserved"])
      .gt("quantity", 0)
      .order("created_at", { ascending: true });

    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform to flat structure for frontend
    const sus = (data || []).map((su) => {
      const wh = su.warehouses as unknown as { name: string } | null;
      const pos = su.rack_positions as unknown as {
        rack_code: string;
        row_number: number;
        column_number: number;
        position_label: string;
      } | null;
      const lot = su.lot_tracking as unknown as {
        lot_number: string;
        expiry_date: string | null;
        status: string;
      } | null;

      return {
        su_id: su.id,
        su_code: su.su_code,
        su_type: su.su_type,
        quantity: Number(su.quantity),
        available_quantity: Number(su.available_quantity),
        reserved_quantity: Number(su.reserved_quantity),
        status: su.status,
        warehouse_id: su.warehouse_id,
        warehouse_name: wh?.name || "—",
        rack_code: pos?.rack_code || "",
        row_number: pos?.row_number || 0,
        column_number: pos?.column_number || 0,
        position_label: pos?.position_label || "",
        lot_number: lot?.lot_number || "",
        expiry_date: lot?.expiry_date || null,
        lot_status: lot?.status || "",
        created_at: su.created_at,
      };
    });

    return NextResponse.json({ success: true, data: sus });
  } catch (err) {
    console.error("[WMS] available-sus error:", err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
