"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, X, Package, MapPin, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type SearchableItem = {
  positionId: string;
  rackCode: string;
  rackId: string;
  row: number;
  col: number;
  productName: string;
  productSku: string;
  category: string;
  quantity: number;
  status: string;
  posX: number;
  posY: number;
  posZ: number;
};

type WarehouseSearchProps = {
  items: SearchableItem[];
  onSelect: (item: SearchableItem) => void;
  isOpen: boolean;
  onClose: () => void;
};

export function WarehouseSearch({ items, onSelect, isOpen, onClose }: WarehouseSearchProps) {
  const [query, setQuery] = useState("");

  // Reset query on open
  useEffect(() => {
    if (isOpen) setQuery("");
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    if (!query.trim()) return items.slice(0, 8);
    const q = query.toLowerCase();
    return items
      .filter(
        (it) =>
          it.productName.toLowerCase().includes(q) ||
          it.productSku.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q) ||
          it.rackCode.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, items]);

  const handleSelect = useCallback(
    (item: SearchableItem) => {
      onSelect(item);
      onClose();
    },
    [onSelect, onClose]
  );

  const statusColor: Record<string, string> = {
    active: "bg-emerald-500",
    expired: "bg-red-500",
    quarantine: "bg-violet-500",
    reserved: "bg-blue-500",
    occupied: "bg-emerald-500",
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-[60] flex items-start justify-center bg-black/30 backdrop-blur-sm pt-16"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: -20, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface/98 shadow-2xl backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <Search size={14} className="text-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por SKU, producto, categoría o rack..."
              className="flex-1 bg-transparent text-[12px] text-text-primary placeholder:text-text-muted outline-none"
            />
            <button
              onClick={onClose}
              className="rounded-md p-0.5 text-text-muted transition-colors hover:text-text-primary"
            >
              <X size={12} />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto py-1">
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Package size={20} className="mx-auto mb-1.5 text-text-muted" />
                <p className="text-[11px] text-text-muted">Sin resultados para &quot;{query}&quot;</p>
              </div>
            ) : (
              results.map((item) => (
                <button
                  key={item.positionId}
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-muted"
                >
                  <div className={`h-2 w-2 rounded-full ${statusColor[item.status] || "bg-slate-400"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-text-primary">
                      {item.productName}
                    </p>
                    <p className="text-[9px] text-text-muted">
                      {item.productSku} · {item.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-text-muted">
                    <MapPin size={9} />
                    <span>{item.rackCode} F{item.row}C{item.col}</span>
                  </div>
                  <ArrowRight size={10} className="text-text-muted" />
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-3.5 py-1.5">
            <p className="text-[8px] text-text-muted">
              ⌘K para abrir · ESC para cerrar · Seleccionar para volar al producto
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export type { SearchableItem };
