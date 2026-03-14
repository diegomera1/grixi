"use server";

import { createClient } from "@/lib/supabase/server";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

// Random attendance statuses with weighted probabilities
const ATTENDANCE_POOL: { status: string; weight: number }[] = [
  { status: "present", weight: 65 },
  { status: "late", weight: 15 },
  { status: "absent", weight: 5 },
  { status: "permission", weight: 5 },
  { status: "sick", weight: 5 },
  { status: "vacation", weight: 5 },
];

function pickWeighted(pool: { status: string; weight: number }[]): string {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p.status;
  }
  return pool[0].status;
}

function randomTime(baseHour: number, variance: number): string {
  const h = baseHour + Math.floor(Math.random() * variance);
  const m = Math.floor(Math.random() * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

// ── Simulate a single employee checking in ─────────────────

export async function simulateCheckIn(): Promise<{
  success: boolean;
  employeeName?: string;
  status?: string;
}> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Get a random active employee who hasn't checked in today
  const { data: employees } = await supabase
    .from("hr_employees")
    .select("id, full_name")
    .eq("status", "active");

  if (!employees || employees.length === 0)
    return { success: false };

  // Pick random employee
  const emp = employees[Math.floor(Math.random() * employees.length)];

  // Check if already has record today
  const { data: existing } = await supabase
    .from("hr_attendance_records")
    .select("id")
    .eq("employee_id", emp.id)
    .eq("date", today)
    .limit(1);

  const status = pickWeighted(ATTENDANCE_POOL);
  const checkIn = randomTime(7, 2); // Between 7:00 and 8:59
  const hoursWorked = status === "present" ? 7.5 + Math.random() * 1.5 : status === "late" ? 6 + Math.random() * 2 : 0;

  if (existing && existing.length > 0) {
    // Update existing — simulate check-out
    const checkOut = randomTime(16, 2);
    await supabase
      .from("hr_attendance_records")
      .update({
        check_out: checkOut,
        hours_worked: Math.round(hoursWorked * 10) / 10,
        overtime_hours: hoursWorked > 8 ? Math.round((hoursWorked - 8) * 10) / 10 : 0,
      })
      .eq("id", existing[0].id);

    return { success: true, employeeName: emp.full_name, status: "check-out" };
  }

  // Insert new attendance record
  await supabase.from("hr_attendance_records").insert({
    org_id: ORG_ID,
    employee_id: emp.id,
    date: today,
    check_in: checkIn,
    status,
    hours_worked: Math.round(hoursWorked * 10) / 10,
    overtime_hours: hoursWorked > 8 ? Math.round((hoursWorked - 8) * 10) / 10 : 0,
    source: "biometric",
  });

  return { success: true, employeeName: emp.full_name, status };
}

// ── Simulate a new leave request ───────────────────────────

const LEAVE_TYPES = ["vacation", "sick", "personal", "maternity", "paternity"] as const;
const LEAVE_REASONS = [
  "Vacaciones familiares programadas",
  "Consulta médica especializada",
  "Trámites personales urgentes",
  "Descanso programado",
  "Cita odontológica",
  "Asuntos legales",
  "Viaje familiar",
  "Reposo médico indicado",
  "Mudanza de domicilio",
  "Evento familiar importante",
];

export async function simulateLeaveRequest(): Promise<{
  success: boolean;
  employeeName?: string;
  type?: string;
}> {
  const supabase = await createClient();

  // Get random active employee
  const { data: employees } = await supabase
    .from("hr_employees")
    .select("id, full_name, manager_id")
    .eq("status", "active");

  if (!employees || employees.length === 0) return { success: false };

  const emp = employees[Math.floor(Math.random() * employees.length)];
  const leaveType = LEAVE_TYPES[Math.floor(Math.random() * LEAVE_TYPES.length)];
  const daysCount = Math.floor(Math.random() * 5) + 1;
  const startOffset = Math.floor(Math.random() * 14) + 1; // 1-14 days from now
  const startDate = new Date(Date.now() + startOffset * 86400000);
  const endDate = new Date(startDate.getTime() + daysCount * 86400000);

  await supabase.from("hr_leave_requests").insert({
    org_id: ORG_ID,
    employee_id: emp.id,
    leave_type: leaveType,
    start_date: startDate.toISOString().split("T")[0],
    end_date: endDate.toISOString().split("T")[0],
    days_count: daysCount,
    status: "pending",
    reason: LEAVE_REASONS[Math.floor(Math.random() * LEAVE_REASONS.length)],
  });

  return { success: true, employeeName: emp.full_name, type: leaveType };
}

// ── Simulate leave approval ────────────────────────────────

export async function simulateLeaveApproval(): Promise<{
  success: boolean;
  employeeName?: string;
  action?: string;
}> {
  const supabase = await createClient();

  // Get a pending leave request
  const { data: pending } = await supabase
    .from("hr_leave_requests")
    .select("id, employee_id")
    .eq("status", "pending")
    .limit(1);

  if (!pending || pending.length === 0) return { success: false };

  const leave = pending[0];
  const action = Math.random() > 0.2 ? "approved" : "rejected"; // 80% approval rate

  // Get the employee's manager
  const { data: emp } = await supabase
    .from("hr_employees")
    .select("full_name, manager_id")
    .eq("id", leave.employee_id)
    .single();

  await supabase
    .from("hr_leave_requests")
    .update({
      status: action,
      approved_by: emp?.manager_id || null,
      approved_at: new Date().toISOString(),
    })
    .eq("id", leave.id);

  return {
    success: true,
    employeeName: emp?.full_name || "Empleado",
    action,
  };
}
