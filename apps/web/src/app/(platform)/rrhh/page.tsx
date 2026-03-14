import { Suspense } from "react";
import { RRHHContent } from "@/features/rrhh/components/rrhh-content";
import {
  fetchEmployees,
  fetchDepartments,
  fetchAttendanceRecords,
  fetchPayrollRecords,
  fetchLeaveRequests,
  fetchPerformanceReviews,
  fetchRRHHKPIs,
} from "@/features/rrhh/actions/rrhh-actions";

export const dynamic = "force-dynamic";

function RRHHSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-4 w-40 rounded bg-[var(--bg-muted)]" />
          <div className="mt-2 h-3 w-64 rounded bg-[var(--bg-muted)]" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-lg bg-[var(--bg-muted)]" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-[var(--bg-muted)]" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 rounded-xl bg-[var(--bg-muted)]" />
        <div className="h-64 rounded-xl bg-[var(--bg-muted)]" />
      </div>
    </div>
  );
}

export default async function RRHHPage() {
  const [
    employees,
    departments,
    attendance,
    payroll,
    leaves,
    reviews,
    kpis,
  ] = await Promise.all([
    fetchEmployees(),
    fetchDepartments(),
    fetchAttendanceRecords(),
    fetchPayrollRecords(),
    fetchLeaveRequests(),
    fetchPerformanceReviews(),
    fetchRRHHKPIs(),
  ]);

  return (
    <Suspense fallback={<RRHHSkeleton />}>
      <RRHHContent
        initialEmployees={employees}
        initialDepartments={departments}
        initialAttendance={attendance}
        initialPayroll={payroll}
        initialLeaves={leaves}
        initialReviews={reviews}
        initialKPIs={kpis}
      />
    </Suspense>
  );
}
