// Finance module types

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

export type CurrencyCode = "USD" | "EUR" | "GBP";

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

export type PnLLine = {
  label: string;
  amount: number;
  type: "revenue" | "expense" | "subtotal" | "total";
  children?: PnLLine[];
  expanded?: boolean;
};
