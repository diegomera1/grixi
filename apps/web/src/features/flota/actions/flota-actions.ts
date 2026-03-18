"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  Vessel, VesselZone, Equipment, MeasurementPoint,
  WorkOrder, Checklist, CrewMember, KPISnapshot,
  BOMItem, MaintenancePlan, FlotaKPIs,
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
} | null> {
  const supabase = await createClient();

  // Get authenticated user's org
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const orgId = user.user_metadata?.org_id || user.app_metadata?.org_id;

  // Get vessel filtered by org
  let vesselQuery = supabase.from("fleet_vessels").select("*");
  if (orgId) vesselQuery = vesselQuery.eq("org_id", orgId);
  const { data: vessel } = await vesselQuery.limit(1).single();

  if (!vessel) return null;

  // Parallel queries
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
  ]);

  // Attach measurement points and BOM to equipment
  const enrichedEquipment = (equipment || []).map((eq) => ({
    ...eq,
    measurement_points: (measurementPoints || []).filter((mp) => mp.equipment_id === eq.id),
    bom_items: (bomItems || []).filter((b) => b.equipment_id === eq.id),
    maintenance_plans: (maintenancePlans || []).filter((mp) => mp.equipment_id === eq.id),
    zone: (zones || []).find((z) => z.id === eq.zone_id) || null,
  })) as Equipment[];

  // Calculate stats
  const openWOs = (workOrders || []).filter((wo) => !["completed", "closed", "cancelled"].includes(wo.status)).length;
  const latestKPI = kpis?.[kpis.length - 1];

  const stats: FlotaKPIs = {
    availability: latestKPI?.availability_pct || 0,
    mtbf: latestKPI?.mtbf_hours || 0,
    mttr: latestKPI?.mttr_hours || 0,
    openWOs,
    criticalAlerts: (workOrders || []).filter((wo) => wo.priority === "critical" && wo.status !== "completed" && wo.status !== "closed").length,
    maintenanceCostMonth: latestKPI?.maintenance_cost || 0,
    hoursOperated: vessel.hours_operated ?? 0,
    crewOnboard: (crew || []).filter((c) => c.status === "onboard").length,
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
  };
}
