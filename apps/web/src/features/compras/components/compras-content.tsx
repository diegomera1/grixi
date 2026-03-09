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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold italic text-[var(--text-primary)]">
            Compras & Aprovisionamiento
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Gestión de órdenes, proveedores y materiales — SAP MM
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[var(--bg-surface)] px-1 py-1 border border-[var(--border)]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
                activeTab === tab.id
                  ? "text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="compras-tab"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon size={13} className="relative z-10" />
              <span className="relative z-10 hidden sm:inline">{tab.label}</span>
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
