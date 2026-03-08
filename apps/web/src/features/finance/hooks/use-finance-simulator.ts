"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FinanceTransaction, CurrencyCode, LineItem } from "../types";

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
  "Producción", "Ventas", "Administración", "Logística", "Mantenimiento",
  "Recursos Humanos", "Tecnología", "Calidad", "Finanzas", "Gerencia General",
];

const COST_CENTER_MAP: Record<string, string> = {
  "Producción": "CC-PROD", "Ventas": "CC-VENT", "Administración": "CC-ADMN",
  "Logística": "CC-LOGI", "Mantenimiento": "CC-MANT", "Recursos Humanos": "CC-RRHH",
  "Tecnología": "CC-IT", "Calidad": "CC-CALI", "Finanzas": "CC-FINA",
  "Gerencia General": "CC-GERE",
};

const CUSTOMERS = [
  "Aceros del Pacífico S.A.", "QuímicaPro Ltda.", "InduMetal Corp.",
  "Empaques Globales", "TecnoSur S.A.", "AgroExport del Litoral",
  "ManufacturasEC", "LogiPuerto S.A.", "MineralAndes", "FarmaEcuador S.A.",
];

const VENDORS = [
  "AceroMax Industrial", "QuímicaAndina", "RepuestosEC",
  "LogiPack Embalajes", "InduTech Solutions", "Energía Nacional",
  "TransCargo S.A.", "MetalPrime", "SumiPetrol", "ElectroParts",
];

// Realistic product/service descriptions for line items
const PRODUCTS: Record<string, string[]> = {
  invoice_revenue: [
    "Planchas de acero inoxidable 304", "Tubería de cobre 1/2''", "Soldadura MIG 70S-6",
    "Consultoría técnica especializada", "Servicio de mantenimiento industrial",
    "Lote de tornillería M8x40", "Válvulas de control neumático",
  ],
  vendor_invoice: [
    "Materia prima — resina epóxica", "Repuestos compresor Atlas Copco",
    "Aceite hidráulico ISO 68", "Rodamientos SKF 6205", "Cable eléctrico THHN 12 AWG",
    "Banda transportadora 600mm", "Filtros industriales HEPA",
  ],
  payroll: [
    "Nómina quincenal — personal operativo", "Nómina mensual — administrativos",
    "Horas extras período", "Bonificación por productividad", "Liquidación vacaciones",
  ],
};

const GL_ACCOUNTS: Record<string, string[]> = {
  revenue: ["4100", "4110", "4200", "4210", "4300"],
  expense: ["5100", "5200", "5300", "5400", "5500", "5600"],
  payment_in: ["1100", "1110", "1120"],
  payment_out: ["2100", "2110", "2120"],
  adjustment: ["6000", "6100"],
};

const PROFIT_CENTERS = ["PC-NORTE", "PC-SUR", "PC-CENTRO", "PC-COSTA", "PC-SIERRA"];
const PAYMENT_TERMS = ["NET15", "NET30", "NET45", "NET60", "IMMEDIATE"] as const;
const PAYMENT_METHODS = ["transfer", "check", "cash", "credit_card", "direct_debit"] as const;

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

// Dynamic interval: returns random ms between 4000-8000
function nextInterval(): number {
  return randomBetween(4000, 8000);
}

function generateLineItems(type: string, amount: number): LineItem[] {
  const numItems = randomBetween(1, 4);
  const items: LineItem[] = [];
  let remaining = amount;

  const descList = PRODUCTS[type] || PRODUCTS.vendor_invoice;
  const glAccounts = GL_ACCOUNTS[CATEGORIES[type]] || GL_ACCOUNTS.expense;

  for (let i = 0; i < numItems; i++) {
    const isLast = i === numItems - 1;
    const itemAmount = isLast ? remaining : Math.round(remaining * (0.2 + Math.random() * 0.4) * 100) / 100;
    remaining -= itemAmount;

    const qty = randomBetween(1, 50);
    items.push({
      item: i + 1,
      description: pick(descList),
      quantity: qty,
      unit_price: Math.round((itemAmount / qty) * 100) / 100,
      total: Math.round(itemAmount * 100) / 100,
      gl_account: pick(glAccounts),
    });
  }

  return items;
}

function generateTransaction(): Omit<FinanceTransaction, "id" | "created_at"> {
  const type = pick(TRANSACTION_TYPES);
  const category = CATEGORIES[type];
  const department = pick(DEPARTMENTS);
  const cur = pickWeighted(CURRENCIES);

  let amount: number;
  switch (type) {
    case "invoice_revenue": amount = randomBetween(2500, 150000); break;
    case "customer_payment": amount = randomBetween(5000, 200000); break;
    case "vendor_invoice": amount = randomBetween(1000, 80000); break;
    case "vendor_payment": amount = randomBetween(2000, 100000); break;
    case "manual_entry": amount = randomBetween(500, 50000); break;
    case "payroll": amount = randomBetween(8000, 45000); break;
    case "tax_payment": amount = randomBetween(3000, 25000); break;
    default: amount = randomBetween(1000, 10000);
  }

  const isRevenue = ["invoice_revenue", "customer_payment"].includes(type);
  const counterparty = isRevenue ? pick(CUSTOMERS) : pick(VENDORS);

  // SAP document numbering
  const sapPrefixes: Record<string, string> = {
    invoice_revenue: "VF01", customer_payment: "F-28",
    vendor_invoice: "MIRO", vendor_payment: "F-53",
    manual_entry: "FB01", payroll: "PC00", tax_payment: "F-53",
  };
  const sapNum = String(Date.now()).slice(-8);
  const prefix = sapPrefixes[type] || "FI";

  // Invoice numbering
  const invoicePrefixes: Record<string, string> = {
    invoice_revenue: "FAC", customer_payment: "REC",
    vendor_invoice: "BILL", vendor_payment: "PAG",
    manual_entry: "AST", payroll: "NOM", tax_payment: "IMP",
  };
  const invPrefix = invoicePrefixes[type] || "DOC";

  // Tax
  const taxRate = type === "tax_payment" ? 0 : (["invoice_revenue", "vendor_invoice"].includes(type) ? 15 : 12);
  const taxAmount = Math.round(amount * (taxRate / 100) * 100) / 100;
  const netAmount = Math.round((amount - taxAmount) * 100) / 100;

  // Dates
  const today = new Date();
  const paymentTerm = pick(PAYMENT_TERMS);
  const dueDays = paymentTerm === "IMMEDIATE" ? 0 : parseInt(paymentTerm.replace("NET", ""));
  const dueDate = new Date(today.getTime() + dueDays * 86400000);

  // Line items
  const lineItems = generateLineItems(type, amount);

  // Descriptions
  const descriptions: Record<string, string[]> = {
    invoice_revenue: [`Factura por servicios — ${counterparty}`, `Venta de producto — ${counterparty}`, `Orden de compra ejecutada — ${counterparty}`],
    customer_payment: [`Cobro factura pendiente — ${counterparty}`, `Pago recibido transferencia — ${counterparty}`],
    vendor_invoice: [`Compra de insumos — ${counterparty}`, `Factura servicios recibidos — ${counterparty}`],
    vendor_payment: [`Pago factura proveedor — ${counterparty}`, `Liquidación cuenta — ${counterparty}`],
    manual_entry: [`Ajuste contable — ${department}`, `Reclasificación — ${department}`],
    payroll: [`Nómina ${department} — Período actual`, `Liquidación personal — ${department}`],
    tax_payment: [`Pago IVA período — SRI`, `Retención en la fuente — ${counterparty}`],
  };

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
    description: pick(descriptions[type] || [`${type} — ${counterparty}`]),
    sap_document_id: `${prefix}-${sapNum}`,
    is_live: true,
    // Rich SAP fields
    invoice_number: `${invPrefix}-${String(Date.now()).slice(-5)}`,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    net_amount: netAmount,
    payment_terms: paymentTerm,
    due_date: dueDate.toISOString().split("T")[0],
    status: "posted",
    cost_center_code: COST_CENTER_MAP[department] || "CC-ADMN",
    gl_account: pick(GL_ACCOUNTS[category] || GL_ACCOUNTS.expense),
    profit_center: pick(PROFIT_CENTERS),
    posting_date: today.toISOString().split("T")[0],
    document_date: today.toISOString().split("T")[0],
    reference: `${prefix}-${sapNum}`,
    payment_method: pick(PAYMENT_METHODS),
    line_items: lineItems,
    notes: null,
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
  const injectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [isSimulating, setIsSimulating] = useState(false);

  const tryBecomeLeader = useCallback(async () => {
    const { data: lock } = await supabase
      .from("finance_sim_lock")
      .select("*")
      .eq("id", "singleton")
      .single();

    const now = new Date();

    if (lock && lock.is_active) {
      const heartbeat = new Date(lock.last_heartbeat);
      const stale = now.getTime() - heartbeat.getTime() > 12000; // 12s stale (generous for dynamic intervals)

      if (!stale && lock.session_id !== sessionId.current) {
        isLeader.current = false;
        return;
      }
    }

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

  const hourlyReset = useCallback(async () => {
    if (!isLeader.current) return;
    await supabase
      .from("finance_transactions")
      .delete()
      .eq("is_live", true);
  }, [supabase]);

  // Dynamic injection loop — random intervals between 4-8 seconds
  const scheduleNext = useCallback(() => {
    injectTimeout.current = setTimeout(() => {
      injectTransaction();
      scheduleNext(); // Schedule next with a new random interval
    }, nextInterval());
  }, [injectTransaction]);

  useEffect(() => {
    tryBecomeLeader();

    // Heartbeat every 5s
    heartbeatTimer.current = setInterval(() => {
      if (isLeader.current) {
        doHeartbeat();
      } else {
        tryBecomeLeader();
      }
    }, 5000);

    // Start dynamic injection loop
    scheduleNext();

    // Hourly reset
    const resetTimer = setInterval(hourlyReset, 60 * 60 * 1000);

    const handleUnload = () => releaseLock();
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(heartbeatTimer.current);
      clearTimeout(injectTimeout.current);
      clearInterval(resetTimer);
      window.removeEventListener("beforeunload", handleUnload);
      releaseLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isSimulating };
}
