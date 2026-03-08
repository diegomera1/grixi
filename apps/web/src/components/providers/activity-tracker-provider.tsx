"use client";

import { useActivityTracker } from "@/lib/hooks/use-activity-tracker";

export function ActivityTrackerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useActivityTracker();
  return <>{children}</>;
}
