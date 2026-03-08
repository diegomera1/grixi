"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";

gsap.registerPlugin(ScrollTrigger);

export function CallToAction() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const btnRef = useRef<HTMLAnchorElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Horizontal line grows
      gsap.fromTo(
        lineRef.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.5,
          ease: "power4.inOut",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            toggleActions: "play none none none",
          },
        }
      );

      // Heading reveals
      gsap.fromTo(
        headingRef.current,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1.2,
          ease: "power4.out",
          scrollTrigger: {
            trigger: headingRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );

      // Button reveals
      gsap.fromTo(
        btnRef.current,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: btnRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[var(--bg-primary)] px-6 py-32 lg:px-10 lg:py-48"
    >
      <div className="mx-auto max-w-[1800px]">
        {/* Horizontal line */}
        <div
          ref={lineRef}
          className="mb-20 h-px w-full origin-left bg-[var(--border)]"
        />

        {/* Content */}
        <div className="flex flex-col items-center text-center">
          <h2
            ref={headingRef}
            className="max-w-3xl font-[family-name:var(--font-instrument-serif)] text-[clamp(2rem,5vw,5rem)] leading-[1.05] tracking-[-0.03em] text-[var(--text-primary)]"
          >
            Empieza a ver <span className="italic text-[var(--brand)]">toda</span>{" "}
            tu empresa desde un solo lugar
          </h2>

          <Link
            ref={btnRef}
            href="/login"
            className="group mt-14 inline-flex items-center gap-3 rounded-full bg-[var(--text-primary)] px-8 py-4 text-[15px] font-medium text-[var(--bg-primary)] transition-all duration-500 hover:gap-5 hover:shadow-[0_0_40px_rgba(124,58,237,0.15)]"
          >
            Ingresar con Google
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="transition-transform duration-500 group-hover:translate-x-1"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
