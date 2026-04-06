// ── WMS Module Types ────────────────────────────────────────

export type WmsTab =
  | "dashboard"
  | "almacenes"
  | "operaciones"
  | "pedidos"
  | "lotes"
  | "conteos"
  | "inventario"
  | "movimientos"
  | "analisis";

export type WarehouseData = {
  id: string;
  name: string;
  type: string;
  location: string | null;
  is_active: boolean;
  sap_plant_code: string | null;
  sap_storage_location: string | null;
  address: string | null;
  manager_name: string | null;
  rackCount: number;
  totalPositions: number;
  occupiedPositions: number;
  occupancy: number;
};

export type SalesOrderRow = {
  id: string;
  so_number: string;
  customer_name: string;
  customer_code: string | null;
  status: string;
  warehouse_id: string | null;
  requested_delivery_date: string | null;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  priority: string;
  shipping_address: string | null;
  sap_so_number: string | null;
  sap_delivery_number: string | null;
  notes: string | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  created_at: string;
  items_count?: number;
  warehouse_name?: string;
  // Linked GIs
  goods_issues?: { id: string; issue_number: string; status: string; posted_at: string | null }[];
  // Items detail
  items?: SalesOrderItemRow[];
};

export type SalesOrderItemRow = {
  id: string;
  item_number: number;
  product_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  quantity_picked: number;
  quantity_shipped: number;
};

export type GoodsReceiptRow = {
  id: string;
  receipt_number: string;
  status: string;
  warehouse_id: string;
  movement_type: string | null;
  sap_document_id: string | null;
  created_at: string;
  po_number?: string;
  warehouse_name?: string;
  items_count?: number;
};

export type GoodsIssueRow = {
  id: string;
  issue_number: string;
  issue_type: string;
  status: string;
  warehouse_id: string;
  movement_type: string | null;
  sap_document_id: string | null;
  created_at: string;
  reference_so?: string;
  warehouse_name?: string;
  items_count?: number;
};

export type TransferOrderRow = {
  id: string;
  transfer_number: string;
  transfer_type: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: string;
  movement_type: string | null;
  priority: string;
  reason: string | null;
  created_at: string;
  from_warehouse_name?: string;
  to_warehouse_name?: string;
  items_count?: number;
};

export type InventoryMovementRow = {
  id: string;
  movement_type: string;
  movement_description: string | null;
  quantity: number;
  product_name: string;
  product_sku: string;
  warehouse_name: string;
  rack_code: string | null;
  sap_movement_type: string | null;
  reference_type: string | null;
  sap_document_id: string | null;
  lot_number: string | null;
  storage_unit_id: string | null;
  created_at: string;
  performed_by_name?: string;
};

export type WmsAiInsight = {
  id: string;
  insight_type: string;
  severity: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  action: Record<string, unknown>;
  is_dismissed: boolean;
  warehouse_name?: string;
  created_at: string;
};

export type WmsDashboardKpis = {
  totalWarehouses: number;
  totalPositions: number;
  occupiedPositions: number;
  avgOccupancy: number;
  todayReceipts: number;
  todayIssues: number;
  pendingOrders: number;
  pendingTransfers: number;
  criticalWarehouses: number;
  totalProducts: number;
  expiringLots: number;
};

export type ExpiringLotSummary = {
  lot_number: string;
  product_name: string;
  expiry_date: string;
  days_left: number;
  remaining_quantity: number;
};

export type LotTrackingRow = {
  id: string;
  lot_number: string;
  product_name: string;
  product_sku: string;
  batch_code: string | null;
  manufacturing_date: string | null;
  expiry_date: string | null;
  status: string;
  characteristics: Record<string, unknown>;
  vendor_name: string | null;
  total_quantity: number;
  remaining_quantity: number;
  created_at: string;
};

// ── Goods Receipt Wizard Types ────────────────────────
export type PurchaseOrderForGR = {
  id: string;
  po_number: string;
  sap_po_number: string | null;
  status: string;
  priority: string;
  total: number;
  expected_delivery: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  vendor_name: string | null;
  item_count: number;
  items: POItemForGR[];
};

export type POItemForGR = {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
};

export type PutawaySuggestion = {
  position_id: string;
  rack_id: string;
  rack_code: string;
  row_number: number;
  column_number: number;
  position_label: string;
  score: number;
  reason: string;
};

// ── Goods Issue Wizard Types ─────────────────────────
export type SalesOrderForGI = {
  id: string;
  so_number: string;
  sap_so_number: string | null;
  status: string;
  priority: string;
  total: number;
  requested_delivery_date: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  customer_name: string;
  customer_code: string | null;
  item_count: number;
  items: SOItemForGI[];
};

export type SOItemForGI = {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity_ordered: number;
  quantity_picked: number;
  quantity_shipped: number;
  unit: string;
  unit_price: number;
};

// ── Storage Unit Types ───────────────────────────────
export type StorageUnitType = 'palet' | 'tina' | 'caja' | 'contenedor';

export type StorageUnitStatus =
  | 'available'
  | 'reserved'
  | 'picking'
  | 'picked'
  | 'in_transit'
  | 'empty';

export type StorageUnit = {
  id: string;
  su_code: string;
  su_type: StorageUnitType;
  warehouse_id: string;
  warehouse_name?: string;
  position_id: string;
  rack_code?: string;
  row_number?: number;
  column_number?: number;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  lot_id: string;
  lot_number?: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  status: StorageUnitStatus;
  max_weight_kg: number | null;
  current_weight_kg: number;
  created_at: string;
};

export type StorageUnitReservation = {
  id: string;
  storage_unit_id: string;
  reference_type: 'goods_issue' | 'transfer_order' | 'sales_order';
  reference_id: string;
  quantity_reserved: number;
  status: 'reserved' | 'picking' | 'picked' | 'released' | 'cancelled';
  reserved_at: string;
  picked_at: string | null;
};

// ── Stock Hierarchy Types (Material → Lot → UA) ─────
export type StockHierarchyProduct = {
  product_id: string;
  product_name: string;
  product_sku: string;
  total_stock: number;
  total_reserved: number;
  total_available: number;
  lot_count: number;
  su_count: number;
  warehouse_count: number;
  lots: StockHierarchyLot[];
};

export type StockHierarchyLot = {
  lot_id: string;
  lot_number: string;
  expiry_date: string | null;
  manufacturing_date: string | null;
  status: string;
  total_quantity: number;
  remaining_quantity: number;
  vendor_name: string | null;
  storage_units: StockHierarchySU[];
};

export type StockHierarchySU = {
  su_id: string;
  su_code: string;
  su_type: StorageUnitType;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  status: StorageUnitStatus;
  warehouse_id: string;
  warehouse_name: string;
  position_id: string;
  rack_code: string;
  row_number: number;
  column_number: number;
};

// ── Picking Source (AI Proposal) ─────────────────────
export type PickingSource = {
  su_id: string;
  su_code: string;
  su_type: StorageUnitType;
  lot_id: string;
  lot_number: string;
  expiry_date: string | null;
  available: number;
  suggested_qty: number;
  rack_code: string;
  row_number: number;
  column_number: number;
  warehouse_name: string;
  reason: string;
};

// ── Movement Description Map ─────────────────────────
export const MOVEMENT_DESCRIPTIONS: Record<string, string> = {
  '101': 'Entrada de mercancía',
  '102': 'Anulación de entrada',
  '201': 'Salida por centro de costo',
  '261': 'Salida por pedido de venta',
  '262': 'Anulación de salida',
  '301': 'Traspaso entre almacenes',
  '311': 'Traspaso interno',
  '551': 'Salida por merma',
};

export const SU_TYPE_LABELS: Record<StorageUnitType, string> = {
  palet: 'Palet',
  tina: 'Tina',
  caja: 'Caja',
  contenedor: 'Contenedor',
};

export const SU_STATUS_LABELS: Record<StorageUnitStatus, string> = {
  available: 'Disponible',
  reserved: 'Reservada',
  picking: 'En Picking',
  picked: 'Recogida',
  in_transit: 'En Tránsito',
  empty: 'Vacía',
};

export const SU_STATUS_COLORS: Record<StorageUnitStatus, string> = {
  available: 'text-emerald-400',
  reserved: 'text-amber-400',
  picking: 'text-blue-400',
  picked: 'text-purple-400',
  in_transit: 'text-cyan-400',
  empty: 'text-zinc-500',
};

// ── Goods Issue Types (expanded) ─────────────────────
export type GoodsIssueType = 'sales_order' | 'cost_center' | 'scrap';

export const ISSUE_TYPE_LABELS: Record<GoodsIssueType, string> = {
  sales_order: 'Pedido de venta',
  cost_center: 'Centro de costo',
  scrap: 'Merma / Scrap',
};

// ── Operation Profile Types ──────────────────────────
export type OperationProfileItem = {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  quantity_rejected?: number;
  lot_number: string | null;
  su_code: string | null;
  su_type: StorageUnitType | null;
  position_label: string | null;
  rack_code: string | null;
};

export type OperationProfile = {
  id: string;
  type: 'gr' | 'gi' | 'to';
  doc_number: string;
  status: string;
  description: string;
  warehouse_id: string;
  warehouse_name: string;
  reference_doc: string | null;
  counterpart: string | null;
  created_at: string;
  posted_at: string | null;
  items: OperationProfileItem[];
  movements: InventoryMovementRow[];
  position_ids: string[];
  // GR-specific
  delivery_note?: string | null;
  carrier?: string | null;
  // TO-specific
  from_warehouse_name?: string;
  to_warehouse_name?: string;
  transfer_type?: string;
  reason?: string | null;
  priority?: string;
};

// ── Picking Line (GI Wizard) ─────────────────────────
export type PickingLine = {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity_needed: number;
  sources: PickingSource[];
};

// ── Transfer Item with UA ────────────────────────────
export type TransferItemWithUA = {
  su_id: string;
  su_code: string;
  su_type: StorageUnitType;
  product_id: string;
  product_name: string;
  product_sku: string;
  lot_id: string;
  lot_number: string;
  quantity: number;
  from_position_label: string;
  to_position_label: string | null;
  to_position_id: string | null;
};
