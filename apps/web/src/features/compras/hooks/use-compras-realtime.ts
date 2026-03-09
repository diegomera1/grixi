"use client";

import { useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PurchaseOrder, PurchaseRequisition, GoodsReceipt } from "../types";

type ComprasRealtimeCallbacks = {
  onPOChange?: (po: PurchaseOrder) => void;
  onPRChange?: (pr: PurchaseRequisition) => void;
  onGRChange?: (gr: GoodsReceipt) => void;
};

export function useComprasRealtime(callbacks: ComprasRealtimeCallbacks) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const subscribe = useCallback(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("compras-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_orders" }, (payload) => {
        callbacksRef.current.onPOChange?.(payload.new as unknown as PurchaseOrder);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_requisitions" }, (payload) => {
        callbacksRef.current.onPRChange?.(payload.new as unknown as PurchaseRequisition);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "goods_receipts" }, (payload) => {
        callbacksRef.current.onGRChange?.(payload.new as unknown as GoodsReceipt);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, [subscribe]);
}
