"use client";

import { X, Package, Calendar, Truck, Hash, Tag, Layers, AlertTriangle, ImageOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useState } from "react";

type InventoryDetail = {
  id: string;
  product_name: string;
  product_sku: string;
  category: string;
  image_url: string | null;
  quantity: number;
  lot_number: string | null;
  batch_code: string | null;
  entry_date: string | null;
  expiry_date: string | null;
  supplier: string | null;
  status: string;
};

type BoxDetailDrawerProps = {
  inventory: InventoryDetail | null;
  rackCode: string;
  posRow: number;
  posCol: number;
  onClose: () => void;
};

const statusCfg: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Activo", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  expired: { label: "Vencido", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  quarantine: { label: "Cuarentena", color: "#7C3AED", bg: "rgba(124,58,237,0.12)" },
  reserved: { label: "Reservado", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-EC", { year: "numeric", month: "short", day: "numeric" });
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function ProductImage({ src, name }: { src: string | null; name: string }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--bg-muted)]">
        <ImageOff size={24} className="text-[var(--text-muted)]" />
      </div>
    );
  }

  // External URLs (unsplash etc)
  if (src.startsWith("http")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className="h-full w-full object-cover"
        onError={() => setError(true)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      width={200}
      height={200}
      className="h-full w-full object-cover"
      onError={() => setError(true)}
    />
  );
}

export function BoxDetailDrawer({ inventory, rackCode, posRow, posCol, onClose }: BoxDetailDrawerProps) {
  if (!inventory) return null;

  const st = statusCfg[inventory.status] || statusCfg.active;
  const daysLeft = daysUntil(inventory.expiry_date);
  const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

  const fields = [
    { icon: Hash, label: "SKU", value: inventory.product_sku },
    { icon: Tag, label: "Categoría", value: inventory.category },
    { icon: Layers, label: "Cantidad", value: inventory.quantity.toLocaleString() },
    { icon: Hash, label: "Lote", value: inventory.lot_number || "—" },
    { icon: Hash, label: "Batch", value: inventory.batch_code || "—" },
    { icon: Calendar, label: "Ingreso", value: formatDate(inventory.entry_date) },
    {
      icon: Calendar,
      label: "Vencimiento",
      value: formatDate(inventory.expiry_date),
      warn: isExpiringSoon,
      extra: daysLeft !== null && daysLeft > 0 ? `${daysLeft}d` : daysLeft !== null && daysLeft <= 0 ? "Vencido" : undefined,
    },
    { icon: Truck, label: "Proveedor", value: inventory.supplier || "—" },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 340, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 340, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="absolute right-0 top-0 z-50 flex h-full w-80 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--bg-surface)]/98 backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <p className="text-xs font-bold text-[var(--text-primary)]">Detalle de Inventario</p>
            <p className="text-[10px] text-[var(--text-muted)]">
              Rack {rackCode} · Fila {posRow}, Col {posCol}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Product Image */}
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--bg-muted)]">
            <ProductImage src={inventory.image_url} name={inventory.product_name} />
            {/* Status badge overlay */}
            <div className="absolute bottom-2 left-2">
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md"
                style={{ color: st.color, backgroundColor: st.bg }}
              >
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.color }} />
                {st.label}
              </div>
            </div>
          </div>

          {/* Product name */}
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-start gap-2">
              <Package size={14} className="mt-0.5 shrink-0 text-[var(--brand)]" />
              <div>
                <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Producto</p>
                <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">{inventory.product_name}</p>
              </div>
            </div>

            {isExpiringSoon && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-medium text-amber-600">
                <AlertTriangle size={11} />
                Vence en {daysLeft} días — Acción requerida
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-0 px-4 py-2">
            {fields.map((f) => (
              <div key={f.label} className="flex items-start gap-2.5 border-b border-[var(--border)]/50 py-2 last:border-0">
                <f.icon size={12} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{f.label}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[11px] font-semibold text-[var(--text-primary)]">{f.value}</p>
                    {f.extra && (
                      <span className={`text-[9px] font-bold ${f.warn ? "text-amber-500" : "text-[var(--text-muted)]"}`}>
                        {f.extra}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
