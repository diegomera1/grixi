"use server";

import { createClient } from "@/lib/supabase/server";

// Register a person boarding the vessel — validates documents against fleet_crew_competencies
export async function registerBoarding(data: {
  vesselId: string;
  personName: string;
  documentId: string;
  role: string;
  crewId?: string;
  notes?: string;
}) {
  const supabase = await createClient();

  let docStatus: "valid" | "expired_docs" | "not_checked" = "not_checked";
  let docWarnings: string[] = [];

  // If linked to a crew member, validate their competencies
  if (data.crewId) {
    const { data: competencies } = await supabase
      .from("fleet_crew_competencies")
      .select("competency_name, cert_code, expiry_date, status")
      .eq("crew_id", data.crewId);

    if (competencies && competencies.length > 0) {
      const now = new Date();
      const expired = competencies.filter((c) => {
        if (c.expiry_date && new Date(c.expiry_date) < now) return true;
        if (c.status === "expired") return true;
        return false;
      });

      if (expired.length > 0) {
        docStatus = "expired_docs";
        docWarnings = expired.map((c) => c.cert_code || c.competency_name);
      } else {
        docStatus = "valid";
      }
    }
  }

  const { data: entry, error } = await supabase
    .from("fleet_vessel_manifest")
    .insert({
      vessel_id: data.vesselId,
      person_name: data.personName,
      document_id: data.documentId,
      role: data.role,
      crew_id: data.crewId || null,
      doc_validation_status: docStatus,
      doc_warnings: docWarnings.length > 0 ? docWarnings : null,
      notes: data.notes || null,
      boarding_time: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  return { success: true, id: entry?.id, docStatus, docWarnings };
}

// Register disembarking
export async function registerDisembarking(entryId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("fleet_vessel_manifest")
    .update({ disembarking_time: new Date().toISOString() })
    .eq("id", entryId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// Save a new logbook entry
export async function saveLogbookEntry(data: {
  vesselId: string;
  entryType: string;
  title: string;
  content?: string;
  shift: "dia" | "noche";
  seaState?: string;
  windSpeed?: number;
  waveHeight?: number;
  positionLat?: number;
  positionLon?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("fleet_logbook")
    .insert({
      vessel_id: data.vesselId,
      entry_type: data.entryType,
      title: data.title,
      content: data.content || null,
      shift: data.shift,
      sea_state: data.seaState || null,
      wind_speed: data.windSpeed ?? null,
      wave_height: data.waveHeight ?? null,
      position_lat: data.positionLat ?? null,
      position_lon: data.positionLon ?? null,
      recorded_by: user?.id || null,
      weather_conditions: {},
      created_offline: false,
    });

  if (error) return { success: false, error: error.message };
  return { success: true };
}
