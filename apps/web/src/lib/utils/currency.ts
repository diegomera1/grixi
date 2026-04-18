/**
 * Shared currency utilities — re-exported from Finance module.
 * Used across Ventas, Dashboard, and any module needing currency conversion.
 */
export {
  convertCurrency,
  formatCurrency,
  formatCurrencyCompact,
  CURRENCY_CONFIG,
  addRateNoise,
} from "@/features/finance/utils/currency";

export type { CurrencyCode } from "@/features/finance/types";
