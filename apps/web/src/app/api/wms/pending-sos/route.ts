import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get("warehouseId");

    let query = supabase
      .from("sales_orders")
      .select("id, so_number, sap_so_number, status, priority, total, currency, requested_delivery_date, warehouse_id, warehouses(name), customer_name, customer_code")
      .in("status", ["confirmed", "processing", "picking"])
      .order("priority", { ascending: true })
      .order("requested_delivery_date", { ascending: true });

    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId);
    }

    const { data: orders, error } = await query.limit(30);
    if (error) throw error;

    // Fetch items for each SO
    const result = await Promise.all(
      (orders || []).map(async (so) => {
        const { data: items } = await supabase
          .from("sales_order_items")
          .select("id, product_id, description, quantity, unit, unit_price, quantity_picked, quantity_shipped")
          .eq("sale_order_id", so.id)
          .order("item_number", { ascending: true });

        const w = so.warehouses as unknown as { name: string } | null;

        // Resolve product names
        const resolvedItems = await Promise.all(
          (items || []).map(async (i) => {
            let productName = i.description || "Material";
            let productSku = "N/A";

            if (i.product_id) {
              const { data: product } = await supabase
                .from("products")
                .select("name, sku")
                .eq("id", i.product_id)
                .maybeSingle();
              if (product) {
                productName = product.name;
                productSku = product.sku;
              }
            }

            return {
              id: i.id,
              product_id: i.product_id || i.id,
              product_name: productName,
              product_sku: productSku,
              quantity_ordered: Number(i.quantity) || 0,
              quantity_picked: Number(i.quantity_picked) || 0,
              quantity_shipped: Number(i.quantity_shipped) || 0,
              unit: i.unit || "UN",
              unit_price: Number(i.unit_price) || 0,
            };
          })
        );

        return {
          id: so.id,
          so_number: so.so_number,
          sap_so_number: so.sap_so_number,
          status: so.status,
          priority: so.priority || "medium",
          total: Number(so.total) || 0,
          requested_delivery_date: so.requested_delivery_date,
          warehouse_id: so.warehouse_id,
          warehouse_name: w?.name || null,
          customer_name: so.customer_name,
          customer_code: so.customer_code,
          item_count: resolvedItems.length,
          items: resolvedItems,
        };
      })
    );

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[WMS API] Pending SOs error:", err);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
