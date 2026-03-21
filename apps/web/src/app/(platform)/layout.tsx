import { Suspense } from "react";
import { GrixiOrb } from "@/components/layout/grixi-orb";
import { CommandPalette } from "@/components/layout/command-palette";
import { ActivityTrackerProvider } from "@/components/providers/activity-tracker-provider";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MobilePreviewWrapper } from "@/components/layout/mobile-preview";
import { PasskeyPromptBanner } from "@/components/layout/passkey-prompt-banner";
import { ViewportHeightFix } from "@/components/layout/viewport-height-fix";

// All platform pages require Supabase at runtime — prevent static prerendering
export const dynamic = "force-dynamic";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ViewportHeightFix />
      <MobilePreviewWrapper>
        {/*
          iOS PWA — JS-locked viewport height:
          
          --app-height is set by ViewportHeightFix using window.innerHeight.
          This is a frozen value that doesn't change during navigation.
          Falls back to 100vh on desktop/first render.
          
          flex-col layout: main (flex-1) + nav (shrink-0)
          Main ENDS where nav BEGINS — zero overlap.
        */}
        <div
          className="flex flex-col bg-[var(--bg-primary)] overflow-hidden"
          style={{ height: "var(--app-height, 100vh)" }}
        >
          <main
            className="platform-dot-grid relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden safe-area-all px-4 pb-6 md:px-6 md:pb-6 lg:px-8 lg:pb-8"
            style={{ paddingTop: "max(env(safe-area-inset-top, 0px) + 2rem, 2rem)" }}
          >
            <div className="relative z-10">
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
