"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  simulateCheckIn,
  simulateLeaveRequest,
  simulateLeaveApproval,
} from "../actions/rrhh-demo";

export type DemoEvent = {
  id: string;
  type: "check-in" | "check-out" | "leave-request" | "leave-approval";
  message: string;
  color: string;
  timestamp: Date;
};

const EVENT_ICONS: Record<DemoEvent["type"], string> = {
  "check-in": "🟢",
  "check-out": "🔵",
  "leave-request": "📋",
  "leave-approval": "✅",
};

const EVENT_COLORS: Record<DemoEvent["type"], string> = {
  "check-in": "#10B981",
  "check-out": "#3B82F6",
  "leave-request": "#F59E0B",
  "leave-approval": "#8B5CF6",
};

const LEAVE_TYPE_ES: Record<string, string> = {
  vacation: "Vacaciones",
  sick: "Enfermedad",
  personal: "Personal",
  maternity: "Maternidad",
  paternity: "Paternidad",
};

export function useRRHHDemo(enabled = true) {
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cycleRef = useRef(0);

  const addEvent = useCallback((event: Omit<DemoEvent, "id" | "timestamp">) => {
    const newEvent: DemoEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setEvents((prev) => [newEvent, ...prev].slice(0, 20)); // Keep last 20
  }, []);

  const runCycle = useCallback(async () => {
    const cycle = cycleRef.current++;
    const action = cycle % 5; // Rotate through actions

    try {
      switch (action) {
        case 0:
        case 1:
        case 2: {
          // Most common: attendance check-in (3 out of 5 cycles)
          const result = await simulateCheckIn();
          if (result.success && result.employeeName) {
            const type = result.status === "check-out" ? "check-out" : "check-in";
            const statusLabel =
              result.status === "check-out"
                ? "registró salida"
                : result.status === "present"
                  ? "marcó entrada"
                  : result.status === "late"
                    ? "llegó tarde"
                    : `estado: ${result.status}`;
            addEvent({
              type,
              message: `${result.employeeName} ${statusLabel}`,
              color: EVENT_COLORS[type],
            });
          }
          break;
        }
        case 3: {
          // Leave request
          const result = await simulateLeaveRequest();
          if (result.success && result.employeeName) {
            addEvent({
              type: "leave-request",
              message: `${result.employeeName} solicitó ${LEAVE_TYPE_ES[result.type || "vacation"] || result.type}`,
              color: EVENT_COLORS["leave-request"],
            });
          }
          break;
        }
        case 4: {
          // Leave approval
          const result = await simulateLeaveApproval();
          if (result.success && result.employeeName) {
            const label = result.action === "approved" ? "aprobado" : "rechazado";
            addEvent({
              type: "leave-approval",
              message: `Permiso de ${result.employeeName} fue ${label}`,
              color: result.action === "approved" ? "#10B981" : "#EF4444",
            });
          }
          break;
        }
      }
    } catch (e) {
      // Silently ignore — demo shouldn't break the app
      console.warn("Demo simulation error:", e);
    }
  }, [addEvent]);

  useEffect(() => {
    if (!enabled) return;

    // Start after a small delay
    const startDelay = setTimeout(() => {
      setIsRunning(true);
      // Run first cycle immediately
      runCycle();
      // Then every 3-6 seconds
      intervalRef.current = setInterval(() => {
        runCycle();
      }, 3000 + Math.random() * 3000);
    }, 1500);

    return () => {
      clearTimeout(startDelay);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsRunning(false);
    };
  }, [enabled, runCycle]);

  return { events, isRunning };
}
