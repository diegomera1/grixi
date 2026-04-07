import { createClient } from "@/lib/supabase/server";
import { WarehousesContent } from "@/features/almacenes/components/warehouses-content";
import { fetchPhysicalCounts } from "@/features/almacenes/actions/wms-queries";
import type {
  WarehouseData,
  SalesOrderRow,
  GoodsReceiptRow,
  GoodsIssueRow,
  TransferOrderRow,
  InventoryMovementRow,
  WmsAiInsight,
  WmsDashboardKpis,
  LotTrackingRow,
  ExpiringLotSummary,
} from "@/features/almacenes/types";

export const metadata = {
  title: "Almacenes — WMS",
  description: "Warehouse Management System — Gestión integral de almacenes",
};

// Demo org_id (consistent with otras páginas de GRIXI)
const DEMO_ORG_ID = "a0000000-0000-0000-0000-000000000001";
const EXPIRY_THRESHOLD_DAYS = 30;

function getExpiryThreshold() {
  const d = new Date();
  d.setDate(d.getDate() + EXPIRY_THRESHOLD_DAYS);
  return d.toISOString().split("T")[0];
}

export default async function WarehousesPage() {
  const supabase = await createClient();
  const expiryThreshold = getExpiryThreshold();

  // ── Parallel data fetching ────────────────────
  const [
    { data: warehouses },
    { data: racks },
    { data: positions },
    { data: salesOrders },
    { data: goodsReceipts },
    { data: goodsIssues },
    { data: transfers },
    { data: movements },
    { data: insights },
    { data: lotCounts },
    { data: productCount },
    { data: productsList },
    { data: lotData },
  ] = await Promise.all([
    supabase.from("warehouses").select("*").eq("org_id", DEMO_ORG_ID).order("name"),
    supabase.from("racks").select("id, warehouse_id"),
    supabase.from("rack_positions").select("rack_id, status"),
    // Sales orders with warehouse name
    supabase
      .from("sales_orders")
      .select("*, warehouses(name), sales_order_items(id)")
      .eq("org_id", DEMO_ORG_ID)
      .order("created_at", { ascending: false })
      .limit(50),
    // Goods receipts with PO (via po_id FK) and warehouse
    supabase
      .from("goods_receipts")
      .select("*, purchase_orders!goods_receipts_po_id_fkey(po_number), warehouses!goods_receipts_warehouse_id_fkey(name)")
      .eq("org_id", DEMO_ORG_ID)
      .order("created_at", { ascending: false })
      .limit(50),
    // Goods issues with warehouse
    supabase
      .from("goods_issues")
      .select("*, warehouses(name)")
      .eq("org_id", DEMO_ORG_ID)
      .order("created_at", { ascending: false })
      .limit(50),
    // Transfer orders with warehouse names
    supabase
      .from("transfer_orders")
      .select("*, from_wh:warehouses!transfer_orders_from_warehouse_id_fkey(name), to_wh:warehouses!transfer_orders_to_warehouse_id_fkey(name)")
      .eq("org_id", DEMO_ORG_ID)
      .order("created_at", { ascending: false })
      .limit(50),
    // Inventory movements via RPC (multi-table join not supported via PostgREST)
    supabase.rpc("wms_get_movements", { p_org_id: DEMO_ORG_ID, p_limit: 100 }),
    // AI Insights
    supabase
      .from("wms_ai_insights")
      .select("*, warehouses(name)")
      .eq("org_id", DEMO_ORG_ID)
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(10),
    // Lot expiry count
    supabase
      .from("lot_tracking")
      .select("id", { count: "exact" })
      .eq("org_id", DEMO_ORG_ID)
      .eq("status", "active")
      .lte("expiry_date", expiryThreshold),
    // Total products (count)
    supabase.from("products").select("id", { count: "exact" }).eq("org_id", DEMO_ORG_ID),
    // Products list for operation modals
    supabase.from("products").select("id, name, sku").eq("org_id", DEMO_ORG_ID).order("name").limit(100),
    // Lots with product and vendor info
    supabase
      .from("lot_tracking")
      .select("*, products(name, sku), vendors(name)")
      .eq("org_id", DEMO_ORG_ID)
      .order("expiry_date", { ascending: true })
      .limit(200),
  ]);

  // ── Fetch physical counts (via server action) ──
  const physicalCounts = await fetchPhysicalCounts();

  // ── Build warehouse stats ─────────────────────
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

  const enrichedWarehouses: WarehouseData[] = (warehouses || []).map((w) => {
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

  // ── Build warehouse name lookup ────────────────
  const warehouseNames = new Map<string, string>();
  for (const w of warehouses || []) {
    warehouseNames.set(w.id, w.name);
  }

  // ── Map sales orders ──────────────────────────
  const enrichedSalesOrders: SalesOrderRow[] = (salesOrders || []).map((so) => ({
    id: so.id,
    so_number: so.so_number,
    customer_name: so.customer_name,
    customer_code: so.customer_code,
    status: so.status,
    warehouse_id: so.warehouse_id,
    requested_delivery_date: so.requested_delivery_date,
    subtotal: so.subtotal || 0,
    tax: so.tax || 0,
    total: so.total || 0,
    currency: so.currency || "USD",
    priority: so.priority || "medium",
    shipping_address: so.shipping_address || null,
    sap_so_number: so.sap_so_number,
    sap_delivery_number: so.sap_delivery_number || null,
    notes: so.notes || null,
    confirmed_at: so.confirmed_at || null,
    shipped_at: so.shipped_at || null,
    created_at: so.created_at,
    items_count: Array.isArray((so as unknown as { sales_order_items: unknown[] }).sales_order_items) ? (so as unknown as { sales_order_items: unknown[] }).sales_order_items.length : 0,
    warehouse_name: (so as unknown as { warehouses: { name: string } | null }).warehouses?.name || undefined,
  }));

  // ── Map goods receipts ────────────────────────
  const enrichedGoodsReceipts: GoodsReceiptRow[] = (goodsReceipts || []).map((gr) => ({
    id: gr.id,
    receipt_number: gr.receipt_number,
    status: gr.status,
    warehouse_id: gr.warehouse_id,
    movement_type: gr.movement_type,
    sap_document_id: gr.sap_document_id,
    created_at: gr.created_at,
    po_number: (gr as unknown as { purchase_orders: { po_number: string } | null }).purchase_orders?.po_number || undefined,
    warehouse_name: (gr as unknown as { warehouses: { name: string } | null }).warehouses?.name || undefined,
  }));

  // ── Map goods issues ──────────────────────────
  // Build SO number lookup for reference_so resolution
  const soNumberLookup = new Map<string, string>();
  for (const so of salesOrders || []) {
    soNumberLookup.set(so.id, so.so_number);
  }

  const enrichedGoodsIssues: GoodsIssueRow[] = (goodsIssues || []).map((gi) => ({
    id: gi.id,
    issue_number: gi.issue_number,
    issue_type: gi.issue_type,
    status: gi.status,
    warehouse_id: gi.warehouse_id,
    movement_type: gi.movement_type,
    sap_document_id: gi.sap_document_id,
    created_at: gi.created_at,
    reference_so: gi.reference_id ? soNumberLookup.get(gi.reference_id) : undefined,
    warehouse_name: (gi as unknown as { warehouses: { name: string } | null }).warehouses?.name || undefined,
  }));

  // ── Map transfers ─────────────────────────────
  const enrichedTransfers: TransferOrderRow[] = (transfers || []).map((t) => ({
    id: t.id,
    transfer_number: t.transfer_number,
    transfer_type: t.transfer_type,
    from_warehouse_id: t.from_warehouse_id,
    to_warehouse_id: t.to_warehouse_id,
    status: t.status,
    movement_type: t.movement_type,
    priority: t.priority || "medium",
    reason: t.reason,
    created_at: t.created_at,
    from_warehouse_name: (t as unknown as { from_wh: { name: string } | null }).from_wh?.name || undefined,
    to_warehouse_name: (t as unknown as { to_wh: { name: string } | null }).to_wh?.name || undefined,
  }));

  // ── Map movements (flat from RPC) ──────────────
  const enrichedMovements: InventoryMovementRow[] = (movements || []).map((m: InventoryMovementRow) => ({
    id: m.id,
    movement_type: m.movement_type,
    movement_description: m.movement_description || null,
    quantity: m.quantity,
    product_name: m.product_name || "Producto desconocido",
    product_sku: m.product_sku || "—",
    warehouse_name: m.warehouse_name || "Desconocido",
    rack_code: m.rack_code || null,
    sap_movement_type: m.sap_movement_type,
    reference_type: m.reference_type,
    sap_document_id: m.sap_document_id,
    lot_number: m.lot_number,
    storage_unit_id: m.storage_unit_id || null,
    created_at: m.created_at,
  }));

  // ── Map insights ──────────────────────────────
  const enrichedInsights: WmsAiInsight[] = (insights || []).map((i) => ({
    id: i.id,
    insight_type: i.insight_type,
    severity: i.severity,
    title: i.title,
    message: i.message,
    data: (i.data as Record<string, unknown>) || {},
    action: (i.action as Record<string, unknown>) || {},
    is_dismissed: i.is_dismissed,
    warehouse_name: (i as unknown as { warehouses: { name: string } | null }).warehouses?.name || undefined,
    created_at: i.created_at,
  }));

  // ── Dashboard KPIs ────────────────────────────
  const totalPositions = enrichedWarehouses.reduce((s, w) => s + w.totalPositions, 0);
  const totalOccupied = enrichedWarehouses.reduce((s, w) => s + w.occupiedPositions, 0);
  const today = new Date().toISOString().split("T")[0];

  const dashboardKpis: WmsDashboardKpis = {
    totalWarehouses: enrichedWarehouses.length,
    totalPositions,
    occupiedPositions: totalOccupied,
    avgOccupancy: totalPositions > 0 ? Math.round((totalOccupied / totalPositions) * 100) : 0,
    todayReceipts: (goodsReceipts || []).filter((gr) => gr.created_at?.startsWith(today)).length,
    todayIssues: (goodsIssues || []).filter((gi) => gi.created_at?.startsWith(today)).length,
    pendingOrders: (salesOrders || []).filter((so) => so.status === "pending" || so.status === "confirmed").length,
    pendingTransfers: (transfers || []).filter((t) => t.status === "pending").length,
    criticalWarehouses: enrichedWarehouses.filter((w) => w.occupancy > 90).length,
    totalProducts: productCount?.length || 0,
    expiringLots: lotCounts?.length || 0,
  };

  // ── Top 5 Expiring Lots (for dashboard widget) ──
  const nowDate = new Date();
  const expiringLotsList: ExpiringLotSummary[] = (lotData || [])
    .filter((l: Record<string, unknown>) => {
      if (!l.expiry_date || l.status !== 'active') return false;
      const exp = new Date(l.expiry_date as string);
      return exp > nowDate;
    })
    .slice(0, 5)
    .map((l: Record<string, unknown>) => {
      const expDate = new Date(l.expiry_date as string);
      return {
        lot_number: l.lot_number as string,
        product_name: ((l as Record<string, unknown>).products as { name: string } | null)?.name || 'Desconocido',
        expiry_date: l.expiry_date as string,
        days_left: Math.ceil((expDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24)),
        remaining_quantity: Number(l.remaining_quantity) || 0,
      };
    });

  return (
    <WarehousesContent
      warehouses={enrichedWarehouses}
      salesOrders={enrichedSalesOrders}
      goodsReceipts={enrichedGoodsReceipts}
      goodsIssues={enrichedGoodsIssues}
      transfers={enrichedTransfers}
      movements={enrichedMovements}
      insights={enrichedInsights}
      dashboardKpis={dashboardKpis}
      products={(productsList || []).map(p => ({ id: p.id, name: p.name, sku: p.sku }))}
      lots={(lotData || []).map((l: Record<string, unknown>) => ({
        id: l.id as string,
        lot_number: l.lot_number as string,
        product_name: ((l as Record<string, unknown>).products as { name: string } | null)?.name || 'Desconocido',
        product_sku: ((l as Record<string, unknown>).products as { sku: string } | null)?.sku || '—',
        batch_code: l.batch_code as string | null,
        manufacturing_date: l.manufacturing_date as string | null,
        expiry_date: l.expiry_date as string | null,
        status: l.status as string,
        characteristics: (l.characteristics as Record<string, unknown>) || {},
        vendor_name: ((l as Record<string, unknown>).vendors as { name: string } | null)?.name || null,
        total_quantity: Number(l.total_quantity) || 0,
        remaining_quantity: Number(l.remaining_quantity) || 0,
        created_at: l.created_at as string,
      } as LotTrackingRow))}
      physicalCounts={physicalCounts}
      expiringLotsList={expiringLotsList}
    />
  );
}
