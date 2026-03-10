import { createClient } from "@/lib/supabase/server";
import { WarehouseDetail } from "@/features/almacenes/components/warehouse-detail";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("name")
    .eq("id", id)
    .single();

  return { title: warehouse?.name || "Almacén" };
}

export default async function WarehouseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch warehouse
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("*")
    .eq("id", id)
    .single();

  if (!warehouse) notFound();

  // Fetch racks with positions
  const { data: racks } = await supabase
    .from("racks")
    .select("*, rack_positions(*)")
    .eq("warehouse_id", id)
    .order("code");

  // Fetch inventory for this warehouse's positions (batched to avoid URL length limits)
  const positionIds = (racks || []).flatMap((r) =>
    (r.rack_positions || []).map((p: { id: string }) => p.id)
  );

  const BATCH_SIZE = 500;
  const inventoryResults = [];
  for (let i = 0; i < positionIds.length; i += BATCH_SIZE) {
    const batch = positionIds.slice(i, i + BATCH_SIZE);
    const { data } = await supabase
      .from("inventory")
      .select("*, products(sku, name, category, unit_of_measure, image_url)")
      .in("position_id", batch);
    if (data) inventoryResults.push(...data);
  }
  const inventory = inventoryResults;

  // Build position map with inventory data
  const inventoryMap = new Map(
    inventory.map((inv) => [inv.position_id, inv])
  );

  // Enrich racks with inventory data
  const enrichedRacks = (racks || []).map((rack) => ({
    ...rack,
    rack_positions: (rack.rack_positions || []).map((pos: {
      id: string;
      row_number: number;
      column_number: number;
      status: string;
      max_weight: number;
    }) => {
      const inv = inventoryMap.get(pos.id);
      return {
        ...pos,
        inventory: inv
          ? {
              id: inv.id,
              product_name: inv.products?.name || "—",
              product_sku: inv.products?.sku || "—",
              category: inv.products?.category || "—",
              image_url: inv.products?.image_url || null,
              lot_number: inv.lot_number,
              batch_code: inv.batch_code,
              quantity: inv.quantity,
              entry_date: inv.entry_date,
              expiry_date: inv.expiry_date,
              supplier: inv.supplier,
              status: inv.status,
            }
          : null,
      };
    }),
  }));

  // Calculate stats
  const totalPositions = enrichedRacks.reduce(
    (sum, r) => sum + r.rack_positions.length,
    0
  );
  const occupiedPositions = enrichedRacks.reduce(
    (sum, r) =>
      sum +
      r.rack_positions.filter(
        (p: { status: string }) => p.status === "occupied"
      ).length,
    0
  );
  const expiredCount = (inventory || []).filter(
    (i) => i.status === "expired"
  ).length;
  const expiringCount = (inventory || []).filter((i) => {
    if (!i.expiry_date) return false;
    const daysUntil =
      (new Date(i.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntil > 0 && daysUntil <= 30;
  }).length;

  return (
    <WarehouseDetail
      warehouse={warehouse}
      racks={enrichedRacks}
      stats={{
        totalRacks: enrichedRacks.length,
        totalPositions,
        occupiedPositions,
        occupancy: totalPositions > 0 ? Math.round((occupiedPositions / totalPositions) * 100) : 0,
        expiredCount,
        expiringCount,
        productsCount: (inventory || []).length,
      }}
    />
  );
}
