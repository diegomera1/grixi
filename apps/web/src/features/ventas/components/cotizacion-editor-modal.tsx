"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm, useFieldArray } from "react-hook-form";
import {
  X,
  Plus,
  Trash2,
  Package,
  FileText,
  Send,
  CheckCircle2,
  ArrowRight,
  Download,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type {
  SalesCustomer,
  SalesQuote,
  QuoteStatus,
  DemoRole,
} from "../types";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from "../types";
import { CustomerCombobox, ProductPicker } from "./nueva-venta-modal";

// ── Types ─────────────────────────────────────────

type QuoteItemForm = {
  product_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
};

type QuoteFormData = {
  customer_id: string;
  status: QuoteStatus;
  validity_days: number;
  currency: string;
  discount_percent: number;
  tax_rate: number;
  terms_html: string;
  internal_notes: string;
  items: QuoteItemForm[];
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  sale_price: number;
  image_url: string | null;
};

// ── Status Flow ───────────────────────────────────

const QUOTE_FLOW: QuoteStatus[] = ["draft", "sent", "approved"];

// ── Props ─────────────────────────────────────────

type Props = {
  customers: SalesCustomer[];
  existingQuote?: SalesQuote | null;
  onClose: () => void;
  onSave: (data: QuoteFormData) => void;
  onConvertToSale?: (quoteId: string) => void;
  demoRole: DemoRole;
};

// ── Product Cell with anchor ref ──────────────────

function QuoteProductCell({
  index,
  item,
  products,
  activeProductRow,
  productSearch,
  register,
  setActiveProductRow,
  setProductSearch,
  selectProduct,
}: {
  index: number;
  item: QuoteItemForm | undefined;
  products: ProductOption[];
  activeProductRow: number | null;
  productSearch: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  setActiveProductRow: (v: number | null) => void;
  setProductSearch: (v: string) => void;
  selectProduct: (rowIndex: number, product: ProductOption) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const selectedProd = products.find((p) => p.id === item?.product_id);

  return (
    <td className="px-3 py-1.5 relative">
      <div ref={anchorRef} className="relative">
        <div className="flex items-center gap-2">
          {selectedProd?.image_url ? (
            <img
              src={selectedProd.image_url}
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-[var(--border)] bg-white"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)]">
              <Package size={12} className="text-[var(--text-muted)]" />
            </div>
          )}
          <input
            {...register(`items.${index}.description`)}
            placeholder="Click para buscar..."
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
        </div>
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
    </td>
  );
}

export function CotizacionEditorModal({
  customers,
  existingQuote,
  onClose,
  onSave,
  onConvertToSale,
  demoRole,
}: Props) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [activeProductRow, setActiveProductRow] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const isEdit = !!existingQuote;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<QuoteFormData>({
    defaultValues: {
      customer_id: existingQuote?.customer_id || "",
      status: existingQuote?.status || "draft",
      validity_days: existingQuote?.validity_days || 30,
      currency: existingQuote?.currency || "USD",
      discount_percent: existingQuote?.discount_percent || 0,
      tax_rate: existingQuote?.tax_rate || 15,
      terms_html: existingQuote?.terms_html || "Precios sujetos a cambio sin previo aviso. Válido por el período indicado.",
      internal_notes: existingQuote?.internal_notes || "",
      items: existingQuote?.items?.map((i) => ({
        product_id: i.product_id || "",
        description: i.description,
        quantity: i.quantity,
        unit: i.unit,
        unit_price: i.unit_price,
        discount_percent: i.discount_percent,
      })) || [
        {
          product_id: "",
          description: "",
          quantity: 1,
          unit: "UND",
          unit_price: 0,
          discount_percent: 0,
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


  const selectProduct = (rowIndex: number, product: ProductOption) => {
    setValue(`items.${rowIndex}.product_id`, product.id);
    setValue(`items.${rowIndex}.description`, product.name);
    setValue(`items.${rowIndex}.unit_price`, product.sale_price);
    setActiveProductRow(null);
    setProductSearch("");
  };

  // Status advancement
  const advanceStatus = () => {
    const currentIdx = QUOTE_FLOW.indexOf(watchStatus);
    if (currentIdx < QUOTE_FLOW.length - 1) {
      setValue("status", QUOTE_FLOW[currentIdx + 1]);
    }
  };

  // PDF Generation (simulated)
  const handleGeneratePDF = async () => {
    setGeneratingPDF(true);
    await new Promise((r) => setTimeout(r, 1500));
    setGeneratingPDF(false);
    // In production, this would call @react-pdf/renderer
    alert("PDF generado exitosamente (simulado para demo)");
  };

  // Submit
  const onSubmit = async (data: QuoteFormData) => {
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
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8B5CF6]/10">
                <FileText size={16} className="text-[#8B5CF6]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  {isEdit ? `Editar Cotización ${existingQuote?.quote_number}` : "Nueva Cotización"}
                </h2>
                <p className="text-[9px] text-[var(--text-muted)]">
                  {isEdit ? "Modificar cotización existente" : "Crear una nueva propuesta comercial"}
                </p>
              </div>
            </div>

            {/* Status + Actions */}
            <div className="flex items-center gap-2">
              {QUOTE_FLOW.map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-6 items-center gap-1 rounded-full px-2.5 text-[8px] font-bold transition-all",
                      watchStatus === s ? "ring-2 ring-offset-1" : QUOTE_FLOW.indexOf(watchStatus) > i ? "opacity-100" : "opacity-40"
                    )}
                    style={{
                      backgroundColor: `${QUOTE_STATUS_COLORS[s]}15`,
                      color: QUOTE_STATUS_COLORS[s],
                    }}
                  >
                    {QUOTE_FLOW.indexOf(watchStatus) > i && <CheckCircle2 size={10} />}
                    {QUOTE_STATUS_LABELS[s]}
                  </div>
                  {i < QUOTE_FLOW.length - 1 && <ArrowRight size={10} className="text-[var(--text-muted)]" />}
                </div>
              ))}

              {watchStatus === "draft" && (
                <button
                  type="button"
                  onClick={advanceStatus}
                  className="ml-2 flex items-center gap-1 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-[9px] font-bold text-white transition-all hover:bg-[#2563EB]"
                >
                  <Send size={10} />
                  Enviar
                </button>
              )}

              {watchStatus === "sent" && (
                <button
                  type="button"
                  onClick={advanceStatus}
                  className="ml-2 flex items-center gap-1 rounded-lg bg-[#10B981] px-3 py-1.5 text-[9px] font-bold text-white transition-all hover:bg-[#059669]"
                >
                  <CheckCircle2 size={10} />
                  Aprobar
                </button>
              )}

              {watchStatus === "approved" && onConvertToSale && existingQuote && (
                <button
                  type="button"
                  onClick={() => onConvertToSale(existingQuote.id)}
                  className="ml-2 flex items-center gap-1 rounded-lg bg-[#F59E0B] px-3 py-1.5 text-[9px] font-bold text-white transition-all hover:bg-[#D97706]"
                >
                  <ShoppingCart size={10} />
                  Convertir a Venta
                </button>
              )}

              <button
                type="button"
                onClick={handleGeneratePDF}
                disabled={generatingPDF}
                className="ml-1 flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[9px] font-bold text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-muted)]"
              >
                <Download size={10} />
                {generatingPDF ? "Generando..." : "PDF"}
              </button>
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
              {/* Row 1 */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6">
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
                <div className="col-span-2">
                  <label className="mb-1 block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Validez (días)
                  </label>
                  <input
                    type="number"
                    {...register("validity_days", { valueAsNumber: true })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[11px] text-[var(--text-primary)] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Moneda
                  </label>
                  <select
                    {...register("currency")}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[11px] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="MXN">MXN</option>
                    <option value="COP">COP</option>
                    <option value="BRL">BRL</option>
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="mb-1 block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Notas Internas
                  </label>
                  <input
                    type="text"
                    {...register("internal_notes")}
                    placeholder="Solo visibles internamente..."
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[11px] placeholder:text-[var(--text-muted)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                </div>
              </div>

              {/* Terms */}
              <div>
                <label className="mb-1 block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Términos y Condiciones
                </label>
                <textarea
                  {...register("terms_html")}
                  rows={2}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[10px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] resize-none"
                />
              </div>

              {/* Product Lines */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
                  <h3 className="text-[10px] font-semibold text-[var(--text-primary)]">
                    Líneas de Cotización
                  </h3>
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
                      })
                    }
                    className="flex items-center gap-1 rounded-lg bg-[#8B5CF6]/10 px-2.5 py-1 text-[9px] font-bold text-[#8B5CF6] transition-colors hover:bg-[#8B5CF6]/20"
                  >
                    <Plus size={10} />
                    Agregar Línea
                  </button>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/50">
                      {["#", "Producto", "Cant.", "Unidad", "Precio Unit.", "Desc.%", "Subtotal", ""].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[8px] font-semibold text-[var(--text-muted)] uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const item = watchItems[index];
                      const lineTotal =
                        (item?.quantity || 0) * (item?.unit_price || 0) *
                        (1 - (item?.discount_percent || 0) / 100);

                      return (
                        <tr key={field.id} className="border-b border-[var(--border)] last:border-0 group">
                          <td className="px-3 py-2 text-[9px] text-[var(--text-muted)]">{index + 1}</td>
                          <QuoteProductCell
                            index={index}
                            item={item}
                            products={products}
                            activeProductRow={activeProductRow}
                            productSearch={productSearch}
                            register={register}
                            setActiveProductRow={setActiveProductRow}
                            setProductSearch={setProductSearch}
                            selectProduct={selectProduct}
                          />
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min={1}
                              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                              className="w-16 rounded border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[10px] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              {...register(`items.${index}.unit`)}
                              className="w-16 rounded border border-[var(--border)] bg-[var(--bg-card)] px-1 py-1.5 text-[10px] focus:outline-none"
                            >
                              {["UND", "KG", "MT", "GL", "LIC", "KIT", "HRS", "SESIÓN"].map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.01"
                              {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                              className="w-24 rounded border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[10px] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.1"
                              min={0}
                              max={100}
                              {...register(`items.${index}.discount_percent`, { valueAsNumber: true })}
                              className="w-14 rounded border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[10px] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-[10px] font-bold text-[var(--text-primary)] tabular-nums">
                              ${lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">
                            {fields.length > 1 && (
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500 opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--border)] bg-[var(--bg-muted)]/30 px-6 py-4">
              <div className="flex items-end justify-between">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="mb-1 block text-[8px] font-semibold text-[var(--text-muted)] uppercase">
                      Descuento Global %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      {...register("discount_percent", { valueAsNumber: true })}
                      className="w-20 rounded border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[10px] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
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
                      className="w-20 rounded border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1.5 text-[10px] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                    />
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
                  <div className="flex items-center justify-end gap-4 pt-1 border-t border-[var(--border)]">
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">TOTAL</span>
                    <span className="text-base font-bold text-[var(--text-primary)] tabular-nums w-28 text-right">
                      ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-[10px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-5 py-2 text-[10px] font-bold text-white transition-all",
                      saving
                        ? "bg-[#8B5CF6]/50 cursor-not-allowed"
                        : "bg-[#8B5CF6] hover:bg-[#7C3AED] shadow-lg shadow-[#8B5CF6]/25"
                    )}
                  >
                    <FileText size={12} />
                    {saving ? "Guardando..." : "Guardar Cotización"}
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
