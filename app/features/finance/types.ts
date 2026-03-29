export type CurrencyCode = "USD" | "EUR" | "GBP" | "COP" | "PEN" | "ARS" | "BRL";

export interface LineItem {
  item: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  gl_account: string;
}

export interface FinanceTransaction {
  id: string;
  org_id: string;
  transaction_type:
    | "invoice_revenue"
    | "customer_payment"
    | "vendor_invoice"
    | "vendor_payment"
    | "manual_entry"
    | "payroll"
    | "tax_payment";
  category: "revenue" | "expense" | "payment_in" | "payment_out" | "adjustment";
  department: string;
  amount: number;
  currency: CurrencyCode;
  exchange_rate: number;
  amount_usd: number;
  counterparty: string;
  description: string;
  sap_document_id: string;
  is_live: boolean;
  // SAP-like fields
  invoice_number: string | null;
  tax_rate: number;
  tax_amount: number;
  net_amount: number | null;
  payment_terms: string;
  due_date: string | null;
  status: string;
  cost_center_code: string | null;
  gl_account: string | null;
  profit_center: string | null;
  posting_date: string | null;
  document_date: string | null;
  reference: string | null;
  payment_method: string | null;
  line_items: LineItem[];
  notes: string | null;
  created_at: string;
}

export interface FinanceCostCenter {
  id: string;
  org_id: string;
  code: string;
  name: string;
  department: string;
  budget_annual: number;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FinanceKPIs {
  totalRevenue: number;
  totalExpenses: number;
  ebitda: number;
  cashFlow: number;
  netBalance: number;
}
