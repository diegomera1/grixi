"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  SalesCustomer,
  SalesOpportunity,
  SalesInvoice,
  SalesQuote,
  SalesActivity,
  SalesAlert,
  SalesPipelineStage,
  SalesContact,
  VentasKPIs,
  PipelineStageSummary,
  SellerProfile,
} from "../types";

// ── Customers ──────────────────────────────────────

export async function fetchCustomers(): Promise<SalesCustomer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_customers")
    .select(`
      *,
      assigned_seller:profiles!sales_customers_assigned_seller_id_fkey(id, full_name, avatar_url)
    `)
    .order("total_revenue", { ascending: false });

  if (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
  return (data || []) as unknown as SalesCustomer[];
}

export async function fetchCustomerById(
  id: string
): Promise<SalesCustomer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_customers")
    .select(`
      *,
      assigned_seller:profiles!sales_customers_assigned_seller_id_fkey(id, full_name, avatar_url),
      contacts:sales_contacts(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching customer:", error);
    return null;
  }
  return data as unknown as SalesCustomer;
}

export async function fetchContacts(
  customerId: string
): Promise<SalesContact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_contacts")
    .select("*")
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false });

  if (error) {
    console.error("Error fetching contacts:", error);
    return [];
  }
  return (data || []) as SalesContact[];
}

// ── Pipeline / Opportunities ──────────────────────

export async function fetchPipelineStages(): Promise<SalesPipelineStage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_pipeline_stages")
    .select("*")
    .eq("is_active", true)
    .order("position");

  if (error) {
    console.error("Error fetching pipeline stages:", error);
    return [];
  }
  return (data || []) as SalesPipelineStage[];
}

export async function fetchOpportunities(): Promise<SalesOpportunity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_opportunities")
    .select(`
      *,
      customer:sales_customers!sales_opportunities_customer_id_fkey(id, business_name, trade_name, code, logo_url, country),
      stage:sales_pipeline_stages!sales_opportunities_stage_id_fkey(id, name, code, color, position, is_won, is_lost),
      seller:profiles!sales_opportunities_seller_id_fkey(id, full_name, avatar_url),
      contact:sales_contacts!sales_opportunities_contact_id_fkey(id, full_name, role, email)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching opportunities:", error);
    return [];
  }
  return (data || []) as unknown as SalesOpportunity[];
}

export async function moveOpportunityStage(
  opportunityId: string,
  newStageId: string,
  probability: number
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_opportunities")
    .update({
      stage_id: newStageId,
      probability,
      stage_changed_at: new Date().toISOString(),
    })
    .eq("id", opportunityId);

  if (error) {
    console.error("Error moving opportunity:", error);
    return false;
  }
  return true;
}

export async function fetchPipelineSummary(): Promise<PipelineStageSummary[]> {
  const [stages, opportunities] = await Promise.all([
    fetchPipelineStages(),
    fetchOpportunities(),
  ]);

  return stages.map((stage) => {
    const stageOpps = opportunities.filter((o) => o.stage_id === stage.id);
    return {
      stage,
      count: stageOpps.length,
      totalAmount: stageOpps.reduce((sum, o) => sum + Number(o.amount), 0),
      opportunities: stageOpps,
    };
  });
}

// ── Invoices / Ventas ─────────────────────────────

export async function fetchInvoices(): Promise<SalesInvoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_invoices")
    .select(`
      *,
      customer:sales_customers!sales_invoices_customer_id_fkey(id, business_name, trade_name, code, logo_url, country, city, segment),
      seller:profiles!sales_invoices_seller_id_fkey(id, full_name, avatar_url),
      items:sales_invoice_items(*)
    `)
    .order("sale_date", { ascending: false });

  if (error) {
    console.error("Error fetching invoices:", error);
    return [];
  }
  return (data || []) as unknown as SalesInvoice[];
}

export async function fetchInvoicesByCustomer(
  customerId: string
): Promise<SalesInvoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_invoices")
    .select(`
      *,
      seller:profiles!sales_invoices_seller_id_fkey(id, full_name, avatar_url)
    `)
    .eq("customer_id", customerId)
    .order("sale_date", { ascending: false });

  if (error) {
    console.error("Error fetching customer invoices:", error);
    return [];
  }
  return (data || []) as unknown as SalesInvoice[];
}

// ── Quotes ────────────────────────────────────────

export async function fetchQuotes(): Promise<SalesQuote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_quotes")
    .select(`
      *,
      customer:sales_customers!sales_quotes_customer_id_fkey(id, business_name, trade_name, code, logo_url, country),
      seller:profiles!sales_quotes_seller_id_fkey(id, full_name, avatar_url),
      items:sales_quote_items(*)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching quotes:", error);
    return [];
  }
  return (data || []) as unknown as SalesQuote[];
}

// ── Activities ────────────────────────────────────

export async function fetchActivities(
  customerId?: string
): Promise<SalesActivity[]> {
  const supabase = await createClient();
  let query = supabase
    .from("sales_activities")
    .select(`
      *,
      customer:sales_customers!sales_activities_customer_id_fkey(id, business_name, trade_name, code, logo_url),
      performer:profiles!sales_activities_performed_by_fkey(id, full_name, avatar_url)
    `)
    .order("created_at", { ascending: false });

  if (customerId) {
    query = query.eq("customer_id", customerId);
  }

  const { data, error } = await query.limit(50);

  if (error) {
    console.error("Error fetching activities:", error);
    return [];
  }
  return (data || []) as unknown as SalesActivity[];
}

// ── Alerts ────────────────────────────────────────

export async function fetchAlerts(): Promise<SalesAlert[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_alerts")
    .select("*")
    .eq("is_read", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching alerts:", error);
    return [];
  }
  return (data || []) as SalesAlert[];
}

export async function markAlertRead(alertId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_alerts")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  if (error) {
    console.error("Error marking alert:", error);
    return false;
  }
  return true;
}

// ── Sellers ───────────────────────────────────────

export async function fetchSellers(): Promise<SellerProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email, department, position")
    .eq("department", "Ventas")
    .order("full_name");

  if (error) {
    console.error("Error fetching sellers:", error);
    return [];
  }
  return (data || []) as SellerProfile[];
}

// ── Top Products ──────────────────────────────────

export async function fetchTopProducts(): Promise<
  Array<{ product_id: string; name: string; image_url: string | null; revenue: number; units: number; invoices: number }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sales_top_products_fallback" as never);

  // Fallback: manual query if RPC doesn't exist
  if (error) {
    const { data: items } = await supabase
      .from("sales_invoice_items")
      .select("product_id, subtotal, quantity, invoice_id");

    if (!items || items.length === 0) return [];

    const { data: products } = await supabase
      .from("products")
      .select("id, name, image_url")
      .in("id", [...new Set(items.map((i: { product_id: string | null }) => i.product_id).filter(Boolean))]);

    const productMap = new Map(
      (products || []).map((p: { id: string; name: string; image_url: string | null }) => [p.id, p])
    );

    const aggregated: Record<string, { revenue: number; units: number; invoices: Set<string> }> = {};
    for (const item of items) {
      const pid = item.product_id;
      if (!pid) continue;
      if (!aggregated[pid]) aggregated[pid] = { revenue: 0, units: 0, invoices: new Set() };
      aggregated[pid].revenue += Number(item.subtotal || 0);
      aggregated[pid].units += Number(item.quantity || 0);
      aggregated[pid].invoices.add(item.invoice_id);
    }

    return Object.entries(aggregated)
      .map(([pid, agg]) => {
        const prod = productMap.get(pid);
        return {
          product_id: pid,
          name: prod?.name || "Desconocido",
          image_url: prod?.image_url || null,
          revenue: agg.revenue,
          units: agg.units,
          invoices: agg.invoices.size,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  return data || [];
}

// ── Quotes by Customer ────────────────────────────

export async function fetchQuotesByCustomer(
  customerId: string
): Promise<SalesQuote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_quotes")
    .select(`
      *,
      seller:profiles!sales_quotes_seller_id_fkey(id, full_name, avatar_url)
    `)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching customer quotes:", error);
    return [];
  }
  return (data || []) as unknown as SalesQuote[];
}

// ── Opportunities by Customer ─────────────────────

export async function fetchOpportunitiesByCustomer(
  customerId: string
): Promise<SalesOpportunity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_opportunities")
    .select(`
      *,
      stage:sales_pipeline_stages!sales_opportunities_stage_id_fkey(id, name, code, color, position, is_won, is_lost),
      seller:profiles!sales_opportunities_seller_id_fkey(id, full_name, avatar_url)
    `)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching customer opportunities:", error);
    return [];
  }
  return (data || []) as unknown as SalesOpportunity[];
}

// ── KPIs ──────────────────────────────────────────

export async function fetchVentasKPIs(): Promise<VentasKPIs> {
  const supabase = await createClient();

  // Parallel queries for performance
  const [invoicesRes, oppsRes, quotesRes, customersRes] = await Promise.all([
    supabase.from("sales_invoices").select("id, status, total, total_usd, sale_date, paid_at"),
    supabase.from("sales_opportunities").select("id, amount, stage_id, stage:sales_pipeline_stages!sales_opportunities_stage_id_fkey(is_won, is_lost)"),
    supabase.from("sales_quotes").select("id, status"),
    supabase.from("sales_customers").select("id, status"),
  ]);

  const invoices = (invoicesRes.data || []) as unknown as Array<{
    id: string;
    status: string;
    total: number;
    total_usd: number;
    sale_date: string;
    paid_at: string | null;
  }>;
  const opps = (oppsRes.data || []) as unknown as Array<{
    id: string;
    amount: number;
    stage_id: string;
    stage: { is_won: boolean; is_lost: boolean };
  }>;
  const quotes = (quotesRes.data || []) as unknown as Array<{ id: string; status: string }>;
  const customers = (customersRes.data || []) as unknown as Array<{ id: string; status: string }>;

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const totalRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.total_usd), 0);

  const monthInvoices = invoices.filter((i) => {
    const d = new Date(i.sale_date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const activeCustomers = customers.filter((c) => c.status === "active").length;

  const activeOpps = opps.filter((o) => !o.stage?.is_won && !o.stage?.is_lost);
  const pipelineValue = activeOpps.reduce((sum, o) => sum + Number(o.amount), 0);

  const wonDeals = opps.filter((o) => o.stage?.is_won).length;
  const totalClosed = opps.filter((o) => o.stage?.is_won || o.stage?.is_lost).length;
  const conversionRate = totalClosed > 0 ? (wonDeals / totalClosed) * 100 : 0;

  const avgDealSize = wonDeals > 0
    ? opps.filter((o) => o.stage?.is_won).reduce((sum, o) => sum + Number(o.amount), 0) / wonDeals
    : 0;

  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const overdueAmount = overdueInvoices.reduce((sum, i) => sum + Number(i.total_usd), 0);

  const quotesOpen = quotes.filter((q) => ["draft", "sent", "viewed"].includes(q.status)).length;
  const quotesConverted = quotes.filter((q) => q.status === "converted").length;

  return {
    totalRevenue,
    totalRevenueChange: 12.5, // demo percentage
    activeCustomers,
    activeCustomersChange: 3,
    openDeals: activeOpps.length,
    pipelineValue,
    pipelineValueChange: 8.3,
    wonDeals,
    wonDealsChange: 2,
    avgDealSize,
    conversionRate,
    conversionRateChange: 5.2,
    overdueInvoices: overdueInvoices.length,
    overdueAmount,
    quotesOpen,
    quotesConverted,
  };
}

// ── Bridge to Finance ─────────────────────────────

export async function bridgeInvoiceToFinance(
  invoiceId: string
): Promise<boolean> {
  const supabase = await createClient();

  // Fetch invoice with customer
  const { data: invoice, error: invoiceError } = await supabase
    .from("sales_invoices")
    .select(`
      *,
      customer:sales_customers!sales_invoices_customer_id_fkey(business_name)
    `)
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    console.error("Error fetching invoice for bridge:", invoiceError);
    return false;
  }

  const inv = invoice as unknown as SalesInvoice & {
    customer: { business_name: string };
  };

  // Create finance transaction
  const { error: financeError } = await supabase
    .from("finance_transactions")
    .insert({
      org_id: inv.org_id,
      transaction_type: "customer_invoice",
      category: "revenue",
      department: "Ventas",
      amount: inv.total,
      currency: inv.currency,
      exchange_rate: inv.exchange_rate,
      amount_usd: inv.total_usd,
      counterparty: inv.customer.business_name,
      description: `Factura de venta ${inv.invoice_number}`,
      invoice_number: inv.invoice_number,
      tax_rate: inv.tax_rate,
      tax_amount: inv.tax,
      net_amount: inv.subtotal,
      payment_terms: `NET${inv.payment_terms}`,
      due_date: inv.due_date,
      status: "posted",
      posting_date: inv.sale_date,
      document_date: inv.sale_date,
      reference: `SALES:${inv.invoice_number}`,
      payment_method: inv.payment_method || "transfer",
    });

  if (financeError) {
    console.error("Error bridging to finance:", financeError);
    return false;
  }

  // Update invoice status
  await supabase
    .from("sales_invoices")
    .update({ status: "invoiced" })
    .eq("id", invoiceId);

  return true;
}

// ── Bridge to Warehouse (Goods Issue) ─────────────

export async function bridgeInvoiceToWarehouse(
  invoiceId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("sales_invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return false;

  const inv = invoice as unknown as SalesInvoice;

  if (!inv.warehouse_id) {
    console.warn("Invoice has no warehouse_id, skipping goods issue");
    return true;
  }

  // Generate issue number
  const issueNumber = `GI-SALE-${inv.invoice_number}`;

  const { error } = await supabase.from("goods_issues").insert({
    org_id: inv.org_id,
    issue_number: issueNumber,
    issue_type: "sales_order",
    reference_type: "sales_invoice",
    reference_id: inv.id,
    warehouse_id: inv.warehouse_id,
    status: "pending",
    movement_type: "601",
    notes: `Salida de mercancía por venta ${inv.invoice_number}`,
  });

  if (error) {
    console.error("Error creating goods issue:", error);
    return false;
  }

  return true;
}
