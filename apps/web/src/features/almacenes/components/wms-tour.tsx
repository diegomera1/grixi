"use client";

import { useEffect, useCallback, useRef } from "react";
import type { WmsTab } from "../types";
import "../styles/driver-theme.css";

// ── Types ────────────────────────────────────────────
type WmsTourProps = {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: WmsTab) => void;
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
  navigateTo?: WmsTab;
};

// ── Tour Step Definitions ────────────────────────────
function getTourSteps(): TourStepDef[] {
  return [
    // 0: WELCOME
    {
      popover: {
        title: '<span class="tour-icon tour-icon--brand">W</span> Bienvenido al WMS',
        description: `
          <strong>Warehouse Management System</strong> de GRIXI — el centro de control para almacenes, inventarios, lotes, pedidos y operaciones logísticas.<br/><br/>
          Recorrido por las <strong>8 secciones</strong> del módulo. Duración: aprox. <strong>3 minutos</strong>.
        `,
        popoverClass: "welcome-step",
      },
    },

    // 1: HEADER
    {
      element: '[data-tour="wms-header"]',
      popover: {
        title: '<span class="tour-icon tour-icon--brand">H</span> Cabecera del Módulo',
        description: `
          Muestra el nombre, cantidad de almacenes activos y el indicador de estado. El botón <strong>Tutorial</strong> reinicia este recorrido.
        `,
        side: "bottom",
        align: "start",
      },
    },

    // 2: TABS
    {
      element: '[data-tour="wms-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--blue">N</span> Navegación por Secciones',
        description: `
          8 pestañas: <strong>Dashboard</strong> (KPIs), <strong>Almacenes</strong> (3D), <strong>Mov. Material</strong> (entradas/salidas/traspasos), <strong>Pedidos</strong>, <strong>Lotes</strong> (trazabilidad), <strong>Inv. Físico</strong> (conteos), <strong>Inventario</strong> (jerarquía) y <strong>Análisis IA</strong>.
        `,
        side: "bottom",
        align: "center",
      },
    },

    // 3: DASHBOARD KPIs
    {
      element: '[data-tour="dashboard-kpis"]',
      popover: {
        title: '<span class="tour-icon tour-icon--emerald">K</span> KPIs Operativos',
        description: `
          Indicadores en tiempo real: almacenes activos, posiciones totales, ocupación, entradas y salidas del día, pedidos pendientes. Los colores siguen una escala semáforo.<br/><br/>
          Más abajo encontrará la <strong>tendencia de movimientos</strong> (7 días), <strong>actividad reciente</strong>, <strong>vencimientos próximos</strong>, <strong>ocupación por almacén</strong> y el módulo de <strong>análisis con IA</strong>.
        `,
        side: "bottom",
        align: "start",
      },
    },

    // 4: ALMACENES — navigate
    {
      element: '[data-tour="wms-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--cyan">A</span> Almacenes',
        description: `
          Directorio de almacenes con dos modos: <strong>Tarjetas</strong> (estadísticas y códigos SAP) y <strong>Vista 3D Holográfica</strong> para explorar racks interactivamente.
        `,
        side: "bottom",
        align: "center",
      },
      navigateTo: "almacenes",
    },

    // 5: ALMACENES — content
    {
      element: '[data-tour="almacenes-content"]',
      popover: {
        title: '<span class="tour-icon tour-icon--cyan">V</span> Vista de Almacenes',
        description: `
          <strong>Tarjetas:</strong> Anillo de ocupación, tipo de almacén, conteo de racks y posiciones.<br/><br/>
          <strong>3D:</strong> Use el toggle superior para edificios tridimensionales. <code>Cmd+K</code> para búsqueda. Clic en un rack para inspeccionar inventario.
        `,
        side: "bottom",
        align: "start",
      },
    },

    // 6: OPERACIONES — navigate
    {
      element: '[data-tour="wms-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--emerald">M</span> Movimiento de Material',
        description: `
          Centro de operaciones logísticas con tres flujos SAP: <strong>Entradas (101)</strong>, <strong>Salidas (261)</strong> y <strong>Traspasos (311)</strong>.
        `,
        side: "bottom",
        align: "center",
      },
      navigateTo: "operaciones",
    },

    // 7: OPERACIONES — subtabs
    {
      element: '[data-tour="operations-subtabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--emerald">F</span> Flujos de Operación',
        description: `
          Filtre por tipo de movimiento. El badge numérico indica documentos pendientes. Alterne entre <strong>Movimiento de Material</strong> (activos) e <strong>Historial</strong> (completados).
        `,
        side: "bottom",
        align: "start",
      },
    },

    // 8: OPERACIONES — list
    {
      element: '[data-tour="operations-list"]',
      popover: {
        title: '<span class="tour-icon tour-icon--blue">D</span> Documentos Logísticos',
        description: `
          Clic en cualquier documento abre su perfil: líneas, ubicaciones, lotes, <strong>línea de tiempo</strong> y acciones de contabilización.
        `,
        side: "top",
        align: "start",
      },
    },

    // 9: OPERACIONES — new
    {
      element: '[data-tour="operations-new"]',
      popover: {
        title: '<span class="tour-icon tour-icon--emerald">N</span> Nuevo Movimiento',
        description: `
          Asistente guiado de 4 pasos: selección de orden, verificación de cantidades, asignación de ubicación (putaway) y confirmación.
        `,
        side: "bottom",
        align: "end",
      },
    },

    // 10: PEDIDOS — navigate
    {
      element: '[data-tour="wms-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--blue">P</span> Pedidos de Venta',
        description: `
          Pipeline de órdenes de venta: desde confirmación hasta despacho y entrega.
        `,
        side: "bottom",
        align: "center",
      },
      navigateTo: "pedidos",
    },

    // 11: PEDIDOS — content
    {
      element: '[data-tour="pedidos-content"]',
      popover: {
        title: '<span class="tour-icon tour-icon--blue">C</span> Ciclo de Vida del Pedido',
        description: `
          Estados: Pendiente, Confirmado, En Picking, Despachado, Entregado. El perfil de cada pedido muestra líneas, racks de picking en 3D y botón para crear <strong>Salida (GI)</strong> vinculada.
        `,
        side: "top",
        align: "start",
      },
    },

    // 12: LOTES — navigate
    {
      element: '[data-tour="wms-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--amber">L</span> Gestión de Lotes',
        description: `
          Trazabilidad completa con control de vencimientos bajo estrategia FEFO.
        `,
        side: "bottom",
        align: "center",
      },
      navigateTo: "lotes",
    },

    // 13: LOTES — content
    {
      element: '[data-tour="lotes-content"]',
      popover: {
        title: '<span class="tour-icon tour-icon--amber">T</span> Trazabilidad de Lotes',
        description: `
          Jerarquía: <strong>Material</strong> → <strong>Lote</strong> (proveedor, fechas, consumo) → <strong>UA</strong> (ubicación en rack). Lotes próximos a vencer se resaltan con alertas. Acciones rápidas: despachar FEFO, traspasar, cuarentena.
        `,
        side: "top",
        align: "start",
      },
    },

    // 14: CONTEOS — navigate
    {
      element: '[data-tour="wms-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--indigo">I</span> Inventario Físico',
        description: `
          Conteos cíclicos con validación 3D de racks para garantizar precisión.
        `,
        side: "bottom",
        align: "center",
      },
      navigateTo: "conteos",
    },

    // 15: CONTEOS — content
    {
      element: '[data-tour="conteos-content"]',
      popover: {
        title: '<span class="tour-icon tour-icon--indigo">C</span> Conteos Físicos',
        description: `
          Tipos: cíclico, anual, spot check, ABC y completo. Vista 3D del rack con colores: coincide, varianza detectada o pendiente. Flujo: seleccionar → contar → revisar varianzas → contabilizar ajustes.
        `,
        side: "top",
        align: "start",
      },
    },

    // 16: INVENTARIO — navigate
    {
      element: '[data-tour="wms-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--cyan">S</span> Inventario',
        description: `
          Stock consolidado con búsqueda global y filtros avanzados.
        `,
        side: "bottom",
        align: "center",
      },
      navigateTo: "inventario",
    },

    // 17: INVENTARIO — content
    {
      element: '[data-tour="inventario-content"]',
      popover: {
        title: '<span class="tour-icon tour-icon--cyan">J</span> Jerarquía de Stock',
        description: `
          Tres niveles: <strong>Material</strong> (nombre, SKU, stock), <strong>Lote</strong> (proveedor, vencimiento) y <strong>UA</strong> (código, tipo, ubicación). Clic en un material para expandir lotes y unidades. Búsqueda por nombre, SKU, lote, UA o rack.
        `,
        side: "top",
        align: "start",
      },
    },

    // 18: ANÁLISIS IA — navigate
    {
      element: '[data-tour="wms-tabs"]',
      popover: {
        title: '<span class="tour-icon tour-icon--brand">A</span> Análisis con IA',
        description: `
          Centro de inteligencia con Google Gemini: insights, alertas y recomendaciones accionables basadas en datos reales.
        `,
        side: "bottom",
        align: "center",
      },
      navigateTo: "analisis",
    },

    // 19: ANÁLISIS IA — content
    {
      element: '[data-tour="analisis-content"]',
      popover: {
        title: '<span class="tour-icon tour-icon--brand">G</span> GRIXI AI',
        description: `
          <strong>Insights automáticos</strong> que detectan riesgos y oportunidades. <strong>Reportes rápidos</strong> (ABC, tendencias, KPIs). <strong>Chat contextual</strong> en lenguaje natural con datos reales de su operación.
        `,
        side: "top",
        align: "start",
      },
    },

    // 20: FINISH
    {
      popover: {
        title: '<span class="tour-icon tour-icon--brand">F</span> Recorrido Finalizado',
        description: `
          Ha completado el tour por las 8 secciones del WMS. Reinicie desde el botón <strong>Tutorial</strong> en la cabecera. Para consultas, use <strong>GRIXI AI</strong> en Análisis.
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
export function WmsTour({ isOpen, onClose, setActiveTab }: WmsTourProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const driverRef = useRef<any>(null);
  const setActiveTabRef = useRef(setActiveTab);
  const onCloseRef = useRef(onClose);
  setActiveTabRef.current = setActiveTab;
  onCloseRef.current = onClose;

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
      onNextClick: () => {
        const currentIdx = driverObj.getActiveIndex() ?? 0;
        const stepDef = steps[currentIdx];

        if (stepDef?.navigateTo) {
          setActiveTabRef.current(stepDef.navigateTo);
          // Navigate, scroll, then advance
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
          // Pre-scroll the next element into view
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
          // Current step navigated to a tab, go back
          let targetTab: WmsTab = "dashboard";
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

    // Ensure start on Dashboard, scroll to top
    setActiveTabRef.current("dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      driverObj.drive();
    }, 400);

    localStorage.setItem("grixi-wms-tour-seen", "true");
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
