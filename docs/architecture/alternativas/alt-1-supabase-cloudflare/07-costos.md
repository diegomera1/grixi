# Alternativa 1 — Costos Detallados

> Desglose completo con precios verificados, stack de trabajo, herramientas de desarrollo, y proyección a 3 años.
> **Actualizado:** 21 de marzo, 2026. Incluye Antigravity, Supabase Branching. Un solo dominio (grixi.com).

---

## Estrategia de Dominio

Un solo dominio `grixi.com` con subdominios para todo:

```
grixi.com              → Landing page / marketing
app.grixi.com          → Dashboard principal (SuperAdmin)
empresa-x.grixi.com   → Tenant "Empresa X"
losnonnos.grixi.com    → Tenant "Los Nonnos"
api.grixi.com          → Supabase custom domain
staging.grixi.com      → Entorno de staging
```

> No se necesita un segundo dominio (.app). Wildcard DNS `*.grixi.com` cubre todos los tenants con un solo plan Cloudflare Pro.

---

## Costos de Setup (One-Time)

| Concepto | Costo |
|---|---|
| Migración de código (tiempo dev interno) | $0 |
| Configurar Cloudflare Workers + Wrangler | $0 |
| Configurar Supabase Branching (GitHub integration) | $0 |
| **Total** | **$0** |

---

## 1. Infraestructura — Costos Fijos Mensuales

### 1.1 Supabase Pro ($175/mes)

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

### 1.2 Supabase Branching (~$10/mes estimado)

| Concepto | Detalle | Precio |
|---|---|---|
| **Branch Compute** | ~$0.01344/hora por branch (Micro) | ~$0.32/día |
| **Uso típico** | 1-2 branches activos, ~8h/día laborable | ~$5-10/mes |
| **Nota** | Sin costo fijo — solo por uso. Se elimina al merge | Variable |
| **Subtotal Branching** | Estimado con uso moderado | **~$10/mes** |

### 1.3 Cloudflare ($25/mes)

| Componente | Incluido | Precio |
|---|---|---|
| **Cloudflare Pro** (grixi.com) | CDN, WAF, DDoS, DNS, Analytics, wildcard `*.grixi.com` | $20/mes |
| **Workers Paid** | 10M requests, 30M CPU ms, Hyperdrive, KV incluido | $5/mes |
| **Workers KV** | 10M reads, 1M writes, 1 GB storage | Incluido en Workers Paid |
| **R2** (cache de Storage) | 10 GB free, $0.015/GB, cero egress | $0 (free tier) |
| **Subtotal Cloudflare** | | **$25/mes** |

---

## 2. Herramientas de Desarrollo

### 2.1 Antigravity (AI Coding Assistant)

| Plan | Precio | Incluye | Para quién |
|---|---|---|---|
| **AI Pro** | $20/mes | Gemini 3.1 Pro, Claude Sonnet, GPT-OSS. Cuota alta con refresh cada 5h | Devs individuales |
| **AI Ultra** | $249.99/mes | Cuota máxima sin límite semanal. Todos los modelos premium | Lead developers, uso intensivo |
| **Créditos extra** | $25 / 2,500 créditos | Para overage cuando se agota la cuota base | Picos de uso |

**Recomendación para GRIXI:**

| Escenario | Plan | Costo/mes |
|---|---|---|
| **1 dev (desarrollo activo diario)** | Ultra × 1 | $249.99/mes |
| **1 dev lead + 1 dev junior** | Ultra × 1 + Pro × 1 | $269.99/mes |
| **3 devs** | Ultra × 1 + Pro × 2 | $289.99/mes |

> [!IMPORTANT]
> **Antigravity es la herramienta de mayor costo individual**, pero también la de mayor ROI. Un dev con Ultra produce ~3-5x más que sin AI.

### 2.2 Comunicación y AI en Producción

| Servicio | Detalle | Precio |
|---|---|---|
| **Discord** Level 2 | 7 boosts (con impuestos) | ~$40/mes |
| **Gemini API** (GRIXI AI en prod) | ~20-30$/mes, escala con uso | ~$25/mes |
| **Subtotal** | | **~$65/mes** |

### 2.3 Email & Monitoreo

| Servicio | Plan | Precio |
|---|---|---|
| **Resend** | Pro — 50K emails/mes | $20/mes |
| **Sentry** | Developer (free) — 5K errors/mes | $0 |
| **Jira** | Free — hasta 10 usuarios | $0 |
| **Subtotal** | | **$20/mes** |

### 2.4 Dominio

| Servicio | Detalle | Precio |
|---|---|---|
| **grixi.com** | ~$12/año | ~$1/mes |

---

## 3. Costos por Usuario

| Servicio | Precio/usuario/mes |
|---|---|
| **GitHub Team** | $4/usuario |
| **Google Workspace Standard** | $14/usuario (anual) |
| **Total por usuario** | **$18/usuario/mes** |

---

## 4. Resumen Total

### Escenario A: 1 Desarrollador (Solo Founder)

| Servicio | Costo/mes |
|---|---|
| Supabase Pro (Medium + PITR) | $175.00 |
| Supabase Branching | ~$10.00 |
| Cloudflare (Pro + Workers) | $25.00 |
| **Antigravity Ultra** | **$249.99** |
| Discord Level 2 | ~$40.00 |
| Gemini API (producción) | ~$25.00 |
| Resend Pro | $20.00 |
| Dominio grixi.com | ~$1.00 |
| Sentry + Jira | $0.00 |
| GitHub Team (1 user) | $4.00 |
| Google Workspace (1 user) | $14.00 |
| **TOTAL** | **~$564/mes** |

### Escenario B: 3 Desarrolladores

| Servicio | Costo/mes |
|---|---|
| Supabase Pro (Medium + PITR) | $175.00 |
| Supabase Branching (~4 branches) | ~$15.00 |
| Cloudflare (Pro + Workers) | $25.00 |
| **Antigravity** (1 Ultra + 2 Pro) | **$289.99** |
| Discord Level 2 | ~$40.00 |
| Gemini API (producción) | ~$25.00 |
| Resend Pro | $20.00 |
| Dominio | ~$1.00 |
| Sentry + Jira | $0.00 |
| GitHub Team (3 users) | $12.00 |
| Google Workspace (3 users) | $42.00 |
| **TOTAL** | **~$645/mes** |

### Escenario C: 5 Desarrolladores

| Servicio | Costo/mes |
|---|---|
| Supabase Pro (Medium + PITR) | $175.00 |
| Supabase Branching (~6 branches) | ~$20.00 |
| Cloudflare (Pro + Workers) | $25.00 |
| **Antigravity** (1 Ultra + 4 Pro) | **$329.99** |
| Discord Level 2 | ~$40.00 |
| Gemini API (producción) | ~$25.00 |
| Resend Pro | $20.00 |
| Dominio | ~$1.00 |
| Sentry + Jira | $0.00 |
| GitHub Team (5 users) | $20.00 |
| Google Workspace (5 users) | $70.00 |
| **TOTAL** | **~$726/mes** |

---

## 5. Desglose por Categoría (1 dev)

```
 Antigravity Ultra    ████████████████████████████████████████████  $249.99  (44%)
 Supabase             ████████████████████████████████████          $185     (33%)
 Discord              ████████                                     $40      (7%)
 Gemini API           █████                                        $25      (4%)
 Cloudflare           █████                                        $25      (4%)
 Resend               ████                                         $20      (4%)
 GitHub + Workspace   ████                                         $18      (3%)
 Dominio              █                                            $1       (0.2%)
 ─────────────────────────────────────────────────────────────────
 TOTAL                                                             ~$564/mes
```

---

## 6. Con vs Sin Antigravity (1 dev)

| Concepto | Sin Antigravity | Con Antigravity Ultra |
|---|---|---|
| **Costos infra** | $314/mes | $314/mes |
| **Antigravity** | $0 | $249.99/mes |
| **TOTAL** | **$314/mes** | **$564/mes** |
| Velocidad de desarrollo | Baseline | ~3-5x más rápido |
| Features/sprint | 2-3 | 6-10 |
| Equivale a | 1 dev | ~3 devs |
| Costo alternativa (contratar 2 devs) | +$4,000-8,000/mes | $249.99/mes |

---

## 7. Comparación con Arquitectura Actual (1 dev, sin Antigravity)

| Concepto | Actual (Vercel) | Alt. 1 (CF Workers) | Diferencia |
|---|---|---|---|
| Vercel Pro | $20 | $0 | -$20 ✅ |
| Cloudflare Pro | $20 | $20 | $0 |
| CF Workers Paid | $0 | $5 | +$5 |
| Supabase (Pro + Medium + PITR) | $175 | $175 | $0 |
| Supabase Branching | $0 | ~$10 | +$10 |
| Discord Level 2 | $40 | $40 | $0 |
| Gemini API | $25 | $25 | $0 |
| Resend Pro | $20 | $20 | $0 |
| GitHub Team (1 user) | $4 | $4 | $0 |
| Google Workspace (1 user) | $14 | $14 | $0 |
| Dominio | $1 | $1 | $0 |
| **Total infra** | **$319/mes** | **$314/mes** | **-$5/mes** ✅ |

---

## 8. Proyección a 3 Años

### Solo infraestructura (1 dev, sin Antigravity)

| Horizonte | Actual | Alt. 1 | Diferencia |
|---|---|---|---|
| **1 año** | $3,828 | $3,768 | -$60 ✅ |
| **2 años** | $7,656 | $7,536 | -$120 ✅ |
| **3 años** | $11,484 | $11,304 | -$180 ✅ |

### Con Antigravity Ultra (1 dev)

| Horizonte | Total |
|---|---|
| **1 año** | $6,768 |
| **2 años** | $13,536 |
| **3 años** | $20,304 |

---

## 9. Escenarios de Escalado

| Escenario | Impacto |
|---|---|
| **+1 dev (Antigravity Pro)** | +$38/mes ($20 Antigravity + $18 GH/Workspace) |
| **+1 dev (Antigravity Ultra)** | +$268/mes ($250 Antigravity + $18 GH/Workspace) |
| **Supabase Medium → Large** | +$50/mes (cuando hay +30 tenants) |
| **50M requests/mes en Workers** | +$12/mes ($0.30 × 40M extra) |
| **Gemini heavy usage (~100 tenants)** | +$20-50/mes |
| **Resend → 100K emails/mes** | +$20/mes |
| **Sentry → Team plan** | +$26/mes |
| **+1 Supabase Branch persistente** | +~$10/mes |

---

## 10. Resumen Ejecutivo

```
┌──────────────────────────────────────────────────────────────────┐
│                GRIXI — COSTOS MENSUALES (1 DEV)                  │
│                                                                  │
│  INFRAESTRUCTURA                          $314/mes               │
│  ├── Supabase (Pro + Medium + PITR)       $175                   │
│  ├── Supabase Branching                   ~$10                   │
│  ├── Cloudflare (Pro + Workers)           $25                    │
│  ├── Discord Level 2                      $40                    │
│  ├── Gemini API (producción)              $25                    │
│  ├── Resend Pro                           $20                    │
│  ├── GitHub Team                          $4                     │
│  ├── Google Workspace                     $14                    │
│  └── Dominio grixi.com                    $1                     │
│                                                                  │
│  HERRAMIENTAS DE DESARROLLO               $249.99/mes            │
│  └── Antigravity Ultra                    $249.99                │
│                                                                  │
│  ════════════════════════════════════════════════════             │
│  TOTAL                                    ~$564/mes              │
│  ════════════════════════════════════════════════════             │
│                                                                  │
│  💡 Sin Antigravity: $314/mes ($5 MENOS que setup actual)        │
│  💡 Con Antigravity: $564/mes (pero produce como equipo de 3)    │
└──────────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> **El verdadero valor de Alt. 1** no es ahorro de costos, sino: **0ms cold starts** (Workers), **310+ PoPs globales con Ecuador**, **builds 10-30x más rápidos** (Vite 8), **Supabase Branching** (preview environments), y **Antigravity** como multiplicador de productividad.
