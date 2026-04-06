import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── Fetch pending purchase orders for GR wizard ─────────
export async function GET(req: NextRequest) {
  try {
    const warehouseId = req.nextUrl.searchParams.get("warehouseId") || undefined;
    const supabase = await createClient();

    let query = supabase
      .from("purchase_orders")
      .select("id, po_number, sap_po_number, status, priority, total, expected_delivery, warehouse_id, warehouses(name), vendors(name)")
      .in("status", ["sent", "approved", "partially_received"])
      .order("expected_delivery", { ascending: true });

    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId);
    }

    const { data: orders, error } = await query.limit(30);
    if (error) throw error;

    // Fetch items for each PO
    const result = await Promise.all(
      (orders || []).map(async (po) => {
        const { data: items } = await supabase
          .from("purchase_order_items")
          .select("id, material_code, description, quantity, received_quantity, unit_price")
          .eq("po_id", po.id);

        const w = po.warehouses as unknown as { name: string } | null;
        const v = po.vendors as unknown as { name: string } | null;

        // Resolve product_id from material_code → products.sku
        const resolvedItems = await Promise.all(
          (items || []).map(async (i) => {
            const { data: product } = await supabase
              .from("products")
              .select("id, name, sku")
              .eq("sku", i.material_code)
              .maybeSingle();

            return {
              id: i.id,
              product_id: product?.id || i.id,
              product_name: product?.name || i.description || "Material",
              product_sku: product?.sku || i.material_code || "N/A",
              quantity_ordered: Number(i.quantity) || 0,
              quantity_received: Number(i.received_quantity) || 0,
              unit_price: Number(i.unit_price) || 0,
            };
          })
        );

        return {
          id: po.id,
          po_number: po.po_number,
          sap_po_number: po.sap_po_number,
          status: po.status,
          priority: po.priority || "medium",
          total: Number(po.total) || 0,
          expected_delivery: po.expected_delivery,
          warehouse_id: po.warehouse_id,
          warehouse_name: w?.name || null,
          vendor_name: v?.name || null,
          item_count: resolvedItems.length,
          items: resolvedItems,
        };
      })
    );

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[WMS API] Error fetching pending POs:", err);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
