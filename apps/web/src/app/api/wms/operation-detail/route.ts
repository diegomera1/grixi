import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MOVEMENT_DESCRIPTIONS: Record<string, string> = {
  "101": "Entrada de mercancía",
  "102": "Anulación de entrada",
  "201": "Salida por centro de costo",
  "261": "Salida por pedido de venta",
  "262": "Anulación de salida",
  "301": "Traspaso entre almacenes",
  "311": "Traspaso interno",
  "551": "Salida por merma",
};

// ══════════════════════════════════════════════════════════
// GET Operation Detail — Full profile for GR, GI, or TO
// ══════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type") as "gr" | "gi" | "to";
    const id = req.nextUrl.searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json({ success: false, message: "type and id are required" }, { status: 400 });
    }

    const supabase = await createClient();

    if (type === "gr") {
      // ── Goods Receipt Profile ────────────────────────
      const { data: gr, error } = await supabase
        .from("goods_receipts")
        .select(`
          id, receipt_number, status, movement_type, warehouse_id,
          delivery_note, carrier, plate_number, quality_checked, notes,
          created_at, receipt_date,
          warehouses(name),
          purchase_orders(po_number, vendors(name))
        `)
        .eq("id", id)
        .single();

      if (error || !gr) throw error || new Error("Entrada no encontrada");

      // Get items with product + position + SU info
      const { data: items } = await supabase
        .from("goods_receipt_items")
        .select(`
          id, product_id, quantity_received, quantity_rejected, rejection_reason,
          lot_number, target_position_id, storage_unit_id, su_type, su_code,
          products(name, sku),
          rack_positions(row_number, column_number, racks(code))
        `)
        .eq("receipt_id", id);

      // Get movements
      const { data: movements } = await supabase
        .from("inventory_movements")
        .select("id, movement_type, movement_description, quantity, created_at, reference, lot_number, storage_unit_id")
        .eq("reference_type", "goods_receipt")
        .eq("reference_id", id)
        .order("created_at", { ascending: true });

      const wh = gr.warehouses as unknown as { name: string } | null;
      const po = gr.purchase_orders as unknown as { po_number: string; vendors: { name: string } | null } | null;

      const profileItems = (items || []).map((item) => {
        const prod = item.products as unknown as { name: string; sku: string } | null;
        const rp = item.rack_positions as unknown as { row_number: number; column_number: number; racks: { code: string } } | null;
        return {
          product_id: item.product_id || "",
          product_name: prod?.name || "Material",
          product_sku: prod?.sku || "N/A",
          quantity: Number(item.quantity_received) || 0,
          quantity_rejected: Number(item.quantity_rejected) || 0,
          lot_number: item.lot_number,
          su_code: item.su_code,
          su_type: item.su_type,
          position_label: rp ? `${rp.racks?.code || "?"}-${rp.row_number}-${rp.column_number}` : null,
          rack_code: rp?.racks?.code || null,
        };
      });

      const positionIds = (items || [])
        .map(i => i.target_position_id)
        .filter(Boolean) as string[];

      return NextResponse.json({
        success: true,
        data: {
          id: gr.id,
          type: "gr",
          doc_number: gr.receipt_number,
          status: gr.status,
          description: MOVEMENT_DESCRIPTIONS[gr.movement_type || "101"] || "Entrada de mercancía",
          warehouse_id: gr.warehouse_id,
          warehouse_name: wh?.name || "N/A",
          reference_doc: po?.po_number || null,
          counterpart: po?.vendors?.name || null,
          created_at: gr.created_at,
          posted_at: gr.status === "posted" ? gr.created_at : null,
          delivery_note: gr.delivery_note,
          carrier: gr.carrier,
          items: profileItems,
          movements: (movements || []).map(m => ({
            ...m,
            movement_description: m.movement_description || MOVEMENT_DESCRIPTIONS[m.movement_type] || m.movement_type,
          })),
          position_ids: positionIds,
        },
      });
    }

    if (type === "gi") {
      // ── Goods Issue Profile ──────────────────────────
      const { data: gi, error } = await supabase
        .from("goods_issues")
        .select(`
          id, issue_number, issue_type, status, movement_type, warehouse_id,
          reference_type, reference_id, notes, created_at, posted_at,
          warehouses(name)
        `)
        .eq("id", id)
        .single();

      if (error || !gi) throw error || new Error("Salida no encontrada");

      // Resolve SO number if applicable
      let soNumber: string | null = null;
      let customerName: string | null = null;
      if (gi.reference_id && gi.reference_type === "sales_order") {
        const { data: so } = await supabase
          .from("sales_orders")
          .select("so_number, customer_name")
          .eq("id", gi.reference_id)
          .maybeSingle();
        soNumber = so?.so_number || null;
        customerName = so?.customer_name || null;
      }

      // Get items
      const { data: items } = await supabase
        .from("goods_issue_items")
        .select(`
          id, product_id, quantity_requested, quantity_issued, quantity_picked,
          storage_unit_id, lot_number, unit,
          products(name, sku),
          storage_units(su_code, su_type, position_id,
            rack_positions(row_number, column_number, racks(code))
          )
        `)
        .eq("issue_id", id);

      const { data: movements } = await supabase
        .from("inventory_movements")
        .select("id, movement_type, movement_description, quantity, created_at, reference, lot_number, storage_unit_id")
        .eq("reference_type", "goods_issue")
        .eq("reference_id", id)
        .order("created_at", { ascending: true });

      const wh = gi.warehouses as unknown as { name: string } | null;

      const profileItems = (items || []).map((item) => {
        const prod = item.products as unknown as { name: string; sku: string } | null;
        const su = item.storage_units as unknown as {
          su_code: string; su_type: string; position_id: string;
          rack_positions: { row_number: number; column_number: number; racks: { code: string } } | null;
        } | null;
        const rp = su?.rack_positions;
        return {
          product_id: item.product_id || "",
          product_name: prod?.name || "Material",
          product_sku: prod?.sku || "N/A",
          quantity: Number(item.quantity_issued) || 0,
          lot_number: item.lot_number,
          su_code: su?.su_code || null,
          su_type: su?.su_type || null,
          position_label: rp ? `${rp.racks?.code || "?"}-${rp.row_number}-${rp.column_number}` : null,
          rack_code: rp?.racks?.code || null,
        };
      });

      const positionIds = (items || [])
        .map(i => {
          const su = i.storage_units as unknown as { position_id: string } | null;
          return su?.position_id;
        })
        .filter(Boolean) as string[];

      return NextResponse.json({
        success: true,
        data: {
          id: gi.id,
          type: "gi",
          doc_number: gi.issue_number,
          status: gi.status,
          description: MOVEMENT_DESCRIPTIONS[gi.movement_type || "261"] || "Salida de mercancía",
          warehouse_id: gi.warehouse_id,
          warehouse_name: wh?.name || "N/A",
          reference_doc: soNumber,
          counterpart: customerName,
          created_at: gi.created_at,
          posted_at: gi.posted_at,
          items: profileItems,
          movements: (movements || []).map(m => ({
            ...m,
            movement_description: m.movement_description || MOVEMENT_DESCRIPTIONS[m.movement_type] || m.movement_type,
          })),
          position_ids: positionIds,
        },
      });
    }

    if (type === "to") {
      // ── Transfer Order Profile ───────────────────────
      const { data: to, error } = await supabase
        .from("transfer_orders")
        .select(`
          id, transfer_number, transfer_type, status, movement_type,
          from_warehouse_id, to_warehouse_id, priority, reason, notes,
          created_at, posted_at
        `)
        .eq("id", id)
        .single();

      if (error || !to) throw error || new Error("Traspaso no encontrado");

      // Resolve warehouse names
      const { data: fromWh } = await supabase.from("warehouses").select("name").eq("id", to.from_warehouse_id).maybeSingle();
      const { data: toWh } = await supabase.from("warehouses").select("name").eq("id", to.to_warehouse_id).maybeSingle();

      // Get items
      const { data: items } = await supabase
        .from("transfer_order_items")
        .select(`
          id, product_id, quantity, status, storage_unit_id, from_su_code,
          to_position_label, lot_number, confirmed_at,
          products(name, sku),
          storage_units(su_code, su_type, position_id,
            rack_positions(row_number, column_number, racks(code))
          )
        `)
        .eq("transfer_id", id);

      const { data: movements } = await supabase
        .from("inventory_movements")
        .select("id, movement_type, movement_description, quantity, created_at, reference, lot_number, storage_unit_id")
        .eq("reference_type", "transfer_order")
        .eq("reference_id", id)
        .order("created_at", { ascending: true });

      const profileItems = (items || []).map((item) => {
        const prod = item.products as unknown as { name: string; sku: string } | null;
        const su = item.storage_units as unknown as {
          su_code: string; su_type: string; position_id: string;
          rack_positions: { row_number: number; column_number: number; racks: { code: string } } | null;
        } | null;
        const rp = su?.rack_positions;
        return {
          product_id: item.product_id || "",
          product_name: prod?.name || "Material",
          product_sku: prod?.sku || "N/A",
          quantity: Number(item.quantity) || 0,
          lot_number: item.lot_number,
          su_code: su?.su_code || item.from_su_code || null,
          su_type: su?.su_type || null,
          position_label: rp ? `${rp.racks?.code || "?"}-${rp.row_number}-${rp.column_number}` : null,
          rack_code: rp?.racks?.code || null,
        };
      });

      const positionIds = (items || [])
        .map(i => {
          const su = i.storage_units as unknown as { position_id: string } | null;
          return su?.position_id;
        })
        .filter(Boolean) as string[];

      return NextResponse.json({
        success: true,
        data: {
          id: to.id,
          type: "to",
          doc_number: to.transfer_number,
          status: to.status,
          description: MOVEMENT_DESCRIPTIONS[to.movement_type || "311"] || "Traspaso",
          warehouse_id: to.from_warehouse_id,
          warehouse_name: fromWh?.name || "N/A",
          reference_doc: null,
          counterpart: null,
          created_at: to.created_at,
          posted_at: to.posted_at,
          from_warehouse_name: fromWh?.name || "N/A",
          to_warehouse_name: toWh?.name || "N/A",
          transfer_type: to.transfer_type,
          reason: to.reason,
          priority: to.priority,
          items: profileItems,
          movements: (movements || []).map(m => ({
            ...m,
            movement_description: m.movement_description || MOVEMENT_DESCRIPTIONS[m.movement_type] || m.movement_type,
          })),
          position_ids: positionIds,
        },
      });
    }

    return NextResponse.json({ success: false, message: `Tipo inválido: ${type}` }, { status: 400 });
  } catch (err) {
    console.error("[WMS API] Operation detail error:", err);
    const msg = err instanceof Error ? err.message : "Error fetching operation detail";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
