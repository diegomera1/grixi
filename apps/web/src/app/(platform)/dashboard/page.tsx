import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "@/features/dashboard/components/dashboard-content";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch KPI data
  const [
    { count: totalUsers },
    { count: totalProducts },
    { count: totalWarehouses },
    { count: recentActivity },
    { data: recentAudit },
    { data: activityByDay },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("warehouses").select("*", { count: "exact", head: true }),
    supabase
      .from("activity_tracking")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("audit_logs")
      .select("id, action, resource_type, new_data, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("activity_tracking")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: true }),
  ]);

  // Process activity data by day for chart
  const activityChartData = processActivityByDay(activityByDay || []);

  // Get user names for audit logs
  const userIds = [...new Set((recentAudit || []).map((a) => a.user_id).filter(Boolean))];
  const { data: userProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map((userProfiles || []).map((p) => [p.id, p]));

  const enrichedAudit = (recentAudit || []).map((log) => ({
    ...log,
    user: profileMap.get(log.user_id) || { full_name: "Sistema", avatar_url: null },
  }));

  return (
    <DashboardContent
      kpis={{
        totalUsers: totalUsers || 0,
        totalProducts: totalProducts || 0,
        totalWarehouses: totalWarehouses || 0,
        recentActivity: recentActivity || 0,
      }}
      activityChartData={activityChartData}
      recentAudit={enrichedAudit}
    />
  );
}

function processActivityByDay(
  activities: Array<{ created_at: string }>
): Array<{ day: string; count: number }> {
  const dayMap = new Map<string, number>();

  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dayKey = date.toLocaleDateString("es-ES", { weekday: "short" });
    dayMap.set(dayKey, 0);
  }

  // Count activities per day
  for (const activity of activities) {
    const date = new Date(activity.created_at);
    const dayKey = date.toLocaleDateString("es-ES", { weekday: "short" });
    dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);
  }

  return Array.from(dayMap.entries()).map(([day, count]) => ({ day, count }));
}
