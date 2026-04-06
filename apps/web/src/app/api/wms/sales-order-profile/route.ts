import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEMO_ORG_ID = "a0000000-0000-0000-0000-000000000001";

/**
 * GET /api/wms/sales-order-profile?id=xxx
 * Loads full SO detail: header, items, linked Goods Issues, and SU positions for 3D
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const soId = searchParams.get("id");

    if (!soId) {
      return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Load SO header
    const { data: so, error: soError } = await supabase
      .from("sales_orders")
      .select("*, warehouses(name)")
      .eq("id", soId)
      .eq("org_id", DEMO_ORG_ID)
      .single();

    if (soError || !so) {
      return NextResponse.json({ success: false, message: "Pedido no encontrado" }, { status: 404 });
    }

    // 2. Load SO items with product info
    const { data: items } = await supabase
      .from("sales_order_items")
      .select("*, products(name, sku)")
      .eq("sale_order_id", soId)
      .order("item_number", { ascending: true });

    // 3. Load linked Goods Issues
    const { data: gis } = await supabase
      .from("goods_issues")
      .select("id, issue_number, status, posted_at, created_at, issue_type, movement_type, warehouse_id, warehouses(name)")
      .eq("reference_id", soId)
      .eq("org_id", DEMO_ORG_ID)
      .order("created_at", { ascending: false });

    // 4. Get SU positions across ALL warehouses using raw SQL for correct joins
    const productIds = (items || []).map((it) => it.product_id);
    type SUPosRow = {
      warehouse_id: string;
      warehouse_name: string;
      rack_code: string;
      row_number: number;
      column_number: number;
      su_code: string;
      quantity: number;
      product_id: string;
    };
    let suPositions: Record<string, SUPosRow[]> = {};

    if (productIds.length > 0) {
      // Use raw SQL to get proper 3-table join: storage_units → rack_positions → racks
      const { data: suRows } = await supabase.rpc("wms_get_su_positions_for_products", {
        p_product_ids: productIds,
        p_org_id: DEMO_ORG_ID,
      });

      // If RPC doesn't exist, fallback to manual query
      if (suRows && Array.isArray(suRows)) {
        for (const su of suRows as SUPosRow[]) {
          if (!suPositions[su.product_id]) suPositions[su.product_id] = [];
          suPositions[su.product_id].push(su);
        }
      } else {
        // Fallback: query directly with separate selects
        for (const pid of productIds) {
          const { data: sus } = await supabase
            .from("storage_units")
            .select("id, su_code, quantity, product_id, warehouse_id, position_id")
            .eq("product_id", pid)
            .in("status", ["available", "reserved"])
            .gt("quantity", 0)
            .eq("org_id", DEMO_ORG_ID);

          if (sus && sus.length > 0) {
            for (const su of sus) {
              if (!su.position_id) continue;
              // Get position + rack
              const { data: pos } = await supabase
                .from("rack_positions")
                .select("row_number, column_number, racks(code, warehouse_id, warehouses(name))")
                .eq("id", su.position_id)
                .single();

              if (pos) {
                const rack = pos.racks as unknown as { code: string; warehouse_id: string; warehouses: { name: string } | null } | null;
                if (!suPositions[pid]) suPositions[pid] = [];
                suPositions[pid].push({
                  warehouse_id: su.warehouse_id as string,
                  warehouse_name: rack?.warehouses?.name || "—",
                  rack_code: rack?.code || "—",
                  row_number: pos.row_number,
                  column_number: pos.column_number,
                  su_code: su.su_code as string,
                  quantity: Number(su.quantity),
                  product_id: pid,
                });
              }
            }
          }
        }
      }
    }

    // 5. Group positions by warehouse for multi-warehouse 3D display
    const warehousePositions: Record<string, { warehouse_id: string; warehouse_name: string; positions: { rack_code: string; row_number: number; column_number: number; su_code: string; product_name: string }[] }> = {};
    
    for (const [pid, positions] of Object.entries(suPositions)) {
      const item = (items || []).find(it => it.product_id === pid);
      const prod = item?.products as unknown as { name: string } | null;
      const productName = prod?.name || item?.description || "—";
      
      for (const pos of positions) {
        if (!warehousePositions[pos.warehouse_id]) {
          warehousePositions[pos.warehouse_id] = {
            warehouse_id: pos.warehouse_id,
            warehouse_name: pos.warehouse_name,
            positions: [],
          };
        }
        warehousePositions[pos.warehouse_id].positions.push({
          rack_code: pos.rack_code,
          row_number: pos.row_number,
          column_number: pos.column_number,
          su_code: pos.su_code,
          product_name: productName,
        });
      }
    }

    // 6. Compute progress metrics
    const totalItems = (items || []).length;
    const totalQty = (items || []).reduce((s, it) => s + Number(it.quantity), 0);
    const totalPicked = (items || []).reduce((s, it) => s + Number(it.quantity_picked), 0);
    const totalShipped = (items || []).reduce((s, it) => s + Number(it.quantity_shipped), 0);
    const pickingProgress = totalQty > 0 ? Math.round((totalPicked / totalQty) * 100) : 0;
    const shippingProgress = totalQty > 0 ? Math.round((totalShipped / totalQty) * 100) : 0;

    const wh = so.warehouses as unknown as { name: string } | null;

    return NextResponse.json({
      success: true,
      data: {
        ...so,
        warehouse_name: wh?.name || null,
        items: (items || []).map((it) => {
          const prod = it.products as unknown as { name: string; sku: string } | null;
          return {
            ...it,
            product_name: prod?.name || it.description,
            product_sku: prod?.sku || "",
          };
        }),
        goods_issues: (gis || []).map((gi) => {
          const giWh = gi.warehouses as unknown as { name: string } | null;
          return { ...gi, warehouse_name: giWh?.name || null };
        }),
        su_positions: suPositions,
        warehouse_positions: Object.values(warehousePositions),
        metrics: {
          total_items: totalItems,
          total_qty: totalQty,
          total_picked: totalPicked,
          total_shipped: totalShipped,
          picking_progress: pickingProgress,
          shipping_progress: shippingProgress,
        },
      },
    });
  } catch (err) {
    console.error("[WMS] sales-order-profile error:", err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
