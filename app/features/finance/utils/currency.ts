import type { CurrencyCode } from "../types";

// Base exchange rates — updated 2026-03-11 from open.er-api.com
const BASE_RATES: Record<CurrencyCode, Record<CurrencyCode, number>> = {
  USD: { USD: 1, EUR: 0.8601, GBP: 0.7718, COP: 3753.09, PEN: 3.4611, ARS: 1452.25, BRL: 5.6842 },
  EUR: { USD: 1.1627, EUR: 1, GBP: 0.8974, COP: 4363.35, PEN: 4.0241, ARS: 1688.38, BRL: 6.6089 },
  GBP: { USD: 1.2957, EUR: 1.1143, GBP: 1, COP: 4862.99, PEN: 4.4847, ARS: 1881.67, BRL: 7.3654 },
  COP: { USD: 0.000266, EUR: 0.000229, GBP: 0.000206, COP: 1, PEN: 0.000922, ARS: 0.3869, BRL: 0.001515 },
  PEN: { USD: 0.2889, EUR: 0.2485, GBP: 0.2230, COP: 1084.47, PEN: 1, ARS: 419.61, BRL: 1.6424 },
  ARS: { USD: 0.000689, EUR: 0.000592, GBP: 0.000531, COP: 2.5849, PEN: 0.002383, ARS: 1, BRL: 0.003914 },
  BRL: { USD: 0.1759, EUR: 0.1513, GBP: 0.1358, COP: 660.28, PEN: 0.6089, ARS: 255.51, BRL: 1 },
};

export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  customRates?: Record<string, number>
): number {
  if (from === to) return amount;
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
    USD: "en-US", EUR: "de-DE", GBP: "en-GB", COP: "es-CO",
    PEN: "es-PE", ARS: "es-AR", BRL: "pt-BR",
  };
  const formatter = new Intl.NumberFormat(locales[currency] || "en-US", {
    style: "currency", currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
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
    USD: "$", EUR: "€", GBP: "£", COP: "COP ",
    PEN: "S/ ", ARS: "ARS ", BRL: "R$ ",
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
  BRL: { symbol: "R$", name: "Real", flag: "🇧🇷" },
};

export function addRateNoise(rate: number): number {
  const noise = (Math.random() - 0.5) * 0.004;
  return Math.round((rate + noise) * 1_000_000) / 1_000_000;
}
