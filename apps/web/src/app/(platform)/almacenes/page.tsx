import { createClient } from "@/lib/supabase/server";
import { WarehousesContent } from "@/features/almacenes/components/warehouses-content";

export const metadata = {
  title: "Almacenes",
};

export default async function WarehousesPage() {
  const supabase = await createClient();

  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("*")
    .order("name");

  // Get rack counts and position stats per warehouse
  const warehouseIds = (warehouses || []).map((w) => w.id);

  const { data: racks } = await supabase
    .from("racks")
    .select("id, warehouse_id")
    .in("warehouse_id", warehouseIds);

  const { data: positions } = await supabase
    .from("rack_positions")
    .select("rack_id, status");

  // Build stats
  const racksByWarehouse = new Map<string, string[]>();
  for (const rack of racks || []) {
    if (!racksByWarehouse.has(rack.warehouse_id)) {
      racksByWarehouse.set(rack.warehouse_id, []);
    }
    racksByWarehouse.get(rack.warehouse_id)!.push(rack.id);
  }

  const positionsByRack = new Map<string, { total: number; occupied: number }>();
  for (const pos of positions || []) {
    if (!positionsByRack.has(pos.rack_id)) {
      positionsByRack.set(pos.rack_id, { total: 0, occupied: 0 });
    }
    const stats = positionsByRack.get(pos.rack_id)!;
    stats.total++;
    if (pos.status === "occupied") stats.occupied++;
  }

  const enrichedWarehouses = (warehouses || []).map((w) => {
    const warehouseRackIds = racksByWarehouse.get(w.id) || [];
    let totalPositions = 0;
    let occupiedPositions = 0;
    for (const rackId of warehouseRackIds) {
      const stats = positionsByRack.get(rackId);
      if (stats) {
        totalPositions += stats.total;
        occupiedPositions += stats.occupied;
      }
    }
    return {
      ...w,
      rackCount: warehouseRackIds.length,
      totalPositions,
      occupiedPositions,
      occupancy: totalPositions > 0 ? Math.round((occupiedPositions / totalPositions) * 100) : 0,
    };
  });

  return <WarehousesContent warehouses={enrichedWarehouses} />;
}
