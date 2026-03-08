"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Package, MapPin, ArrowRight, X, QrCode, Layers } from "lucide-react";

type InventoryItem = {
  positionId: string;
  productName: string;
  productSku: string;
  category: string;
  quantity: number;
  rackCode: string;
  row: number;
  col: number;
  status: string;
  supplier: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  warehouseId?: string;
  warehouseName?: string;
};

type ProductLocatorProps = {
  items: InventoryItem[];
  onLocate: (item: InventoryItem) => void;
  onClose: () => void;
  isOpen: boolean;
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-500",
  expired: "bg-red-500",
  quarantine: "bg-violet-500",
  reserved: "bg-blue-500",
};

export function ProductLocator({ items, onLocate, onClose, isOpen }: ProductLocatorProps) {
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return items
      .filter(
        (i) =>
          i.productSku.toLowerCase().includes(q) ||
          i.productName.toLowerCase().includes(q) ||
          i.rackCode.toLowerCase().includes(q) ||
          i.lotNumber?.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query, items]);

  const handleLocate = useCallback(
    (item: InventoryItem) => {
      setSelectedItem(item);
      onLocate(item);
    },
    [onLocate]
  );

  // Demo button — pick a random item
  const handleDemo = useCallback(() => {
    if (items.length === 0) return;
    const randomItem = items[Math.floor(Math.random() * items.length)];
    setQuery(randomItem.productSku);
    setSelectedItem(randomItem);
    onLocate(randomItem);
  }, [items, onLocate]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-12"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ y: -20, scale: 0.95 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: -20, scale: 0.95 }}
          className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
            <QrCode size={16} className="text-[var(--brand)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Localizar Producto</h3>
            <div className="flex-1" />
            <button onClick={handleDemo} className="rounded-md bg-[var(--brand)]/10 px-2 py-1 text-[10px] font-semibold text-[var(--brand)] hover:bg-[var(--brand)]/20 transition-colors">
              🎯 Demo
            </button>
            <button onClick={onClose} className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X size={14} />
            </button>
          </div>

          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
            <Search size={14} className="text-[var(--text-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedItem(null); }}
              placeholder="Buscar por SKU, nombre, lote, categoría o rack..."
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              autoFocus
            />
          </div>

          {/* Selected item detail card */}
          {selectedItem && (
            <div className="border-b border-[var(--border)] bg-[var(--brand)]/5 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-[var(--brand)]/10 p-2">
                  <Package size={20} className="text-[var(--brand)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--text-primary)]">{selectedItem.productName}</p>
                  <p className="text-xs text-[var(--brand)] font-mono">{selectedItem.productSku}</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1"><MapPin size={10} /> Rack {selectedItem.rackCode} · F{selectedItem.row}C{selectedItem.col}</span>
                    <span className="flex items-center gap-1"><Layers size={10} /> {selectedItem.quantity} unidades</span>
                    <span>📦 {selectedItem.category}</span>
                    {selectedItem.supplier && <span>🏭 {selectedItem.supplier}</span>}
                    {selectedItem.lotNumber && <span>🏷️ Lote: {selectedItem.lotNumber}</span>}
                    {selectedItem.expiryDate && (
                      <span className={new Date(selectedItem.expiryDate) < new Date() ? "text-red-500 font-bold" : ""}>
                        📅 Vence: {new Date(selectedItem.expiryDate).toLocaleDateString("es")}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`h-3 w-3 rounded-full ${statusColors[selectedItem.status] || "bg-gray-400"}`} />
              </div>
            </div>
          )}

          {/* Results */}
          <div className="max-h-60 overflow-y-auto">
            {query.trim() && filteredItems.length === 0 && (
              <div className="flex flex-col items-center gap-1 py-6 text-[var(--text-muted)]">
                <Package size={24} className="opacity-30" />
                <p className="text-xs">No se encontraron productos</p>
              </div>
            )}
            {filteredItems.map((item) => (
              <button
                key={`${item.positionId}`}
                onClick={() => handleLocate(item)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-muted)] ${
                  selectedItem?.positionId === item.positionId ? "bg-[var(--brand)]/5" : ""
                }`}
              >
                <div className={`h-2 w-2 shrink-0 rounded-full ${statusColors[item.status] || "bg-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-[var(--text-primary)]">{item.productName}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {item.productSku} · Rack {item.rackCode} · {item.quantity} uds
                  </p>
                </div>
                <ArrowRight size={12} className="text-[var(--text-muted)]" />
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
