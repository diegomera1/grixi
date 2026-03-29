import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouteLoaderData } from "react-router";
import { createBrowserClient } from "@supabase/ssr";
import type { FinanceTransaction, FinanceKPIs } from "../types";

/**
 * Hook de finanzas en tiempo real para producción.
 * Escucha inserts/deletes de Supabase Realtime y computa KPIs.
 */
export function useFinanceRealtime(initialTransactions: FinanceTransaction[]) {
  const rootData = useRouteLoaderData("root") as
    | { env?: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string } }
    | undefined;

  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);

  function getSupabase() {
    if (supabaseRef.current) return supabaseRef.current;
    const url = rootData?.env?.SUPABASE_URL;
    const key = rootData?.env?.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseRef.current = createBrowserClient(url, key);
    return supabaseRef.current;
  }

  const [transactions, setTransactions] = useState<FinanceTransaction[]>(initialTransactions);
  const [liveTransactions, setLiveTransactions] = useState<FinanceTransaction[]>([]);
  const liveRef = useRef<FinanceTransaction[]>([]);

  // Subscribe to real-time changes
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel("finance-live")
      .on(
        "postgres_changes" as const,
        { event: "INSERT", schema: "public", table: "finance_transactions" },
        (payload: { new: Record<string, unknown> }) => {
          const newTx = payload.new as unknown as FinanceTransaction;
          liveRef.current = [newTx, ...liveRef.current].slice(0, 200);
          setLiveTransactions([...liveRef.current]);
          setTransactions((prev) => [newTx, ...prev].slice(0, 5000));
        }
      )
      .on(
        "postgres_changes" as const,
        { event: "UPDATE", schema: "public", table: "finance_transactions" },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as unknown as FinanceTransaction;
          setTransactions((prev) =>
            prev.map((tx) => (tx.id === updated.id ? updated : tx))
          );
        }
      )
      .on(
        "postgres_changes" as const,
        { event: "DELETE", schema: "public", table: "finance_transactions" },
        (payload: { old: Record<string, unknown> }) => {
          const deletedId = (payload.old as Record<string, unknown>)?.id as string | undefined;
          if (deletedId) {
            setTransactions((prev) => prev.filter((tx) => tx.id !== deletedId));
            liveRef.current = liveRef.current.filter((tx) => tx.id !== deletedId);
            setLiveTransactions([...liveRef.current]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootData?.env?.SUPABASE_URL]);

  // Compute KPIs
  const computeKPIs = useCallback(
    (txs: FinanceTransaction[]): FinanceKPIs => {
      let totalRevenue = 0;
      let totalExpenses = 0;
      let cashIn = 0;
      let cashOut = 0;

      for (const tx of txs) {
        switch (tx.category) {
          case "revenue":
            totalRevenue += tx.amount_usd;
            break;
          case "expense":
            totalExpenses += tx.amount_usd;
            break;
          case "payment_in":
            cashIn += tx.amount_usd;
            break;
          case "payment_out":
            cashOut += tx.amount_usd;
            break;
          case "adjustment":
            if (tx.amount_usd > 0) totalRevenue += tx.amount_usd;
            else totalExpenses += Math.abs(tx.amount_usd);
            break;
        }
      }

      return {
        totalRevenue,
        totalExpenses,
        ebitda: totalRevenue - totalExpenses,
        cashFlow: cashIn - cashOut,
        netBalance: totalRevenue + cashIn - totalExpenses - cashOut,
      };
    },
    []
  );

  const historicalKPIs = computeKPIs(initialTransactions);
  const liveKPIs = computeKPIs(liveTransactions);

  const kpis: FinanceKPIs = {
    totalRevenue: historicalKPIs.totalRevenue + liveKPIs.totalRevenue,
    totalExpenses: historicalKPIs.totalExpenses + liveKPIs.totalExpenses,
    ebitda: historicalKPIs.ebitda + liveKPIs.ebitda,
    cashFlow: historicalKPIs.cashFlow + liveKPIs.cashFlow,
    netBalance: historicalKPIs.netBalance + liveKPIs.netBalance,
  };

  // Department breakdown
  const departmentBreakdown = useMemo(() => {
    const depts: Record<string, number> = {};
    for (const tx of [...initialTransactions, ...liveTransactions]) {
      if (tx.category === "expense" || tx.category === "payment_out") {
        depts[tx.department] = (depts[tx.department] || 0) + tx.amount_usd;
      }
    }
    return depts;
  }, [initialTransactions, liveTransactions]);

  const historicalTransactions = useMemo(() => initialTransactions, [initialTransactions]);

  return {
    transactions,
    liveTransactions,
    historicalTransactions,
    kpis,
    liveKPIs,
    historicalKPIs,
    departmentBreakdown,
  };
}
