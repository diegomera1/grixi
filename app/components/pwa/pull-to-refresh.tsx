/**
 * Pull-to-Refresh for PWA standalone mode
 * Only activates on touch devices in standalone mode (installed PWA)
 */
import { useState, useRef, useCallback, useEffect } from "react";

const THRESHOLD = 80; // px to trigger refresh
const MAX_PULL = 120;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const isPWA = useRef(false);

  useEffect(() => {
    isPWA.current = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isPWA.current || refreshing) return;
    if (window.scrollY > 5) return; // Only at top of page
    startY.current = e.touches[0].clientY;
    setPulling(true);
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta < 0) { setPulling(false); return; }
    const distance = Math.min(delta * 0.5, MAX_PULL);
    setPullDistance(distance);
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(() => {
    if (!pulling) return;
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      // Slight delay for visual feedback
      setTimeout(() => window.location.reload(), 400);
    } else {
      setPullDistance(0);
    }
    setPulling(false);
  }, [pulling, pullDistance]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
      style={{ overscrollBehaviorY: "contain" }}
    >
      {/* Pull indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="pointer-events-none fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-opacity"
          style={{ height: pullDistance, opacity: progress }}
        >
          <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-brand/20 ${refreshing ? "animate-spin" : ""}`}>
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              className="text-brand transition-transform"
              style={{ transform: `rotate(${progress * 360}deg)` }}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
