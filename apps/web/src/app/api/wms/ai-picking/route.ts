import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ══════════════════════════════════════════════════════════
// AI Picking Proposal — Algorithmic FEFO/FIFO/Consolidation
// Returns optimal storage units for each product requested
// ══════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const { warehouse_id, items } = await req.json();

    if (!warehouse_id || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, message: "warehouse_id e items son requeridos" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    type ItemRequest = { product_id: string; quantity_needed: number };
    type PickingSuggestion = {
      product_id: string;
      sources: {
        su_id: string;
        su_code: string;
        su_type: string;
        lot_id: string;
        lot_number: string;
        expiry_date: string | null;
        available: number;
        suggested_qty: number;
        position_id: string;
        rack_code: string;
        row_number: number;
        column_number: number;
        position_label: string;
        warehouse_name: string;
        reason: string;
      }[];
      total_available: number;
      total_suggested: number;
      is_sufficient: boolean;
    };

    const results: PickingSuggestion[] = [];

    for (const item of items as ItemRequest[]) {
      // Fetch available storage units for this product
      const { data: sus, error } = await supabase
        .from("storage_units")
        .select(`
          id, su_code, su_type, quantity, reserved_quantity, available_quantity,
          status, position_id, lot_id, created_at,
          lot_tracking(lot_number, expiry_date, manufacturing_date),
          rack_positions!inner(row_number, column_number, rack_id, racks!inner(code, warehouse_id, warehouses!inner(name)))
        `)
        .eq("warehouse_id", warehouse_id)
        .eq("product_id", item.product_id)
        .in("status", ["available", "reserved"])
        .gt("available_quantity", 0)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[AI Picking] Error fetching SUs:", error);
        results.push({
          product_id: item.product_id,
          sources: [],
          total_available: 0,
          total_suggested: 0,
          is_sufficient: false,
        });
        continue;
      }

      // Sort by FEFO first (expiry_date ASC, nulls last), then FIFO (created_at ASC)
      const sorted = (sus || []).sort((a, b) => {
        const lotA = a.lot_tracking as unknown as { expiry_date: string | null } | null;
        const lotB = b.lot_tracking as unknown as { expiry_date: string | null } | null;
        const expiryA = lotA?.expiry_date ? new Date(lotA.expiry_date).getTime() : Infinity;
        const expiryB = lotB?.expiry_date ? new Date(lotB.expiry_date).getTime() : Infinity;

        if (expiryA !== expiryB) return expiryA - expiryB; // FEFO
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); // FIFO
      });

      let remaining = item.quantity_needed;
      const sources: PickingSuggestion["sources"] = [];

      for (const su of sorted) {
        if (remaining <= 0) break;

        const available = Number(su.available_quantity) || 0;
        if (available <= 0) continue;

        const suggestedQty = Math.min(available, remaining);
        remaining -= suggestedQty;

        const lot = su.lot_tracking as unknown as { lot_number: string; expiry_date: string | null; manufacturing_date: string | null } | null;
        const rp = su.rack_positions as unknown as {
          row_number: number;
          column_number: number;
          racks: { code: string; warehouses: { name: string } };
        };

        // Generate reason
        const reasons: string[] = [];
        if (lot?.expiry_date) {
          const daysLeft = Math.ceil((new Date(lot.expiry_date).getTime() - Date.now()) / 86400000);
          reasons.push(`FEFO: vence en ${daysLeft} días`);
        }
        reasons.push("FIFO: UA más antigua disponible");
        if (suggestedQty === available) {
          reasons.push("Vacía la UA completamente");
        }

        sources.push({
          su_id: su.id,
          su_code: su.su_code,
          su_type: su.su_type,
          lot_id: su.lot_id,
          lot_number: lot?.lot_number || "N/A",
          expiry_date: lot?.expiry_date || null,
          available,
          suggested_qty: suggestedQty,
          position_id: su.position_id,
          rack_code: rp?.racks?.code || "N/A",
          row_number: rp?.row_number || 0,
          column_number: rp?.column_number || 0,
          position_label: `${rp?.racks?.code || "?"}-${rp?.row_number || 0}-${rp?.column_number || 0}`,
          warehouse_name: rp?.racks?.warehouses?.name || "N/A",
          reason: reasons.join(" · "),
        });
      }

      const totalAvailable = sorted.reduce((sum, su) => sum + (Number(su.available_quantity) || 0), 0);
      const totalSuggested = sources.reduce((sum, s) => sum + s.suggested_qty, 0);

      results.push({
        product_id: item.product_id,
        sources,
        total_available: totalAvailable,
        total_suggested: totalSuggested,
        is_sufficient: totalSuggested >= item.quantity_needed,
      });
    }

    return NextResponse.json({ success: true, data: results });
  } catch (err) {
    console.error("[AI Picking] Error:", err);
    return NextResponse.json({ success: false, message: "Error generating picking proposal" }, { status: 500 });
  }
}
