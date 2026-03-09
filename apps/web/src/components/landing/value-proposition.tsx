"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function Statement() {
  const sectionRef = useRef<HTMLElement>(null);
  const line1Ref = useRef<HTMLDivElement>(null);
  const line2Ref = useRef<HTMLDivElement>(null);
  const line3Ref = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const lines = [line1Ref.current, line2Ref.current, line3Ref.current];

      lines.forEach((line, i) => {
        gsap.fromTo(
          line,
          { y: 80, opacity: 0, clipPath: "inset(100% 0 0 0)" },
          {
            y: 0,
            opacity: 1,
            clipPath: "inset(0% 0 0 0)",
            duration: 1.2,
            ease: "power4.out",
            scrollTrigger: {
              trigger: line,
              start: "top 85%",
              end: "top 50%",
              toggleActions: "play none none none",
            },
            delay: i * 0.15,
          }
        );
      });

      gsap.fromTo(
        descRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: descRef.current,
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
        <div className="grid gap-16 lg:grid-cols-[1fr_400px] lg:gap-20 xl:grid-cols-[1fr_480px]">
          {/* Left: Big editorial text */}
          <div className="flex flex-col gap-2">
            <div ref={line1Ref} className="overflow-hidden">
              <span className="block font-[family-name:var(--font-instrument-serif)] text-[clamp(2.5rem,6vw,6rem)] leading-[1] tracking-[-0.03em] text-[var(--text-primary)]">
                Conecta tus
              </span>
            </div>
            <div ref={line2Ref} className="overflow-hidden">
              <span className="block font-[family-name:var(--font-instrument-serif)] text-[clamp(2.5rem,6vw,6rem)] italic leading-[1] tracking-[-0.03em] text-[var(--brand)]">
                sistemas,
              </span>
            </div>
            <div ref={line3Ref} className="overflow-hidden">
              <span className="block font-[family-name:var(--font-instrument-serif)] text-[clamp(2.5rem,6vw,6rem)] leading-[1] tracking-[-0.03em] text-[var(--text-primary)]">
                libera datos.
              </span>
            </div>
          </div>

          {/* Right: Description */}
          <div className="flex items-end lg:pb-4">
            <p
              ref={descRef}
              className="text-[15px] leading-[1.8] text-[var(--text-secondary)]"
            >
              GRIXI es la plataforma enterprise que se conecta con SAP, ERPs,
              CRMs, IoT y cualquier fuente de datos que necesites. Unifica toda
              la información de tu empresa en un solo lugar, con visualización
              3D, auditoría inteligente, y predicciones con Gemini AI. Diseñada
              para empresas que necesitan control total sobre su operación.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
