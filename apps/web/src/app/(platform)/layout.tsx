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
          iOS PWA Architecture:
          - MobileNav is OUTSIDE the overflow-hidden container
          - This prevents iOS from misplacing fixed elements
          - The main container uses h-screen but nav is a sibling, not a child
        */}
        <div className="relative h-full overflow-hidden bg-[var(--bg-primary)]">
          <main className="platform-dot-grid relative h-full overflow-y-auto overflow-x-hidden mobile-content-bottom safe-area-all px-4 pt-6 pb-4 md:px-8 md:pt-8 md:pb-6 lg:px-16 lg:pt-10 lg:pb-8 xl:px-24">
            <div className="relative z-10 mx-auto max-w-[1440px]">
              <PasskeyPromptBanner />
              <ActivityTrackerProvider>{children}</ActivityTrackerProvider>
            </div>
          </main>
          <CommandPalette />
          <Suspense fallback={null}>
            <GrixiOrb />
          </Suspense>
        </div>
        {/* Nav is OUTSIDE the overflow-hidden container — critical for iOS */}
        <MobileNav />
      </MobilePreviewWrapper>
    </>
  );
}
