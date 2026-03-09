// Compras & Aprovisionamiento module types — SAP MM equivalent

export type PurchaseOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "partially_received"
  | "received"
  | "invoiced"
  | "closed"
  | "cancelled";

export type PRStatus = "draft" | "submitted" | "approved" | "rejected" | "converted";

export type POPriority = "low" | "medium" | "high" | "urgent";

export type VendorCategory =
  | "materia_prima"
  | "quimicos"
  | "embalaje"
  | "repuestos"
  | "electricos"
  | "sellantes"
  | "servicios";

export type GoodsReceiptStatus = "pending" | "inspecting" | "accepted" | "partial" | "rejected";

export type Vendor = {
  id: string;
  org_id: string;
  code: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  category: VendorCategory | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  country: string;
  payment_terms: number;
  rating: number;
  compliance_score: number;
  quality_score: number;
  avg_lead_time_days: number;
  is_active: boolean;
  sap_vendor_code: string | null;
  logo_url: string | null;
  website: string | null;
  bank_account: string | null;
  notes: string | null;
  created_at: string;
};

export type PurchaseOrder = {
  id: string;
  org_id: string;
  po_number: string;
  vendor_id: string;
  requester_id: string;
  approver_id: string | null;
  status: PurchaseOrderStatus;
  order_date: string | null;
  expected_delivery: string | null;
  actual_delivery: string | null;
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  currency: string;
  warehouse_id: string | null;
  notes: string | null;
  sap_po_number: string | null;
  priority: POPriority;
  approved_at: string | null;
  sent_at: string | null;
  created_at: string;
  // Joined fields
  vendor?: Vendor;
  items?: PurchaseOrderItem[];
  requester?: { id: string; full_name: string; avatar_url: string | null };
  approver?: { id: string; full_name: string; avatar_url: string | null } | null;
};

export type PurchaseOrderItem = {
  id: string;
  po_id: string;
  item_number: number;
  material_code: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number | null;
  received_quantity: number;
  warehouse_id: string | null;
  rack_code: string | null;
  sap_material_number: string | null;
  created_at: string;
};

export type PurchaseRequisition = {
  id: string;
  org_id: string;
  pr_number: string;
  requester_id: string;
  department: string | null;
  status: PRStatus;
  priority: POPriority;
  description: string;
  justification: string | null;
  estimated_amount: number | null;
  po_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  // Joined
  requester?: { id: string; full_name: string; avatar_url: string | null };
  items?: PurchaseRequisitionItem[];
};

export type PurchaseRequisitionItem = {
  id: string;
  pr_id: string;
  item_number: number;
  material_code: string | null;
  description: string;
  quantity: number;
  unit: string;
  estimated_unit_price: number | null;
  estimated_total: number | null;
};

export type GoodsReceipt = {
  id: string;
  org_id: string;
  receipt_number: string;
  po_id: string;
  receiver_id: string;
  warehouse_id: string;
  receipt_date: string;
  status: GoodsReceiptStatus;
  quality_check: boolean;
  notes: string | null;
  sap_document_id: string | null;
  created_at: string;
  // Joined
  purchase_order?: PurchaseOrder;
  receiver?: { id: string; full_name: string };
};

export type GoodsReceiptItem = {
  id: string;
  receipt_id: string;
  po_item_id: string | null;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  rejection_reason: string | null;
  rack_code: string | null;
};

// Pipeline stages for the visual pipeline
export type PipelineStage = {
  id: PurchaseOrderStatus;
  label: string;
  count: number;
  total: number;
  color: string;
  icon: string;
};

// KPIs for the dashboard
export type ComprasKPIs = {
  openOrders: number;
  pendingApproval: number;
  inTransit: number;
  receivedToday: number;
  totalMonthAmount: number;
  totalMonthOrders: number;
};

// Vendor scorecard
export type VendorScorecard = {
  vendor: Vendor;
  totalOrders: number;
  totalAmount: number;
  avgDeliveryDays: number;
  onTimePercentage: number;
  lastOrderDate: string | null;
};

// Category label map
export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  materia_prima: "Materia Prima",
  quimicos: "Químicos",
  embalaje: "Embalaje",
  repuestos: "Repuestos",
  electricos: "Eléctricos",
  sellantes: "Sellantes",
  servicios: "Servicios",
};

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Borrador",
  pending_approval: "Pend. Aprobación",
  approved: "Aprobada",
  sent: "Enviada",
  partially_received: "Parcial",
  received: "Recibida",
  invoiced: "Facturada",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

export const PO_STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  draft: "#6B7280",
  pending_approval: "#F59E0B",
  approved: "#3B82F6",
  sent: "#8B5CF6",
  partially_received: "#F97316",
  received: "#10B981",
  invoiced: "#06B6D4",
  closed: "#6B7280",
  cancelled: "#EF4444",
};

export const PR_STATUS_LABELS: Record<PRStatus, string> = {
  draft: "Borrador",
  submitted: "Enviada",
  approved: "Aprobada",
  rejected: "Rechazada",
  converted: "Convertida en OC",
};

export const PRIORITY_LABELS: Record<POPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const PRIORITY_COLORS: Record<POPriority, string> = {
  low: "#6B7280",
  medium: "#3B82F6",
  high: "#F97316",
  urgent: "#EF4444",
};
