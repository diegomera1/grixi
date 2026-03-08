"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FinanceTransaction, CurrencyCode } from "../types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

const TRANSACTION_TYPES = [
  "invoice_revenue",
  "customer_payment",
  "vendor_invoice",
  "vendor_payment",
  "manual_entry",
  "payroll",
  "tax_payment",
] as const;

const CATEGORIES: Record<string, string> = {
  invoice_revenue: "revenue",
  customer_payment: "payment_in",
  vendor_invoice: "expense",
  vendor_payment: "payment_out",
  manual_entry: "adjustment",
  payroll: "expense",
  tax_payment: "expense",
};

const DEPARTMENTS = [
  "Producción",
  "Ventas",
  "Administración",
  "Logística",
  "Mantenimiento",
  "Recursos Humanos",
  "Tecnología",
  "Calidad",
  "Finanzas",
  "Gerencia General",
];

const CUSTOMERS = [
  "Aceros del Pacífico S.A.",
  "QuímicaPro Ltda.",
  "InduMetal Corp.",
  "Empaques Globales",
  "TecnoSur S.A.",
  "AgroExport del Litoral",
  "ManufacturasEC",
  "LogiPuerto S.A.",
  "MineralAndes",
  "FarmaEcuador S.A.",
];

const VENDORS = [
  "AceroMax Industrial",
  "QuímicaAndina",
  "RepuestosEC",
  "LogiPack Embalajes",
  "InduTech Solutions",
  "Energía Nacional",
  "TransCargo S.A.",
  "MetalPrime",
  "SumiPetrol",
  "ElectroParts",
];

const CURRENCIES: Array<{ code: CurrencyCode; rate: number; weight: number }> = [
  { code: "USD", rate: 1.0, weight: 0.6 },
  { code: "EUR", rate: 1.0834, weight: 0.25 },
  { code: "GBP", rate: 1.2674, weight: 0.15 },
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function pickWeighted(items: typeof CURRENCIES) {
  const r = Math.random();
  let acc = 0;
  for (const item of items) {
    acc += item.weight;
    if (r <= acc) return item;
  }
  return items[0];
}

function generateTransaction(): Omit<FinanceTransaction, "id" | "created_at"> {
  const type = pick(TRANSACTION_TYPES);
  const category = CATEGORIES[type];
  const department = pick(DEPARTMENTS);
  const cur = pickWeighted(CURRENCIES);

  let amount: number;
  switch (type) {
    case "invoice_revenue":
      amount = randomBetween(500, 150000);
      break;
    case "customer_payment":
      amount = randomBetween(1000, 200000);
      break;
    case "vendor_invoice":
      amount = randomBetween(200, 80000);
      break;
    case "vendor_payment":
      amount = randomBetween(500, 100000);
      break;
    case "manual_entry":
      amount = randomBetween(100, 50000);
      break;
    case "payroll":
      amount = randomBetween(5000, 30000);
      break;
    case "tax_payment":
      amount = randomBetween(1000, 20000);
      break;
    default:
      amount = randomBetween(100, 10000);
  }

  const isRevenue = ["invoice_revenue", "customer_payment"].includes(type);
  const counterparty = isRevenue ? pick(CUSTOMERS) : pick(VENDORS);
  const sapPrefix = isRevenue ? "VF" : "FI";
  const sapNum = String(Date.now()).slice(-8);

  return {
    org_id: ORG_ID,
    transaction_type: type,
    category: category as FinanceTransaction["category"],
    department,
    amount,
    currency: cur.code,
    exchange_rate: cur.rate,
    amount_usd: Math.round(amount * cur.rate * 100) / 100,
    counterparty,
    description: `${type} — ${counterparty}`,
    sap_document_id: `${sapPrefix}-${sapNum}`,
    is_live: true,
  };
}

export function useFinanceSimulator() {
  const supabase = createClient();
  const sessionId = useRef(
    typeof crypto !== "undefined"
      ? crypto.randomUUID()
      : Math.random().toString(36)
  );
  const isLeader = useRef(false);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const injectTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [isSimulating, setIsSimulating] = useState(false);

  const tryBecomeLeader = useCallback(async () => {
    // Check if there's an active leader
    const { data: lock } = await supabase
      .from("finance_sim_lock")
      .select("*")
      .eq("id", "singleton")
      .single();

    const now = new Date();

    if (lock && lock.is_active) {
      const heartbeat = new Date(lock.last_heartbeat);
      const stale = now.getTime() - heartbeat.getTime() > 6000; // 6s stale

      if (!stale && lock.session_id !== sessionId.current) {
        // Another active leader exists
        isLeader.current = false;
        return;
      }
    }

    // Take leadership via upsert
    await supabase.from("finance_sim_lock").upsert({
      id: "singleton",
      session_id: sessionId.current,
      last_heartbeat: now.toISOString(),
      is_active: true,
    });

    isLeader.current = true;
    setIsSimulating(true);
  }, [supabase]);

  const doHeartbeat = useCallback(async () => {
    if (!isLeader.current) return;
    await supabase
      .from("finance_sim_lock")
      .update({ last_heartbeat: new Date().toISOString() })
      .eq("session_id", sessionId.current);
  }, [supabase]);

  const injectTransaction = useCallback(async () => {
    if (!isLeader.current) return;
    const tx = generateTransaction();
    await supabase.from("finance_transactions").insert(tx);
  }, [supabase]);

  const releaseLock = useCallback(async () => {
    if (!isLeader.current) return;
    await supabase
      .from("finance_sim_lock")
      .update({ is_active: false })
      .eq("session_id", sessionId.current);
    isLeader.current = false;
    setIsSimulating(false);
  }, [supabase]);

  // Hourly reset of live data
  const hourlyReset = useCallback(async () => {
    if (!isLeader.current) return;
    await supabase
      .from("finance_transactions")
      .delete()
      .eq("is_live", true);
  }, [supabase]);

  useEffect(() => {
    tryBecomeLeader();

    // Heartbeat every 3s
    heartbeatTimer.current = setInterval(() => {
      if (isLeader.current) {
        doHeartbeat();
      } else {
        tryBecomeLeader();
      }
    }, 3000);

    // Inject data every 2s
    injectTimer.current = setInterval(() => {
      injectTransaction();
    }, 2000);

    // Hourly reset
    const resetTimer = setInterval(hourlyReset, 60 * 60 * 1000);

    // Cleanup
    const handleUnload = () => releaseLock();
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(heartbeatTimer.current);
      clearInterval(injectTimer.current);
      clearInterval(resetTimer);
      window.removeEventListener("beforeunload", handleUnload);
      releaseLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isSimulating };
}
