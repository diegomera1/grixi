"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type {
  VentasKPIs,
  SalesCustomer,
  SalesOpportunity,
  SalesInvoice,
  SalesQuote,
  SalesPipelineStage,
  TopProduct,
} from "../types";
import { analyzeDemoStep, type DemoStepId } from "../actions/demo-ai-action";

// ── Types ─────────────────────────────────────────

type DemoStatus = "idle" | "running" | "loading" | "paused" | "completed";

type DemoStep = {
  id: DemoStepId;
  tabLabel: string;
  description: string;
};

type DemoState = {
  status: DemoStatus;
  currentStepIndex: number;
  currentInsight: string | null;
  isAnalyzing: boolean;
  steps: DemoStep[];
};

type DemoContextValue = DemoState & {
  startDemo: () => void;
  nextStep: () => void;
  prevStep: () => void;
  pauseDemo: () => void;
  resumeDemo: () => void;
  stopDemo: () => void;
  currentStep: DemoStep | null;
};

// ── Constants ─────────────────────────────────────

const DEMO_STEPS: DemoStep[] = [
  { id: "dashboard", tabLabel: "Dashboard", description: "KPIs principales y métricas de rendimiento" },
  { id: "clientes", tabLabel: "Clientes", description: "Cartera de clientes y segmentación" },
  { id: "ventas", tabLabel: "Ventas", description: "Facturación y registro de ventas" },
  { id: "pipeline", tabLabel: "Pipeline", description: "Oportunidades y embudo comercial" },
  { id: "cotizaciones", tabLabel: "Cotizaciones", description: "Propuestas comerciales y seguimiento" },
  { id: "reportes", tabLabel: "Reportes", description: "Análisis geográfico y visualizaciones" },
];

// ── Context ───────────────────────────────────────

const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemoTour() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemoTour must be used within DemoTourProvider");
  return ctx;
}

// ── Provider ──────────────────────────────────────

type ProviderProps = {
  children: ReactNode;
  onTabChange: (tab: string) => void;
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

export function DemoTourProvider({ children, onTabChange, dataContext }: ProviderProps) {
  const [state, setState] = useState<DemoState>({
    status: "idle",
    currentStepIndex: 0,
    currentInsight: null,
    isAnalyzing: false,
    steps: DEMO_STEPS,
  });

  const abortRef = useRef(false);

  // Build the data payload for a given step
  const getStepData = useCallback(
    (stepId: DemoStepId): Record<string, unknown> => {
      switch (stepId) {
        case "dashboard":
          return { kpis: dataContext.kpis, topProducts: dataContext.topProducts };
        case "clientes":
          return { customers: dataContext.customers };
        case "ventas":
          return { invoices: dataContext.invoices };
        case "pipeline":
          return { stages: dataContext.stages, opportunities: dataContext.opportunities };
        case "cotizaciones":
          return { quotes: dataContext.quotes };
        case "reportes":
          return { invoices: dataContext.invoices, customers: dataContext.customers };
        default:
          return {};
      }
    },
    [dataContext]
  );

  // Analyze current step with AI
  const analyzeStep = useCallback(
    async (stepIndex: number) => {
      const step = DEMO_STEPS[stepIndex];
      if (!step) return;

      // Switch tab
      onTabChange(step.id);

      // Show loading state
      setState((prev) => ({
        ...prev,
        isAnalyzing: true,
        currentInsight: null,
      }));

      // Small delay so the tab renders before analysis
      await new Promise((r) => setTimeout(r, 600));

      if (abortRef.current) return;

      // Call AI
      const data = getStepData(step.id);
      const result = await analyzeDemoStep({ stepId: step.id, data });

      if (abortRef.current) return;

      setState((prev) => ({
        ...prev,
        isAnalyzing: false,
        currentInsight: result.insight,
      }));
    },
    [onTabChange, getStepData]
  );

  const startDemo = useCallback(() => {
    abortRef.current = false;
    setState({
      status: "running",
      currentStepIndex: 0,
      currentInsight: null,
      isAnalyzing: false,
      steps: DEMO_STEPS,
    });
    analyzeStep(0);
  }, [analyzeStep]);

  const nextStep = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.currentStepIndex + 1;
      if (nextIndex >= DEMO_STEPS.length) {
        return { ...prev, status: "completed", currentInsight: "🎉 Demo completada. Has recorrido todos los módulos de Ventas & CRM de GRIXI." };
      }
      analyzeStep(nextIndex);
      return { ...prev, currentStepIndex: nextIndex, status: "running" };
    });
  }, [analyzeStep]);

  const prevStep = useCallback(() => {
    setState((prev) => {
      const prevIndex = Math.max(0, prev.currentStepIndex - 1);
      analyzeStep(prevIndex);
      return { ...prev, currentStepIndex: prevIndex, status: "running" };
    });
  }, [analyzeStep]);

  const pauseDemo = useCallback(() => {
    setState((prev) => ({ ...prev, status: "paused" }));
  }, []);

  const resumeDemo = useCallback(() => {
    setState((prev) => ({ ...prev, status: "running" }));
  }, []);

  const stopDemo = useCallback(() => {
    abortRef.current = true;
    setState({
      status: "idle",
      currentStepIndex: 0,
      currentInsight: null,
      isAnalyzing: false,
      steps: DEMO_STEPS,
    });
  }, []);

  const currentStep = state.status !== "idle" ? DEMO_STEPS[state.currentStepIndex] || null : null;

  return (
    <DemoContext.Provider
      value={{
        ...state,
        currentStep,
        startDemo,
        nextStep,
        prevStep,
        pauseDemo,
        resumeDemo,
        stopDemo,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
