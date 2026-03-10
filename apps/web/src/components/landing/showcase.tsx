"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";

gsap.registerPlugin(ScrollTrigger);

type ShowcaseItem = {
  label: string;
  title: string;
  titleAccent: string;
  description: string;
  image: string;
  imageAlt: string;
  reverse?: boolean;
};

const showcaseItems: ShowcaseItem[] = [
  {
    label: "Dashboards",
    title: "Visibilidad total.",
    titleAccent: "Datos en tiempo real.",
    description:
      "KPIs, gráficos interactivos y métricas de negocio en un solo dashboard. Conecta con SAP, ERPs y cualquier fuente de datos. Cada número se actualiza al instante en tiempo real.",
    image: "/brand/preview-dashboard.png",
    imageAlt: "Dashboard principal de GRIXI con KPIs y gráficos",
  },
  {
    label: "Almacenes 3D",
    title: "Tu almacén,",
    titleAccent: "en tres dimensiones.",
    description:
      "Visualización interactiva de racks, posiciones e inventario en 3D. Colores por estado, zoom inteligente, selección de posiciones. Todo conectado a tu sistema de origen en tiempo real.",
    image: "/brand/preview-warehouse.png",
    imageAlt: "Visualización 3D de almacén con racks codificados por color",
    reverse: true,
  },
  {
    label: "Inteligencia Artificial",
    title: "Pregunta cualquier cosa.",
    titleAccent: "La IA responde.",
    description:
      "Chat con IA integrado con function calling. Pregunta por un producto y te muestra su ubicación. Analiza tendencias, detecta anomalías y sugiere acciones — todo en lenguaje natural.",
    image: "/brand/preview-ai-chat.png",
    imageAlt: "Chat de IA de GRIXI con respuesta de inventario",
  },
];

export function Showcase() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Animate each showcase block
      const blocks = sectionRef.current?.querySelectorAll(".showcase-block");
      blocks?.forEach((block) => {
        const text = block.querySelector(".showcase-text");
        const img = block.querySelector(".showcase-img");

        if (text) {
          gsap.fromTo(
            text,
            { y: 60, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 1,
              ease: "power4.out",
              scrollTrigger: {
                trigger: block,
                start: "top 75%",
                toggleActions: "play none none none",
              },
            }
          );
        }

        if (img) {
          gsap.fromTo(
            img,
            { y: 40, opacity: 0, scale: 0.97 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 1.2,
              ease: "power4.out",
              scrollTrigger: {
                trigger: block,
                start: "top 70%",
                toggleActions: "play none none none",
              },
              delay: 0.15,
            }
          );
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[var(--bg-primary)] px-6 py-20 lg:px-10 lg:py-32"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col gap-28 lg:gap-40">
          {showcaseItems.map((item) => (
            <div
              key={item.label}
              className={`showcase-block flex flex-col gap-10 lg:gap-16 ${
                item.reverse
                  ? "lg:flex-row-reverse"
                  : "lg:flex-row"
              } lg:items-center`}
            >
              {/* Text side */}
              <div className="showcase-text flex flex-col lg:w-[40%]">
                <span className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--brand)]">
                  {item.label}
                </span>
                <h3 className="font-[family-name:var(--font-instrument-serif)] text-[clamp(2rem,4vw,3.5rem)] leading-[1.05] tracking-[-0.02em] text-[var(--text-primary)]">
                  {item.title}
                  <br />
                  <span className="italic">{item.titleAccent}</span>
                </h3>
                <p className="mt-6 text-[15px] leading-[1.8] text-[var(--text-secondary)]">
                  {item.description}
                </p>
              </div>

              {/* Image side */}
              <div className="showcase-img lg:w-[60%]">
                <div className="showcase-image">
                  <Image
                    src={item.image}
                    alt={item.imageAlt}
                    width={900}
                    height={560}
                    className="h-auto w-full"
                    quality={95}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
