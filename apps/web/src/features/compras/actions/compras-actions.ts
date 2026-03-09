"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  Vendor,
  PurchaseRequisition,
  PRStatus,
  GoodsReceipt,
  ComprasKPIs,
} from "../types";

// ── Purchase Orders ───────────────────────────────

export async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(`
      *,
      vendor:vendors!purchase_orders_vendor_id_fkey(id, name, code, category, logo_url, city, compliance_score),
      requester:profiles!purchase_orders_requester_id_fkey(id, full_name, avatar_url),
      approver:profiles!purchase_orders_approver_id_fkey(id, full_name, avatar_url)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching POs:", error);
    return [];
  }
  return (data || []) as unknown as PurchaseOrder[];
}

export async function fetchPurchaseOrderById(
  id: string
): Promise<PurchaseOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(`
      *,
      vendor:vendors!purchase_orders_vendor_id_fkey(*),
      requester:profiles!purchase_orders_requester_id_fkey(id, full_name, avatar_url),
      approver:profiles!purchase_orders_approver_id_fkey(id, full_name, avatar_url),
      items:purchase_order_items(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching PO:", error);
    return null;
  }
  return data as unknown as PurchaseOrder;
}

export async function updatePOStatus(
  id: string,
  status: PurchaseOrderStatus,
  approverId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };

  if (status === "approved" && approverId) {
    updates.approver_id = approverId;
    updates.approved_at = new Date().toISOString();
  }
  if (status === "sent") {
    updates.sent_at = new Date().toISOString();
  }
  if (status === "received") {
    updates.actual_delivery = new Date().toISOString().split("T")[0];
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update(updates)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  // Bridge to Finance: when invoiced, create a finance_transaction
  if (status === "invoiced") {
    await bridgeToFinance(id);
  }

  return { success: true };
}

// ── Vendors ───────────────────────────────────────

export async function fetchVendors(): Promise<Vendor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching vendors:", error);
    return [];
  }
  return (data || []) as Vendor[];
}

export async function fetchVendorWithOrders(
  vendorId: string
): Promise<{ vendor: Vendor; orders: PurchaseOrder[] } | null> {
  const supabase = await createClient();
  const [{ data: vendor }, { data: orders }] = await Promise.all([
    supabase.from("vendors").select("*").eq("id", vendorId).single(),
    supabase
      .from("purchase_orders")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!vendor) return null;
  return {
    vendor: vendor as Vendor,
    orders: (orders || []) as PurchaseOrder[],
  };
}

// ── Purchase Requisitions ─────────────────────────

export async function fetchRequisitions(): Promise<PurchaseRequisition[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_requisitions")
    .select(`
      *,
      requester:profiles!purchase_requisitions_requester_id_fkey(id, full_name, avatar_url),
      items:purchase_requisition_items(*)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching PRs:", error);
    return [];
  }
  return (data || []) as unknown as PurchaseRequisition[];
}

export async function updateRequisitionStatus(
  id: string,
  status: PRStatus,
  approverId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };

  if (status === "approved" && approverId) {
    updates.approved_by = approverId;
    updates.approved_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("purchase_requisitions")
    .update(updates)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Goods Receipts ────────────────────────────────

export async function fetchGoodsReceipts(): Promise<GoodsReceipt[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .select(`
      *,
      purchase_order:purchase_orders!goods_receipts_po_id_fkey(id, po_number, vendor_id, total,
        vendor:vendors!purchase_orders_vendor_id_fkey(name, code)
      ),
      receiver:profiles!goods_receipts_receiver_id_fkey(id, full_name)
    `)
    .order("receipt_date", { ascending: false });

  if (error) {
    console.error("Error fetching GRs:", error);
    return [];
  }
  return (data || []) as unknown as GoodsReceipt[];
}

// ── KPIs ──────────────────────────────────────────

export async function fetchComprasKPIs(): Promise<ComprasKPIs> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .split("T")[0];

  const [
    { count: openCount },
    { count: pendingCount },
    { count: inTransitCount },
    { count: receivedTodayCount },
    { data: monthData },
  ] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["draft", "pending_approval", "approved", "sent"]),
    supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_approval"),
    supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent"),
    supabase
      .from("goods_receipts")
      .select("*", { count: "exact", head: true })
      .eq("receipt_date", today),
    supabase
      .from("purchase_orders")
      .select("total")
      .gte("order_date", monthStart),
  ]);

  const totalMonthAmount =
    monthData?.reduce((sum, po) => sum + (Number(po.total) || 0), 0) || 0;

  return {
    openOrders: openCount || 0,
    pendingApproval: pendingCount || 0,
    inTransit: inTransitCount || 0,
    receivedToday: receivedTodayCount || 0,
    totalMonthAmount,
    totalMonthOrders: monthData?.length || 0,
  };
}

// ── Bridge: Compras → Finanzas ────────────────────

async function bridgeToFinance(poId: string): Promise<void> {
  const supabase = await createClient();
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("*, vendor:vendors!purchase_orders_vendor_id_fkey(name)")
    .eq("id", poId)
    .single();

  if (!po) return;

  await supabase.from("finance_transactions").insert({
    org_id: po.org_id,
    transaction_type: "vendor_invoice",
    category: "expense",
    department: "Compras",
    amount: po.total,
    currency: po.currency || "USD",
    exchange_rate: 1,
    amount_usd: po.total,
    counterparty: po.vendor?.name || "Proveedor",
    description: `Factura OC ${po.po_number}`,
    sap_document_id: po.sap_po_number,
    is_live: false,
    invoice_number: `FAC-${po.po_number}`,
    tax_rate: po.tax_rate || 15,
    tax_amount: po.tax,
    net_amount: po.subtotal,
    payment_terms: "NET30",
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    status: "posted",
    payment_method: "transfer",
    line_items: JSON.stringify([]),
  });
}
