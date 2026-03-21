# Alternativa 1 — Costos Detallados

> Desglose completo para **5 desarrolladores**, **~100 usuarios por tenant**, estimados **holgados**.
> Dominio único: `grixi.com` (wildcard `*.grixi.com` para tenants).
> AI: **Gemini 3.1 Flash-Lite** ($0.25 input / $1.50 output por M tokens).
> **Actualizado:** 21 de marzo, 2026.

---

## 1. Qué es Cada Servicio

### Infraestructura Core

| Servicio | Qué hace | Por qué lo necesitamos |
|---|---|---|
| **Supabase Pro** | Base de datos PostgreSQL administrada con Auth, Realtime, Storage, y Edge Functions | Backend completo de GRIXI: almacena datos, maneja login, conexiones en tiempo real, y archivos de todos los tenants |
| **Supabase Compute Medium** | CPU y RAM dedicada para la DB (2 vCPU ARM, 4 GB RAM) | Sin compute dedicado, la DB comparte recursos con otros y se pone lenta bajo carga |
| **Supabase PITR** | Point-in-Time Recovery — restaurar la DB a cualquier segundo de los últimos 7 días | Seguro contra desastres: un error que borre datos se recupera al instante |
| **Supabase Branching** | Crea copias aisladas de la DB para cada feature branch de Git | 5 devs trabajan en features paralelas sin tocar la DB de producción |
| **Cloudflare Pro** | CDN global 310+ PoPs, WAF, DDoS, DNS, SSL, Analytics | Protege y acelera la app. Wildcard `*.grixi.com` para subdominios de tenants |
| **Cloudflare Workers** | Runtime serverless en el edge — ejecuta SSR + API | Reemplaza a Vercel. Corre React Router v7 con 0ms cold starts globalmente |
| **Cloudflare KV** | Key-value store distribuido globalmente | Cache de config de orgs, permisos, datos semi-estáticos |
| **Cloudflare R2** | Object storage S3-compatible. **Egress siempre $0** | Storage principal de archivos pesados (imágenes, documentos, exports). Sin costo por descargas |
| **Cloudflare Hyperdrive** | Connection pooling para PostgreSQL | Reutiliza conexiones a Supabase, reduce latencia ~4x |

### AI y Desarrollo

| Servicio | Qué hace | Por qué lo necesitamos |
|---|---|---|
| **Antigravity Ultra** | AI coding assistant (hasta 5 devs, sin límite semanal) | Multiplica productividad ~3-5x. Un dev con Antigravity = equipo de 3 |
| **Gemini 3.1 Flash-Lite** | Modelo de lenguaje para el asistente GRIXI AI en producción | Chat AI para usuarios: "¿cuánto gastamos?", "genera reporte", "analiza stock" |

### Comunicación y Productividad

| Servicio | Qué hace | Por qué lo necesitamos |
|---|---|---|
| **Discord Level 2** | Servidor privado con boosts para el equipo | Comunicación interna, soporte, alertas CI/CD |
| **Resend Pro** | Emails transaccionales con dominio custom | Invitaciones, alertas, notificaciones, reportes, verificaciones |
| **GitHub Team** | Repos privados, CI/CD, code review | Control de versiones, deploys automáticos, PR reviews |
| **Google Workspace** | Gmail, Drive, Meet, Calendar con @grixi.com | Email profesional, documentos, videoconferencias |
| **Jira** | Gestión de proyectos y sprints | Tracking de features, backlog, planificación |
| **Sentry** | Monitoreo de errores en producción | Detecta crashes y excepciones en tiempo real |

---

## 2. Uso Estimado por Tenant (~100 Usuarios, Uso Intensivo)

| Recurso | Por tenant/mes | Con 5 tenants | Incluido en plan | Extra |
|---|---|---|---|---|
| **DB (PostgreSQL)** | ~1 GB datos | ~5 GB | 8 GB | Dentro ✅ |
| **Storage Supabase** (docs con RLS) | ~10 GB | ~50 GB | 100 GB | Dentro ✅ |
| **Storage R2** (imágenes, exports, assets) | ~50 GB | ~250 GB | 10 GB free | 240 GB extra |
| **Egress Supabase** (API + descargas) | ~30 GB | ~150 GB | 250 GB | Dentro ✅ |
| **Workers requests** | ~200K req | ~1M req | 10M | Dentro ✅ |
| **KV reads** | ~100K reads | ~500K reads | 10M | Dentro ✅ |
| **Edge Functions** | ~50K invocaciones | ~250K | 2M | Dentro ✅ |
| **Realtime connections** | ~30 simultáneas | ~150 | 500 | Dentro ✅ |
| **MAUs** | ~100 | ~500 | 100K | Dentro ✅ |
| **Gemini API** (AI assistant) | ~$25 | ~$125 | Pay per use | $125 |
| **Emails transaccionales** | ~2K emails | ~10K | 50K | Dentro ✅ |

---

## 3. Tabla de Costos Completa (5 Devs, 5 Tenants, 500 Usuarios)

| # | Servicio | Tipo | Incluido | Precio/mes |
|---|---|---|---|---:|
| | **SUPABASE** | | | |
| 1 | Plan Pro base | 🔒 Fijo | 8 GB DB, 250 GB egress, 100K MAUs, 100 GB storage, Realtime, Edge Functions | $25.00 |
| 2 | Compute Medium | 🔒 Fijo | 2 vCPU ARM, 4 GB RAM dedicado, I/O optimizado | $60.00 |
| 3 | Crédito compute | 🔒 Fijo | Descuento incluido en Pro | -$10.00 |
| 4 | PITR 7 días | 🔒 Fijo | Restauración a cualquier segundo, últimos 7 días | $100.00 |
| 5 | Branching | 📈 Variable | ~6 branches × 8h × 22 días × $0.01344/hr | ~$15.00 |
| 6 | DB extra | 📈 Variable | ~5 GB con 5 tenants (dentro de 8 GB) | ~$0.00 |
| 7 | Storage extra (Supabase) | 📈 Variable | ~50 GB docs con RLS (dentro de 100 GB) | ~$0.00 |
| 8 | Egress extra | 📈 Variable | ~150 GB API + descargas (dentro de 250 GB) | ~$0.00 |
| 9 | MAUs extra | 📈 Variable | ~500 usuarios (dentro de 100K) | ~$0.00 |
| 10 | Edge Functions extra | 📈 Variable | ~250K invocaciones (dentro de 2M) | ~$0.00 |
| | **Subtotal Supabase** | | | **$190.00** |
| | | | | |
| | **CLOUDFLARE** | | | |
| 11 | Pro (grixi.com) | 🔒 Fijo | CDN 310+ PoPs, WAF 20 reglas, DDoS, DNS, SSL, `*.grixi.com` | $20.00 |
| 12 | Workers Paid | 🔒 Fijo | 10M req, 30M CPU ms, Hyperdrive, KV base (10M reads, 1M writes, 1 GB) | $5.00 |
| 13 | Workers req extra | 📈 Variable | ~1M req con 5 tenants (dentro de 10M) | ~$0.00 |
| 14 | KV reads extra | 📈 Variable | ~500K reads cache (dentro de 10M) | ~$0.00 |
| 15 | **R2 Storage** | 📈 Variable | **~250 GB** (50 GB/tenant: imágenes, PDFs, exports). 10 GB free → 240 GB × $0.015 | **~$3.60** |
| 16 | R2 egress | — | **Siempre $0**. Descargas ilimitadas sin costo | $0.00 |
| | **Subtotal Cloudflare** | | | **$28.60** |
| | | | | |
| | **AI** | | | |
| 17 | Antigravity Ultra | 🔒 Fijo | Hasta 5 devs. Gemini 3.1 Pro, Claude, GPT. Sin límite semanal | $249.99 |
| 18 | Gemini 3.1 Flash-Lite | 📈 Variable | 5 tenants × 100 users × 70% activos × 8 queries/día (ver cálculo §4) | ~$125.00 |
| 19 | Gemini margen +30% | 📈 Variable | Buffer: picos de uso, prompts largos, re-intentos, imágenes | ~$40.00 |
| | **Subtotal AI** | | | **$414.99** |
| | | | | |
| | **COMUNICACIÓN & EMAIL** | | | |
| 20 | Discord Level 2 | 🔒 Fijo | 7 boosts + impuestos. Comunicación interna | ~$40.00 |
| 21 | Resend Pro | 🔒 Fijo | 50K emails/mes | $20.00 |
| 22 | Resend uso | 📈 Variable | ~10K emails (5 tenants × 2K). Dentro de 50K | ~$0.00 |
| | **Subtotal Comunicación** | | | **$60.00** |
| | | | | |
| | **MONITOREO** | | | |
| 23 | Sentry | 🔒 Fijo | Free: 5K errors/mes. Monitoreo de errores en producción | $0.00 |
| 24 | Jira | 🔒 Fijo | Free: hasta 10 usuarios. Sprints, backlog, tracking | $0.00 |
| | **Subtotal Monitoreo** | | | **$0.00** |
| | | | | |
| | **POR DEVELOPER (×5)** | | | |
| 25 | GitHub Team | 🔒 Fijo | $4/dev × 5. Repos privados, CI/CD, code review | $20.00 |
| 26 | Google Workspace | 🔒 Fijo | $14/dev × 5. Gmail, Drive, Meet con @grixi.com | $70.00 |
| | **Subtotal Devs** | | | **$90.00** |

### Totales

| Categoría | Monto/mes |
|---|---:|
| 🔒 **Costos fijos** | **$599.99** |
| 📈 **Costos variables** (holgados, 5 tenants, 500 usuarios) | **~$183.60** |
| **TOTAL MENSUAL** | **~$784/mes** |

---

## 4. Cálculo Gemini 3.1 Flash-Lite (Detallado)

> [!WARNING]
> **Gemini 2.0 Flash Lite se apaga el 1 de junio de 2026.** Todos los cálculos usan **3.1 Flash-Lite**.

| Modelo | Input / M tokens | Output / M tokens | Estado |
|---|---|---|---|
| ~~Gemini 2.0 Flash Lite~~ | ~~$0.075~~ | ~~$0.30~~ | ❌ Shutdown Jun 2026 |
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 | ✅ Alternativa barata |
| **Gemini 3.1 Flash-Lite** | **$0.25** | **$1.50** | ✅ **Presupuestado** |

### Supuestos por tenant (holgados)

| Concepto | Valor |
|---|---|
| Usuarios por tenant | 100 |
| % que usan GRIXI AI activamente | 70% (= 70 usuarios) |
| Consultas por usuario activo por día | 8 |
| Días laborales por mes | 22 |
| Tokens input por consulta (contexto DB + módulo + pregunta) | 1,000 |
| Tokens output por consulta (respuesta con datos y gráficos) | 1,200 |

### Cálculo

| Paso | Cálculo | Resultado |
|---|---|---|
| Consultas/tenant/mes | 70 × 8 × 22 | **12,320** |
| Input tokens/tenant/mes | 12,320 × 1,000 | **12.3M** |
| Output tokens/tenant/mes | 12,320 × 1,200 | **14.8M** |
| Costo input | 12.3 × $0.25 | $3.08 |
| Costo output | 14.8 × $1.50 | $22.18 |
| **Total/tenant/mes** | | **~$25** |
| **Con margen +30%** | | **~$33** |

---

## 5. Costos Variables: Qué Sube y Cuándo

| # | Servicio | Incluido | Cuándo sube | Costo extra | Trigger |
|---|---|---|---|---|---|
| 1 | **Gemini API** | ~$165 (5 tenants + margen) | Cada tenant nuevo | +$25-35/tenant | Cada tenant |
| 2 | **Supabase Branching** | ~$15 (6 branches) | Más devs o branches persistentes | +$10/branch | +6 devs |
| 3 | **R2 Storage** | ~$3.60 (250 GB) | Más tenants, más archivos | +$0.75/tenant (~50 GB) | Cada tenant |
| 4 | **Supabase DB** | 8 GB | DB > 8 GB | +$0.125/GB | ~10 tenants |
| 5 | **Supabase Compute** | Medium 4 GB | Queries lentas, carga alta | +$100 → Large | ~30 tenants |
| 6 | **Supabase Egress** | 250 GB | Muchas descargas directas de Supabase | +$0.09/GB | ~10 tenants |
| 7 | **Supabase Storage** | 100 GB | Más de 100 GB de docs con RLS | +$0.021/GB | ~15 tenants |
| 8 | **CF Workers req** | 10M | Alto tráfico concurrente | +$0.30/millón | ~20 tenants |
| 9 | **CF KV** | 10M reads | Cache de muchas orgs | +$0.50/M reads | ~50 tenants |
| 10 | **Resend** | 50K emails | Muchas notificaciones/alertas | +$20 → 100K | ~30 tenants |
| 11 | **Sentry** | 5K errors | Más tráfico = más errores | +$26 → Team | ~20 tenants |
| 12 | **Supabase MAUs** | 100K | Más de 100K usuarios únicos | +$0.00325/MAU | ~100 tenants |

---

## 6. Escalado por Tenant (~100 Usuarios por Tenant, 50 GB Storage por Tenant)

### Costo marginal por tenant adicional

| Recurso | Costo/tenant/mes | Notas |
|---|---|---|
| **Gemini 3.1 Flash-Lite** | ~$33 | 70 users activos × 8 queries/día + 30% margen |
| **R2 Storage** (50 GB/tenant) | ~$0.75 | $0.015/GB × 50 GB. Egress $0 |
| **Supabase DB** | ~$0.13 | ~1 GB data/tenant × $0.125/GB |
| **Supabase Egress** | ~$2.70 | ~30 GB/tenant × $0.09/GB (cuando excede 250 GB) |
| **Supabase Storage** | ~$0.21 | ~10 GB docs/tenant × $0.021/GB (cuando excede 100 GB) |
| **Workers requests** | ~$0.06 | ~200K req/tenant |
| **Resend emails** | ~$0.00 | ~2K emails/tenant (dentro del plan hasta ~25 tenants) |
| **Total por tenant extra** | **~$37/tenant** | Con margen holgado |

### Tabla de escalado completo

| Tenants | Usuarios | Gemini (con margen) | R2 Storage | Supabase extras | CF extras | Otros | Fijos | **Total/mes** |
|---|---|---|---|---|---|---|---|---|
| **1-5** | 500 | ~$165 | ~$4 | ~$0* | ~$0* | ~$15 | $600 | **~$784** |
| **6-10** | 1,000 | ~$330 | ~$8 | ~$15 | ~$0* | ~$15 | $600 | **~$968** |
| **11-20** | 2,000 | ~$660 | ~$15 | ~$50 | ~$3 | ~$15 | $600 | **~$1,343** |
| **21-30** | 3,000 | ~$990 | ~$23 | ~$90 | ~$6 | ~$35** | $600 | **~$1,744** |
| **31-50** | 5,000 | ~$1,650 | ~$38 | ~$140 | ~$12 | ~$35** | $600 | **~$2,475** |
| **51-100** | 10,000 | ~$3,300 | ~$75 | ~$240 | ~$25 | ~$61*** | $600 | **~$4,301** |

> \* Dentro de los límites incluidos del plan Pro
> \** Incluye upgrade Supabase → Large (+$100/mes) y Resend 100K (+$20)
> \*** Incluye upgrade Supabase → XL (+$150), Resend 100K (+$20), Sentry Team (+$26)

---

## 7. Estrategias para Reducir Gemini (el costo dominante)

| Estrategia | Ahorro | Detalle |
|---|---|---|
| **Caching de respuestas** en Workers KV | -30-50% | Consultas repetidas ("¿stock total?") se sirven del cache |
| **Modelo híbrido** (2.5 simple, 3.1 complejo) | -40% | Conteos → 2.5 Flash-Lite. Análisis → 3.1 Flash-Lite |
| **Rate limiting** por usuario | -20% | Máx 20 consultas/usuario/día evita abuso |
| **Context compression** | -15% | Solo enviar datos relevantes al prompt |
| **Streaming + max_tokens** | -20% | Respuestas tuneadas por tipo de consulta |
| **Combinando todas** | **-50-70%** | Costo real: ~$12-18/tenant en vez de $33 |

---

## 8. Proyección a 3 Años (5 devs, crecimiento orgánico)

| Periodo | Tenants | Usuarios | Total/mes | Total periodo |
|---|---|---|---|---|
| **Mes 1-6** | 1-5 | 500 | ~$784 | $4,704 |
| **Mes 7-12** | 6-10 | 1,000 | ~$968 | $5,808 |
| **Año 2** | 11-25 | 2,500 | ~$1,500 | $18,000 |
| **Año 3** | 26-50 | 5,000 | ~$2,300 | $27,600 |
| **Total 3 años** | | | | **$56,112** |

### Break-even

| Precio/tenant/mes | Tenants necesarios | Cuándo |
|---|---|---|
| $500/mes | 2 clientes | Mes 1 |
| $300/mes | 3 clientes | Mes 2 |
| $200/mes | 4 clientes | Mes 3 |
| $100/mes | 8 clientes | Mes 8 |

---

## 9. Resumen Ejecutivo

```
┌────────────────────────────────────────────────────────────────────────┐
│    GRIXI — COSTOS MENSUALES (5 DEVS, 5 TENANTS, ~500 USUARIOS)        │
│    100 usuarios/tenant · 50 GB storage/tenant · Gemini 3.1 Flash-Lite │
│    Estimados HOLGADOS con margen +30% en AI                            │
│                                                                        │
│  🔒 COSTOS FIJOS                                    $599.99/mes       │
│  ├── Antigravity Ultra (5 devs)                     $249.99           │
│  ├── Supabase Pro                                   $25.00            │
│  ├── Supabase Compute Medium (2 vCPU, 4 GB)         $60.00            │
│  ├── Supabase crédito                               -$10.00           │
│  ├── Supabase PITR 7 días                           $100.00           │
│  ├── Google Workspace (5 × $14)                     $70.00            │
│  ├── Discord Level 2                                $40.00            │
│  ├── Cloudflare Pro (CDN + WAF + DDoS)              $20.00            │
│  ├── Cloudflare Workers Paid (+ KV + Hyperdrive)    $5.00             │
│  ├── Resend Pro (50K emails)                        $20.00            │
│  ├── GitHub Team (5 × $4)                           $20.00            │
│  └── Sentry + Jira                                  $0.00             │
│                                                                        │
│  📈 COSTOS VARIABLES (holgados, 5 tenants)          ~$184/mes         │
│  ├── Gemini 3.1 Flash-Lite (5 × ~$25/tenant)       ~$125.00          │
│  ├── Gemini margen seguridad (+30%)                 ~$40.00           │
│  ├── Supabase Branching (~6 branches)               ~$15.00           │
│  └── R2 Storage (5 × 50 GB = 250 GB)               ~$3.60            │
│                                                                        │
│  ═══════════════════════════════════════════════════════               │
│  TOTAL                                              ~$784/mes         │
│  ═══════════════════════════════════════════════════════               │
│                                                                        │
│  📊 ESCALADO                                                          │
│  ├── Costo variable dominante: Gemini (~$33/tenant con margen)        │
│  ├── Costo marginal total por tenant: ~$37/mes                        │
│  ├── 10 tenants (1K users):            ~$968/mes                      │
│  ├── 20 tenants (2K users):            ~$1,343/mes                    │
│  ├── 50 tenants (5K users):            ~$2,475/mes                    │
│  └── Break-even: 2 clientes × $500/mes                                │
│                                                                        │
│  ⚠️  Gemini 2.0 Flash Lite shutdown: 1 junio 2026                    │
│      Presupuestado con 3.1 Flash-Lite ($0.25/$1.50 por M tokens)      │
│      Con optimizaciones (cache + modelo híbrido) → -50-70% en AI      │
└────────────────────────────────────────────────────────────────────────┘
```
