// GRIXI Flota — Fleet Maintenance Module Types

// ── Status & Classification Types ───────────────

export type VesselStatus = "operational" | "drydock" | "anchored" | "in_port" | "decommissioned";
export type VesselType = "oil_chemical_tanker" | "bulk_carrier" | "container" | "lpg_carrier" | "general_cargo";
export type ZoneType = "bridge" | "engine_room" | "pump_room" | "main_deck" | "accommodation" | "cargo_tank" | "ballast_tank" | "forecastle" | "aft_deck" | "steering_gear" | "bow_thruster" | "funnel" | "upper_deck_machinery" | "galley" | "double_bottom";
export type EquipmentCriticality = "critical" | "high" | "medium" | "low";
export type EquipmentStatus = "operational" | "maintenance" | "standby" | "failed" | "decommissioned";
export type WOPriority = "critical" | "high" | "medium" | "low";
export type WOStatus = "planned" | "assigned" | "in_progress" | "completed" | "closed" | "cancelled";
export type CrewRole = "captain" | "chief_engineer" | "first_officer" | "second_officer" | "first_engineer" | "electrician" | "bosun" | "motorman" | "cook" | "oiler";
export type StrategyType = "time_based" | "running_hours" | "calendar" | "condition_based" | "predictive";
export type MeasurementType = "counter" | "gauge" | "status";

// ── Data Types ──────────────────────────────────

export type Vessel = {
  id: string;
  org_id: string;
  name: string;
  imo_number: string | null;
  vessel_type: VesselType;
  flag: string;
  class_society: string;
  loa: number;
  beam: number;
  draft: number;
  dwt: number;
  year_built: number;
  port_of_registry: string;
  vessel_image_url: string | null;
  status: VesselStatus;
  created_at: string;
  // Joined
  zones?: VesselZone[];
  equipment?: Equipment[];
  crew?: CrewMember[];
};

export type VesselZone = {
  id: string;
  vessel_id: string;
  code: string;
  name: string;
  parent_zone_id: string | null;
  zone_type: ZoneType;
  deck_level: number;
  description: string | null;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  created_at: string;
  // Joined
  equipment?: Equipment[];
  children?: VesselZone[];
};

export type Equipment = {
  id: string;
  vessel_id: string;
  zone_id: string | null;
  code: string;
  name: string;
  equipment_type: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  criticality: EquipmentCriticality;
  status: EquipmentStatus;
  image_url: string | null;
  specs: Record<string, unknown>;
  created_at: string;
  // Joined
  zone?: VesselZone;
  measurement_points?: MeasurementPoint[];
  bom_items?: BOMItem[];
  maintenance_plans?: MaintenancePlan[];
};

export type MeasurementPoint = {
  id: string;
  equipment_id: string;
  name: string;
  unit: string;
  measurement_type: MeasurementType;
  min_value: number | null;
  max_value: number | null;
  alert_threshold: number | null;
  created_at: string;
  // Joined
  latest_measurement?: Measurement;
};

export type Measurement = {
  id: string;
  measurement_point_id: string;
  value: number;
  recorded_by: string | null;
  recorded_at: string;
  is_offline: boolean;
  synced_at: string | null;
};

export type BOMItem = {
  id: string;
  equipment_id: string;
  part_number: string;
  description: string;
  quantity_required: number;
  quantity_onboard: number;
  unit: string;
  lead_time_days: number;
  critical: boolean;
  created_at: string;
};

export type MaintenancePlan = {
  id: string;
  equipment_id: string;
  vessel_id: string | null;
  name: string;
  strategy_type: StrategyType;
  interval_hours: number | null;
  interval_days: number | null;
  regulation_code: string | null;
  condition_measurement_point_id: string | null;
  condition_threshold: number | null;
  auto_generate_wo: boolean;
  wo_priority: string;
  wo_title_template: string | null;
  last_executed: string | null;
  next_due: string | null;
  created_at: string;
  // Joined
  equipment?: { id: string; code: string; name: string } | null;
};

export type WorkOrder = {
  id: string;
  org_id: string;
  vessel_id: string;
  equipment_id: string | null;
  wo_number: string;
  title: string;
  description: string | null;
  priority: WOPriority;
  status: WOStatus;
  assigned_to: string | null;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  hours_estimated: number;
  hours_actual: number;
  cost_estimated: number;
  cost_actual: number;
  created_offline: boolean;
  created_at: string;
  // Joined
  equipment?: { id: string; code: string; name: string; zone_id: string } | null;
  assignee?: { id: string; full_name: string; role: string } | null;
};

export type Checklist = {
  id: string;
  vessel_id: string;
  name: string;
  zone_id: string | null;
  checklist_type: string;
  items: ChecklistItem[];
  created_at: string;
  // Joined
  zone?: { id: string; name: string; code: string } | null;
  latest_execution?: ChecklistExecution | null;
};

export type ChecklistItem = {
  item: string;
  category: string;
  critical: boolean;
};

export type ChecklistExecution = {
  id: string;
  checklist_id: string;
  executed_by: string | null;
  executed_at: string;
  results: ChecklistResultItem[];
  anomalies_found: number;
  notes: string | null;
  created_offline: boolean;
  synced_at: string | null;
};

export type ChecklistResultItem = {
  item: string;
  status: "ok" | "nok" | "na";
  notes: string | null;
};

export type CrewMember = {
  id: string;
  vessel_id: string;
  employee_id: string | null;
  role: CrewRole;
  rank: string | null;
  certifications: string[];
  boarding_date: string | null;
  disembarking_date: string | null;
  status: string;
  created_at: string;
  // Joined
  employee?: { id: string; full_name: string; avatar_url: string | null; position: string } | null;
};

export type KPISnapshot = {
  id: string;
  vessel_id: string;
  snapshot_date: string;
  mtbf_hours: number;
  mttr_hours: number;
  availability_pct: number;
  reliability_pct: number;
  maintenance_cost: number;
  fuel_consumption: number;
  created_at: string;
};

export type FlotaKPIs = {
  availability: number;
  mtbf: number;
  mttr: number;
  openWOs: number;
  criticalAlerts: number;
  maintenanceCostMonth: number;
  hoursOperated: number;
  crewOnboard: number;
  certExpiringSoon: number;
  activeAlerts: number;
  fuelROB: number;
  avgFuelConsumption: number;
};

// ── New Module Types ────────────────────────────

export type LogbookEntryType = "navegacion" | "incidente" | "inspeccion" | "cambio_guardia" | "maniobra" | "avistamiento" | "comunicacion";

export type LogbookEntry = {
  id: string;
  vessel_id: string;
  entry_type: LogbookEntryType;
  title: string;
  content: string | null;
  position_lat: number | null;
  position_lon: number | null;
  weather_conditions: Record<string, unknown>;
  sea_state: string | null;
  wind_speed: number | null;
  wave_height: number | null;
  recorded_by: string | null;
  shift: "dia" | "noche";
  created_offline: boolean;
  synced_at: string | null;
  created_at: string;
  // Joined
  crew_member?: { id: string; role: string; rank: string } | null;
};

export type AlertSeverity = "info" | "warning" | "critical" | "emergency";
export type AlertType = "equipment" | "weather" | "maintenance" | "safety" | "regulatory";

export type FleetAlert = {
  id: string;
  vessel_id: string;
  equipment_id: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string | null;
  source: "system" | "manual" | "sensor";
  is_read: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  auto_resolved: boolean;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  // Joined
  equipment_name?: string | null;
};

export type CertType = "class" | "flag" | "ISPS" | "STCW" | "ISM" | "MARPOL" | "SOPEP" | "IOPP" | "DOC" | "SMC" | "IAPP" | "CLC" | "loadline" | "tonnage" | "safety_radio" | "safety_equip" | "safety_construction";
export type CertStatus = "active" | "expiring_soon" | "expired" | "suspended";

export type FleetCertificate = {
  id: string;
  vessel_id: string;
  cert_type: CertType;
  cert_number: string;
  issued_by: string;
  issue_date: string;
  expiry_date: string | null;
  document_url: string | null;
  status: CertStatus;
  renewal_notes: string | null;
  surveyor: string | null;
  created_at: string;
};

export type FuelType = "HFO" | "MGO" | "LSFO" | "LNG" | "VLSFO";

export type FuelLog = {
  id: string;
  vessel_id: string;
  log_date: string;
  fuel_type: FuelType;
  quantity_mt: number;
  price_per_mt: number | null;
  rob_before: number | null;
  rob_after: number | null;
  consumption_rate_mt_day: number | null;
  distance_nm: number | null;
  avg_speed_kts: number | null;
  port: string | null;
  logged_by: string | null;
  notes: string | null;
  created_at: string;
};

// ── Label & Color Maps ──────────────────────────

export const VESSEL_STATUS_LABELS: Record<VesselStatus, string> = {
  operational: "Operativo",
  drydock: "En Dique Seco",
  anchored: "Fondeado",
  in_port: "En Puerto",
  decommissioned: "Descomisionado",
};

export const VESSEL_STATUS_COLORS: Record<VesselStatus, string> = {
  operational: "#10B981",
  drydock: "#F59E0B",
  anchored: "#3B82F6",
  in_port: "#8B5CF6",
  decommissioned: "#6B7280",
};

export const EQUIPMENT_CRITICALITY_LABELS: Record<EquipmentCriticality, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
};

export const EQUIPMENT_CRITICALITY_COLORS: Record<EquipmentCriticality, string> = {
  critical: "#EF4444",
  high: "#F59E0B",
  medium: "#3B82F6",
  low: "#6B7280",
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  operational: "Operativo",
  maintenance: "En Mantenimiento",
  standby: "Stand-by",
  failed: "Falla",
  decommissioned: "Fuera de Servicio",
};

export const EQUIPMENT_STATUS_COLORS: Record<EquipmentStatus, string> = {
  operational: "#10B981",
  maintenance: "#F59E0B",
  standby: "#3B82F6",
  failed: "#EF4444",
  decommissioned: "#6B7280",
};

export const WO_PRIORITY_LABELS: Record<WOPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const WO_PRIORITY_COLORS: Record<WOPriority, string> = {
  critical: "#EF4444",
  high: "#F59E0B",
  medium: "#3B82F6",
  low: "#6B7280",
};

export const WO_STATUS_LABELS: Record<WOStatus, string> = {
  planned: "Planificada",
  assigned: "Asignada",
  in_progress: "En Ejecución",
  completed: "Completada",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

export const WO_STATUS_COLORS: Record<WOStatus, string> = {
  planned: "#6B7280",
  assigned: "#3B82F6",
  in_progress: "#F59E0B",
  completed: "#10B981",
  closed: "#8B5CF6",
  cancelled: "#EF4444",
};

export const CREW_ROLE_LABELS: Record<CrewRole, string> = {
  captain: "Capitán",
  chief_engineer: "Jefe de Máquinas",
  first_officer: "1er Oficial",
  second_officer: "2do Oficial",
  first_engineer: "1er Maquinista",
  electrician: "Electricista",
  bosun: "Contramaestre",
  motorman: "Motorista",
  cook: "Cocinero",
  oiler: "Engrasador",
};

export const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  bridge: "Puente",
  engine_room: "Sala de Máquinas",
  pump_room: "Sala de Bombas",
  main_deck: "Cubierta Principal",
  accommodation: "Acomodación",
  cargo_tank: "Tanque de Carga",
  ballast_tank: "Tanque de Lastre",
  forecastle: "Castillo de Proa",
  aft_deck: "Popa",
  steering_gear: "Sala de Gobierno",
  bow_thruster: "Bow Thruster",
  funnel: "Chimenea",
  upper_deck_machinery: "Maq. Cubierta",
  galley: "Cocina",
  double_bottom: "Doble Fondo",
};

export const ZONE_TYPE_COLORS: Record<ZoneType, string> = {
  bridge: "#06B6D4",
  engine_room: "#EF4444",
  pump_room: "#F97316",
  main_deck: "#10B981",
  accommodation: "#8B5CF6",
  cargo_tank: "#F59E0B",
  ballast_tank: "#3B82F6",
  forecastle: "#6B7280",
  aft_deck: "#6B7280",
  steering_gear: "#EC4899",
  bow_thruster: "#14B8A6",
  funnel: "#6B7280",
  upper_deck_machinery: "#A855F7",
  galley: "#F59E0B",
  double_bottom: "#475569",
};
