import { Suspense } from "react";
import {
  fetchPurchaseOrders,
  fetchVendors,
  fetchRequisitions,
  fetchGoodsReceipts,
  fetchComprasKPIs,
} from "@/features/compras/actions/compras-actions";
import { ComprasContent } from "@/features/compras/components/compras-content";

export const metadata = {
  title: "Compras",
};

export default async function ComprasPage() {
  const [orders, vendors, requisitions, receipts, kpis] = await Promise.all([
    fetchPurchaseOrders(),
    fetchVendors(),
    fetchRequisitions(),
    fetchGoodsReceipts(),
    fetchComprasKPIs(),
  ]);

  return (
    <Suspense fallback={<ComprasLoadingSkeleton />}>
      <ComprasContent
        initialOrders={orders}
        initialVendors={vendors}
        initialRequisitions={requisitions}
        initialReceipts={receipts}
        initialKPIs={kpis}
      />
    </Suspense>
  );
}

function ComprasLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded-lg bg-[var(--bg-muted)]" />
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[var(--bg-muted)]" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-[var(--bg-muted)]" />
    </div>
  );
}
