# Alternativa 2 — Costos Detallados

> Desglose completo con precios verificados, inversión inicial, stack de trabajo, y break-even.

---

## Inversión Inicial (One-Time)

| Concepto | Costo |
|---|---|
| Mac Studio M4 Max 64 GB / 1 TB | $2,499 |
| UPS APC 1500VA | $250 |
| SSD Externo Samsung T7 2 TB | $150 |
| Cable Ethernet Cat 6a | $10 |
| **Total** | **~$2,910** |

---

## Infraestructura — Costos Fijos Mensuales

### Hosting & Red ($23/mes)

| Servicio | Detalle | Precio |
|---|---|---|
| **Cloudflare Pro** | CDN + WAF + DNS + Tunnel | $20/mes |
| **Cloudflare R2** | Backups offsite ~20 GB | ~$2/mes |
| **Dominio** grixi.com | ~$12/año | ~$1/mes |
| **Electricidad** | Mac Studio ~60W 24/7 | ~$6/mes |
| Subtotal sin electricidad | | $23/mes |
| **Subtotal con electricidad** | | **$29/mes** |

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
| Cloudflare (Pro + R2) | $22 |
| Electricidad | $6 |
| Discord Level 2 | $40 |
| Gemini API | $25 |
| Resend Pro | $20 |
| Dominio | $1 |
| Sentry + Jira | $0 |
| Supabase | **$0** ← eliminado |
| Vercel | **$0** ← eliminado |
| **Costos fijos** | **$114/mes** |
| **+ por usuario** | **$18/usuario/mes** |

| Ejemplo con equipo | Total/mes |
|---|---|
| 1 persona | $132/mes |
| 3 personas | $168/mes |
| 5 personas | $204/mes |

---

## Comparación con Arquitectura Actual (3 personas)

| Concepto | Actual | On-Premise | Diferencia |
|---|---|---|---|
| Vercel Pro | $20 | **$0** | -$20 ✅ |
| Supabase (Pro + Medium + PITR) | $175 | **$0** | -$175 ✅ |
| Cloudflare Pro | $20 | $20 | $0 |
| CF R2 backups | $0 | $2 | +$2 |
| Discord Level 2 | $40 | $40 | $0 |
| Gemini API | $25 | $25 | $0 |
| Resend Pro | $20 | $20 | $0 |
| GitHub Team (×3) | $12 | $12 | $0 |
| Workspace (×3) | $42 | $42 | $0 |
| Electricidad | $0 | $6 | +$6 |
| Dominio | $1 | $1 | $0 |
| Hardware (amortizado 36 meses) | $0 | ~$81 | +$81 |
| **Total mensual** | **$355/mes** | **$249/mes** (con amortización) | **-$106/mes** |
| **Total sin amortización** | **$355/mes** | **$168/mes** | **-$187/mes** ✅ |

---

## Break-Even

```
Ahorro mensual (sin amortización): $355 - $168 = $187/mes
Inversión: $2,910
Break-even: $2,910 ÷ $187 = ~16 meses
```

> Después del mes 16, el ahorro es de **~$187/mes** — **$2,244/año**.

---

## Proyección a 3 Años (3 personas)

| Horizonte | Actual | On-Premise | Ahorro |
|---|---|---|---|
| **1 año** | $4,260 | $2,910 + $2,016 = **$4,926** | -$666 (inversión) |
| **2 años** | $8,520 | $2,910 + $4,032 = **$6,942** | **$1,578** ✅ |
| **3 años** | $12,780 | $2,910 + $6,048 = **$8,958** | **$3,822** ✅ |

---

## Escenarios de Escalado

| Escenario | Impacto |
|---|---|
| **+1 usuario** | +$18/mes (GitHub + Workspace) |
| **Gemini heavy usage** | +$20-50/mes |
| **Más storage (MinIO)** | $0 (hardware local) |
| **Más DB connections** | $0 (config PostgreSQL) |
| **Sentry → Team** | +$26/mes |
| **UPS replacement (cada 3-5 años)** | ~$250 one-time |

> [!TIP]
> **Alt. 2 es la opción más barata a largo plazo.** Después de 16 meses, ahorra ~$187/mes vs la arquitectura actual. En 3 años, el ahorro acumulado es de **$3,822**.
