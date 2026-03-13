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
          iOS PWA — NO OVERLAP layout:
          
          The critical fix: main and nav must NOT overlap.
          Previous approach: main=h-full (100% viewport) + nav=position:fixed
          Problem: main's scroll container intercepted touch events over the nav
          
          Current approach: flex column layout
          - Outer div: h-full (fills locked body), flex-col
          - Main: flex-1 (takes remaining space after nav)
          - Nav: shrink-0 (takes exactly what it needs)
          - Main ENDS where nav BEGINS — zero overlap
          - No position:fixed on nav, no mobile-content-bottom padding needed
        */}
        <div className="h-full flex flex-col bg-[var(--bg-primary)]">
          <main className="platform-dot-grid relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden safe-area-all px-4 pt-6 pb-4 md:px-8 md:pt-8 md:pb-6 lg:px-16 lg:pt-10 lg:pb-8 xl:px-24">
            <div className="relative z-10 mx-auto max-w-[1440px]">
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
