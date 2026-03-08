"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FinanceTransaction, FinanceKPIs } from "../types";

export function useFinanceRealtime(initialTransactions: FinanceTransaction[]) {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(initialTransactions);
  const [liveTransactions, setLiveTransactions] = useState<FinanceTransaction[]>([]);
  const liveRef = useRef<FinanceTransaction[]>([]);

  // Subscribe to real-time inserts
  useEffect(() => {
    const channel = supabase
      .channel("finance-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "finance_transactions",
        },
        (payload) => {
          const newTx = payload.new as FinanceTransaction;
          liveRef.current = [newTx, ...liveRef.current].slice(0, 200);
          setLiveTransactions([...liveRef.current]);
          setTransactions((prev) => [newTx, ...prev].slice(0, 5000));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "finance_transactions",
        },
        () => {
          liveRef.current = [];
          setLiveTransactions([]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

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

  // Department breakdown — returns a Record<string, number>
  const departmentBreakdown = useMemo(() => {
    const depts: Record<string, number> = {};
    for (const tx of [...initialTransactions, ...liveTransactions]) {
      if (tx.category === "expense" || tx.category === "payment_out") {
        depts[tx.department] = (depts[tx.department] || 0) + tx.amount_usd;
      }
    }
    return depts;
  }, [initialTransactions, liveTransactions]);

  // Historical transactions (for P&L and other calculations)
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
