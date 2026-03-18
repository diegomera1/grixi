# Alternativa 1 — Costos

> Desglose completo de costos mensuales, precios unitarios por servicio, y proyección a 3 años.

---

## Costos de Setup (One-Time)

| Concepto | Costo |
|---|---|
| Migración de código (tiempo dev) | $0 (interno) |
| **Total** | **$0** |

> Sin inversión inicial. Solo se paga la suscripción mensual.

---

## Costos Recurrentes — Desglose Detallado

### Supabase Pro ($140/mes)

| Componente | Incluido | Precio |
|---|---|---|
| **Plan Pro base** | 8 GB DB, 250 GB bandwidth, 100K MAUs | $25/mes |
| **PITR** (7 días) | Point-in-Time Recovery | $100/mes |
| **Compute Small** | 2 vCPU, 1 GB RAM dedicado | $15/mes |
| **Crédito compute** | Incluido en Pro | -$10/mes (ya aplicado) |
| Edge Functions | 2M invocaciones/mes | Incluido |
| Realtime | 500 concurrent connections | Incluido |
| Storage | 100 GB archivos | Incluido |
| **Subtotal** | | **$140/mes** |

### Cloudflare Pro ($20/mes)

| Componente | Incluido | Precio |
|---|---|---|
| **Plan Pro** | CDN, WAF, DDoS, DNS, Analytics | $20/mes |
| SSL Full (Strict) | Certificado edge + origin | Incluido |
| Page Rules | 20 reglas | Incluido |
| DNS | Unlimited queries | Incluido |
| **Subtotal** | | **$20/mes** |

### Cloudflare Workers Paid ($5-10/mes)

| Componente | Incluido gratis | Precio overage | Estimado GRIXI |
|---|---|---|---|
| **Plan base** | — | — | $5/mes |
| **Requests** | 10M/mes | $0.30 por 1M adicional | ~$0 (< 10M) |
| **CPU time** | 30M ms/mes | $0.02 por 1M ms | ~$0 |
| **Egress** | Ilimitado | $0 | $0 |
| **Subtotal** | | | **~$5-7/mes** |

> [!NOTE]
> Con < 10M requests/mes y SSR ligero, los costos de Workers se mantienen en el mínimo de **$5/mes**. Solo escalaría si GRIXI supera 10M requests, que equivale a ~333K/día — muy por encima del uso esperado.

### Cloudflare Workers KV ($0-5/mes)

| Componente | Incluido gratis | Precio overage | Estimado GRIXI |
|---|---|---|---|
| **Reads** | 10M/mes | $0.50 por 1M | ~$0 |
| **Writes** | 1M/mes | $5 por 1M | ~$0 |
| **Storage** | 1 GB | $0.50 por GB | ~$0.50 |
| **Subtotal** | | | **~$0-2/mes** |

### Cloudflare R2 (Cache de Storage, Opcional)

| Componente | Incluido gratis | Precio | Estimado GRIXI |
|---|---|---|---|
| **Storage** | 10 GB/mes | $0.015 por GB | ~$0-1 |
| **Class A ops** (PUT) | 1M/mes | $4.50 por 1M | ~$0 |
| **Class B ops** (GET) | 10M/mes | $0.36 por 1M | ~$0 |
| **Egress** | Ilimitado | $0 | $0 |
| **Subtotal** | | | **~$0-1/mes** |

### GitHub Teams ($12/mes)

| Componente | Precio |
|---|---|
| **3 usuarios** | $4/user/mes = $12/mes |

---

## Resumen de Costos Mensuales

| Servicio | Costo/mes |
|---|---|
| **Supabase Pro** (Pro + PITR + Compute Small) | $140 |
| **Cloudflare Pro** (CDN + WAF + DNS) | $20 |
| **Cloudflare Workers Paid** (SSR) | ~$5 |
| **Cloudflare Workers KV** (cache) | ~$2 |
| **Cloudflare R2** (storage cache, opcional) | ~$1 |
| **GitHub Teams** (3 users) | $12 |
| **Dominio** grixi.com (anual/12) | ~$1 |
| **Total** | **~$181/mes** |

---

## Comparación con Arquitectura Actual — Línea por Línea

| Concepto | Actual | Alt. 1 | Diferencia |
|---|---|---|---|
| Vercel Pro (hosting) | $20/mes | **$0** | -$20 ✅ |
| CF Workers Paid (SSR) | $0 | ~$5 | +$5 |
| CF Workers KV (cache) | $0 | ~$2 | +$2 |
| CF R2 (storage cache) | $0 | ~$1 | +$1 |
| Supabase Pro (backend) | $140/mes | $140/mes | $0 |
| Cloudflare Pro (CDN) | $20/mes | $20/mes | $0 |
| GitHub Teams (repo) | $12/mes | $12/mes | $0 |
| Dominio | ~$1/mes | ~$1/mes | $0 |
| **Total** | **$193/mes** | **~$181/mes** | **-$12/mes** ✅ |

---

## Break-Even

```
Ahorro mensual: $193 - $181 = $12/mes
Inversión inicial: $0
Break-even: Inmediato — desde el mes 1 se ahorra
```

> El ahorro inicia desde el día 1 porque no hay costo inicial.

---

## Proyección a 3 Años

| Horizonte | Actual | Alt. 1 | Ahorro acumulado |
|---|---|---|---|
| **6 meses** | $1,158 | $1,086 | **$72** |
| **1 año** | $2,316 | $2,172 | **$144** |
| **2 años** | $4,632 | $4,344 | **$288** |
| **3 años** | $6,948 | $6,516 | **$432** |

---

## Comparación con Todas las Alternativas

| Concepto | Actual | Alt. 1 (SB+CF) | Alt. 2 (On-Prem) | Alt. 3 (AX52) |
|---|---|---|---|---|
| Costo mensual | $193 | **$181** | ~$41 | ~$108 |
| Costo inicial | $0 | **$0** | ~$2,910 | ~$290 |
| **1 año** | $2,316 | **$2,172** | $3,402 | $1,586 |
| **2 años** | $4,632 | **$4,344** | $3,894 | $2,882 |
| **3 años** | $6,948 | **$6,516** | $4,386 | $4,178 |

---

## Escenarios de Escalado

| Escenario | Impacto en costo |
|---|---|
| **10M → 50M requests/mes** | Workers: +$12/mes ($0.30 × 40M) |
| **100+ tenants (más DB)** | Supabase: upgrade compute Medium (+$45/mes) |
| **Heavy AI usage** | Gemini: via Edge Functions, sin impacto en Workers |
| **10 GB → 50 GB storage cache** | R2: +$0.60/mes (40 GB × $0.015) |
| **Equipo crece a 10 devs** | GitHub Team: +$28/mes ($4 × 7 users más) |

> [!TIP]
> **El costo escala linealmente y de forma predecible.** No hay sorpresas tipo "Vercel bandwidth overage". Cloudflare no cobra egress ni en Workers, ni en R2, ni en KV.

---

## ¿Por Qué Elegir Alt. 1 en Costos?

| ✅ A favor | ❌ En contra |
|---|---|
| Sin inversión inicial ($0) | Ahorro mensual modesto ($12/mes) |
| Pricing predecible — sin egress fees | Supabase sigue siendo el costo principal ($140) |
| Escalado gradual (pay-per-use) | No es la opción más barata a largo plazo |
| Break-even inmediato | — |

> [!NOTE]
> **El verdadero valor de Alt. 1 no es el ahorro en costos** (que es modesto), sino la **mejora en latencia** (0ms cold starts, 310+ PoPs), la **eliminación de Vercel como vendor**, y el **pricing sin egress fees** que escala sin sorpresas.
