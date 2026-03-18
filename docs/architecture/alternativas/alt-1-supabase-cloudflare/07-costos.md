# Alternativa 1 — Costos

> Desglose detallado de costos mensuales y comparación con la arquitectura actual.

---

## Costo Mensual

| Servicio | Plan | Costo/mes |
|---|---|---|
| **Supabase Pro** | Pro ($25) + PITR ($100) + Compute Small ($15) | $140 |
| **Cloudflare Pro** | CDN + WAF + DNS | $20 |
| **Cloudflare Workers Paid** | $5 base + ~500K requests/mes | ~$5-10 |
| **Cloudflare Workers KV** | Cache ISR (10M reads/mes) | ~$0-5 |
| **GitHub Teams** | 3 users | $12 |
| **Total** | | **~$177-187/mes** |

## Comparación con Actual

| Concepto | Actual | Alt. 1 | Diferencia |
|---|---|---|---|
| Vercel Pro | $20 | $0 | -$20 |
| CF Workers | $0 | ~$7 | +$7 |
| CF KV | $0 | ~$3 | +$3 |
| Supabase | $140 | $140 | $0 |
| Cloudflare | $20 | $20 | $0 |
| GitHub | $12 | $12 | $0 |
| **Total** | **$192** | **~$182** | **~-$10/mes** |

## Proyección a 12 Meses

| Concepto | Actual | Alt. 1 |
|---|---|---|
| Total anual | $2,304 | ~$2,184 |
| Ahorro anual | — | ~$120 |

> [!NOTE]
> El ahorro directo es modesto (~$10/mes). El verdadero beneficio es la **latencia mejorada** (310+ PoPs vs 18 regiones Vercel) y la **eliminación de un vendor** (Vercel).
