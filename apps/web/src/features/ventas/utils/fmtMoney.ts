/**
 * Centralized money formatting utilities for the Ventas module.
 * All monetary values in the CRM should use these functions
 * for consistent display across Dashboard, Reportes, and Map.
 */

/**
 * Format a number as USD currency with full precision.
 * @example fmtMoney(9826667)      → "$9,826,667.00"
 * @example fmtMoney(45700, 0)     → "$45,700"
 * @example fmtMoney(1234.5, 2)    → "$1,234.50"
 */
export function fmtMoney(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number as compact USD for KPI cards and small spaces.
 * @example fmtMoneyCompact(9826667) → "$9.8M"
 * @example fmtMoneyCompact(45700)   → "$45.7K"
 * @example fmtMoneyCompact(850)     → "$850"
 */
export function fmtMoneyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * Format a plain number with thousands separators (no currency symbol).
 * @example fmtNum(82159)  → "82,159"
 * @example fmtNum(3.14)   → "3.14"
 */
export function fmtNum(value: number, decimals?: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals ?? 2,
  }).format(value);
}

/**
 * Format a percentage with consistent display.
 * @example fmtPct(0.354)  → "35.4%"
 * @example fmtPct(85.2)   → "85.2%"  (when already a percentage)
 */
export function fmtPct(value: number, isDecimal = false): string {
  const pct = isDecimal ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}
