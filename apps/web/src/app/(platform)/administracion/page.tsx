import { createClient } from "@/lib/supabase/server";
import { AdminContent } from "@/features/admin/components/admin-content";

export const metadata = {
  title: "Administración",
};

export default async function AdminPage() {
  const supabase = await createClient();

  // Fetch audit logs with user profiles
  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  // Get user profiles for all audit users
  const userIds = [...new Set((auditLogs || []).map((a) => a.user_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, department")
    .in("id", userIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const enrichedLogs = (auditLogs || []).map((log) => ({
    ...log,
    user: profileMap.get(log.user_id) || { full_name: "Sistema", avatar_url: null, department: null },
  }));

  // Fetch activity stats
  const { data: activityData } = await supabase
    .from("activity_tracking")
    .select("event_type, page_path, created_at")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false });

  // Calculate stats
  const pageViews = (activityData || []).filter((a) => a.event_type === "page_view");
  const clicks = (activityData || []).filter((a) => a.event_type === "click");

  // Top pages
  const pageCount = new Map<string, number>();
  for (const pv of pageViews) {
    pageCount.set(pv.page_path, (pageCount.get(pv.page_path) || 0) + 1);
  }
  const topPages = [...pageCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([path, count]) => ({ path, count }));

  // Activity by hour for heatmap
  const hourMap = new Map<number, number>();
  for (let i = 0; i < 24; i++) hourMap.set(i, 0);
  for (const a of activityData || []) {
    const hour = new Date(a.created_at).getHours();
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
  }
  const activityByHour = [...hourMap.entries()].map(([hour, count]) => ({ hour, count }));

  // Fetch active sessions
  const { data: sessions } = await supabase
    .from("active_sessions")
    .select("*")
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false })
    .limit(20);

  const sessionUserIds = [...new Set((sessions || []).map((s) => s.user_id).filter(Boolean))];
  const { data: sessionProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", sessionUserIds.length > 0 ? sessionUserIds : ["00000000-0000-0000-0000-000000000000"]);

  const sessionProfileMap = new Map((sessionProfiles || []).map((p) => [p.id, p]));
  const enrichedSessions = (sessions || []).map((s) => ({
    ...s,
    user: sessionProfileMap.get(s.user_id) || { full_name: "Desconocido", avatar_url: null },
  }));

  return (
    <AdminContent
      auditLogs={enrichedLogs}
      topPages={topPages}
      activityByHour={activityByHour}
      sessions={enrichedSessions}
      stats={{
        totalEvents: (activityData || []).length,
        totalPageViews: pageViews.length,
        totalClicks: clicks.length,
        totalAuditLogs: (auditLogs || []).length,
      }}
    />
  );
}
