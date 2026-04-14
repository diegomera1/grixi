import { Suspense } from "react";
import {
  fetchCustomers,
  fetchOpportunities,
  fetchPipelineStages,
  fetchInvoices,
  fetchQuotes,
  fetchActivities,
  fetchAlerts,
  fetchVentasKPIs,
  fetchSellers,
  fetchTopProducts,
} from "@/features/ventas/actions/ventas-actions";
import { VentasContent } from "@/features/ventas/components/ventas-content";

export const metadata = {
  title: "Ventas",
};

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const [
    customers,
    opportunities,
    pipelineStages,
    invoices,
    quotes,
    activities,
    alerts,
    kpis,
    sellers,
    topProducts,
  ] = await Promise.all([
    fetchCustomers(),
    fetchOpportunities(),
    fetchPipelineStages(),
    fetchInvoices(),
    fetchQuotes(),
    fetchActivities(),
    fetchAlerts(),
    fetchVentasKPIs(),
    fetchSellers(),
    fetchTopProducts(),
  ]);

  return (
    <Suspense fallback={<VentasLoadingSkeleton />}>
      <VentasContent
        initialCustomers={customers}
        initialOpportunities={opportunities}
        initialPipelineStages={pipelineStages}
        initialInvoices={invoices}
        initialQuotes={quotes}
        initialActivities={activities}
        initialAlerts={alerts}
        initialKPIs={kpis}
        initialSellers={sellers}
        initialTopProducts={topProducts}
      />
    </Suspense>
  );
}

function VentasLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-10 w-64 rounded-lg bg-[var(--bg-muted)]" />
        <div className="h-8 w-32 rounded-full bg-[var(--bg-muted)]" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[var(--bg-muted)]" />
        ))}
      </div>
      <div className="h-96 rounded-xl bg-[var(--bg-muted)]" />
    </div>
  );
}
