// Ventas / CRM module types

// ═══════════════════════════════════════════════════════
// Union Types
// ═══════════════════════════════════════════════════════

export type CustomerSegment =
  | "champion"
  | "loyal"
  | "at_risk"
  | "dormant"
  | "prospect"
  | "new";

export type CustomerStatus = "active" | "inactive" | "prospect" | "blocked";

export type CompanySize = "micro" | "small" | "medium" | "large" | "enterprise";

export type ContactRole =
  | "decision_maker"
  | "technical"
  | "purchasing"
  | "billing"
  | "logistics"
  | "other";

export type OpportunitySource =
  | "referral"
  | "website"
  | "cold_call"
  | "event"
  | "inbound"
  | "partner"
  | "other";

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "rejected"
  | "expired"
  | "converted";

export type InvoiceStatus =
  | "draft"
  | "confirmed"
  | "invoiced"
  | "paid"
  | "partially_paid"
  | "overdue"
  | "cancelled";

export type PaymentMethod = "transfer" | "cash" | "credit" | "check" | "card";

export type ActivityType =
  | "call"
  | "email"
  | "meeting"
  | "note"
  | "visit"
  | "follow_up"
  | "demo"
  | "proposal";

export type AlertType =
  | "inactive_customer"
  | "quote_expiring"
  | "deal_stalled"
  | "payment_overdue"
  | "target_at_risk"
  | "new_opportunity"
  | "upsell";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type DemoRole = "seller" | "supervisor" | "manager" | "admin";

// ═══════════════════════════════════════════════════════
// Entity Types
// ═══════════════════════════════════════════════════════

export type SalesCustomer = {
  id: string;
  org_id: string;
  code: string;
  business_name: string;
  trade_name: string | null;
  tax_id: string | null;
  segment: CustomerSegment;
  sector: string | null;
  company_size: CompanySize | null;
  address: string | null;
  city: string | null;
  country: string;
  province: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  assigned_seller_id: string | null;
  payment_terms: number;
  credit_limit: number;
  credit_used: number;
  preferred_currency: string;
  status: CustomerStatus;
  health_score: number;
  notes: string | null;
  sap_customer_code: string | null;
  last_purchase_at: string | null;
  total_revenue: number;
  total_orders: number;
  founded_year: number | null;
  employee_count: number | null;
  industry_code: string | null;
  annual_revenue_usd: number;
  nps_score: number;
  churn_risk: 'low' | 'medium' | 'high' | 'critical';
  last_contact_date: string | null;
  primary_product_line: string | null;
  avg_order_value: number;
  retention_rate: number;
  first_purchase_date: string | null;
  lifetime_value: number;
  yoy_growth_pct: number;
  payment_avg_days: number;
  on_time_payment_pct: number;
  top_categories: string[];
  contract_type: string;
  contract_end_date: string | null;
  satisfaction_rating: number;
  created_at: string;
  // Joined fields
  assigned_seller?: { id: string; full_name: string; avatar_url: string | null };
  contacts?: SalesContact[];
};

export type SalesContact = {
  id: string;
  org_id: string;
  customer_id: string;
  full_name: string;
  role: ContactRole | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
};

export type SalesPipelineStage = {
  id: string;
  org_id: string;
  name: string;
  code: string;
  color: string;
  position: number;
  default_probability: number;
  is_won: boolean;
  is_lost: boolean;
  is_active: boolean;
  created_at: string;
};

export type SalesOpportunity = {
  id: string;
  org_id: string;
  name: string;
  customer_id: string;
  contact_id: string | null;
  stage_id: string;
  amount: number;
  probability: number;
  currency: string;
  expected_close_date: string | null;
  actual_close_date: string | null;
  loss_reason: string | null;
  seller_id: string | null;
  source: OpportunitySource | null;
  notes: string | null;
  stage_changed_at: string;
  created_at: string;
  // Joined
  customer?: SalesCustomer;
  stage?: SalesPipelineStage;
  seller?: { id: string; full_name: string; avatar_url: string | null };
  contact?: SalesContact;
};

export type SalesQuote = {
  id: string;
  org_id: string;
  quote_number: string;
  customer_id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  status: QuoteStatus;
  validity_days: number;
  subtotal: number;
  discount_percent: number;
  tax_rate: number;
  tax: number;
  total: number;
  currency: string;
  terms_html: string | null;
  internal_notes: string | null;
  sent_at: string | null;
  approved_at: string | null;
  converted_invoice_id: string | null;
  seller_id: string | null;
  created_at: string;
  // Joined
  customer?: SalesCustomer;
  seller?: { id: string; full_name: string; avatar_url: string | null };
  items?: SalesQuoteItem[];
};

export type SalesQuoteItem = {
  id: string;
  quote_id: string;
  item_number: number;
  product_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  subtotal: number | null;
  created_at: string;
};

export type SalesInvoice = {
  id: string;
  org_id: string;
  invoice_number: string;
  customer_id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  quote_id: string | null;
  status: InvoiceStatus;
  sale_date: string;
  subtotal: number;
  discount_percent: number;
  tax_rate: number;
  tax: number;
  total: number;
  currency: string;
  exchange_rate: number;
  total_usd: number;
  payment_method: PaymentMethod | null;
  payment_terms: number;
  due_date: string | null;
  paid_at: string | null;
  seller_id: string | null;
  warehouse_id: string | null;
  notes: string | null;
  sap_invoice_number: string | null;
  created_at: string;
  // Joined
  customer?: SalesCustomer;
  seller?: { id: string; full_name: string; avatar_url: string | null };
  items?: SalesInvoiceItem[];
};

export type SalesInvoiceItem = {
  id: string;
  invoice_id: string;
  item_number: number;
  product_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  subtotal: number | null;
  cost_price: number | null;
  margin_percent: number | null;
  created_at: string;
};

export type SalesActivity = {
  id: string;
  org_id: string;
  activity_type: ActivityType;
  title: string;
  description: string | null;
  customer_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  performed_by: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  is_completed: boolean;
  created_at: string;
  // Joined
  customer?: SalesCustomer;
  performer?: { id: string; full_name: string; avatar_url: string | null };
};

export type SalesAlert = {
  id: string;
  org_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_by: string | null;
  read_at: string | null;
  created_at: string;
};

// ═══════════════════════════════════════════════════════
// KPIs & Dashboard
// ═══════════════════════════════════════════════════════

export type VentasKPIs = {
  totalRevenue: number;
  totalRevenueChange: number;
  activeCustomers: number;
  activeCustomersChange: number;
  openDeals: number;
  pipelineValue: number;
  pipelineValueChange: number;
  wonDeals: number;
  wonDealsChange: number;
  avgDealSize: number;
  conversionRate: number;
  conversionRateChange: number;
  overdueInvoices: number;
  overdueAmount: number;
  quotesOpen: number;
  quotesConverted: number;
};

export type PipelineStageSummary = {
  stage: SalesPipelineStage;
  count: number;
  totalAmount: number;
  opportunities: SalesOpportunity[];
};

export type ConversionFunnelStep = {
  label: string;
  count: number;
  percentage: number;
  color: string;
};

export type TopProduct = {
  product_id: string;
  name: string;
  image_url: string | null;
  revenue: number;
  units: number;
  invoices: number;
};

export type RolePermissions = {
  create: boolean;
  edit: 'own' | 'team' | 'all';
  delete: boolean;
  viewReports: boolean;
};

export const ROLE_PERMISSIONS: Record<DemoRole, RolePermissions> = {
  seller:     { create: true, edit: 'own',  delete: false, viewReports: false },
  supervisor: { create: true, edit: 'team', delete: false, viewReports: true },
  manager:    { create: true, edit: 'all',  delete: true,  viewReports: true },
  admin:      { create: true, edit: 'all',  delete: true,  viewReports: true },
};

// ═══════════════════════════════════════════════════════
// Seller teams
// ═══════════════════════════════════════════════════════

export type SellerProfile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string | null;
  department: string | null;
  position: string | null;
};

// ═══════════════════════════════════════════════════════
// Label Maps & Constants
// ═══════════════════════════════════════════════════════

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  champion: "Campeón",
  loyal: "Leal",
  at_risk: "En Riesgo",
  dormant: "Dormido",
  prospect: "Prospecto",
  new: "Nuevo",
};

export const SEGMENT_COLORS: Record<CustomerSegment, string> = {
  champion: "#10B981",
  loyal: "#3B82F6",
  at_risk: "#F97316",
  dormant: "#6B7280",
  prospect: "#8B5CF6",
  new: "#06B6D4",
};

export const STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  prospect: "Prospecto",
  blocked: "Bloqueado",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Borrador",
  confirmed: "Confirmada",
  invoiced: "Facturada",
  paid: "Pagada",
  partially_paid: "Pago Parcial",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "#6B7280",
  confirmed: "#3B82F6",
  invoiced: "#8B5CF6",
  paid: "#10B981",
  partially_paid: "#F97316",
  overdue: "#EF4444",
  cancelled: "#6B7280",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Borrador",
  sent: "Enviada",
  viewed: "Vista",
  approved: "Aprobada",
  rejected: "Rechazada",
  expired: "Expirada",
  converted: "Convertida",
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: "#6B7280",
  sent: "#3B82F6",
  viewed: "#06B6D4",
  approved: "#10B981",
  rejected: "#EF4444",
  expired: "#F97316",
  converted: "#8B5CF6",
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: "Llamada",
  email: "Email",
  meeting: "Reunión",
  note: "Nota",
  visit: "Visita",
  follow_up: "Seguimiento",
  demo: "Demo",
  proposal: "Propuesta",
};

export const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
  call: "#3B82F6",
  email: "#06B6D4",
  meeting: "#8B5CF6",
  note: "#6B7280",
  visit: "#F97316",
  follow_up: "#F59E0B",
  demo: "#10B981",
  proposal: "#EC4899",
};

export const ALERT_SEVERITY_COLORS: Record<AlertSeverity, string> = {
  low: "#6B7280",
  medium: "#F59E0B",
  high: "#F97316",
  critical: "#EF4444",
};

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  decision_maker: "Decisor",
  technical: "Técnico",
  purchasing: "Compras",
  billing: "Facturación",
  logistics: "Logística",
  other: "Otro",
};

export const SOURCE_LABELS: Record<OpportunitySource, string> = {
  referral: "Referido",
  website: "Sitio Web",
  cold_call: "Llamada Fría",
  event: "Evento",
  inbound: "Entrante",
  partner: "Partner",
  other: "Otro",
};

export const DEMO_ROLE_LABELS: Record<DemoRole, string> = {
  seller: "Vendedor",
  supervisor: "Supervisor",
  manager: "Gerente",
  admin: "Admin",
};

export const DEMO_ROLE_COLORS: Record<DemoRole, string> = {
  seller: "#3B82F6",
  supervisor: "#10B981",
  manager: "#F59E0B",
  admin: "#EF4444",
};
