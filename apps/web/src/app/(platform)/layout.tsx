import { Suspense } from "react";
import { GrixiOrb } from "@/components/layout/grixi-orb";
import { CommandPalette } from "@/components/layout/command-palette";
import { ActivityTrackerProvider } from "@/components/providers/activity-tracker-provider";

// All platform pages require Supabase at runtime — prevent static prerendering
export const dynamic = "force-dynamic";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-screen overflow-hidden bg-[var(--bg-primary)]">
      <main className="platform-dot-grid relative h-full overflow-y-auto p-6 pl-8">
        <div className="relative z-10">
          <ActivityTrackerProvider>{children}</ActivityTrackerProvider>
        </div>
      </main>
      <CommandPalette />
      <Suspense fallback={null}>
        <GrixiOrb />
      </Suspense>
    </div>
  );
}
