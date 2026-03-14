"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  Employee,
  Department,
  AttendanceRecord,
  PayrollRecord,
  LeaveRequest,
  PerformanceReview,
  LeaveStatus,
  RRHHKPIs,
} from "../types";

// ── Employees ──────────────────────────────────────

export async function fetchEmployees(): Promise<Employee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_employees")
    .select(`
      *,
      department:hr_departments!hr_employees_department_id_fkey(id, name, code, color, icon)
    `)
    .order("employee_number");

  if (error) {
    console.error("Error fetching employees:", error);
    return [];
  }

  // Resolve manager info client-side to avoid PostgREST self-ref FK issues
  const emps = (data || []) as unknown as Employee[];
  const empMap = new Map(emps.map((e) => [e.id, e]));
  return emps.map((e) => {
    if (e.manager_id && empMap.has(e.manager_id)) {
      const mgr = empMap.get(e.manager_id)!;
      return { ...e, manager: { id: mgr.id, full_name: mgr.full_name, position: mgr.position } };
    }
    return e;
  });
}

// ── Departments ────────────────────────────────────

export async function fetchDepartments(): Promise<Department[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_departments")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
  return (data || []) as unknown as Department[];
}

// ── Attendance ─────────────────────────────────────

export async function fetchAttendanceRecords(): Promise<AttendanceRecord[]> {
  const supabase = await createClient();
  // Fetch last 45 days — limit to reasonable rows
  const since = new Date(Date.now() - 45 * 86400000).toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("hr_attendance_records")
    .select("*")
    .gte("date", since)
    .order("date", { ascending: false })
    .limit(5000);

  if (error) {
    console.error("Error fetching attendance:", error);
    return [];
  }
  return (data || []) as unknown as AttendanceRecord[];
}

// ── Payroll ────────────────────────────────────────

export async function fetchPayrollRecords(): Promise<PayrollRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_payroll_records")
    .select("*")
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false });

  if (error) {
    console.error("Error fetching payroll:", error);
    return [];
  }
  return (data || []) as unknown as PayrollRecord[];
}

// ── Leave Requests ─────────────────────────────────

export async function fetchLeaveRequests(): Promise<LeaveRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_leave_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching leaves:", error);
    return [];
  }
  return (data || []) as unknown as LeaveRequest[];
}

export async function updateLeaveRequestStatus(
  id: string,
  status: LeaveStatus,
  approverId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };

  if ((status === "approved" || status === "rejected") && approverId) {
    updates.approved_by = approverId;
    updates.approved_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("hr_leave_requests")
    .update(updates)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Performance Reviews ────────────────────────────

export async function fetchPerformanceReviews(): Promise<PerformanceReview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_performance_reviews")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }
  return (data || []) as unknown as PerformanceReview[];
}

// ── KPIs ───────────────────────────────────────────

export async function fetchRRHHKPIs(): Promise<RRHHKPIs> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .split("T")[0];
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [
    { count: headcount },
    { count: contractsExpiring },
    { data: attendanceToday },
    { data: payrollMonth },
    { count: pendingLeaves },
    { data: allEmployees },
  ] = await Promise.all([
    supabase
      .from("hr_employees")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("hr_employees")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .not("contract_end", "is", null)
      .lte("contract_end", thirtyDaysLater),
    supabase
      .from("hr_attendance_records")
      .select("status")
      .eq("date", today),
    supabase
      .from("hr_payroll_records")
      .select("total_income, overtime_pay")
      .eq("period_month", currentMonth)
      .eq("period_year", currentYear),
    supabase
      .from("hr_leave_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("hr_employees")
      .select("hire_date")
      .eq("status", "active"),
  ]);

  const presentToday =
    attendanceToday?.filter((a) => a.status === "present" || a.status === "late")
      .length || 0;
  const totalToday = attendanceToday?.length || 1;
  const attendancePct = Math.round((presentToday / totalToday) * 100);

  const payrollCost =
    payrollMonth?.reduce((s, p) => s + (Number(p.total_income) || 0), 0) || 0;
  const overtimeCost =
    payrollMonth?.reduce((s, p) => s + (Number(p.overtime_pay) || 0), 0) || 0;

  const now = new Date();
  const avgSeniorityYears =
    allEmployees && allEmployees.length > 0
      ? allEmployees.reduce((sum, e) => {
          const hire = new Date(e.hire_date);
          return sum + (now.getTime() - hire.getTime()) / (365.25 * 86400000);
        }, 0) / allEmployees.length
      : 0;

  return {
    headcount: headcount || 0,
    rotation: 3.2, // Demo value
    attendanceToday: attendancePct,
    contractsExpiring: contractsExpiring || 0,
    payrollCostMonth: payrollCost,
    pendingLeaves: pendingLeaves || 0,
    avgSeniority: Math.round(avgSeniorityYears * 10) / 10,
    overtimeCost,
  };
}
