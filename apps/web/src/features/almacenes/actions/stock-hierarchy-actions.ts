"use server";

import { createClient } from "@/lib/supabase/server";
import type { StockHierarchyProduct, PickingSource } from "../types";

const DEMO_ORG_ID = "a0000000-0000-0000-0000-000000000001";

// ── Fetch stock hierarchy (Material → Lot → UA) ─────────────────
export async function fetchStockHierarchy(
  warehouseId?: string
): Promise<StockHierarchyProduct[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("wms_get_stock_hierarchy", {
    p_org_id: DEMO_ORG_ID,
    p_warehouse_id: warehouseId || null,
  });

  if (error) {
    console.error("[fetchStockHierarchy] Error:", error);
    return [];
  }

  return (data as StockHierarchyProduct[]) || [];
}

// ── Fetch picking sources for a product ──────────────────────────
export async function fetchPickingSources(
  warehouseId: string,
  productId: string,
  quantity: number,
  strategy: "fefo" | "fifo" = "fefo"
): Promise<PickingSource[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("wms_get_picking_sources", {
    p_org_id: DEMO_ORG_ID,
    p_warehouse_id: warehouseId,
    p_product_id: productId,
    p_quantity: quantity,
    p_strategy: strategy,
  });

  if (error) {
    console.error("[fetchPickingSources] Error:", error);
    return [];
  }

  return (data as PickingSource[]) || [];
}

// ── Fetch storage units for a specific lot ───────────────────────
export async function fetchStorageUnitsByLot(
  lotId: string
): Promise<
  Array<{
    id: string;
    su_code: string;
    su_type: string;
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    status: string;
    warehouse_name: string;
    rack_code: string;
    row_number: number;
    column_number: number;
    warehouse_id: string;
    position_id: string;
  }>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("storage_units")
    .select(
      `
      id, su_code, su_type, quantity, reserved_quantity, available_quantity, status,
      warehouse_id, position_id,
      warehouses!inner(name),
      rack_positions!inner(
        row_number, column_number,
        racks!inner(code)
      )
    `
    )
    .eq("lot_id", lotId)
    .neq("status", "empty")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[fetchStorageUnitsByLot] Error:", error);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((su: any) => ({
    id: su.id,
    su_code: su.su_code,
    su_type: su.su_type,
    quantity: su.quantity,
    reserved_quantity: su.reserved_quantity,
    available_quantity: su.available_quantity,
    status: su.status,
    warehouse_name: su.warehouses?.name || "",
    rack_code: su.rack_positions?.racks?.code || "",
    row_number: su.rack_positions?.row_number || 0,
    column_number: su.rack_positions?.column_number || 0,
    warehouse_id: su.warehouse_id,
    position_id: su.position_id,
  }));
}

// ── Fetch lot detail with movements ──────────────────────────────
export async function fetchLotDetail(lotId: string) {
  const supabase = await createClient();

  console.log("[fetchLotDetail] Fetching lot:", lotId);

  const { data: lot, error: lotError } = await supabase
    .from("lot_tracking")
    .select(
      `
      *,
      products(name, sku),
      vendors(name)
    `
    )
    .eq("id", lotId)
    .single();

  if (lotError) {
    console.error("[fetchLotDetail] Lot error:", lotError);
    return null;
  }
  if (!lot) {
    console.error("[fetchLotDetail] No lot found for id:", lotId);
    return null;
  }

  console.log("[fetchLotDetail] Got lot:", lot.lot_number, "product_id:", lot.product_id);

  // Get storage units
  const storageUnits = await fetchStorageUnitsByLot(lotId);
  console.log("[fetchLotDetail] Storage units count:", storageUnits.length);

  // Get movements for this lot
  const { data: movements, error: movError } = await supabase
    .from("inventory_movements")
    .select(
      `
      id, movement_type, movement_description, quantity, created_at,
      reference_number, sap_movement_type,
      products(name, sku)
    `
    )
    .eq("product_id", lot.product_id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (movError) {
    console.error("[fetchLotDetail] Movements error:", movError);
  }

  return {
    lot,
    storageUnits,
    movements: movements || [],
  };
}

// ── Fetch warehouse racks for mini 3D preview ────────────────────
export type MiniRackPosition = {
  id: string;
  row_number: number;
  column_number: number;
  status: string;
  su_code: string | null;
  su_type: string | null;
  su_quantity: number | null;
  product_name: string | null;
  product_sku: string | null;
  lot_number: string | null;
};

export type MiniRack = {
  id: string;
  code: string;
  rows: number;
  columns: number;
  rack_positions: MiniRackPosition[];
};

export async function fetchWarehouseRacksForPreview(warehouseId: string): Promise<{
  warehouse: { id: string; name: string; type: string };
  racks: MiniRack[];
}> {
  const supabase = await createClient();

  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("id, name, type")
    .eq("id", warehouseId)
    .single();

  if (!warehouse) return { warehouse: { id: warehouseId, name: "", type: "" }, racks: [] };

  const { data: racks } = await supabase
    .from("racks")
    .select(`
      id, code, rows, columns,
      rack_positions(
        id, row_number, column_number, status,
        storage_units(
          su_code, su_type, quantity,
          lot_tracking(lot_number),
          products(name, sku)
        )
      )
    `)
    .eq("warehouse_id", warehouseId)
    .order("code");

  return {
    warehouse,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    racks: (racks || []).map((r: any) => ({
      id: r.id,
      code: r.code,
      rows: r.rows,
      columns: r.columns,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rack_positions: ((r).rack_positions || []).map((p: any) => {
        // Take the first non-empty storage unit in this position
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const su = (p.storage_units || []).find((s: any) => s.su_code) || null;
        return {
          id: p.id,
          row_number: p.row_number,
          column_number: p.column_number,
          status: p.status,
          su_code: su?.su_code || null,
          su_type: su?.su_type || null,
          su_quantity: su?.quantity || null,
          product_name: su?.products?.name || null,
          product_sku: su?.products?.sku || null,
          lot_number: su?.lot_tracking?.lot_number || null,
        };
      }),
    })),
  };
}

// ── Fetch ALL warehouses with racks for 3D overview ──────────────
export type WarehouseOverview = {
  id: string;
  name: string;
  type: string;
  location: string | null;
  occupancy: number;
  totalPositions: number;
  occupiedPositions: number;
  rackCount: number;
  racks: MiniRack[];
};

export async function fetchAllWarehousesOverview(): Promise<WarehouseOverview[]> {
  const supabase = await createClient();

  // 1. Get all warehouses
  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, name, type, location")
    .eq("org_id", DEMO_ORG_ID)
    .eq("is_active", true)
    .order("name");

  if (!warehouses || warehouses.length === 0) return [];

  // 2. Get ALL racks across all warehouses in one query
  const warehouseIds = warehouses.map(w => w.id);
  const { data: allRacks } = await supabase
    .from("racks")
    .select(`
      id, code, rows, columns, warehouse_id,
      rack_positions(
        id, row_number, column_number, status,
        storage_units(
          su_code, su_type, quantity,
          lot_tracking(lot_number),
          products(name, sku)
        )
      )
    `)
    .in("warehouse_id", warehouseIds)
    .order("code");

  // 3. Index racks by warehouse
  const racksByWarehouse = new Map<string, typeof allRacks>();
  for (const rack of allRacks || []) {
    const wid = rack.warehouse_id as string;
    const existing = racksByWarehouse.get(wid) || [];
    existing.push(rack);
    racksByWarehouse.set(wid, existing);
  }

  // 4. Build overview per warehouse
  return warehouses.map(w => {
    const wRacks = racksByWarehouse.get(w.id) || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappedRacks: MiniRack[] = wRacks.map((r: any) => ({
      id: r.id,
      code: r.code,
      rows: r.rows,
      columns: r.columns,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rack_positions: (r.rack_positions || []).map((p: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const su = (p.storage_units || []).find((s: any) => s.su_code) || null;
        return {
          id: p.id,
          row_number: p.row_number,
          column_number: p.column_number,
          status: p.status,
          su_code: su?.su_code || null,
          su_type: su?.su_type || null,
          su_quantity: su?.quantity || null,
          product_name: su?.products?.name || null,
          product_sku: su?.products?.sku || null,
          lot_number: su?.lot_tracking?.lot_number || null,
        };
      }),
    }));

    let totalPos = 0;
    let occPos = 0;
    for (const rack of mappedRacks) {
      for (const pos of rack.rack_positions) {
        totalPos++;
        if (pos.status === "occupied" || pos.su_code) occPos++;
      }
    }

    return {
      id: w.id,
      name: w.name,
      type: w.type,
      location: w.location,
      occupancy: totalPos > 0 ? Math.round((occPos / totalPos) * 100) : 0,
      totalPositions: totalPos,
      occupiedPositions: occPos,
      rackCount: mappedRacks.length,
      racks: mappedRacks,
    };
  });
}

// ── Fetch count items for a physical count ──────────────────────
export type CountItem = {
  id: string;
  position_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  rack_code: string;
  row_number: number;
  column_number: number;
  system_quantity: number;
  counted_quantity: number | null;
  variance: number | null;
  lot_number: string | null;
  status: string; // 'pending' | 'counted'
  counted_at: string | null;
  notes: string | null;
};

export async function fetchCountItems(countId: string): Promise<CountItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("physical_count_items")
    .select(`
      id, position_id, product_id, system_quantity, counted_quantity,
      variance, lot_number, status, counted_at, notes,
      products!inner(name, sku),
      rack_positions!inner(
        row_number, column_number,
        racks!inner(code)
      )
    `)
    .eq("count_id", countId)
    .order("counted_at", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("[fetchCountItems] Error:", error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => {
    const product = row.products as { name: string; sku: string } | null;
    const rp = row.rack_positions as { row_number: number; column_number: number; racks: { code: string } } | null;
    return {
      id: row.id as string,
      position_id: row.position_id as string,
      product_id: row.product_id as string,
      product_name: product?.name || "Desconocido",
      product_sku: product?.sku || "",
      rack_code: rp?.racks?.code || "?",
      row_number: rp?.row_number || 0,
      column_number: rp?.column_number || 0,
      system_quantity: Number(row.system_quantity) || 0,
      counted_quantity: row.counted_quantity !== null ? Number(row.counted_quantity) : null,
      variance: row.variance !== null ? Number(row.variance) : null,
      lot_number: row.lot_number as string | null,
      status: row.status as string,
      counted_at: row.counted_at as string | null,
      notes: row.notes as string | null,
    };
  });
}

// ── Types for Lots grouped by Material ──────────────────────────
export type LotWithUAs = {
  id: string;
  lot_number: string;
  status: string;
  manufacturing_date: string | null;
  expiry_date: string | null;
  total_quantity: number;
  remaining_quantity: number;
  vendor_name: string | null;
  batch_code: string | null;
  notes: string | null;
  characteristics: Record<string, unknown>;
  storage_units: Array<{
    id: string;
    su_code: string;
    su_type: string;
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    status: string;
    warehouse_name: string;
    rack_code: string;
    row_number: number;
    column_number: number;
  }>;
};

export type MaterialLotGroup = {
  product_id: string;
  product_name: string;
  product_sku: string;
  lots: LotWithUAs[];
  totalStock: number;
  totalUAs: number;
  totalLots: number;
  hasExpiring: boolean;
  hasExpired: boolean;
  nearestExpiry: string | null;
  daysToNearestExpiry: number | null;
};

// ── Fetch lots grouped by material ──────────────────────────────
export async function fetchLotsGroupedByMaterial(): Promise<MaterialLotGroup[]> {
  const supabase = await createClient();

  // Fetch all lots with product info
  const { data: lotsData, error: lotsErr } = await supabase
    .from("lot_tracking")
    .select(`
      id, lot_number, status, manufacturing_date, expiry_date,
      total_quantity, remaining_quantity, batch_code, notes, characteristics,
      product_id,
      products!inner(name, sku),
      vendors(name)
    `)
    .eq("org_id", DEMO_ORG_ID)
    .order("expiry_date", { ascending: true, nullsFirst: false });

  if (lotsErr) {
    console.error("[fetchLotsGroupedByMaterial] lots error:", lotsErr);
    return [];
  }

  // Fetch all storage units with position info
  const { data: susData, error: susErr } = await supabase
    .from("storage_units")
    .select(`
      id, su_code, su_type, quantity, reserved_quantity, available_quantity,
      status, lot_id, warehouse_id,
      warehouses!inner(name),
      rack_positions!inner(
        row_number, column_number,
        racks!inner(code)
      )
    `)
    .eq("org_id", DEMO_ORG_ID)
    .neq("status", "empty");

  if (susErr) {
    console.error("[fetchLotsGroupedByMaterial] SUs error:", susErr);
  }

  // Index SUs by lot_id
  const susByLot = new Map<string, typeof susData>();
  for (const su of susData || []) {
    const lotId = su.lot_id as string;
    const existing = susByLot.get(lotId) || [];
    existing.push(su);
    susByLot.set(lotId, existing);
  }

  // Group lots by product
  const productMap = new Map<string, MaterialLotGroup>();
  const now = Date.now();

  for (const raw of lotsData || []) {
    const product = raw.products as unknown as { name: string; sku: string };
    const vendor = raw.vendors as unknown as { name: string } | null;
    const productId = raw.product_id as string;

    if (!productMap.has(productId)) {
      productMap.set(productId, {
        product_id: productId,
        product_name: product.name,
        product_sku: product.sku,
        lots: [],
        totalStock: 0,
        totalUAs: 0,
        totalLots: 0,
        hasExpiring: false,
        hasExpired: false,
        nearestExpiry: null,
        daysToNearestExpiry: null,
      });
    }

    const group = productMap.get(productId)!;

    // Map storage units for this lot
    const lotSUs = (susByLot.get(raw.id) || []).map((su: Record<string, unknown>) => {
      const wh = su.warehouses as unknown as { name: string };
      const rp = su.rack_positions as unknown as { row_number: number; column_number: number; racks: { code: string } };
      return {
        id: su.id as string,
        su_code: su.su_code as string,
        su_type: su.su_type as string,
        quantity: Number(su.quantity) || 0,
        reserved_quantity: Number(su.reserved_quantity) || 0,
        available_quantity: Number(su.available_quantity) || 0,
        status: su.status as string,
        warehouse_name: wh?.name || "—",
        rack_code: rp?.racks?.code || "?",
        row_number: rp?.row_number || 0,
        column_number: rp?.column_number || 0,
      };
    });

    const lot: LotWithUAs = {
      id: raw.id,
      lot_number: raw.lot_number,
      status: raw.status,
      manufacturing_date: raw.manufacturing_date,
      expiry_date: raw.expiry_date,
      total_quantity: Number(raw.total_quantity) || 0,
      remaining_quantity: Number(raw.remaining_quantity) || 0,
      vendor_name: vendor?.name || null,
      batch_code: raw.batch_code,
      notes: raw.notes,
      characteristics: (raw.characteristics as Record<string, unknown>) || {},
      storage_units: lotSUs,
    };

    group.lots.push(lot);
    group.totalStock += lot.remaining_quantity;
    group.totalUAs += lotSUs.length;
    group.totalLots += 1;

    // Expiry analysis
    if (raw.expiry_date) {
      const days = Math.ceil((new Date(raw.expiry_date).getTime() - now) / 86400000);
      if (days <= 0) group.hasExpired = true;
      if (days > 0 && days <= 30) group.hasExpiring = true;
      if (group.daysToNearestExpiry === null || days < group.daysToNearestExpiry) {
        group.daysToNearestExpiry = days;
        group.nearestExpiry = raw.expiry_date;
      }
    }
  }

  // Sort: materials with expired/expiring first, then alphabetical
  return Array.from(productMap.values()).sort((a, b) => {
    if (a.hasExpired && !b.hasExpired) return -1;
    if (!a.hasExpired && b.hasExpired) return 1;
    if (a.hasExpiring && !b.hasExpiring) return -1;
    if (!a.hasExpiring && b.hasExpiring) return 1;
    return a.product_name.localeCompare(b.product_name);
  });
}
