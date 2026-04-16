"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Users,
  Receipt,
  KanbanSquare,
  FileText,
  BarChart3,
  Plus,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type {
  SalesCustomer,
  SalesOpportunity,
  SalesPipelineStage,
  SalesInvoice,
  SalesQuote,
  SalesActivity,
  SalesAlert,
  VentasKPIs,
  DemoRole,
  SellerProfile,
  TopProduct,
} from "../types";
import { RoleSwitcher } from "./role-switcher";
import { DashboardTab } from "./dashboard-tab";
import { ClientesTab } from "./clientes-tab";
import { VentasTab } from "./ventas-tab";
import { PipelineTab } from "./pipeline-tab";
import { CotizacionesTab } from "./cotizaciones-tab";
import { ReportesTab } from "./reportes-tab";
import { NuevaVentaModal } from "./nueva-venta-modal";
import { ROLE_PERMISSIONS } from "../types";
import { VentasTour } from "./ventas-tour";

type Tab = "dashboard" | "clientes" | "ventas" | "pipeline" | "cotizaciones" | "reportes";

const TABS: { id: Tab; label: string; icon: typeof TrendingUp; hiddenFor?: DemoRole[] }[] = [
  { id: "dashboard", label: "Dashboard", icon: TrendingUp },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "ventas", label: "Ventas", icon: Receipt },
  { id: "pipeline", label: "Pipeline", icon: KanbanSquare },
  { id: "cotizaciones", label: "Cotizaciones", icon: FileText },
  { id: "reportes", label: "Reportes", icon: BarChart3, hiddenFor: ["seller"] },
];

type Props = {
  initialCustomers: SalesCustomer[];
  initialOpportunities: SalesOpportunity[];
  initialPipelineStages: SalesPipelineStage[];
  initialInvoices: SalesInvoice[];
  initialQuotes: SalesQuote[];
  initialActivities: SalesActivity[];
  initialAlerts: SalesAlert[];
  initialKPIs: VentasKPIs;
  initialSellers: SellerProfile[];
  initialTopProducts: TopProduct[];
};

export function VentasContent({
  initialCustomers,
  initialOpportunities,
  initialPipelineStages,
  initialInvoices,
  initialQuotes,
  initialActivities,
  initialAlerts,
  initialKPIs,
  initialSellers,
  initialTopProducts,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [demoRole, setDemoRole] = useState<DemoRole>("admin");
  const [showNuevaVenta, setShowNuevaVenta] = useState(false);
  const [customers] = useState(initialCustomers);
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [invoices] = useState(initialInvoices);
  const [quotes] = useState(initialQuotes);
  const [alerts, setAlerts] = useState(initialAlerts);

  // Filter data based on role
  const filteredCustomers = filterByRole(customers, demoRole);
  const filteredOpportunities = filterByRole(opportunities, demoRole);
  const filteredInvoices = filterByRole(invoices, demoRole);
  const filteredQuotes = filterByRole(quotes, demoRole);

  // Filter visible tabs by role
  const visibleTabs = TABS.filter(
    (tab) => !tab.hiddenFor || !tab.hiddenFor.includes(demoRole)
  );

  // Ensure activeTab is visible
  if (!visibleTabs.find((t) => t.id === activeTab)) {
    setActiveTab(visibleTabs[0].id);
  }

  const handleOpportunityMove = useCallback(
    (oppId: string, newStageId: string) => {
      setOpportunities((prev) =>
        prev.map((o) =>
          o.id === oppId
            ? { ...o, stage_id: newStageId, stage_changed_at: new Date().toISOString() }
            : o
        )
      );
    },
    []
  );

  const handleAlertDismiss = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const [tourOpen, setTourOpen] = useState(false);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div data-tour="ventas-header" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Comercial & CRM
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            Pipeline comercial, clientes, cotizaciones y facturación
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ROLE_PERMISSIONS[demoRole].create && (
            <button
              onClick={() => setShowNuevaVenta(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-[10px] font-bold text-white shadow-lg shadow-[#3B82F6]/25 transition-all hover:bg-[#2563EB]"
            >
              <Plus size={12} />
              Nueva Venta
            </button>
          )}
          <button
            onClick={() => setTourOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] px-3 py-1.5 text-[10px] font-bold text-white shadow-lg shadow-[#8B5CF6]/25 transition-all hover:shadow-[#8B5CF6]/40 hover:scale-[1.02]"
          >
            <Sparkles size={12} />
            Demo IA
          </button>
          <RoleSwitcher activeRole={demoRole} onRoleChange={setDemoRole} />
          <div data-tour="ventas-tabs" className="grid grid-cols-3 gap-0.5 border-b border-[var(--border)] sm:flex sm:items-center sm:gap-1 md:grid-cols-6">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all relative",
                  "sm:justify-start sm:px-4",
                  activeTab === tab.id
                    ? "text-[#3B82F6]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                )}
              >
                <tab.icon size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="ventas-tab-indicator"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#3B82F6] rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          data-tour="ventas-content"
        >
          {activeTab === "dashboard" && (
            <DashboardTab
              kpis={initialKPIs}
              customers={filteredCustomers}
              opportunities={filteredOpportunities}
              invoices={filteredInvoices}
              alerts={alerts}
              pipelineStages={initialPipelineStages}
              topProducts={initialTopProducts}
              demoRole={demoRole}
              onAlertDismiss={handleAlertDismiss}
            />
          )}
          {activeTab === "clientes" && (
            <ClientesTab
              customers={filteredCustomers}
              sellers={initialSellers}
              demoRole={demoRole}
            />
          )}
          {activeTab === "ventas" && (
            <VentasTab
              invoices={filteredInvoices}
              customers={customers}
              demoRole={demoRole}
            />
          )}
          {activeTab === "pipeline" && (
            <PipelineTab
              stages={initialPipelineStages}
              opportunities={filteredOpportunities}
              sellers={initialSellers}
              onOpportunityMove={handleOpportunityMove}
              demoRole={demoRole}
            />
          )}
          {activeTab === "cotizaciones" && (
            <CotizacionesTab
              quotes={filteredQuotes}
              customers={customers}
              demoRole={demoRole}
            />
          )}
          {activeTab === "reportes" && (
            <ReportesTab
              invoices={invoices}
              customers={customers}
              opportunities={opportunities}
              quotes={quotes}
              demoRole={demoRole}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Nueva Venta Modal */}
      {showNuevaVenta && (
        <NuevaVentaModal
          customers={customers}
          onClose={() => setShowNuevaVenta(false)}
          onSave={() => {
            setShowNuevaVenta(false);
          }}
          demoRole={demoRole}
        />
      )}

      {/* Driver.js Tour with AI */}
      <VentasTour
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
        setActiveTab={setActiveTab}
        dataContext={{
          kpis: initialKPIs,
          customers,
          opportunities,
          invoices,
          quotes,
          stages: initialPipelineStages,
          topProducts: initialTopProducts,
        }}
      />
    </div>
  );
}



// ── Role-based data filtering (demo only) ─────────

const DEMO_SELLER_ID = "a0000001-0000-0000-0000-000000000007"; // Roberto Silva for demo

function filterByRole<
  T extends { seller_id?: string | null; assigned_seller_id?: string | null }
>(data: T[], role: DemoRole): T[] {
  if (role === "admin" || role === "manager") return data;

  if (role === "seller") {
    return data.filter(
      (item) =>
        item.seller_id === DEMO_SELLER_ID ||
        item.assigned_seller_id === DEMO_SELLER_ID
    );
  }

  // Supervisor: sees seller + ana_torres team
  if (role === "supervisor") {
    const teamIds = [
      DEMO_SELLER_ID,
      "a0000001-0000-0000-0000-000000000004", // Ana Torres
      "a0000001-0000-0000-0000-000000000001", // Carlos Mendoza
    ];
    return data.filter(
      (item) =>
        teamIds.includes(item.seller_id || "") ||
        teamIds.includes(item.assigned_seller_id || "")
    );
  }

  return data;
}
