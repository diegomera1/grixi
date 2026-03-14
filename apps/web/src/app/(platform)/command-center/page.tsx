import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CommandCenterContent } from "@/features/command-center/components/command-center-content";
import { HIDDEN_USER_IDS } from "@/config/hidden-users";
import type {
  CommandCenterData,
  WarehouseOccupancy,
  ActivityEvent,
  ModuleHealth,
  CommandCenterUser,
} from "@/features/command-center/types";

export const metadata = {
  title: "Centro de Comando — GRIXI",
  description: "Panel de control unificado en tiempo real con métricas de toda la plataforma",
};

export default async function CommandCenterPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

  // ── Massive parallel fetch ─────────────────────────
  const [
    // Finance
    { data: monthRevenue },
    { data: monthExpenses },
    { data: prevMonthRevenue },
    { data: prevMonthExpenses },
    { data: revenueByDay },

    // Purchase Orders
    { count: openPOCount },
    { data: openPOsData },
    { count: pendingApprovalCount },

    // Warehouses & Inventory
    { data: warehouses },
    { data: racks },
    { data: positions },
    { count: totalProducts },
    { data: lowStockProducts },

    // Users
    { count: activeSessionCount },
    { count: totalUsers },

    // Vendors
    { count: vendorCount },

    // Recent Activity (audit_logs)
    { data: recentAudit },
  ] = await Promise.all([
    // Revenue this month
    supabase
      .from("finance_transactions")
      .select("amount_usd")
      .eq("transaction_type", "income")
      .gte("posting_date", monthStart),
    // Expenses this month
    supabase
      .from("finance_transactions")
      .select("amount_usd")
      .eq("transaction_type", "expense")
      .gte("posting_date", monthStart),
    // Revenue previous month
    supabase
      .from("finance_transactions")
      .select("amount_usd")
      .eq("transaction_type", "income")
      .gte("posting_date", prevMonthStart)
      .lte("posting_date", prevMonthEnd),
    // Expenses previous month
    supabase
      .from("finance_transactions")
      .select("amount_usd")
      .eq("transaction_type", "expense")
      .gte("posting_date", prevMonthStart)
      .lte("posting_date", prevMonthEnd),
    // Revenue by day (7 days for sparkline)
    supabase
      .from("finance_transactions")
      .select("amount_usd, posting_date")
      .eq("transaction_type", "income")
      .gte("posting_date", sevenDaysAgo)
      .order("posting_date", { ascending: true }),

    // Open POs
    supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("closed","cancelled")'),
    // Open POs total amount
    supabase
      .from("purchase_orders")
      .select("total")
      .not("status", "in", '("closed","cancelled")'),
    // Pending approval POs
    supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_approval"),

    // Warehouses
    supabase.from("warehouses").select("*").order("name"),
    // Racks
    supabase.from("racks").select("id, warehouse_id"),
    // Positions
    supabase.from("rack_positions").select("rack_id, status"),
    // Total products
    supabase.from("products").select("*", { count: "exact", head: true }),
    // Low stock products
    supabase
      .from("products")
      .select("id, name, min_stock")
      .gt("min_stock", 0),

    // Active sessions (last 24h)
    supabase
      .from("active_sessions")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .gte("last_seen_at", oneDayAgo),
    // Total users
    supabase.from("profiles").select("*", { count: "exact", head: true }),

    // Vendor count
    supabase.from("vendors").select("*", { count: "exact", head: true }).eq("is_active", true),

    // Recent audit logs
    supabase
      .from("audit_logs")
      .select("id, action, resource_type, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // ── Process Revenue & Expenses ─────────────────────
  const totalRevenue = (monthRevenue || []).reduce((sum, t) => sum + Number(t.amount_usd || 0), 0);
  const totalExpenses = (monthExpenses || []).reduce((sum, t) => sum + Math.abs(Number(t.amount_usd || 0)), 0);
  const prevTotalRevenue = (prevMonthRevenue || []).reduce((sum, t) => sum + Number(t.amount_usd || 0), 0);
  const prevTotalExpenses = (prevMonthExpenses || []).reduce((sum, t) => sum + Math.abs(Number(t.amount_usd || 0)), 0);

  const revenueTrend = prevTotalRevenue > 0
    ? Math.round(((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100)
    : 0;
  const expensesTrend = prevTotalExpenses > 0
    ? Math.round(((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100)
    : 0;

  // Revenue sparkline (7 days)
  const sparklineMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    sparklineMap.set(d.toISOString().split("T")[0], 0);
  }
  for (const t of revenueByDay || []) {
    const dateKey = t.posting_date;
    if (dateKey && sparklineMap.has(dateKey)) {
      sparklineMap.set(dateKey, (sparklineMap.get(dateKey) || 0) + Number(t.amount_usd || 0));
    }
  }
  const revenueSparkline = Array.from(sparklineMap.values());

  // ── Open POs total ─────────────────────────────────
  const openPOsTotal = (openPOsData || []).reduce((sum, po) => sum + Number(po.total || 0), 0);

  // ── Warehouse Occupancy ────────────────────────────
  const racksByWarehouse = new Map<string, string[]>();
  for (const rack of racks || []) {
    if (!racksByWarehouse.has(rack.warehouse_id)) racksByWarehouse.set(rack.warehouse_id, []);
    racksByWarehouse.get(rack.warehouse_id)!.push(rack.id);
  }
  const positionsByRack = new Map<string, { total: number; occupied: number }>();
  for (const pos of positions || []) {
    if (!positionsByRack.has(pos.rack_id)) positionsByRack.set(pos.rack_id, { total: 0, occupied: 0 });
    const s = positionsByRack.get(pos.rack_id)!;
    s.total++;
    if (pos.status === "occupied") s.occupied++;
  }
  const warehouseStats: WarehouseOccupancy[] = (warehouses || []).map((w) => {
    const wRacks = racksByWarehouse.get(w.id) || [];
    let totalPos = 0, occPos = 0;
    for (const rId of wRacks) {
      const s = positionsByRack.get(rId);
      if (s) { totalPos += s.total; occPos += s.occupied; }
    }
    return {
      id: w.id,
      name: w.name,
      type: w.type,
      rackCount: wRacks.length,
      totalPositions: totalPos,
      occupiedPositions: occPos,
      occupancy: totalPos > 0 ? Math.round((occPos / totalPos) * 100) : 0,
    };
  });

  const avgOccupancy = warehouseStats.length
    ? Math.round(warehouseStats.reduce((s, w) => s + w.occupancy, 0) / warehouseStats.length)
    : 0;

  // ── Low Stock Count ────────────────────────────────
  // Count products that are below their min stock (simplified check)
  const lowStockCount = (lowStockProducts || []).length;

  // ── Activity Feed ──────────────────────────────────
  const auditUserIds = [...new Set((recentAudit || []).map((a) => a.user_id).filter(Boolean))];
  const { data: auditProfiles } = auditUserIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", auditUserIds)
    : { data: [] };
  const profileMap = new Map((auditProfiles || []).map((p) => [p.id, p]));

  const moduleFromAction = (action: string, resourceType: string | null): string => {
    if (resourceType === "purchase_order" || action.includes("purchase")) return "compras";
    if (resourceType === "warehouse" || action.includes("warehouse") || action.includes("inventory")) return "almacenes";
    if (resourceType === "finance" || action.includes("finance") || action.includes("transaction")) return "finanzas";
    if (action.includes("login") || action.includes("logout") || action.includes("session")) return "usuarios";
    if (action.includes("ai")) return "ai";
    return "sistema";
  };

  const recentActivity: ActivityEvent[] = (recentAudit || [])
    .filter((log) => !HIDDEN_USER_IDS.includes(log.user_id))
    .slice(0, 15)
    .map((log) => {
      const profile = profileMap.get(log.user_id);
      return {
        id: log.id,
        action: log.action,
        resourceType: log.resource_type,
        createdAt: log.created_at,
        userId: log.user_id,
        userName: profile?.full_name || "Sistema",
        userAvatar: profile?.avatar_url || null,
        module: moduleFromAction(log.action, log.resource_type),
      };
    });

  // ── Module Health ──────────────────────────────────
  const moduleHealth: ModuleHealth[] = [
    {
      module: "finanzas",
      label: "Finanzas",
      status: totalRevenue > totalExpenses ? "healthy" : totalRevenue > 0 ? "warning" : "critical",
      metric: `$${(totalRevenue - totalExpenses).toLocaleString("en-US", { maximumFractionDigits: 0 })} EBITDA`,
      color: "#8B5CF6",
    },
    {
      module: "almacenes",
      label: "Almacenes",
      status: avgOccupancy < 85 ? "healthy" : avgOccupancy < 95 ? "warning" : "critical",
      metric: `${avgOccupancy}% ocupación`,
      color: "#10B981",
    },
    {
      module: "compras",
      label: "Compras",
      status: (pendingApprovalCount || 0) < 5 ? "healthy" : (pendingApprovalCount || 0) < 10 ? "warning" : "critical",
      metric: `${pendingApprovalCount || 0} pendientes`,
      color: "#F97316",
    },
    {
      module: "usuarios",
      label: "Usuarios",
      status: (activeSessionCount || 0) > 0 ? "healthy" : "warning",
      metric: `${activeSessionCount || 0} online`,
      color: "#F59E0B",
    },
  ];

  // ── User Info ──────────────────────────────────────
  const ccUser: CommandCenterUser = {
    name:
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split("@")[0] ||
      "Comandante",
    avatar: user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null,
  };

  // ── Assemble Data ──────────────────────────────────
  const data: CommandCenterData = {
    revenue: totalRevenue,
    revenueTrend,
    expenses: totalExpenses,
    expensesTrend,
    openPOs: openPOCount || 0,
    openPOsTotal,
    pendingApproval: pendingApprovalCount || 0,
    stockOccupancy: avgOccupancy,
    stockOccupancyTrend: 0,
    totalProducts: totalProducts || 0,
    lowStockCount,
    activeUsers: activeSessionCount || 0,
    totalUsers: totalUsers || 0,
    vendorCount: vendorCount || 0,
    warehouseStats,
    recentActivity,
    revenueSparkline,
    expenseSparkline: [],
    moduleHealth,
  };

  return (
    <Suspense fallback={null}>
      <CommandCenterContent data={data} user={ccUser} />
    </Suspense>
  );
}
