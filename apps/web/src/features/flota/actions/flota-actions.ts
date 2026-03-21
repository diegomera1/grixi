"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  Vessel, VesselZone, Equipment,
  WorkOrder, Checklist, CrewMember, KPISnapshot,
  FlotaKPIs,
  LogbookEntry, FleetAlert, FleetCertificate, FuelLog,
} from "../types";

// ── Fetch full vessel data ──────────────────────

export async function fetchVessel(): Promise<{
  vessel: Vessel;
  zones: VesselZone[];
  equipment: Equipment[];
  workOrders: WorkOrder[];
  checklists: Checklist[];
  crew: CrewMember[];
  kpis: KPISnapshot[];
  stats: FlotaKPIs;
  logbook: LogbookEntry[];
  alerts: FleetAlert[];
  certificates: FleetCertificate[];
  fuelLogs: FuelLog[];
} | null> {
  const supabase = await createClient();

  // Try to get authenticated user's org — but don't block if not logged in (demo data)
  const { data: { user } } = await supabase.auth.getUser();
  const orgId = user?.user_metadata?.org_id || user?.app_metadata?.org_id;

  // Get vessel — filtered by org if authenticated, otherwise first available (demo)
  let vesselQuery = supabase.from("fleet_vessels").select("*");
  if (orgId) vesselQuery = vesselQuery.eq("org_id", orgId);
  const { data: vessel } = await vesselQuery.limit(1).single();

  if (!vessel) return null;

  // Parallel queries — original + 4 new tables
  const [
    { data: zones },
    { data: equipment },
    { data: workOrders },
    { data: checklists },
    { data: crew },
    { data: kpis },
    { data: measurementPoints },
    { data: bomItems },
    { data: maintenancePlans },
    { data: logbook },
    { data: alerts },
    { data: certificates },
    { data: fuelLogs },
  ] = await Promise.all([
    supabase.from("fleet_vessel_zones").select("*").eq("vessel_id", vessel.id).order("deck_level", { ascending: false }),
    supabase.from("fleet_equipment").select("*").eq("vessel_id", vessel.id).order("code"),
    supabase.from("fleet_work_orders").select("*").eq("vessel_id", vessel.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("fleet_checklists").select("*").eq("vessel_id", vessel.id),
    supabase.from("fleet_crew").select("*, employee:hr_employees(id, full_name, avatar_url, position)").eq("vessel_id", vessel.id),
    supabase.from("fleet_kpi_snapshots").select("*").eq("vessel_id", vessel.id).order("snapshot_date"),
    supabase.from("fleet_measurement_points").select("*"),
    supabase.from("fleet_bom_items").select("*"),
    supabase.from("fleet_maintenance_plans").select("*"),
    // New tables
    supabase.from("fleet_logbook").select("*").eq("vessel_id", vessel.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("fleet_alerts").select("*").eq("vessel_id", vessel.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("fleet_certificates").select("*").eq("vessel_id", vessel.id).order("expiry_date", { ascending: true }),
    supabase.from("fleet_fuel_logs").select("*").eq("vessel_id", vessel.id).order("log_date", { ascending: false }).limit(60),
  ]);

  // Attach measurement points and BOM to equipment
  const enrichedEquipment = (equipment || []).map((eq) => ({
    ...eq,
    measurement_points: (measurementPoints || []).filter((mp) => mp.equipment_id === eq.id),
    bom_items: (bomItems || []).filter((b) => b.equipment_id === eq.id),
    maintenance_plans: (maintenancePlans || []).filter((mp) => mp.equipment_id === eq.id),
    zone: (zones || []).find((z) => z.id === eq.zone_id) || null,
  })) as Equipment[];

  // Enrich alerts with equipment name
  const enrichedAlerts = (alerts || []).map((a) => ({
    ...a,
    equipment_name: a.equipment_id ? (equipment || []).find((e) => e.id === a.equipment_id)?.name ?? null : null,
  })) as FleetAlert[];

  // Calculate stats
  const openWOs = (workOrders || []).filter((wo) => !["completed", "closed", "cancelled"].includes(wo.status)).length;
  const latestKPI = kpis?.[kpis.length - 1];
  const activeAlertsList = enrichedAlerts.filter((a) => !a.resolved_at);
  const certExpiring = (certificates || []).filter((c) => c.status === "expiring_soon" || c.status === "expired");

  // Fuel ROB = latest LSFO rob_after (most recent non-negative entry for navigation)
  const latestFuelNav = (fuelLogs || []).find((f) => f.quantity_mt > 0 && f.consumption_rate_mt_day && f.consumption_rate_mt_day > 0);
  const navLogs = (fuelLogs || []).filter((f) => f.consumption_rate_mt_day && f.consumption_rate_mt_day > 0);
  const avgConsumption = navLogs.length > 0
    ? navLogs.reduce((sum, f) => sum + (f.consumption_rate_mt_day || 0), 0) / navLogs.length
    : 0;

  const stats: FlotaKPIs = {
    availability: latestKPI?.availability_pct || 0,
    mtbf: latestKPI?.mtbf_hours || 0,
    mttr: latestKPI?.mttr_hours || 0,
    openWOs,
    criticalAlerts: activeAlertsList.filter((a) => a.severity === "critical" || a.severity === "emergency").length,
    maintenanceCostMonth: latestKPI?.maintenance_cost || 0,
    hoursOperated: 0,
    crewOnboard: (crew || []).filter((c) => c.status === "onboard").length,
    certExpiringSoon: certExpiring.length,
    activeAlerts: activeAlertsList.length,
    fuelROB: latestFuelNav?.rob_after || 0,
    avgFuelConsumption: Math.round(avgConsumption * 10) / 10,
  };

  return {
    vessel: vessel as Vessel,
    zones: (zones || []) as VesselZone[],
    equipment: enrichedEquipment,
    workOrders: (workOrders || []) as WorkOrder[],
    checklists: (checklists || []) as Checklist[],
    crew: (crew || []) as CrewMember[],
    kpis: (kpis || []) as KPISnapshot[],
    stats,
    logbook: (logbook || []) as LogbookEntry[],
    alerts: enrichedAlerts,
    certificates: (certificates || []) as FleetCertificate[],
    fuelLogs: (fuelLogs || []) as FuelLog[],
  };
}
