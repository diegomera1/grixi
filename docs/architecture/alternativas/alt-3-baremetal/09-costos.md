# Alternativa 3 — Costos

> Desglose completo de setup y costos mensuales.

---

## Costos de Setup (One-Time)

| Concepto | Costo |
|---|---|
| Hetzner setup fee | ~€269 (~$290 USD) |
| **Total** | **~$290** |

---

## Costos Recurrentes — Con AX52 (Recomendado)

| Servicio | Costo/mes |
|---|---|
| **Hetzner AX52** (servidor) | ~$73 |
| **Cloudflare Pro** (CDN + WAF + DNS) | $20 |
| **GitHub Teams** (3 users) | $12 |
| **Cloudflare R2** (backups ~30 GB) | ~$3 |
| **Total** | **~$108/mes** |

## Costos Recurrentes — Con AX102 (Premium)

| Servicio | Costo/mes |
|---|---|
| **Hetzner AX102** (servidor) | ~$115-165 |
| **Cloudflare Pro** | $20 |
| **GitHub Teams** | $12 |
| **Cloudflare R2** | ~$3-5 |
| **Total** | **~$150-202/mes** |

---

## Comparación con Arquitectura Actual y Alt. 2

| Concepto | Actual | Alt. 2 (On-Prem) | Alt. 3 (AX52) | Alt. 3 (AX102) |
|---|---|---|---|---|
| Costo mensual | $192 | ~$41 | ~$108 | ~$150-202 |
| Costo inicial | $0 | ~$2,900 | ~$290 | ~$290 |
| **1 año** | $2,304 | $3,392 | **$1,586** | $2,090-2,714 |
| **2 años** | $4,608 | $3,884 | **$2,882** | $3,890-5,138 |
| **3 años** | $6,912 | $4,376 | **$4,178** | $5,690-7,562 |

---

## Mejor Opción por Presupuesto

| Horizonte | Opción más económica |
|---|---|
| **< 19 meses** | Actual o **Alt. 3 AX52** |
| **> 19 meses** | **Alt. 2** (On-Premise) |
| **Siempre (sin hardware upfront)** | **Alt. 3 AX52** ($108/mes desde día 1) |
| **Máxima confiabilidad + bajo costo** | **Alt. 3 AX52** ⭐ |

> [!TIP]
> **El AX52 a $108/mes es un 44% más barato que la arquitectura actual** ($192/mes), con **64 GB DDR5 dedicados**, 2 TB NVMe en RAID 1, y uptime de datacenter. Es la mejor relación costo/confiabilidad de las 3 alternativas.
