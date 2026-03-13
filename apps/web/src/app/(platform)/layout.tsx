import { Suspense } from "react";
import { GrixiOrb } from "@/components/layout/grixi-orb";
import { CommandPalette } from "@/components/layout/command-palette";
import { ActivityTrackerProvider } from "@/components/providers/activity-tracker-provider";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MobilePreviewWrapper } from "@/components/layout/mobile-preview";
import { PasskeyPromptBanner } from "@/components/layout/passkey-prompt-banner";

// All platform pages require Supabase at runtime — prevent static prerendering
export const dynamic = "force-dynamic";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MobilePreviewWrapper>
        {/*
          Layout strategy for iOS PWA:
          - Outer div: flex column, h-[100dvh] (dynamic viewport height, works with iOS safe areas)
          - Main: flex-1 + overflow-y-auto (takes all available space minus nav)
          - MobileNav: NOT fixed, but sticky at bottom via flex layout
          This avoids all iOS position:fixed bugs inside overflow containers.
        */}
        <div className="relative flex flex-col bg-[var(--bg-primary)] h-[100dvh] md:h-screen overflow-hidden">
          <main className="platform-dot-grid relative flex-1 overflow-y-auto overflow-x-hidden px-4 pt-6 pb-4 md:px-8 md:pt-8 md:pb-6 lg:px-16 lg:pt-10 lg:pb-8 xl:px-24">
            <div className="relative z-10 safe-area-all mx-auto max-w-[1440px]">
              <PasskeyPromptBanner />
              <ActivityTrackerProvider>{children}</ActivityTrackerProvider>
            </div>
          </main>
          <MobileNav />
          <CommandPalette />
          <Suspense fallback={null}>
            <GrixiOrb />
          </Suspense>
        </div>
      </MobilePreviewWrapper>
    </>
  );
}
