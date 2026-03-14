"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LeaveRequest, AttendanceRecord } from "../types";

type UseRRHHRealtimeProps = {
  onLeaveChange?: (leave: LeaveRequest) => void;
  onAttendanceChange?: (record: AttendanceRecord) => void;
};

export function useRRHHRealtime({
  onLeaveChange,
  onAttendanceChange,
}: UseRRHHRealtimeProps) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("rrhh-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hr_leave_requests" },
        (payload) => {
          if (onLeaveChange && payload.new) {
            onLeaveChange(payload.new as unknown as LeaveRequest);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hr_attendance_records" },
        (payload) => {
          if (onAttendanceChange && payload.new) {
            onAttendanceChange(payload.new as unknown as AttendanceRecord);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onLeaveChange, onAttendanceChange]);
}
