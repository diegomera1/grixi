import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "@/features/dashboard/components/dashboard-content";
import { HIDDEN_USER_IDS } from "@/config/hidden-users";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id;
  const userProfile = userId
    ? (await supabase.from("profiles").select("id, full_name, avatar_url, role_id").eq("id", userId).single()).data
    : null;

  const userRole = userProfile?.role_id
    ? (await supabase.from("roles").select("name").eq("id", userProfile.role_id).single()).data?.name
    : null;

  // ── Parallel data fetch ─────────────────────────────
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { count: totalUsers },
    { count: totalProducts },
    { count: totalWarehouses },
    { count: recentActivity },
    { count: lastWeekActivity },
    { data: recentAudit },
    { data: activityByDay },
    { data: activityHeatmap },
    { data: warehouses },
    { data: racks },
    { data: positions },
    { data: products },
    { data: recentPOs },
    { count: openPOCount },
    { count: pendingApprovalPOs },
    { data: monthPOs },
    { count: vendorCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("warehouses").select("*", { count: "exact", head: true }),
    // Activity this week
    supabase
      .from("activity_tracking")
      .select("*", { count: "exact", head: true })
      .gte("created_at", oneDayAgo),
    // Activity last week (for trend)
    supabase
      .from("activity_tracking")
      .select("*", { count: "exact", head: true })
      .gte("created_at", fourteenDaysAgo)
      .lt("created_at", sevenDaysAgo),
    // Recent audit logs
    supabase
      .from("audit_logs")
      .select("id, action, resource_type, new_data, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(10),
    // Activity chart (7 days)
    supabase
      .from("activity_tracking")
      .select("created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: true }),
    // Activity heatmap (90 days)
    supabase
      .from("activity_tracking")
      .select("created_at")
      .gte("created_at", ninetyDaysAgo)
      .order("created_at", { ascending: true }),
    // Warehouses
    supabase.from("warehouses").select("*").order("name"),
    // Racks
    supabase.from("racks").select("id, warehouse_id, columns, rows"),
    // Rack positions
    supabase.from("rack_positions").select("rack_id, status"),
    // Products by category
    supabase.from("products").select("id, category"),
    // Recent POs
    supabase
      .from("purchase_orders")
      .select("id, po_number, status, total, currency, created_at, priority, vendor_id")
      .order("created_at", { ascending: false })
      .limit(5),
    // Open POs
    supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("closed","cancelled")'),
    // Pending approval POs
    supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_approval"),
    // Month PO totals
    supabase
      .from("purchase_orders")
      .select("total")
      .gte("created_at", monthStart)
      .not("status", "eq", "cancelled"),
    // Vendor count
    supabase.from("vendors").select("*", { count: "exact", head: true }).eq("is_active", true),
  ]);

  // ── Process activity chart ──────────────────────────
  const activityChartData = processActivityByDay(activityByDay || []);

  // ── Process heatmap ─────────────────────────────────
  const heatmapData = processHeatmap(activityHeatmap || []);

  // ── Enrich audit logs ───────────────────────────────
  const userIds = [...new Set((recentAudit || []).map((a) => a.user_id).filter(Boolean))];
  const { data: userProfiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((userProfiles || []).map((p) => [p.id, p]));
  const enrichedAudit = (recentAudit || [])
    .filter((log) => !HIDDEN_USER_IDS.includes(log.user_id))
    .map((log) => ({
    ...log,
    user: profileMap.get(log.user_id) || { full_name: "Sistema", avatar_url: null },
  }));

  // ── Warehouse occupancy ─────────────────────────────
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
  const warehouseStats = (warehouses || []).map((w) => {
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
      location: w.location,
      rackCount: wRacks.length,
      totalPositions: totalPos,
      occupiedPositions: occPos,
      occupancy: totalPos > 0 ? Math.round((occPos / totalPos) * 100) : 0,
    };
  });

  // ── Products by category ────────────────────────────
  const categoryMap = new Map<string, number>();
  for (const p of products || []) {
    const cat = p.category || "Sin Categoría";
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
  }
  const productsByCategory = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ── Enrich recent POs with vendor names ─────────────
  const vendorIds = [...new Set((recentPOs || []).map((p) => p.vendor_id).filter(Boolean))];
  const { data: vendorNames } = vendorIds.length
    ? await supabase.from("vendors").select("id, name").in("id", vendorIds)
    : { data: [] };
  const vendorMap = new Map((vendorNames || []).map((v) => [v.id, v.name]));
  const enrichedPOs = (recentPOs || []).map((po) => ({
    ...po,
    vendor_name: vendorMap.get(po.vendor_id) || "—",
  }));

  // ── Month PO total ──────────────────────────────────
  const monthPOTotal = (monthPOs || []).reduce((sum, po) => sum + (po.total || 0), 0);

  // ── Avg occupancy ───────────────────────────────────
  const avgOccupancy = warehouseStats.length
    ? Math.round(warehouseStats.reduce((s, w) => s + w.occupancy, 0) / warehouseStats.length)
    : 0;

  // ── Trend calculation (this week vs last week) ──────
  const thisWeekCount = recentActivity || 0;
  const lastWeekCount = lastWeekActivity || 1;
  const activityTrend = lastWeekCount > 0
    ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
    : 0;

  // ── AI Insights (server-generated, no API call) ─────
  const insights: string[] = [];
  const highOccWarehouse = warehouseStats.find((w) => w.occupancy >= 90);
  if (highOccWarehouse) insights.push(`${highOccWarehouse.name} está al ${highOccWarehouse.occupancy}% de capacidad`);
  if ((pendingApprovalPOs || 0) > 0) insights.push(`${pendingApprovalPOs} órdenes de compra pendientes de aprobación`);
  if (activityTrend > 0) insights.push(`La actividad subió ${activityTrend}% esta semana`);
  if (activityTrend < 0) insights.push(`La actividad bajó ${Math.abs(activityTrend)}% esta semana`);
  if (monthPOTotal > 0) insights.push(`$${monthPOTotal.toLocaleString()} en compras este mes`);
  if (insights.length === 0) insights.push("Todo operando con normalidad");

  return (
    <DashboardContent
      user={{
        name: userProfile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuario",
        avatar: userProfile?.avatar_url || null,
        role: userRole || "Operador",
      }}
      kpis={{
        totalUsers: totalUsers || 0,
        totalProducts: totalProducts || 0,
        totalWarehouses: totalWarehouses || 0,
        recentActivity: recentActivity || 0,
        avgOccupancy,
        openPOs: openPOCount || 0,
      }}
      activityTrend={activityTrend}
      activityChartData={activityChartData}
      heatmapData={heatmapData}
      warehouseStats={warehouseStats}
      productsByCategory={productsByCategory}
      recentPOs={enrichedPOs}
      recentAudit={enrichedAudit}
      financeStats={{
        monthPOTotal,
        vendorCount: vendorCount || 0,
        pendingApproval: pendingApprovalPOs || 0,
      }}
      insights={insights}
    />
  );
}

// ── Helpers ───────────────────────────────────────────

function processActivityByDay(
  activities: Array<{ created_at: string }>
): Array<{ day: string; count: number }> {
  const dayMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dayKey = date.toLocaleDateString("es-ES", { weekday: "short" });
    dayMap.set(dayKey, 0);
  }
  for (const a of activities) {
    const dayKey = new Date(a.created_at).toLocaleDateString("es-ES", { weekday: "short" });
    dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);
  }
  return Array.from(dayMap.entries()).map(([day, count]) => ({ day, count }));
}

function processHeatmap(
  activities: Array<{ created_at: string }>
): Array<{ date: string; count: number }> {
  const dayMap = new Map<string, number>();
  // Initialize 90 days
  for (let i = 89; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dayMap.set(d.toISOString().split("T")[0], 0);
  }
  for (const a of activities) {
    const dateKey = new Date(a.created_at).toISOString().split("T")[0];
    if (dayMap.has(dateKey)) dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);
  }
  return Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));
}
