"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const DEMO_ORG_ID = "a0000000-0000-0000-0000-000000000001";

// ── Sequence number generation ────────────────────────
async function getNextSequence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  prefix: string,
  table: string,
  column: string
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;
  const { data } = await supabase
    .from(table)
    .select(column)
    .like(column, pattern)
    .order(column, { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (data && data.length > 0) {
    const last = (data[0] as unknown as Record<string, string>)[column];
    const parts = last.split("-");
    nextNum = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}-${year}-${String(nextNum).padStart(4, "0")}`;
}

// ── Types ─────────────────────────────────────────────
type ActionResult = {
  success: boolean;
  message: string;
  id?: string;
  data?: Record<string, unknown>;
};

export type CreateGoodsReceiptInput = {
  warehouse_id: string;
  po_id?: string;
  movement_type: string;
  notes?: string;
  items: { product_id: string; quantity: number; lot_number?: string }[];
};

export type CreateGoodsIssueInput = {
  warehouse_id: string;
  issue_type: string;
  reference_type?: string;
  reference_id?: string;
  movement_type: string;
  cost_center_code?: string;
  notes?: string;
  items: { product_id: string; quantity: number }[];
};

export type CreateTransferOrderInput = {
  from_warehouse_id: string;
  to_warehouse_id: string;
  transfer_type: string;
  priority: string;
  reason?: string;
  items: { product_id: string; quantity: number }[];
};

// ══════════════════════════════════════════════════════
// STEP 1: CREATE (documento pendiente + items)
// ══════════════════════════════════════════════════════

// ── Create Goods Receipt (Entrada — status: pending) ──
export async function createGoodsReceipt(
  input: CreateGoodsReceiptInput
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const receiptNumber = await getNextSequence(
      supabase,
      "GR",
      "goods_receipts",
      "receipt_number"
    );

    // 1. Create the GR header
    const { data, error } = await supabase
      .from("goods_receipts")
      .insert({
        org_id: DEMO_ORG_ID,
        receipt_number: receiptNumber,
        po_id: input.po_id || null,
        receiver_id: null,
        warehouse_id: input.warehouse_id,
        receipt_date: new Date().toISOString().split("T")[0],
        status: "pending",
        quality_check: false,
        movement_type: input.movement_type || "101",
        notes: input.notes || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    // 2. Create items (NO inventory movements — those happen on post)
    for (const item of input.items) {
      const { error: itemError } = await supabase
        .from("goods_receipt_items")
        .insert({
          receipt_id: data.id,
          product_id: item.product_id,
          quantity_received: item.quantity,
          lot_number: item.lot_number || null,
        });
      if (itemError) {
        console.error("[WMS] Error creating GR item:", itemError);
      }
    }

    revalidatePath("/almacenes");
    return {
      success: true,
      message: `Entrada ${receiptNumber} creada. Pendiente de contabilización.`,
      id: data.id,
    };
  } catch (err) {
    console.error("[WMS] Error creating goods receipt:", err);
    return { success: false, message: "Error al crear la entrada de mercancía" };
  }
}

// ── Create Goods Issue (Salida — status: pending) ─────
export async function createGoodsIssue(
  input: CreateGoodsIssueInput
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const issueNumber = await getNextSequence(
      supabase,
      "GI",
      "goods_issues",
      "issue_number"
    );

    // 1. Create the GI header
    const { data, error } = await supabase
      .from("goods_issues")
      .insert({
        org_id: DEMO_ORG_ID,
        issue_number: issueNumber,
        issue_type: input.issue_type || "production",
        warehouse_id: input.warehouse_id,
        status: "pending",
        movement_type: input.movement_type || "201",
        reference_type: input.reference_type || null,
        reference_id: input.reference_id || null,
        cost_center_code: input.cost_center_code || null,
        notes: input.notes || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    // 2. Create items (NO inventory decrements — those happen on post)
    for (const item of input.items) {
      const { error: itemError } = await supabase
        .from("goods_issue_items")
        .insert({
          issue_id: data.id,
          product_id: item.product_id,
          quantity_requested: item.quantity,
          quantity_issued: 0,
          unit: "UN",
        });
      if (itemError) {
        console.error("[WMS] Error creating GI item:", itemError);
      }
    }

    // If linked to a Sales Order, mark as picking
    if (input.reference_type === "sales_order" && input.reference_id) {
      await supabase
        .from("sales_orders")
        .update({ status: "picking" })
        .eq("id", input.reference_id);
    }

    revalidatePath("/almacenes");
    return {
      success: true,
      message: `Salida ${issueNumber} creada. Pendiente de contabilización.`,
      id: data.id,
    };
  } catch (err) {
    console.error("[WMS] Error creating goods issue:", err);
    return { success: false, message: "Error al crear la salida de mercancía" };
  }
}

// ── Create Transfer Order (Traspaso — status: pending) ─
export async function createTransferOrder(
  input: CreateTransferOrderInput
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const transferNumber = await getNextSequence(
      supabase,
      "TO",
      "transfer_orders",
      "transfer_number"
    );

    // 1. Create the TO header
    const { data, error } = await supabase
      .from("transfer_orders")
      .insert({
        org_id: DEMO_ORG_ID,
        transfer_number: transferNumber,
        transfer_type: input.transfer_type || "internal",
        from_warehouse_id: input.from_warehouse_id,
        to_warehouse_id: input.to_warehouse_id,
        status: "pending",
        movement_type:
          input.from_warehouse_id === input.to_warehouse_id ? "311" : "301",
        priority: input.priority || "medium",
        reason: input.reason || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    // 2. Create items (NO inventory moves — those happen on post)
    for (const item of input.items) {
      const { error: itemError } = await supabase
        .from("transfer_order_items")
        .insert({
          transfer_id: data.id,
          product_id: item.product_id,
          quantity: item.quantity,
          status: "pending",
        });
      if (itemError) {
        console.error("[WMS] Error creating TO item:", itemError);
      }
    }

    revalidatePath("/almacenes");
    return {
      success: true,
      message: `Traspaso ${transferNumber} creado. Pendiente de contabilización.`,
      id: data.id,
    };
  } catch (err) {
    console.error("[WMS] Error creating transfer order:", err);
    return { success: false, message: "Error al crear el traspaso" };
  }
}

// ══════════════════════════════════════════════════════
// STEP 2: POST (transactional — via RPC)
// These RPCs atomically update inventory, positions, and movements
// ══════════════════════════════════════════════════════

// ── Post Goods Receipt (Contabilizar Entrada) ─────────
export async function postGoodsReceipt(
  id: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("wms_post_goods_receipt", {
      p_receipt_id: id,
    });

    if (error) throw error;

    const result = data as {
      success: boolean;
      message?: string;
      error?: string;
      sap_document_id?: string;
      items_posted?: number;
      total_quantity?: number;
    };

    if (!result.success) {
      return { success: false, message: result.error || "Error desconocido" };
    }

    revalidatePath("/almacenes");
    return {
      success: true,
      message: `✅ ${result.message} — SAP: ${result.sap_document_id}`,
      data: {
        sap_document_id: result.sap_document_id,
        items_posted: result.items_posted,
        total_quantity: result.total_quantity,
      },
    };
  } catch (err) {
    console.error("[WMS] Error posting GR:", err);
    return { success: false, message: "Error al contabilizar la entrada" };
  }
}

// ── Post Goods Issue (Contabilizar Salida) ────────────
export async function postGoodsIssue(
  id: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("wms_post_goods_issue", {
      p_issue_id: id,
    });

    if (error) throw error;

    const result = data as {
      success: boolean;
      message?: string;
      error?: string;
      sap_document_id?: string;
      items_posted?: number;
      total_quantity?: number;
    };

    if (!result.success) {
      return { success: false, message: result.error || "Error desconocido" };
    }

    revalidatePath("/almacenes");
    return {
      success: true,
      message: `✅ ${result.message} — SAP: ${result.sap_document_id}`,
      data: {
        sap_document_id: result.sap_document_id,
        items_posted: result.items_posted,
        total_quantity: result.total_quantity,
      },
    };
  } catch (err) {
    console.error("[WMS] Error posting GI:", err);
    return { success: false, message: "Error al contabilizar la salida" };
  }
}

// ── Post Transfer Order (Contabilizar Traspaso) ───────
export async function postTransferOrder(
  id: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("wms_post_transfer", {
      p_transfer_id: id,
    });

    if (error) throw error;

    const result = data as {
      success: boolean;
      message?: string;
      error?: string;
      sap_document_id?: string;
      items_posted?: number;
      total_quantity?: number;
    };

    if (!result.success) {
      return { success: false, message: result.error || "Error desconocido" };
    }

    revalidatePath("/almacenes");
    return {
      success: true,
      message: `✅ ${result.message} — SAP: ${result.sap_document_id}`,
      data: {
        sap_document_id: result.sap_document_id,
        items_posted: result.items_posted,
        total_quantity: result.total_quantity,
      },
    };
  } catch (err) {
    console.error("[WMS] Error posting TO:", err);
    return { success: false, message: "Error al contabilizar el traspaso" };
  }
}

// ── Adjust Physical Count (Contabilizar Ajuste) ───────
export async function adjustPhysicalCount(
  countId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("wms_adjust_physical_count", {
      p_count_id: countId,
    });

    if (error) throw error;

    const result = data as {
      success: boolean;
      message?: string;
      error?: string;
      sap_document_id?: string;
      adjustments?: number;
      positive_adjustments?: number;
      negative_adjustments?: number;
    };

    if (!result.success) {
      return { success: false, message: result.error || "Error desconocido" };
    }

    revalidatePath("/almacenes");
    return {
      success: true,
      message: `✅ ${result.message} — SAP: ${result.sap_document_id}`,
      data: {
        sap_document_id: result.sap_document_id,
        adjustments: result.adjustments,
        positive_adjustments: result.positive_adjustments,
        negative_adjustments: result.negative_adjustments,
      },
    };
  } catch (err) {
    console.error("[WMS] Error adjusting count:", err);
    return { success: false, message: "Error al ajustar el conteo" };
  }
}

// ── Ship Sales Order (Despachar) ──────────────────────
export async function shipSalesOrder(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const sapDelivery = `DN-${String(Math.floor(Math.random() * 900000) + 100000)}`;

    const { error } = await supabase
      .from("sales_orders")
      .update({
        status: "shipped",
        sap_delivery_number: sapDelivery,
        shipped_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/almacenes");
    return {
      success: true,
      message: `Pedido despachado — Entrega SAP: ${sapDelivery}`,
    };
  } catch (err) {
    console.error("[WMS] Error shipping SO:", err);
    return { success: false, message: "Error al despachar el pedido" };
  }
}

// ══════════════════════════════════════════════════════
// DASHBOARD RPCs
// ══════════════════════════════════════════════════════

export async function getDashboardKpis(warehouseId?: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("wms_get_dashboard_kpis", {
      p_org_id: DEMO_ORG_ID,
      p_warehouse_id: warehouseId || null,
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("[WMS] Error getting KPIs:", err);
    return null;
  }
}

export async function getWarehouseOccupancy() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("wms_get_warehouse_occupancy", {
      p_org_id: DEMO_ORG_ID,
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("[WMS] Error getting occupancy:", err);
    return null;
  }
}

export async function getMovementTrends(days: number = 7) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("wms_get_movement_trends", {
      p_org_id: DEMO_ORG_ID,
      p_days: days,
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("[WMS] Error getting trends:", err);
    return null;
  }
}

export async function getLowStockProducts() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("wms_get_low_stock_products", {
      p_org_id: DEMO_ORG_ID,
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("[WMS] Error getting low stock:", err);
    return null;
  }
}

// ══════════════════════════════════════════════════════
// GOODS RECEIPT WIZARD — Server Actions
// ══════════════════════════════════════════════════════

// ── Fetch Pending POs for GR Wizard ───────────────────
export async function fetchPendingPurchaseOrders(warehouseId?: string) {
  try {
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
        // POI columns: id, material_code, description, quantity, received_quantity, unit_price
        const { data: items } = await supabase
          .from("purchase_order_items")
          .select("id, material_code, description, quantity, received_quantity, unit_price")
          .eq("po_id", po.id);

        const w = po.warehouses as unknown as { name: string } | null;
        const v = po.vendors as unknown as { name: string } | null;

        // Resolve product_id from material_code → products.sku
        const resolvedItems = await Promise.all(
          (items || []).map(async (i) => {
            // Try to find matching product by SKU
            const { data: product } = await supabase
              .from("products")
              .select("id, name, sku")
              .eq("sku", i.material_code)
              .maybeSingle();

            return {
              id: i.id,
              product_id: product?.id || i.id, // fallback to item id if no product match
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

    return { success: true, data: result };
  } catch (err) {
    console.error("[WMS] Error fetching pending POs:", err);
    return { success: false, data: [] };
  }
}

// ── Fetch Putaway Suggestions ─────────────────────────
export async function fetchPutawaySuggestions(
  warehouseId: string,
  productId: string,
  quantity: number
) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("wms_suggest_putaway", {
      p_warehouse_id: warehouseId,
      p_product_id: productId,
      p_quantity: quantity,
    });
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error("[WMS] Error fetching putaway suggestions:", err);
    return { success: false, data: [] };
  }
}

// ── Create Enterprise Goods Receipt (Enhanced) ────────
export type EnterpriseGRInput = {
  warehouse_id: string;
  po_id: string;
  movement_type: string;
  delivery_note?: string;
  carrier?: string;
  plate_number?: string;
  quality_checked: boolean;
  notes?: string;
  items: {
    product_id: string;
    quantity_received: number;
    quantity_rejected: number;
    rejection_reason?: string;
    lot_number?: string;
    position_id?: string;
  }[];
};

export async function createEnterpriseGoodsReceipt(
  input: EnterpriseGRInput
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const receiptNumber = await getNextSequence(supabase, "GR", "goods_receipts", "receipt_number");

    // 1. Create the GR header with enterprise fields
    const { data, error } = await supabase
      .from("goods_receipts")
      .insert({
        org_id: DEMO_ORG_ID,
        receipt_number: receiptNumber,
        po_id: input.po_id,
        warehouse_id: input.warehouse_id,
        receipt_date: new Date().toISOString().split("T")[0],
        status: "pending",
        quality_check: input.quality_checked,
        movement_type: input.movement_type || "101",
        notes: input.notes || null,
        delivery_note: input.delivery_note || null,
        carrier: input.carrier || null,
        plate_number: input.plate_number || null,
        quality_checked: input.quality_checked,
      })
      .select("id")
      .single();

    if (error) throw error;

    // 2. Create GR items
    for (const item of input.items) {
      await supabase.from("goods_receipt_items").insert({
        receipt_id: data.id,
        product_id: item.product_id,
        quantity_received: item.quantity_received,
        quantity_rejected: item.quantity_rejected || 0,
        rejection_reason: item.rejection_reason || null,
        lot_number: item.lot_number || null,
        position_id: item.position_id || null,
      });
    }

    revalidatePath("/almacenes");
    return {
      success: true,
      message: `Entrada ${receiptNumber} creada exitosamente. Pendiente de contabilización.`,
      id: data.id,
      data: { receiptNumber },
    };
  } catch (err) {
    console.error("[WMS] Error creating enterprise GR:", err);
    return { success: false, message: "Error al crear la entrada de mercancía" };
  }
}

// ══════════════════════════════════════════════════════
// GOODS ISSUE WIZARD — Server Actions
// ══════════════════════════════════════════════════════

// ── Fetch Confirmed Sales Orders for GI Wizard ────────
export async function fetchPendingSalesOrders(warehouseId?: string) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("sales_orders")
      .select("id, so_number, sap_so_number, status, priority, total, currency, requested_delivery_date, warehouse_id, warehouses(name), customer_name, customer_code")
      .in("status", ["confirmed", "processing"])
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

    return { success: true, data: result };
  } catch (err) {
    console.error("[WMS] Error fetching pending SOs:", err);
    return { success: false, data: [] };
  }
}

// ── Create Enterprise Goods Issue ─────────────────────
export type EnterpriseGIInput = {
  warehouse_id: string;
  so_id: string;
  issue_type: string;
  movement_type: string;
  notes?: string;
  items: {
    product_id: string;
    quantity_picked: number;
  }[];
};

export async function createEnterpriseGoodsIssue(
  input: EnterpriseGIInput
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const issueNumber = await getNextSequence(supabase, "GI", "goods_issues", "issue_number");

    // 1. Create the GI header
    const { data, error } = await supabase
      .from("goods_issues")
      .insert({
        org_id: DEMO_ORG_ID,
        issue_number: issueNumber,
        issue_type: input.issue_type || "sales_order",
        reference_type: "sales_order",
        reference_id: input.so_id,
        warehouse_id: input.warehouse_id,
        status: "posted",
        movement_type: input.movement_type || "261",
        sap_document_id: `MAT-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`,
        notes: input.notes || null,
        posted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;

    // 2. Create GI items and movements
    const totalPicked = input.items.reduce((acc, it) => acc + it.quantity_picked, 0);

    for (const item of input.items) {
      // Create goods_issue_items
      await supabase.from("goods_issue_items").insert({
        issue_id: data.id,
        product_id: item.product_id,
        quantity_requested: item.quantity_picked,
        quantity_issued: item.quantity_picked,
      });

      // Create inventory movement (salida)
      await supabase.from("inventory_movements").insert({
        org_id: DEMO_ORG_ID,
        product_id: item.product_id,
        warehouse_id: input.warehouse_id,
        movement_type: "outbound",
        quantity: item.quantity_picked,
        reference_type: "goods_issue",
        reference_id: data.id,
        sap_movement_type: input.movement_type || "261",
        sap_document_id: `MAT-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`,
      });
    }

    // 3. Update SO status to "processing" or "shipped"
    await supabase
      .from("sales_orders")
      .update({ status: "processing" })
      .eq("id", input.so_id);

    revalidatePath("/almacenes");
    return {
      success: true,
      message: `Salida ${issueNumber} contabilizada — ${totalPicked} unidades despachadas.`,
      id: data.id,
      data: { issueNumber },
    };
  } catch (err) {
    console.error("[WMS] Error creating enterprise GI:", err);
    return { success: false, message: "Error al crear la salida de mercancía" };
  }
}

// ══════════════════════════════════════════════════════
// PHYSICAL COUNTS (Inventario Físico)
// ══════════════════════════════════════════════════════

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

// ── Fetch all physical counts ─────────────────────────
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

// ── Create a new physical count document ──────────────
type CreatePhysicalCountInput = {
  warehouse_id: string;
  count_type: string;
  total_positions: number;
  notes?: string;
};

export async function createPhysicalCount(
  input: CreatePhysicalCountInput
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const countNumber = await getNextSequence(
      supabase,
      "PC",
      "physical_counts",
      "count_number"
    );

    const { data, error } = await supabase
      .from("physical_counts")
      .insert({
        org_id: DEMO_ORG_ID,
        count_number: countNumber,
        warehouse_id: input.warehouse_id,
        count_type: input.count_type,
        status: "planned",
        total_positions: input.total_positions,
        counted_positions: 0,
        variance_count: 0,
        notes: input.notes || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    revalidatePath("/almacenes");
    return {
      success: true,
      message: `Conteo ${countNumber} creado. Pendiente de ejecución.`,
      id: data.id,
    };
  } catch (err) {
    console.error("[WMS] Error creating physical count:", err);
    return { success: false, message: "Error al crear el conteo" };
  }
}
