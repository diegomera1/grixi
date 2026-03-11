import type { CurrencyCode } from "../types";

// Base exchange rates (USD as reference) — March 2026 approximate
const BASE_RATES: Record<CurrencyCode, Record<CurrencyCode, number>> = {
  USD: { USD: 1, EUR: 0.923, GBP: 0.789, COP: 4285, PEN: 3.72, ARS: 1065 },
  EUR: { USD: 1.0834, EUR: 1, GBP: 0.8549, COP: 4642, PEN: 4.03, ARS: 1154 },
  GBP: { USD: 1.2674, EUR: 1.1698, GBP: 1, COP: 5431, PEN: 4.72, ARS: 1350 },
  COP: { USD: 0.000233, EUR: 0.000215, GBP: 0.000184, COP: 1, PEN: 0.000868, ARS: 0.2485 },
  PEN: { USD: 0.2688, EUR: 0.2482, GBP: 0.2119, COP: 1152, PEN: 1, ARS: 286.3 },
  ARS: { USD: 0.000939, EUR: 0.000867, GBP: 0.000741, COP: 4.024, PEN: 0.003493, ARS: 1 },
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
  const locales: Record<CurrencyCode, string> = {
    USD: "en-US",
    EUR: "de-DE",
    GBP: "en-GB",
    COP: "es-CO",
    PEN: "es-PE",
    ARS: "es-AR",
  };
  const formatter = new Intl.NumberFormat(locales[currency] || "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === "COP" || currency === "ARS" ? 0 : 0,
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
    COP: "COP ",
    PEN: "S/ ",
    ARS: "ARS ",
  };
  const sym = symbols[currency];

  if (abs >= 1_000_000_000) return `${sign}${sym}${(abs / 1_000_000_000).toFixed(1)}B`;
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
  COP: { symbol: "COP", name: "Peso Col.", flag: "🇨🇴" },
  PEN: { symbol: "S/", name: "Sol", flag: "🇵🇪" },
  ARS: { symbol: "ARS", name: "Peso Arg.", flag: "🇦🇷" },
};

// Add small random variation to rates (simulates live market)
export function addRateNoise(rate: number): number {
  const noise = (Math.random() - 0.5) * 0.004; // ±0.2%
  return Math.round((rate + noise) * 1_000_000) / 1_000_000;
}
