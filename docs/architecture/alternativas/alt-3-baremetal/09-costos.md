# Alternativa 3 — Costos Detallados

> Desglose completo con precios verificados, Hetzner actualizado, stack de trabajo, y proyección a 3 años.

---

## Costos de Setup (One-Time)

| Concepto | Costo |
|---|---|
| Hetzner AX52 setup fee | ~€269 (~$290 USD) |
| **Total** | **~$290** |

---

## Infraestructura — Costos Fijos Mensuales

### Hosting & Red ($96/mes)

| Servicio | Detalle | Precio |
|---|---|---|
| **Hetzner AX52** | AMD Ryzen 7 7700, 64 GB DDR5, 2×1 TB NVMe | ~$73/mes |
| **Cloudflare Pro** | CDN + WAF + DNS + Proxy | $20/mes |
| **Cloudflare R2** | Backups offsite ~30 GB | ~$3/mes |
| **Subtotal** | | **$96/mes** |

### Servicios de Comunicación y AI ($65/mes)

| Servicio | Detalle | Precio |
|---|---|---|
| **Discord** Level 2 | 7 boosts (con impuestos) | ~$40/mes |
| **Gemini API** | ~20-30$/mes inicial, escala con uso | ~$25/mes |
| **Subtotal** | | **~$65/mes** |

### Email & Monitoreo ($20/mes)

| Servicio | Plan | Precio |
|---|---|---|
| **Resend** | Pro — 50K emails/mes | $20/mes |
| **Sentry** | Developer (free) — 5K errors/mes | $0 |
| **Jira** | Free — hasta 10 usuarios | $0 |
| **Subtotal** | | **$20/mes** |

### Otros ($1/mes)

| Servicio | Detalle | Precio |
|---|---|---|
| **Dominio** grixi.com | ~$12/año | ~$1/mes |

---

## Costos por Usuario

| Servicio | Precio/usuario/mes |
|---|---|
| **GitHub Team** | $4/usuario |
| **Google Workspace Standard** | $14/usuario (anual) |
| **Total por usuario** | **$18/usuario/mes** |

---

## Resumen Total

| Categoría | Costo/mes |
|---|---|
| Hetzner AX52 | $73 |
| Cloudflare (Pro + R2) | $23 |
| Discord Level 2 | $40 |
| Gemini API | $25 |
| Resend Pro | $20 |
| Dominio | $1 |
| Sentry + Jira | $0 |
| Supabase | **$0** ← eliminado |
| Vercel | **$0** ← eliminado |
| **Costos fijos** | **$182/mes** |
| **+ por usuario** | **$18/usuario/mes** |

| Ejemplo con equipo | Total/mes |
|---|---|
| 1 persona | $200/mes |
| 3 personas | $236/mes |
| 5 personas | $272/mes |

---

## Alternativa Premium: Hetzner AX102

| Servicio | AX52 (Recomendado) | AX102 (Premium) |
|---|---|---|
| CPU | AMD Ryzen 7 7700 (8C/16T) | AMD Ryzen 9 7950X (16C/32T) |
| RAM | 64 GB DDR5 | 128 GB DDR5 |
| Storage | 2× 1 TB NVMe | 2× 2 TB NVMe |
| Precio servidor | ~$73/mes | ~$130/mes |
| **Total fijo** | **$182/mes** | **$239/mes** |
| **Total 3 personas** | **$236/mes** | **$293/mes** |

---

## Comparación con Arquitectura Actual y Alt. 2 (3 personas)

| Concepto | Actual | Alt. 2 (On-Prem) | Alt. 3 (AX52) |
|---|---|---|---|
| Costo mensual | $355 | $168 | **$236** |
| Costo inicial | $0 | ~$2,910 | **~$290** |
| **1 año** | $4,260 | $4,926 | **$3,122** ⭐ |
| **2 años** | $8,520 | $6,942 | **$5,922** ⭐ |
| **3 años** | $12,780 | $8,958 | **$8,722** ⭐ |

---

## Break-Even vs Actual

```
Ahorro mensual: $355 - $236 = $119/mes
Inversión: $290
Break-even: $290 ÷ $119 = ~2.4 meses ← casi inmediato
```

> **Break-even en menos de 3 meses.** Después, ahorro de **$119/mes** = **$1,428/año**.

---

## Mejor Opción por Horizonte (3 personas)

| Horizonte | Opción más económica |
|---|---|
| **Mes 1** | **Alt. 3 AX52** (inversión baja de $290) |
| **< 16 meses** | **Alt. 3 AX52** |
| **> 16 meses** | **Alt. 2** (On-Premise) toma la delantera |
| **Máxima confiabilidad + bajo costo** | **Alt. 3 AX52** ⭐ |
| **Cero inversión inicial** | **Alt. 1** (Supabase + Cloudflare) |

---

## Escenarios de Escalado

| Escenario | Impacto |
|---|---|
| **+1 usuario** | +$18/mes (GitHub + Workspace) |
| **AX52 → AX102** | +$57/mes (upgrade de servidor) |
| **2do servidor (HA)** | +$73-130/mes |
| **Gemini heavy usage** | +$20-50/mes |
| **Sentry → Team** | +$26/mes |
| **Hetzner Storage Box 1 TB** | +$4/mes (alternativa a R2) |

> [!TIP]
> **Alt. 3 (AX52) a $236/mes es un 34% más barato que la actual** ($355/mes), con 64 GB RAM dedicados, 2 TB NVMe en RAID 1, uptime de datacenter, y break-even en solo ~3 meses.
