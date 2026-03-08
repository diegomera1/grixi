import { createClient } from "@/lib/supabase/server";
import { FinanceContent } from "@/features/finance/components/finance-content";

export const metadata = {
  title: "Finanzas",
};

export default async function FinanzasPage() {
  const supabase = await createClient();

  // Fetch initial data in parallel
  const [
    { data: transactions },
    { data: costCenters },
  ] = await Promise.all([
    supabase
      .from("finance_transactions")
      .select("*")
      .eq("is_live", false)
      .order("created_at", { ascending: false })
      .limit(2500),
    supabase
      .from("finance_cost_centers")
      .select("*")
      .order("budget_annual", { ascending: false }),
  ]);

  return (
    <FinanceContent
      initialTransactions={transactions || []}
      costCenters={costCenters || []}
    />
  );
}
