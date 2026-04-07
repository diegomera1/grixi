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

    // Use the same join pattern as ai-picking to get rack code from racks table
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
        warehouses(name),
        rack_positions(row_number, column_number, rack_id, racks(code, warehouse_id, warehouses(name))),
        lot_tracking(lot_number, expiry_date, status)
      `)
      .eq("org_id", DEMO_ORG_ID)
      .eq("product_id", productId)
      .in("status", ["available", "reserved"])
      .gt("available_quantity", 0)
      .order("created_at", { ascending: true });

    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform to flat structure for frontend
    const sus = (data || []).map((su) => {
      const wh = su.warehouses as unknown as { name: string } | null;
      const rp = su.rack_positions as unknown as {
        row_number: number;
        column_number: number;
        racks: { code: string; warehouses: { name: string } } | null;
      } | null;
      const lot = su.lot_tracking as unknown as {
        lot_number: string;
        expiry_date: string | null;
        status: string;
      } | null;

      const rackCode = rp?.racks?.code || "";
      const rowNum = rp?.row_number || 0;
      const colNum = rp?.column_number || 0;
      const posLabel = rackCode && rowNum && colNum ? `${rackCode}-${rowNum}-${colNum}` : "Sin ubicación";

      return {
        su_id: su.id,
        su_code: su.su_code,
        su_type: su.su_type,
        quantity: Number(su.quantity),
        available_quantity: Number(su.available_quantity),
        reserved_quantity: Number(su.reserved_quantity),
        status: su.status,
        warehouse_id: su.warehouse_id,
        warehouse_name: wh?.name || rp?.racks?.warehouses?.name || "—",
        rack_code: rackCode,
        row_number: rowNum,
        column_number: colNum,
        position_label: posLabel,
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
