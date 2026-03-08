import type { CurrencyCode } from "../types";

// Base exchange rates (USD as reference)
const BASE_RATES: Record<CurrencyCode, Record<CurrencyCode, number>> = {
  USD: { USD: 1, EUR: 0.923, GBP: 0.789 },
  EUR: { USD: 1.0834, EUR: 1, GBP: 0.8549 },
  GBP: { USD: 1.2674, EUR: 1.1698, GBP: 1 },
};

export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  customRates?: Record<string, number>
): number {
  if (from === to) return amount;

  // Use custom rates if available
  if (customRates) {
    const key = `${from}_${to}`;
    if (customRates[key]) return amount * customRates[key];
  }

  const rate = BASE_RATES[from]?.[to] ?? 1;
  return amount * rate;
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = "USD"
): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(amount);
}

export function formatCurrencyCompact(
  amount: number,
  currency: CurrencyCode = "USD"
): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const symbols: Record<CurrencyCode, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
  };
  const sym = symbols[currency];

  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

export const CURRENCY_CONFIG: Record<
  CurrencyCode,
  { symbol: string; name: string; flag: string }
> = {
  USD: { symbol: "$", name: "Dólar", flag: "🇺🇸" },
  EUR: { symbol: "€", name: "Euro", flag: "🇪🇺" },
  GBP: { symbol: "£", name: "Libra", flag: "🇬🇧" },
};

// Add small random variation to rates (simulates live market)
export function addRateNoise(rate: number): number {
  const noise = (Math.random() - 0.5) * 0.004; // ±0.2%
  return Math.round((rate + noise) * 1_000_000) / 1_000_000;
}
