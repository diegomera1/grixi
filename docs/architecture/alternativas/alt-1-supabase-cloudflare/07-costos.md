# Alternativa 1 — Costos Detallados

> Desglose completo con precios verificados, stack de trabajo, y proyección a 3 años.

---

## Costos de Setup (One-Time)

| Concepto | Costo |
|---|---|
| Migración de código (tiempo dev interno) | $0 |
| **Total** | **$0** |

---

## Infraestructura — Costos Fijos Mensuales

### Supabase Pro ($175/mes)

| Componente | Specs | Precio |
|---|---|---|
| **Plan Pro base** | 8 GB DB, 250 GB BW, 100K MAUs | $25/mes |
| **Compute Medium** | 2 vCPU ARM, 4 GB RAM dedicado | $60/mes |
| Crédito compute (incluido en Pro) | — | -$10/mes |
| **PITR** (7 días) | Point-in-Time Recovery | $100/mes |
| Edge Functions | 2M invocaciones/mes | Incluido |
| Realtime | 500 concurrent connections | Incluido |
| Storage | 100 GB archivos | Incluido |
| **Subtotal Supabase** | | **$175/mes** |

### Cloudflare ($27/mes)

| Componente | Incluido | Precio |
|---|---|---|
| **Cloudflare Pro** | CDN, WAF, DDoS, DNS, Analytics | $20/mes |
| **Workers Paid** | 10M requests, 30M CPU ms | $5/mes |
| **Workers KV** | 10M reads, 1 GB storage | ~$2/mes |
| **R2** (cache de Storage) | 10 GB free, $0.015/GB, cero egress | ~$0-1/mes |
| **Subtotal Cloudflare** | | **~$27/mes** |

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
| Supabase Pro (Medium + PITR) | $175 |
| Cloudflare (Pro + Workers + KV + R2) | $27 |
| Discord Level 2 | $40 |
| Gemini API | $25 |
| Resend Pro | $20 |
| Dominio | $1 |
| Sentry + Jira | $0 |
| **Costos fijos** | **$288/mes** |
| **+ por usuario** | **$18/usuario/mes** |

| Ejemplo con equipo | Total/mes |
|---|---|
| 1 persona | $306/mes |
| 3 personas | $342/mes |
| 5 personas | $378/mes |

---

## Comparación con Arquitectura Actual

| Concepto | Actual (Vercel) | Alt. 1 (CF Workers) | Diferencia |
|---|---|---|---|
| Vercel Pro | $20 | **$0** | -$20 ✅ |
| CF Workers + KV + R2 | $0 | $27 | +$27 |
| Supabase (Pro + Medium + PITR) | $175 | $175 | $0 |
| Cloudflare Pro | $20 | $20 | $0 |
| Discord Level 2 | $40 | $40 | $0 |
| Gemini API | $25 | $25 | $0 |
| Resend Pro | $20 | $20 | $0 |
| GitHub Team (per user) | $4/user | $4/user | $0 |
| Google Workspace (per user) | $14/user | $14/user | $0 |
| Dominio | $1 | $1 | $0 |
| **Total fijo** | **$301/mes** | **$288/mes** | **-$13/mes** ✅ |
| **Total 3 personas** | **$355/mes** | **$342/mes** | **-$13/mes** |

---

## Proyección a 3 Años (3 personas)

| Horizonte | Actual | Alt. 1 | Ahorro |
|---|---|---|---|
| **6 meses** | $2,130 | $2,052 | **$78** |
| **1 año** | $4,260 | $4,104 | **$156** |
| **2 años** | $8,520 | $8,208 | **$312** |
| **3 años** | $12,780 | $12,312 | **$468** |

---

## Escenarios de Escalado

| Escenario | Impacto |
|---|---|
| **+1 usuario (dev/designer)** | +$18/mes (GitHub + Workspace) |
| **Supabase Medium → Large** | +$50/mes (cuando hay +30 tenants) |
| **50M requests/mes en Workers** | +$12/mes ($0.30 × 40M extra) |
| **Gemini heavy usage (~100 tenants)** | +$20-50/mes |
| **Resend → 100K emails/mes** | +$20/mes (upgrade a Pro Plus) |
| **Sentry → Team plan** | +$26/mes (cuando hay +5K errors/mes) |

> [!NOTE]
> **El verdadero valor de Alt. 1 no es el ahorro** (~$13/mes), sino: **0ms cold starts** (Workers), **310+ PoPs globales**, **cero egress fees** en todo Cloudflare, y la **eliminación de Vercel** como vendor.
