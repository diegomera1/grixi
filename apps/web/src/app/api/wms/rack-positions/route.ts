import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const warehouseId = request.nextUrl.searchParams.get("warehouseId");
  if (!warehouseId) {
    return Response.json({ success: false, error: "warehouseId required" }, { status: 400 });
  }

  // Get racks for this warehouse
  const { data: racks, error: racksError } = await supabase
    .from("racks")
    .select("id, code, rows, columns")
    .eq("warehouse_id", warehouseId)
    .order("code");

  if (racksError) {
    return Response.json({ success: false, error: racksError.message }, { status: 500 });
  }

  if (!racks || racks.length === 0) {
    return Response.json({ success: true, data: [] });
  }

  // Get all positions for these racks
  const rackIds = racks.map(r => r.id);
  const { data: positions, error: posError } = await supabase
    .from("rack_positions")
    .select("id, rack_id, row_number, column_number, status")
    .in("rack_id", rackIds)
    .order("row_number")
    .order("column_number");

  if (posError) {
    return Response.json({ success: false, error: posError.message }, { status: 500 });
  }

  // Get inventory for these positions (separate query to avoid FK ambiguity)
  const positionIds = (positions || []).map(p => p.id);
  let inventoryMap = new Map<string, { product_id: string; quantity: number; lot_number: string | null; product_name: string | null; product_sku: string | null }>();

  if (positionIds.length > 0) {
    const { data: inventory } = await supabase
      .from("inventory")
      .select("position_id, product_id, quantity, lot_number, products(name, sku)")
      .in("position_id", positionIds);

    if (inventory) {
      for (const inv of inventory) {
        const prod = inv.products as unknown as { name: string; sku: string } | null;
        inventoryMap.set(inv.position_id, {
          product_id: inv.product_id,
          quantity: inv.quantity,
          lot_number: inv.lot_number,
          product_name: prod?.name || null,
          product_sku: prod?.sku || null,
        });
      }
    }
  }

  // Map positions to racks
  type PositionRow = {
    id: string;
    rack_id: string;
    row_number: number;
    column_number: number;
    status: string;
  };

  const positionsByRack = new Map<string, PositionRow[]>();
  for (const pos of (positions as unknown as PositionRow[]) || []) {
    if (!positionsByRack.has(pos.rack_id)) {
      positionsByRack.set(pos.rack_id, []);
    }
    positionsByRack.get(pos.rack_id)!.push(pos);
  }

  const result = racks.map(rack => {
    const rackPositions = positionsByRack.get(rack.id) || [];
    return {
      id: rack.id,
      code: rack.code,
      rows: rack.rows,
      columns: rack.columns,
      positions: rackPositions.map(p => {
        const inv = inventoryMap.get(p.id);
        return {
          id: p.id,
          row_number: p.row_number,
          column_number: p.column_number,
          // Map 'empty' to 'available' for the grid
          status: p.status === "empty" ? "available" : p.status,
          product_name: inv?.product_name || null,
          product_sku: inv?.product_sku || null,
          quantity: inv?.quantity || null,
          lot_number: inv?.lot_number || null,
        };
      }),
    };
  });

  return Response.json({ success: true, data: result });
}
