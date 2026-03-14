// RRHH module types — SAP HCM equivalent

export type EmployeeStatus = "active" | "inactive" | "terminated" | "on_leave";
export type ContractType = "indefinite" | "fixed" | "temporary" | "intern";
export type AttendanceStatus = "present" | "late" | "absent" | "vacation" | "sick" | "permission" | "holiday";
export type LeaveType = "vacation" | "sick" | "maternity" | "paternity" | "personal" | "bereavement" | "unpaid";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type PayrollStatus = "calculated" | "approved" | "paid";
export type ReviewStatus = "pending" | "in_progress" | "completed" | "acknowledged";
export type Gender = "male" | "female" | "other";

export type Department = {
  id: string;
  org_id: string;
  code: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  color: string;
  icon: string;
  headcount: number;
  budget_annual: number;
  location: string | null;
  is_active: boolean;
  created_at: string;
  // Joined
  manager?: Employee | null;
};

export type Employee = {
  id: string;
  org_id: string;
  profile_id: string | null;
  employee_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  document_id: string | null;
  birth_date: string | null;
  gender: Gender | null;
  marital_status: string | null;
  hire_date: string;
  contract_end: string | null;
  contract_type: ContractType;
  department_id: string | null;
  position: string;
  level: number;
  manager_id: string | null;
  work_location: string | null;
  email: string | null;
  phone: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  address: string | null;
  city: string;
  base_salary: number;
  salary_currency: string;
  bank_name: string | null;
  bank_account: string | null;
  iess_number: string | null;
  avatar_url: string | null;
  status: EmployeeStatus;
  termination_date: string | null;
  termination_reason: string | null;
  sap_personnel_number: string | null;
  created_at: string;
  // Joined
  department?: Department | null;
  manager?: { id: string; full_name: string; position: string } | null;
  direct_reports_count?: number;
};

export type AttendanceRecord = {
  id: string;
  org_id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: AttendanceStatus;
  hours_worked: number;
  overtime_hours: number;
  notes: string | null;
  source: string;
  created_at: string;
  // Joined
  employee?: { id: string; full_name: string; employee_number: string; department_id: string } | null;
};

export type PayrollRecord = {
  id: string;
  org_id: string;
  employee_id: string;
  period_month: number;
  period_year: number;
  base_salary: number;
  overtime_hours: number;
  overtime_pay: number;
  bonuses: number;
  commissions: number;
  total_income: number;
  iess_personal: number;
  iess_patronal: number;
  income_tax: number;
  loans: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  payment_date: string | null;
  payment_method: string;
  status: PayrollStatus;
  created_at: string;
  // Joined
  employee?: { id: string; full_name: string; employee_number: string; department_id: string; position: string } | null;
};

export type LeaveRequest = {
  id: string;
  org_id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  status: LeaveStatus;
  approved_by: string | null;
  approved_at: string | null;
  reason: string | null;
  attachment_url: string | null;
  created_at: string;
  // Joined
  employee?: { id: string; full_name: string; employee_number: string; position: string; avatar_url: string | null } | null;
  approver?: { id: string; full_name: string } | null;
};

export type PerformanceReview = {
  id: string;
  org_id: string;
  employee_id: string;
  reviewer_id: string | null;
  review_period: string;
  review_type: string;
  status: ReviewStatus;
  technical_skills: number;
  communication: number;
  teamwork: number;
  leadership: number;
  punctuality: number;
  initiative: number;
  overall_score: number;
  strengths: string | null;
  areas_of_improvement: string | null;
  goals: string | null;
  reviewer_comments: string | null;
  employee_comments: string | null;
  completed_at: string | null;
  created_at: string;
  // Joined
  employee?: { id: string; full_name: string; employee_number: string; position: string; avatar_url: string | null } | null;
  reviewer?: { id: string; full_name: string } | null;
};

export type RRHHKPIs = {
  headcount: number;
  rotation: number;
  attendanceToday: number;
  contractsExpiring: number;
  payrollCostMonth: number;
  pendingLeaves: number;
  avgSeniority: number;
  overtimeCost: number;
};

// Label & Color Maps
export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  terminated: "Desvinculado",
  on_leave: "En Licencia",
};

export const EMPLOYEE_STATUS_COLORS: Record<EmployeeStatus, string> = {
  active: "#10B981",
  inactive: "#6B7280",
  terminated: "#EF4444",
  on_leave: "#F59E0B",
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  indefinite: "Indefinido",
  fixed: "Plazo Fijo",
  temporary: "Temporal",
  intern: "Pasantía",
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Presente",
  late: "Tardanza",
  absent: "Ausente",
  vacation: "Vacaciones",
  sick: "Enfermedad",
  permission: "Permiso",
  holiday: "Feriado",
};

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "#10B981",
  late: "#F59E0B",
  absent: "#EF4444",
  vacation: "#3B82F6",
  sick: "#8B5CF6",
  permission: "#06B6D4",
  holiday: "#6B7280",
};

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  vacation: "Vacaciones",
  sick: "Enfermedad",
  maternity: "Maternidad",
  paternity: "Paternidad",
  personal: "Personal",
  bereavement: "Duelo",
  unpaid: "Sin Sueldo",
};

export const LEAVE_TYPE_COLORS: Record<LeaveType, string> = {
  vacation: "#3B82F6",
  sick: "#8B5CF6",
  maternity: "#EC4899",
  paternity: "#06B6D4",
  personal: "#F59E0B",
  bereavement: "#6B7280",
  unpaid: "#EF4444",
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

export const LEAVE_STATUS_COLORS: Record<LeaveStatus, string> = {
  pending: "#F59E0B",
  approved: "#10B981",
  rejected: "#EF4444",
  cancelled: "#6B7280",
};

export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  calculated: "Calculada",
  approved: "Aprobada",
  paid: "Pagada",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pendiente",
  in_progress: "En Progreso",
  completed: "Completada",
  acknowledged: "Aceptada",
};

export const REVIEW_STATUS_COLORS: Record<ReviewStatus, string> = {
  pending: "#F59E0B",
  in_progress: "#3B82F6",
  completed: "#10B981",
  acknowledged: "#8B5CF6",
};

export const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
