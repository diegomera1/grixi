"use client";

import { useEffect, useCallback, useRef } from "react";
import type { VentasKPIs, SalesCustomer, SalesOpportunity, SalesInvoice, SalesQuote, SalesPipelineStage, TopProduct } from "../types";
import { analyzeDemoStep, type DemoStepId } from "../actions/demo-ai-action";
import "../../almacenes/styles/driver-theme.css";

// ── Types ────────────────────────────────────────────
type Tab = "dashboard" | "clientes" | "ventas" | "pipeline" | "cotizaciones" | "reportes";

type VentasTourProps = {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: Tab) => void;
  dataContext: {
    kpis: VentasKPIs;
    customers: SalesCustomer[];
    opportunities: SalesOpportunity[];
    invoices: SalesInvoice[];
    quotes: SalesQuote[];
    stages: SalesPipelineStage[];
    topProducts: TopProduct[];
  };
};

type TourStepDef = {
  element?: string;
  popover: {
    title: string;
    description: string;
    popoverClass?: string;
    side?: "top" | "bottom" | "left" | "right";
    align?: "start" | "center" | "end";
  };
  navigateTo?: Tab;
  aiStepId?: DemoStepId;
};

// ── AI data builder ──────────────────────────────────
function getAIData(
  stepId: DemoStepId,
  ctx: VentasTourProps["dataContext"]
): Record<string, unknown> {
  switch (stepId) {
    case "dashboard":
      return { kpis: ctx.kpis, topProducts: ctx.topProducts };
    case "clientes":
      return { customers: ctx.customers };
    case "ventas":
      return { invoices: ctx.invoices };
    case "pipeline":
      return { stages: ctx.stages, opportunities: ctx.opportunities };
    case "cotizaciones":
      return { quotes: ctx.quotes };
    case "reportes":
      return { invoices: ctx.invoices, customers: ctx.customers };
    default:
      return {};
  }
}

// ── Tour Steps ───────────────────────────────────────
function getTourSteps(): TourStepDef[] {
  return [
    // 0: WELCOME
    {
      popover: {
        title: '<span class="tour-icon tour-icon--brand">V</span> Bienvenido a Ventas & CRM',
        description: `
          Tour interactivo del módulo de <strong>Ventas & CRM</strong> de GRIXI.
          Recorreremos las <strong>6 secciones</strong>: Dashboard, Clientes, Ventas, Pipeline, Cotizaciones y Reportes.<br/><br/>
          En cada sección, <strong>GRIXI AI</strong> analizará la data real y generará insights ejecutivos.
        `,
        popoverClass: "welcome-step",
      },
    },

    // 1: HEADER
    {
      element: '[data-tour="ventas-header"]',
      popover: {
        title: '<span class="tour-icon tour-icon--brand">H</span> Cabecera del Módulo',
        description: `
          Controles del módulo: <strong>Nueva Venta</strong> para crear facturas, <strong>Demo IA</strong> para este tour,
          y el <strong>Switcher de Roles</strong> que simula vistas de Admin, Manager, Supervisor y Vendedor.
        `,
        side: "bottom",
        align: "start",
      },
    },

    // 2: TABS
    {
      element: '[data-tour="ventas-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--blue">N</span> Navegación por Secciones',
        description: `
          6 pestañas: <strong>Dashboard</strong> (KPIs y métricas), <strong>Clientes</strong> (CRM), 
          <strong>Ventas</strong> (facturación), <strong>Pipeline</strong> (oportunidades), 
          <strong>Cotizaciones</strong> (propuestas) y <strong>Reportes</strong> (análisis geográfico).
        `,
        side: "bottom",
        align: "center",
      },
    },

    // 3: DASHBOARD — KPIs
    {
      element: '[data-tour="ventas-content"]',
      popover: {
        title: '<span class="tour-icon tour-icon--emerald">K</span> Dashboard — KPIs en Tiempo Real',
        description: '<em>Cargando análisis IA...</em>',
        side: "bottom",
        align: "start",
      },
      aiStepId: "dashboard",
    },

    // 4: CLIENTES — navigate
    {
      element: '[data-tour="ventas-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--cyan">C</span> Clientes',
        description: `
          Cartera de clientes con segmentación inteligente: <strong>Champion</strong>, <strong>Loyal</strong>, 
          <strong>New</strong>, <strong>At Risk</strong>, <strong>Dormant</strong> y <strong>Prospect</strong>.
        `,
        side: "bottom",
        align: "center",
      },
      navigateTo: "clientes",
    },

    // 5: CLIENTES — content + AI
    {
      element: '[data-tour="ventas-content"]',
      popover: {
        title: '<span class="tour-icon tour-icon--cyan">A</span> Análisis de Clientes',
        description: '<em>Cargando análisis IA...</em>',
        side: "top",
        align: "start",
      },
      aiStepId: "clientes",
    },

    // 6: VENTAS — navigate
    {
      element: '[data-tour="ventas-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--emerald">V</span> Facturación',
        description: `
          Registro completo de ventas y facturas con estados: <strong>Pagada</strong>, <strong>Pendiente</strong>, 
          <strong>Vencida</strong> y <strong>Cancelada</strong>.
        `,
        side: "bottom",
        align: "center",
      },
      navigateTo: "ventas",
    },

    // 7: VENTAS — content + AI
    {
      element: '[data-tour="ventas-content"]',
      popover: {
        title: '<span class="tour-icon tour-icon--emerald">I</span> Análisis de Facturación',
        description: '<em>Cargando análisis IA...</em>',
        side: "top",
        align: "start",
      },
      aiStepId: "ventas",
    },

    // 8: PIPELINE — navigate
    {
      element: '[data-tour="ventas-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--blue">P</span> Pipeline de Ventas',
        description: `
          Embudo comercial interactivo: desde <strong>Prospección</strong> hasta <strong>Cierre</strong>. 
          Drag & drop para mover oportunidades entre etapas.
        `,
        side: "bottom",
        align: "center",
      },
      navigateTo: "pipeline",
    },

    // 9: PIPELINE — content + AI
    {
      element: '[data-tour="ventas-content"]',
      popover: {
        title: '<span class="tour-icon tour-icon--blue">F</span> Análisis del Pipeline',
        description: '<em>Cargando análisis IA...</em>',
        side: "top",
        align: "start",
      },
      aiStepId: "pipeline",
    },

    // 10: COTIZACIONES — navigate
    {
      element: '[data-tour="ventas-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--amber">Q</span> Cotizaciones',
        description: `
          Gestión de propuestas comerciales: crear, enviar, dar seguimiento y convertir a ventas.
        `,
        side: "bottom",
        align: "center",
      },
      navigateTo: "cotizaciones",
    },

    // 11: COTIZACIONES — content + AI
    {
      element: '[data-tour="ventas-content"]',
      popover: {
        title: '<span class="tour-icon tour-icon--amber">C</span> Análisis de Cotizaciones',
        description: '<em>Cargando análisis IA...</em>',
        side: "top",
        align: "start",
      },
      aiStepId: "cotizaciones",
    },

    // 12: REPORTES — navigate
    {
      element: '[data-tour="ventas-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--indigo">R</span> Reportes Geográficos',
        description: `
          Mapa mundial interactivo con distribución de revenue por país. 
          Click en un país para ver detalle de clientes y facturas.
        `,
        side: "bottom",
        align: "center",
      },
      navigateTo: "reportes",
    },

    // 13: REPORTES — content + AI
    {
      element: '[data-tour="ventas-content"]',
      popover: {
        title: '<span class="tour-icon tour-icon--indigo">G</span> Análisis Geográfico',
        description: '<em>Cargando análisis IA...</em>',
        side: "top",
        align: "start",
      },
      aiStepId: "reportes",
    },

    // 14: FINISH
    {
      popover: {
        title: '<span class="tour-icon tour-icon--brand">✓</span> Tour Completado',
        description: `
          Ha recorrido las <strong>6 secciones</strong> de Ventas & CRM con análisis de <strong>GRIXI AI</strong>.
          Reinicie desde el botón <strong>Demo IA</strong> en la cabecera.
        `,
        popoverClass: "welcome-step",
      },
    },
  ];
}

// ── Scroll helper ────────────────────────────────────
function scrollToTourElement(selector?: string) {
  if (!selector) return;
  const el = document.querySelector(selector);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// ── Main Component ───────────────────────────────────
export function VentasTour({ isOpen, onClose, setActiveTab, dataContext }: VentasTourProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const driverRef = useRef<any>(null);
  const setActiveTabRef = useRef(setActiveTab);
  const onCloseRef = useRef(onClose);
  const dataRef = useRef(dataContext);
  setActiveTabRef.current = setActiveTab;
  onCloseRef.current = onClose;
  dataRef.current = dataContext;

  const startTour = useCallback(async () => {
    if (driverRef.current) {
      try { driverRef.current.destroy(); } catch { /* noop */ }
      driverRef.current = null;
    }

    const { driver } = await import("driver.js");
    // @ts-expect-error -- CSS import has no type declarations
    await import("driver.js/dist/driver.css");

    const steps = getTourSteps();
    const totalSteps = steps.length;

    const driverSteps = steps.map((s) => ({
      element: s.element,
      popover: s.popover,
    }));

    const driverObj = driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      stagePadding: 8,
      stageRadius: 12,
      allowClose: true,
      doneBtnText: "Finalizar",
      nextBtnText: "Siguiente",
      prevBtnText: "Anterior",
      progressText: "{{current}} / {{total}}",
      popoverClass: "grixi-tour",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPopoverRender: (popover: any) => {
        const currentIdx = driverObj.getActiveIndex() ?? 0;
        const progress = ((currentIdx + 1) / totalSteps) * 100;
        popover.wrapper.style.setProperty("--tour-progress", `${progress}%`);
      },
      onHighlightStarted: () => {
        const currentIdx = driverObj.getActiveIndex() ?? 0;
        const stepDef = steps[currentIdx];

        // Trigger AI analysis for steps that have aiStepId
        if (stepDef?.aiStepId) {
          const data = getAIData(stepDef.aiStepId, dataRef.current);
          analyzeDemoStep({ stepId: stepDef.aiStepId, data }).then((result) => {
            // Update the popover description with AI insight
            const descEl = document.querySelector(".driver-popover-description");
            if (descEl) {
              descEl.innerHTML = `
                <div style="display:flex;align-items:start;gap:8px;margin-bottom:6px;">
                  <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:rgba(139,92,246,0.12);color:#8B5CF6;font-size:10px;flex-shrink:0;margin-top:1px;">AI</span>
                  <span style="font-size:11px;line-height:1.6;">${result.insight}</span>
                </div>
              `;
            }
          });
        }
      },
      onNextClick: () => {
        const currentIdx = driverObj.getActiveIndex() ?? 0;
        const stepDef = steps[currentIdx];

        if (stepDef?.navigateTo) {
          setActiveTabRef.current(stepDef.navigateTo);
          const nextStep = steps[currentIdx + 1];
          setTimeout(() => {
            scrollToTourElement(nextStep?.element);
            setTimeout(() => {
              driverObj.moveNext();
            }, 300);
          }, 500);
        } else if (currentIdx === totalSteps - 1) {
          driverObj.destroy();
          onCloseRef.current();
        } else {
          const nextStep = steps[currentIdx + 1];
          if (nextStep?.element) {
            scrollToTourElement(nextStep.element);
            setTimeout(() => {
              driverObj.moveNext();
            }, 250);
          } else {
            driverObj.moveNext();
          }
        }
      },
      onPrevClick: () => {
        const currentIdx = driverObj.getActiveIndex() ?? 0;
        if (currentIdx <= 0) return;

        const prevStepDef = steps[currentIdx - 1];

        if (steps[currentIdx]?.navigateTo) {
          let targetTab: Tab = "dashboard";
          for (let i = currentIdx - 1; i >= 0; i--) {
            if (steps[i].navigateTo) {
              targetTab = steps[i].navigateTo!;
              break;
            }
          }
          setActiveTabRef.current(targetTab);
          setTimeout(() => {
            scrollToTourElement(prevStepDef?.element);
            setTimeout(() => {
              driverObj.movePrevious();
            }, 300);
          }, 500);
        } else if (prevStepDef?.navigateTo) {
          setActiveTabRef.current(prevStepDef.navigateTo);
          setTimeout(() => {
            scrollToTourElement(prevStepDef.element);
            setTimeout(() => {
              driverObj.movePrevious();
            }, 300);
          }, 500);
        } else {
          scrollToTourElement(prevStepDef?.element);
          setTimeout(() => {
            driverObj.movePrevious();
          }, 200);
        }
      },
      onDestroyStarted: () => {
        driverObj.destroy();
        onCloseRef.current();
      },
      steps: driverSteps,
    });

    driverRef.current = driverObj;

    // Start on Dashboard
    setActiveTabRef.current("dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      driverObj.drive();
    }, 400);
  }, []);

  useEffect(() => {
    if (isOpen) {
      startTour();
    }

    return () => {
      if (driverRef.current) {
        try {
          driverRef.current.destroy();
        } catch {
          // driver already destroyed
        }
        driverRef.current = null;
      }
    };
  }, [isOpen, startTour]);

  return null;
}
