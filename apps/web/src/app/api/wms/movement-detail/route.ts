import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ══════════════════════════════════════════════════════════
// GET Movement Detail — Full profile for a single movement
// ══════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch the movement with product, positions, SU info
    const { data: mov, error } = await supabase
      .from("inventory_movements")
      .select(`
        id, movement_type, movement_description, quantity, created_at,
        sap_movement_type, sap_document_id,
        reference_type, reference_id, reference, lot_number,
        storage_unit_id, performed_by,
        products(id, name, sku)
      `)
      .eq("id", id)
      .single();

    if (error || !mov) {
      throw error || new Error("Movimiento no encontrado");
    }

    const product = mov.products as unknown as { id: string; name: string; sku: string } | null;

    // Resolve from_position
    let fromRackCode: string | null = null;
    let fromRow: number | null = null;
    let fromCol: number | null = null;
    let fromLabel: string | null = null;
    let warehouseId: string | null = null;
    let warehouseName = "N/A";

    // Get from_position_id
    const { data: movFull } = await supabase
      .from("inventory_movements")
      .select("from_position_id, to_position_id")
      .eq("id", id)
      .single();

    if (movFull?.from_position_id) {
      const { data: fromPos } = await supabase
        .from("rack_positions")
        .select("row_number, column_number, racks(code, warehouse_id, warehouses(name))")
        .eq("id", movFull.from_position_id)
        .maybeSingle();

      if (fromPos) {
        const rack = fromPos.racks as unknown as { code: string; warehouse_id: string; warehouses: { name: string } } | null;
        fromRackCode = rack?.code || null;
        fromRow = fromPos.row_number;
        fromCol = fromPos.column_number;
        fromLabel = `${fromRackCode || "?"}-F${fromRow}-C${fromCol}`;
        warehouseId = rack?.warehouse_id || null;
        warehouseName = rack?.warehouses?.name || "N/A";
      }
    }

    // Resolve to_position
    let toRackCode: string | null = null;
    let toRow: number | null = null;
    let toCol: number | null = null;
    let toLabel: string | null = null;

    if (movFull?.to_position_id) {
      const { data: toPos } = await supabase
        .from("rack_positions")
        .select("row_number, column_number, racks(code, warehouse_id, warehouses(name))")
        .eq("id", movFull.to_position_id)
        .maybeSingle();

      if (toPos) {
        const rack = toPos.racks as unknown as { code: string; warehouse_id: string; warehouses: { name: string } } | null;
        toRackCode = rack?.code || null;
        toRow = toPos.row_number;
        toCol = toPos.column_number;
        toLabel = `${toRackCode || "?"}-F${toRow}-C${toCol}`;
        if (!warehouseId) {
          warehouseId = rack?.warehouse_id || null;
          warehouseName = rack?.warehouses?.name || "N/A";
        }
      }
    }

    // If no warehouse from positions, try from SU
    if (!warehouseId && mov.storage_unit_id) {
      const { data: su } = await supabase
        .from("storage_units")
        .select("warehouse_id, warehouses(name), position_id, su_code, su_type, quantity, rack_positions(row_number, column_number, racks(code))")
        .eq("id", mov.storage_unit_id)
        .maybeSingle();
      
      if (su) {
        const suWh = su.warehouses as unknown as { name: string } | null;
        warehouseId = su.warehouse_id;
        warehouseName = suWh?.name || "N/A";
        
        // If no position info yet, get from SU
        if (!fromRackCode && !toRackCode) {
          const rp = su.rack_positions as unknown as { row_number: number; column_number: number; racks: { code: string } } | null;
          if (rp) {
            const isInbound = mov.movement_type === "inbound" || mov.movement_type === "receipt";
            const code = rp.racks?.code || null;
            const label = `${code || "?"}-F${rp.row_number}-C${rp.column_number}`;
            if (isInbound) {
              toRackCode = code; toRow = rp.row_number; toCol = rp.column_number; toLabel = label;
            } else {
              fromRackCode = code; fromRow = rp.row_number; fromCol = rp.column_number; fromLabel = label;
            }
          }
        }
      }
    }

    // Last-resort fallback: resolve from product's current storage unit
    if (!warehouseId && !fromRackCode && !toRackCode && product) {
      const { data: suByProduct } = await supabase
        .from("storage_units")
        .select("warehouse_id, warehouses(name), position_id, rack_positions(row_number, column_number, racks(code))")
        .eq("lot_id", (
          await supabase.from("lot_tracking").select("id").eq("product_id", product.id).limit(1).maybeSingle()
        ).data?.id || "")
        .not("position_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (suByProduct) {
        const suWh = suByProduct.warehouses as unknown as { name: string } | null;
        warehouseId = suByProduct.warehouse_id;
        warehouseName = suWh?.name || "N/A";
        const rp = suByProduct.rack_positions as unknown as { row_number: number; column_number: number; racks: { code: string } } | null;
        if (rp) {
          const isInbound = mov.movement_type === "inbound" || mov.movement_type === "receipt";
          const code = rp.racks?.code || null;
          const label = `${code || "?"}-F${rp.row_number}-C${rp.column_number}`;
          if (isInbound) {
            toRackCode = code; toRow = rp.row_number; toCol = rp.column_number; toLabel = label;
          } else {
            fromRackCode = code; fromRow = rp.row_number; fromCol = rp.column_number; fromLabel = label;
          }
        }
      }
    }

    // Final fallback for warehouse: resolve from reference GR/GI
    if (!warehouseId && mov.reference_id) {
      if (mov.reference_type === "goods_receipt") {
        const { data: gr } = await supabase.from("goods_receipts").select("warehouse_id, warehouses(name)").eq("id", mov.reference_id).maybeSingle();
        if (gr) {
          warehouseId = gr.warehouse_id;
          const grWh = gr.warehouses as unknown as { name: string } | null;
          warehouseName = grWh?.name || "N/A";
        }
      } else if (mov.reference_type === "goods_issue") {
        const { data: gi } = await supabase.from("goods_issues").select("warehouse_id, warehouses(name)").eq("id", mov.reference_id).maybeSingle();
        if (gi) {
          warehouseId = gi.warehouse_id;
          const giWh = gi.warehouses as unknown as { name: string } | null;
          warehouseName = giWh?.name || "N/A";
        }
      }
    }

    // SU details
    let suCode: string | null = null;
    let suType: string | null = null;
    let suQuantity: number | null = null;

    if (mov.storage_unit_id) {
      const { data: su } = await supabase
        .from("storage_units")
        .select("su_code, su_type, quantity")
        .eq("id", mov.storage_unit_id)
        .maybeSingle();
      if (su) {
        suCode = su.su_code;
        suType = su.su_type;
        suQuantity = Number(su.quantity);
      }
    }

    // Resolve reference number
    let referenceNumber: string | null = mov.reference as string || null;
    if (!referenceNumber && mov.reference_id) {
      if (mov.reference_type === "goods_receipt") {
        const { data: gr } = await supabase.from("goods_receipts").select("receipt_number").eq("id", mov.reference_id).maybeSingle();
        referenceNumber = gr?.receipt_number || null;
      } else if (mov.reference_type === "goods_issue") {
        const { data: gi } = await supabase.from("goods_issues").select("issue_number").eq("id", mov.reference_id).maybeSingle();
        referenceNumber = gi?.issue_number || null;
      } else if (mov.reference_type === "transfer_order") {
        const { data: to } = await supabase.from("transfer_orders").select("transfer_number").eq("id", mov.reference_id).maybeSingle();
        referenceNumber = to?.transfer_number || null;
      }
    }

    // Resolve performed_by name
    let performedByName: string | null = null;
    if (mov.performed_by) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", mov.performed_by).maybeSingle();
      performedByName = profile?.full_name || null;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: mov.id,
        movement_type: mov.movement_type,
        movement_description: mov.movement_description,
        quantity: Number(mov.quantity),
        created_at: mov.created_at,
        sap_movement_type: mov.sap_movement_type,
        sap_document_id: mov.sap_document_id,
        reference_type: mov.reference_type,
        reference_id: mov.reference_id,
        reference_number: referenceNumber,
        lot_number: mov.lot_number,
        performed_by_name: performedByName,
        product_name: product?.name || "Material",
        product_sku: product?.sku || "N/A",
        warehouse_name: warehouseName,
        warehouse_id: warehouseId,
        from_rack_code: fromRackCode,
        from_row: fromRow,
        from_col: fromCol,
        from_position_label: fromLabel,
        to_rack_code: toRackCode,
        to_row: toRow,
        to_col: toCol,
        to_position_label: toLabel,
        su_code: suCode,
        su_type: suType,
        su_quantity: suQuantity,
      },
    });
  } catch (err) {
    console.error("[WMS API] Movement detail error:", err);
    const msg = err instanceof Error ? err.message : "Error fetching movement detail";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
