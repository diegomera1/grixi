// Finance module types — rich SAP-like data

export type TransactionType =
  | "invoice_revenue"
  | "customer_payment"
  | "vendor_invoice"
  | "vendor_payment"
  | "manual_entry"
  | "payroll"
  | "tax_payment";

export type TransactionCategory =
  | "revenue"
  | "expense"
  | "payment_in"
  | "payment_out"
  | "adjustment";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "COP" | "PEN" | "ARS" | "BRL";

export type PaymentMethod = "transfer" | "check" | "cash" | "credit_card" | "direct_debit";
export type TransactionStatus = "draft" | "posted" | "cleared" | "reversed";

export type LineItem = {
  item: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  gl_account: string;
};

export type FinanceTransaction = {
  id: string;
  org_id: string;
  transaction_type: TransactionType;
  category: TransactionCategory;
  department: string;
  amount: number;
  currency: CurrencyCode;
  exchange_rate: number;
  amount_usd: number;
  counterparty: string;
  description: string;
  sap_document_id: string;
  is_live: boolean;
  created_at: string;
  // Rich SAP fields
  invoice_number: string | null;
  tax_rate: number;
  tax_amount: number;
  net_amount: number | null;
  payment_terms: string;
  due_date: string | null;
  status: TransactionStatus;
  cost_center_code: string | null;
  gl_account: string | null;
  profit_center: string | null;
  posting_date: string | null;
  document_date: string | null;
  reference: string | null;
  payment_method: PaymentMethod;
  line_items: LineItem[];
  notes: string | null;
};

export type ExchangeRate = {
  id: string;
  org_id: string;
  from_currency: CurrencyCode;
  to_currency: CurrencyCode;
  rate: number;
  updated_at: string;
};

export type FinanceCostCenter = {
  id: string;
  org_id: string;
  code: string;
  name: string;
  department: string;
  budget_annual: number;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type FinanceKPIs = {
  totalRevenue: number;
  totalExpenses: number;
  ebitda: number;
  cashFlow: number;
  netBalance: number;
};
