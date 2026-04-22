import { useLoaderData, useOutletContext } from "react-router";
import { RouteErrorBoundary } from "~/components/route-error-boundary";
import { createSupabaseServerClient } from "~/lib/supabase/client.server";
import type { Route } from "./+types/finanzas";
import type { TenantContext } from "./authenticated";
import type { FinanceTransaction, FinanceCostCenter } from "~/features/finance/types";
import { PageSkeleton } from "~/components/shared/page-skeleton";

export const meta = () => [{ title: "Finanzas — GRIXI" }];
export const handle = { breadcrumb: "Finanzas" };
export function HydrateFallback() { return <PageSkeleton variant="table" />; }

// Lazy client-side import to avoid SSR bundling framer-motion into Workers
import { lazy, Suspense } from "react";
const FinanceContent = lazy(() =>
  import("~/features/finance/components/finance-content").then((m) => ({
    default: m.FinanceContent,
  }))
);

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { supabase } = createSupabaseServerClient(request, env);

  // Fetch transactions (last 500) and cost centers in parallel
  const [txResult, ccResult] = await Promise.all([
    supabase
      .from("finance_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("finance_cost_centers")
      .select("*")
      .order("code", { ascending: true }),
  ]);

  return {
    transactions: (txResult.data || []) as FinanceTransaction[],
    costCenters: (ccResult.data || []) as FinanceCostCenter[],
  };
}

export default function Finanzas() {
  const ctx = useOutletContext<TenantContext>();
  const { transactions, costCenters } = useLoaderData<typeof loader>();

  return (
    <div className="w-full">
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface py-20" style={{ minHeight: 400 }}>
            <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Cargando módulo de finanzas...</p>
          </div>
        }
      >
        <FinanceContent
          initialTransactions={transactions}
          costCenters={costCenters}
        />
      </Suspense>
    </div>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  return <RouteErrorBoundary error={error} moduleName="Finanzas" />;
}
