"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, ClipboardList, Truck, Users2, PackageCheck,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type {
  PurchaseOrder, Vendor, PurchaseRequisition, GoodsReceipt, ComprasKPIs,
} from "../types";
import { useComprasRealtime } from "../hooks/use-compras-realtime";
import { DashboardTab } from "./dashboard-tab";
import { OrdersTab } from "./orders-tab";
import { VendorsTab } from "./vendors-tab";
import { RequisitionsTab } from "./requisitions-tab";
import { ReceiptsTab } from "./receipts-tab";

type Tab = "dashboard" | "ordenes" | "proveedores" | "solicitudes" | "recepciones";

const TABS: { id: Tab; label: string; icon: typeof ShoppingCart }[] = [
  { id: "dashboard", label: "Dashboard", icon: ShoppingCart },
  { id: "ordenes", label: "Órdenes de Compra", icon: ClipboardList },
  { id: "proveedores", label: "Proveedores", icon: Users2 },
  { id: "solicitudes", label: "Solicitudes", icon: Truck },
  { id: "recepciones", label: "Recepciones", icon: PackageCheck },
];

type Props = {
  initialOrders: PurchaseOrder[];
  initialVendors: Vendor[];
  initialRequisitions: PurchaseRequisition[];
  initialReceipts: GoodsReceipt[];
  initialKPIs: ComprasKPIs;
};

export function ComprasContent({
  initialOrders, initialVendors, initialRequisitions, initialReceipts, initialKPIs,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [orders, setOrders] = useState(initialOrders);
  const [requisitions, setRequisitions] = useState(initialRequisitions);

  // Realtime updates
  useComprasRealtime({
    onPOChange: useCallback((po: PurchaseOrder) => {
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === po.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...po };
          return next;
        }
        return [po, ...prev];
      });
    }, []),
    onPRChange: useCallback((pr: PurchaseRequisition) => {
      setRequisitions((prev) => {
        const idx = prev.findIndex((r) => r.id === pr.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...pr };
          return next;
        }
        return [pr, ...prev];
      });
    }, []),
  });

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Compras & Aprovisionamiento
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            Gestión de órdenes, proveedores y materiales — SAP MM
          </p>
        </div>
        <div className="grid grid-cols-5 border-b border-[var(--border)] sm:flex sm:items-center sm:gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all relative",
                "sm:justify-start sm:px-4",
                activeTab === tab.id
                  ? "text-[var(--brand)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <tab.icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="compras-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand)] rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
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
        >
          {activeTab === "dashboard" && (
            <DashboardTab orders={orders} vendors={initialVendors} kpis={initialKPIs} />
          )}
          {activeTab === "ordenes" && (
            <OrdersTab orders={orders} vendors={initialVendors} />
          )}
          {activeTab === "proveedores" && (
            <VendorsTab vendors={initialVendors} orders={orders} />
          )}
          {activeTab === "solicitudes" && (
            <RequisitionsTab requisitions={requisitions} />
          )}
          {activeTab === "recepciones" && (
            <ReceiptsTab receipts={initialReceipts} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
