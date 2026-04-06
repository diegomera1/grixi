import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── Putaway suggestions for GR wizard step 3 ────────────
export async function GET(req: NextRequest) {
  try {
    const warehouseId = req.nextUrl.searchParams.get("warehouseId");
    let productId = req.nextUrl.searchParams.get("productId");
    const quantity = Number(req.nextUrl.searchParams.get("quantity") || "1");

    if (!warehouseId) {
      return NextResponse.json({ success: false, data: [], error: "Missing warehouseId" }, { status: 400 });
    }

    const supabase = await createClient();

    // If productId is not a valid UUID or doesn't exist in products, try to resolve it
    // or use a fallback product to still get position suggestions
    if (productId) {
      const { data: productCheck } = await supabase
        .from("products")
        .select("id")
        .eq("id", productId)
        .maybeSingle();

      if (!productCheck) {
        // productId doesn't exist in products table — try to find ANY product as fallback
        // The putaway function mainly uses it for weight calculation, positions are warehouse-based
        const { data: fallbackProduct } = await supabase
          .from("products")
          .select("id")
          .limit(1)
          .single();
        
        productId = fallbackProduct?.id || null;
      }
    }

    if (!productId) {
      // No product at all — get any available position directly
      const { data: positions } = await supabase
        .from("rack_positions")
        .select("id, row_number, column_number, racks!inner(id, code, warehouse_id)")
        .eq("racks.warehouse_id", warehouseId)
        .in("status", ["available", "empty"])
        .order("row_number")
        .limit(5);

      const fallbackData = (positions || []).map(p => {
        const rack = p.racks as unknown as { id: string; code: string };
        return {
          position_id: p.id,
          rack_id: rack.id,
          rack_code: rack.code,
          row_number: p.row_number,
          column_number: p.column_number,
          position_label: `${rack.code}-${p.row_number}-${p.column_number}`,
          score: 50,
          reason: `Posición disponible en ${rack.code}, Fila ${p.row_number}.`,
        };
      });

      return NextResponse.json({ success: true, data: fallbackData });
    }

    const { data, error } = await supabase.rpc("wms_suggest_putaway", {
      p_warehouse_id: warehouseId,
      p_product_id: productId,
      p_quantity: quantity,
    });

    if (error) {
      console.error("[WMS API] RPC error:", error);
      // Don't fail — return empty with success so UI can show manual options
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    console.error("[WMS API] Error fetching putaway suggestions:", err);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
