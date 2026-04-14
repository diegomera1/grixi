"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useForm, useFieldArray } from "react-hook-form";
import {
  X,
  Plus,
  Trash2,
  Package,
  DollarSign,
  FileText,
  CheckCircle2,
  ArrowRight,
  Search,
  Building2,
  ChevronDown,
  CreditCard,
  Banknote,
  Landmark,
  Wallet,
  Receipt,
  Globe,
  MapPin,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type {
  SalesCustomer,
  SalesInvoice,
  InvoiceStatus,
  PaymentMethod,
  DemoRole,
} from "../types";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  SEGMENT_LABELS,
  SEGMENT_COLORS,
} from "../types";

// ── Types ─────────────────────────────────────────

type InvoiceItemForm = {
  product_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  cost_price: number;
};

type InvoiceFormData = {
  customer_id: string;
  status: InvoiceStatus;
  sale_date: string;
  currency: string;
  exchange_rate: number;
  payment_method: PaymentMethod;
  payment_terms: number;
  discount_percent: number;
  tax_rate: number;
  notes: string;
  items: InvoiceItemForm[];
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  sale_price: number;
  image_url: string | null;
};

// ── Status Flow ───────────────────────────────────

const STATUS_FLOW: InvoiceStatus[] = ["draft", "confirmed", "invoiced"];

const STATUS_FLOW_LABELS: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmada",
  invoiced: "Facturada",
};

// ── Currency flags ────────────────────────────────

const CURRENCIES = [
  { code: "USD", name: "Dólar US", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", flag: "🇪🇺" },
  { code: "MXN", name: "Peso MX", flag: "🇲🇽" },
  { code: "COP", name: "Peso CO", flag: "🇨🇴" },
  { code: "BRL", name: "Real BR", flag: "🇧🇷" },
  { code: "CNY", name: "Yuan CN", flag: "🇨🇳" },
];

// ── Payment method ────────────────────────────────

const PAYMENT_METHODS = [
  { value: "transfer", label: "Transferencia Bancaria", icon: Landmark, color: "#3B82F6" },
  { value: "credit", label: "Crédito a Plazo", icon: CreditCard, color: "#8B5CF6" },
  { value: "cash", label: "Efectivo", icon: Banknote, color: "#10B981" },
  { value: "check", label: "Cheque", icon: Receipt, color: "#F59E0B" },
  { value: "card", label: "Tarjeta de Crédito", icon: Wallet, color: "#EC4899" },
];

// ═══════════════════════════════════════════════════
// Custom Customer Combobox
// ═══════════════════════════════════════════════════

export function CustomerCombobox({
  customers,
  value,
  onChange,
  error,
}: {
  customers: SalesCustomer[];
  value: string;
  onChange: (id: string) => void;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selected = customers.find((c) => c.id === value);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.business_name.toLowerCase().includes(q) ||
        c.trade_name?.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
    );
  }, [customers, search]);

  // Compute position when opening
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
  }, [open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
          "hover:border-[#3B82F6]/50",
          open ? "ring-2 ring-[#3B82F6]/30 border-[#3B82F6]" : "",
          error ? "border-red-500" : "border-[var(--border)]",
          "bg-[var(--bg-card)]"
        )}
      >
        {selected ? (
          <>
            {selected.logo_url ? (
              <img
                src={selected.logo_url}
                alt=""
                className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-[var(--border)]"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3B82F6]/10">
                <Building2 size={14} className="text-[#3B82F6]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-[11px] font-semibold text-[var(--text-primary)]">
                {selected.trade_name || selected.business_name}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-[var(--text-muted)]">{selected.code}</span>
                <span className="text-[8px] text-[var(--text-muted)]">·</span>
                <span className="flex items-center gap-0.5 text-[8px] text-[var(--text-muted)]">
                  <MapPin size={7} />
                  {selected.city}, {selected.country}
                </span>
              </div>
            </div>
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-bold"
              style={{
                backgroundColor: `${SEGMENT_COLORS[selected.segment]}15`,
                color: SEGMENT_COLORS[selected.segment],
              }}
            >
              {SEGMENT_LABELS[selected.segment]}
            </span>
          </>
        ) : (
          <>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)]">
              <Building2 size={14} className="text-[var(--text-muted)]" />
            </div>
            <span className="text-[11px] text-[var(--text-muted)]">Seleccionar cliente...</span>
          </>
        )}
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-[var(--text-muted)] transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown via Portal */}
      {open && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl"
            style={{ top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          >
            {/* Search */}
            <div className="border-b border-[var(--border)] p-2.5">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, código o país..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] py-2 pl-8 pr-3 text-[10px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-4 text-center text-[10px] text-[var(--text-muted)]">
                  Sin resultados
                </p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChange(c.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all",
                      "hover:bg-[#3B82F6]/5",
                      value === c.id && "bg-[#3B82F6]/10"
                    )}
                  >
                    {c.logo_url ? (
                      <img
                        src={c.logo_url}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-[var(--border)]"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)]">
                        <Building2 size={14} className="text-[var(--text-muted)]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[10px] font-semibold text-[var(--text-primary)]">
                        {c.trade_name || c.business_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[8px] text-[var(--text-muted)]">{c.code}</span>
                        <span className="text-[8px] text-[var(--text-muted)]">·</span>
                        <span className="text-[8px] text-[var(--text-muted)]">
                          {c.city}, {c.country}
                        </span>
                        <span className="text-[8px] text-[var(--text-muted)]">·</span>
                        <span className="text-[8px] text-emerald-500 font-medium">
                          ${(c.total_revenue / 1000).toFixed(0)}K rev.
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[7px] font-bold"
                        style={{
                          backgroundColor: `${SEGMENT_COLORS[c.segment]}15`,
                          color: SEGMENT_COLORS[c.segment],
                        }}
                      >
                        {SEGMENT_LABELS[c.segment]}
                      </span>
                      <span className="text-[7px] text-[var(--text-muted)]">
                        Score: {c.health_score}
                      </span>
                    </div>
                    {value === c.id && (
                      <CheckCircle2 size={14} className="shrink-0 text-[#3B82F6]" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Rich Product Picker for table rows
// ═══════════════════════════════════════════════════

export function ProductPicker({
  products,
  search,
  onSearchChange,
  onSelect,
  onClose,
  anchorRef,
}: {
  products: ProductOption[];
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (p: ProductOption) => void;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 384 });

  // Compute position from anchor
  useEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 384) });
    }
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const content = (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="fixed overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl"
      style={{ top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
    >
      {/* Search */}
      <div className="border-b border-[var(--border)] p-2.5">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar producto por nombre o SKU..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] py-2 pl-8 pr-3 text-[10px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
            autoFocus
          />
        </div>
      </div>

      {/* Results */}
      <div className="max-h-72 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6">
            <Package size={20} className="text-[var(--text-muted)]" />
            <p className="mt-2 text-[10px] text-[var(--text-muted)]">
              No se encontraron productos
            </p>
          </div>
        ) : (
          filtered.slice(0, 12).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-[#3B82F6]/5 border-b border-[var(--border)] last:border-0"
            >
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-[var(--border)] bg-white"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)]">
                  <Package size={16} className="text-[var(--text-muted)]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-[10px] font-semibold text-[var(--text-primary)]">
                  {p.name}
                </p>
                <p className="text-[8px] text-[var(--text-muted)] mt-0.5">
                  SKU: {p.sku}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-bold text-emerald-500 tabular-nums">
                  ${p.sale_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[7px] text-[var(--text-muted)]">precio unit.</p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-3 py-2 bg-[var(--bg-muted)]/30">
        <p className="text-[8px] text-[var(--text-muted)]">
          {filtered.length} producto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>
    </motion.div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

// ═══════════════════════════════════════════════════
// Product Row with Anchor
// ═══════════════════════════════════════════════════

function ProductRowAnchor({
  index,
  activeProductRow,
  selectedProd,
  register,
  item,
  setActiveProductRow,
  setProductSearch,
  products,
  productSearch,
  selectProduct,
}: {
  index: number;
  activeProductRow: number | null;
  selectedProd: ProductOption | undefined;
  register: ReturnType<typeof useForm<InvoiceFormData>>["register"];
  item: InvoiceFormData["items"][number] | undefined;
  setActiveProductRow: (v: number | null) => void;
  setProductSearch: (v: string) => void;
  products: ProductOption[];
  productSearch: string;
  selectProduct: (rowIndex: number, product: ProductOption) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={anchorRef} className="relative flex-1 min-w-0">
      <div className="flex items-center gap-2">
        {selectedProd?.image_url ? (
          <img
            src={selectedProd.image_url}
            alt=""
            className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-[var(--border)] bg-white"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)]">
            <Package size={14} className="text-[var(--text-muted)]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <input
            {...register(`items.${index}.description`)}
            placeholder="Click para buscar producto..."
            className="w-full bg-[var(--bg-card)] text-[10px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none cursor-pointer"
            onFocus={() => {
              setActiveProductRow(index);
              setProductSearch("");
            }}
            readOnly={!!item?.product_id}
            onClick={() => {
              setActiveProductRow(index);
              setProductSearch("");
            }}
          />
          {selectedProd && (
            <p className="text-[8px] text-[var(--text-muted)]">
              SKU: {selectedProd.sku}
            </p>
          )}
        </div>
      </div>

      {/* Product Dropdown */}
      <AnimatePresence>
        {activeProductRow === index && (
          <ProductPicker
            products={products}
            search={productSearch}
            onSearchChange={setProductSearch}
            onSelect={(p) => selectProduct(index, p)}
            onClose={() => setActiveProductRow(null)}
            anchorRef={anchorRef}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Main Modal
// ═══════════════════════════════════════════════════

type Props = {
  customers: SalesCustomer[];
  onClose: () => void;
  onSave: (data: InvoiceFormData) => void;
  demoRole: DemoRole;
  prefilledQuoteId?: string;
};

export function NuevaVentaModal({
  customers,
  onClose,
  onSave,
  demoRole,
}: Props) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [activeProductRow, setActiveProductRow] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    defaultValues: {
      customer_id: "",
      status: "draft",
      sale_date: new Date().toISOString().split("T")[0],
      currency: "USD",
      exchange_rate: 1,
      payment_method: "transfer",
      payment_terms: 30,
      discount_percent: 0,
      tax_rate: 15,
      notes: "",
      items: [
        {
          product_id: "",
          description: "",
          quantity: 1,
          unit: "UND",
          unit_price: 0,
          discount_percent: 0,
          cost_price: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchItems = watch("items");
  const watchDiscount = watch("discount_percent");
  const watchTax = watch("tax_rate");
  const watchStatus = watch("status");
  const watchCurrency = watch("currency");
  const watchPaymentMethod = watch("payment_method");
  const watchCustomerId = watch("customer_id");

  // Load products
  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch("/api/ventas/products");
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        }
      } catch {
        // Fallback
      }
    }
    loadProducts();
  }, []);

  // Calculations
  const subtotal = watchItems.reduce((sum, item) => {
    const lineTotal = (item.quantity || 0) * (item.unit_price || 0);
    const discount = lineTotal * ((item.discount_percent || 0) / 100);
    return sum + lineTotal - discount;
  }, 0);

  const discountAmount = subtotal * ((watchDiscount || 0) / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * ((watchTax || 0) / 100);
  const total = taxableAmount + taxAmount;

  const totalCost = watchItems.reduce((sum, item) => {
    return sum + (item.cost_price || 0) * (item.quantity || 0);
  }, 0);

  const marginPercent = total > 0 ? ((total - totalCost) / total) * 100 : 0;

  // Product Selection
  const selectProduct = (rowIndex: number, product: ProductOption) => {
    setValue(`items.${rowIndex}.product_id`, product.id);
    setValue(`items.${rowIndex}.description`, product.name);
    setValue(`items.${rowIndex}.unit_price`, product.sale_price);
    setValue(`items.${rowIndex}.cost_price`, product.sale_price * 0.65);
    setActiveProductRow(null);
    setProductSearch("");
  };

  // Status stepper
  const advanceStatus = () => {
    const currentIdx = STATUS_FLOW.indexOf(watchStatus);
    if (currentIdx < STATUS_FLOW.length - 1) {
      setValue("status", STATUS_FLOW[currentIdx + 1]);
    }
  };

  // Submit
  const onSubmit = async (data: InvoiceFormData) => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    onSave(data);
    setSaving(false);
    onClose();
  };

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Resolved display values
  const selectedCurrency = CURRENCIES.find((c) => c.code === watchCurrency);
  const selectedPayment = PAYMENT_METHODS.find((m) => m.value === watchPaymentMethod);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative flex h-[92vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3B82F6]/10">
                <FileText size={16} className="text-[#3B82F6]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Nueva Venta</h2>
                <p className="text-[9px] text-[var(--text-muted)]">Registrar nueva transacción de venta</p>
              </div>
            </div>

            {/* Status Stepper */}
            <div className="flex items-center gap-2">
              {STATUS_FLOW.map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-6 items-center gap-1 rounded-full px-2.5 text-[8px] font-bold transition-all",
                      watchStatus === s
                        ? "ring-2 ring-offset-1"
                        : STATUS_FLOW.indexOf(watchStatus) > i
                        ? "opacity-100"
                        : "opacity-40"
                    )}
                    style={{
                      backgroundColor: `${INVOICE_STATUS_COLORS[s]}15`,
                      color: INVOICE_STATUS_COLORS[s],
                    }}
                  >
                    {STATUS_FLOW.indexOf(watchStatus) > i && <CheckCircle2 size={10} />}
                    {STATUS_FLOW_LABELS[s]}
                  </div>
                  {i < STATUS_FLOW.length - 1 && (
                    <ArrowRight size={10} className="text-[var(--text-muted)]" />
                  )}
                </div>
              ))}
              {watchStatus !== "invoiced" && (
                <button
                  type="button"
                  onClick={advanceStatus}
                  className="ml-2 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-[9px] font-bold text-white transition-all hover:bg-[#2563EB]"
                >
                  Avanzar →
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-muted)]"
            >
              <X size={16} className="text-[var(--text-muted)]" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Row 1: Customer Combobox (full width) */}
              <div>
                <label className="mb-1.5 block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Cliente *
                </label>
                <CustomerCombobox
                  customers={customers}
                  value={watchCustomerId}
                  onChange={(id) => setValue("customer_id", id)}
                  error={!!errors.customer_id}
                />
              </div>

              {/* Row 2: Date + Currency + Payment Method */}
              <div className="grid grid-cols-12 gap-4">
                {/* Date */}
                <div className="col-span-3">
                  <label className="mb-1.5 block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Fecha de Venta
                  </label>
                  <input
                    type="date"
                    {...register("sale_date")}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[11px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                  />
                </div>

                {/* Currency Picker */}
                <div className="col-span-3 relative">
                  <label className="mb-1.5 block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Moneda
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowCurrencyPicker(!showCurrencyPicker); setShowPaymentPicker(false); }}
                    className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-left transition-all hover:border-[#3B82F6]/50"
                  >
                    <span className="text-base">{selectedCurrency?.flag}</span>
                    <span className="text-[11px] font-semibold text-[var(--text-primary)]">{watchCurrency}</span>
                    <span className="text-[9px] text-[var(--text-muted)]">{selectedCurrency?.name}</span>
                    <ChevronDown size={12} className="ml-auto text-[var(--text-muted)]" />
                  </button>
                  {showCurrencyPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl overflow-hidden"
                    >
                      {CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setValue("currency", c.code);
                            setShowCurrencyPicker(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-all hover:bg-[#3B82F6]/5",
                            watchCurrency === c.code && "bg-[#3B82F6]/10"
                          )}
                        >
                          <span className="text-lg">{c.flag}</span>
                          <span className="text-[10px] font-semibold text-[var(--text-primary)]">{c.code}</span>
                          <span className="text-[9px] text-[var(--text-muted)]">{c.name}</span>
                          {watchCurrency === c.code && (
                            <CheckCircle2 size={12} className="ml-auto text-[#3B82F6]" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>

                {/* Payment Method Picker */}
                <div className="col-span-4 relative">
                  <label className="mb-1.5 block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Método de Pago
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowPaymentPicker(!showPaymentPicker); setShowCurrencyPicker(false); }}
                    className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-left transition-all hover:border-[#3B82F6]/50"
                  >
                    {selectedPayment && (
                      <>
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${selectedPayment.color}15` }}
                        >
                          <selectedPayment.icon size={12} style={{ color: selectedPayment.color }} />
                        </div>
                        <span className="text-[11px] font-medium text-[var(--text-primary)]">
                          {selectedPayment.label}
                        </span>
                      </>
                    )}
                    <ChevronDown size={12} className="ml-auto text-[var(--text-muted)]" />
                  </button>
                  {showPaymentPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl overflow-hidden"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            setValue("payment_method", m.value as PaymentMethod);
                            setShowPaymentPicker(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-[#3B82F6]/5",
                            watchPaymentMethod === m.value && "bg-[#3B82F6]/10"
                          )}
                        >
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${m.color}15` }}
                          >
                            <m.icon size={14} style={{ color: m.color }} />
                          </div>
                          <span className="text-[10px] font-medium text-[var(--text-primary)]">{m.label}</span>
                          {watchPaymentMethod === m.value && (
                            <CheckCircle2 size={12} className="ml-auto text-[#3B82F6]" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>

                {/* Payment Terms */}
                <div className="col-span-2">
                  <label className="mb-1.5 block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Plazo (días)
                  </label>
                  <input
                    type="number"
                    {...register("payment_terms", { valueAsNumber: true })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[11px] text-[var(--text-primary)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                  />
                </div>
              </div>

              {/* Row 3: Notes */}
              <div>
                <label className="mb-1.5 block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Notas Internas
                </label>
                <input
                  type="text"
                  {...register("notes")}
                  placeholder="Instrucciones especiales, referencias, etc."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                />
              </div>

              {/* Product Lines */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-[#3B82F6]" />
                    <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">
                      Líneas de Producto
                    </h3>
                    <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[8px] font-bold text-[var(--text-muted)]">
                      {fields.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      append({
                        product_id: "",
                        description: "",
                        quantity: 1,
                        unit: "UND",
                        unit_price: 0,
                        discount_percent: 0,
                        cost_price: 0,
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg bg-[#3B82F6]/10 px-3 py-1.5 text-[9px] font-bold text-[#3B82F6] transition-colors hover:bg-[#3B82F6]/20"
                  >
                    <Plus size={10} />
                    Agregar Línea
                  </button>
                </div>

                {/* Items */}
                <div className="divide-y divide-[var(--border)]">
                  {fields.map((field, index) => {
                    const item = watchItems[index];
                    const lineTotal =
                      (item?.quantity || 0) *
                      (item?.unit_price || 0) *
                      (1 - (item?.discount_percent || 0) / 100);
                    const selectedProd = products.find(
                      (p) => p.id === item?.product_id
                    );

                    return (
                      <div key={field.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-muted)]/30 transition-colors">
                        {/* # */}
                        <span className="w-6 shrink-0 text-[10px] font-bold text-[var(--text-muted)]">
                          {index + 1}
                        </span>

                        {/* Product image + picker */}
                        <ProductRowAnchor
                          index={index}
                          activeProductRow={activeProductRow}
                          selectedProd={selectedProd}
                          register={register}
                          item={item}
                          setActiveProductRow={setActiveProductRow}
                          setProductSearch={setProductSearch}
                          products={products}
                          productSearch={productSearch}
                          selectProduct={selectProduct}
                        />

                        {/* Quantity */}
                        <div className="w-16 shrink-0">
                          <label className="mb-0.5 block text-[7px] text-[var(--text-muted)] uppercase">Cant.</label>
                          <input
                            type="number"
                            min={1}
                            {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[10px] text-[var(--text-primary)] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#3B82F6] text-center"
                          />
                        </div>

                        {/* Unit */}
                        <div className="w-16 shrink-0">
                          <label className="mb-0.5 block text-[7px] text-[var(--text-muted)] uppercase">Unidad</label>
                          <select
                            {...register(`items.${index}.unit`)}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-1 py-1.5 text-[10px] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                          >
                            {["UND", "KG", "MT", "GL", "LIC", "KIT", "HRS"].map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>

                        {/* Price */}
                        <div className="w-24 shrink-0">
                          <label className="mb-0.5 block text-[7px] text-[var(--text-muted)] uppercase">P. Unit.</label>
                          <input
                            type="number"
                            step="0.01"
                            {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[10px] text-[var(--text-primary)] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#3B82F6] text-right"
                          />
                        </div>

                        {/* Disc */}
                        <div className="w-14 shrink-0">
                          <label className="mb-0.5 block text-[7px] text-[var(--text-muted)] uppercase">Desc.%</label>
                          <input
                            type="number"
                            step="0.1"
                            min={0}
                            max={100}
                            {...register(`items.${index}.discount_percent`, { valueAsNumber: true })}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[10px] text-[var(--text-primary)] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#3B82F6] text-center"
                          />
                        </div>

                        {/* Subtotal */}
                        <div className="w-24 shrink-0 text-right">
                          <label className="mb-0.5 block text-[7px] text-[var(--text-muted)] uppercase">Subtotal</label>
                          <p className="text-[11px] font-bold text-[var(--text-primary)] tabular-nums">
                            ${lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>

                        {/* Delete */}
                        <div className="w-8 shrink-0 flex items-center justify-center">
                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="rounded-lg p-1.5 text-[var(--text-muted)] transition-all hover:bg-red-500/10 hover:text-red-500 opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--border)] bg-[var(--bg-muted)]/30 px-6 py-4">
              <div className="flex items-end justify-between">
                {/* Controls */}
                <div className="flex items-end gap-5">
                  <div>
                    <label className="mb-1 block text-[8px] font-semibold text-[var(--text-muted)] uppercase">
                      Descuento %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      {...register("discount_percent", { valueAsNumber: true })}
                      className="w-20 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[10px] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#3B82F6] text-center"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[8px] font-semibold text-[var(--text-muted)] uppercase">
                      IVA %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      {...register("tax_rate", { valueAsNumber: true })}
                      className="w-20 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[10px] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#3B82F6] text-center"
                    />
                  </div>
                  <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border)] px-3 py-1.5">
                    <p className="text-[7px] text-[var(--text-muted)] uppercase">Margen</p>
                    <p
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        marginPercent >= 30 ? "text-emerald-500" : marginPercent >= 15 ? "text-amber-500" : "text-red-500"
                      )}
                    >
                      {marginPercent.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div className="text-right space-y-1">
                  <div className="flex items-center justify-end gap-4">
                    <span className="text-[9px] text-[var(--text-muted)]">Subtotal</span>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)] tabular-nums w-28 text-right">
                      ${subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex items-center justify-end gap-4">
                      <span className="text-[9px] text-[var(--text-muted)]">Descuento ({watchDiscount}%)</span>
                      <span className="text-[10px] text-red-500 tabular-nums w-28 text-right">
                        -${discountAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-4">
                    <span className="text-[9px] text-[var(--text-muted)]">IVA ({watchTax}%)</span>
                    <span className="text-[10px] text-[var(--text-secondary)] tabular-nums w-28 text-right">
                      ${taxAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-4 pt-1.5 border-t border-[var(--border)]">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">TOTAL</span>
                    <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums w-28 text-right">
                      ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-[10px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[10px] font-bold text-white transition-all",
                      saving
                        ? "bg-[#3B82F6]/50 cursor-not-allowed"
                        : "bg-[#3B82F6] hover:bg-[#2563EB] shadow-lg shadow-[#3B82F6]/25"
                    )}
                  >
                    <DollarSign size={12} />
                    {saving ? "Guardando..." : "Guardar Venta"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
