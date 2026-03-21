# Alternativa 1 — Costos Detallados

> Desglose completo para un equipo de **5 personas (2 developers + 3 equipo)**, **~100 usuarios por tenant**, estimados **holgados**.
> Dominio único: `grixi.com` (wildcard `*.grixi.com` para tenants).
> AI: **Gemini 3.1 Flash-Lite** ($0.25 input / $1.50 output por M tokens).
> **Actualizado:** 21 de marzo, 2026.

### Composición del Equipo

| Rol | Cantidad | Qué necesita |
|---|---|---|
| **Developers** | 2 | Antigravity Ultra, GitHub Team, Google Workspace, acceso a Supabase Branching |
| **Equipo** (comercial, diseño, gestión) | 3 | Google Workspace, Jira, Discord |

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

## 3. Tabla de Costos Completa (2 Devs + 3 Equipo, 5 Tenants, 500 Usuarios)

| # | Servicio | Tipo | Incluido | Precio/mes |
|---|---|---|---|---:|
| | **SUPABASE** | | | |
| 1 | Plan Pro base | 🔒 Fijo | 8 GB DB, 250 GB egress, 100K MAUs, 100 GB storage, Realtime, Edge Functions | $25.00 |
| 2 | Compute Medium | 🔒 Fijo | 2 vCPU ARM, 4 GB RAM dedicado, I/O optimizado | $60.00 |
| 3 | Crédito compute | 🔒 Fijo | Descuento incluido en Pro | -$10.00 |
| 4 | PITR 7 días | 🔒 Fijo | Restauración a cualquier segundo, últimos 7 días | $100.00 |
| 5 | Branching | 📈 Variable | ~3 branches (2 devs) × 8h × 22 días × $0.01344/hr | ~$8.00 |
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
| 17 | Antigravity Ultra | 🔒 Fijo | Hasta 5 devs (usada por 2). Gemini 3.1 Pro, Claude, GPT. Sin límite semanal | $249.99 |
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
| | **POR PERSONA** | | | |
| 25 | GitHub Team (solo devs) | 🔒 Fijo | $4/dev × 2 developers. Repos privados, CI/CD, code review | $8.00 |
| 26 | Google Workspace (todo el equipo) | 🔒 Fijo | $14/persona × 5. Gmail, Drive, Meet con @grixi.com | $70.00 |
| | **Subtotal Equipo** | | | **$78.00** |

### Totales

| Categoría | Monto/mes |
|---|---:|
| 🔒 **Costos fijos** | **$587.99** |
| 📈 **Costos variables** (holgados, 5 tenants, 500 usuarios) | **~$176.60** |
| **TOTAL MENSUAL** | **~$765/mes** |

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

## 5. Cálculo Detallado: Resend (Emails Transaccionales)

### Emails por tenant/mes (~100 usuarios, uso intensivo)

| Tipo de email | Cantidad/mes | Notas |
|---|---|---|
| Alertas (stock bajo, OC aprobada, medidas fuera de rango) | ~500 | ~5/usuario activo |
| Notificaciones (asignaciones, cambios, nuevos docs) | ~300 | ~3/usuario |
| Reportes programados (semanales/mensuales a gerentes) | ~80 | ~20 gerentes × 4 reportes |
| Invitaciones y onboarding | ~50 | Nuevos usuarios + re-envíos |
| Magic links, password resets, verificaciones | ~100 | Estimado |
| Auditoría y alertas admin | ~50 | Solo admins |
| **Total por tenant/mes** | **~1,100** | Uso normal |
| **Total holgado (+50%)** | **~1,650** | **Para presupuesto** |
| **Total máximo** | **~3,000** | Pico alto con alertas masivas |

### Resend: planes y escalado

| Plan | Emails incluidos | Precio | Overage | Cuántos tenants cubre (a 3K/tenant) |
|---|---|---|---|---|
| **Pro** | 50,000/mes | $20/mes | $0.90/1K extra | ~16 tenants |
| **Scale** | 100,000/mes | $90/mes | $0.90/1K extra | ~33 tenants |
| Enterprise | Custom | Custom | Negociable | 34+ tenants |

---

## 6. Todos los Costos Variables: Qué Sube y Cuándo

| # | Servicio | Incluido en plan fijo | Cuándo se excede | Costo extra | Trigger |
|---|---|---|---|---|---|
| 1 | **Gemini 3.1 Flash-Lite** | Pay per use | Cada tenant nuevo | ~$33/tenant (con margen) | Cada tenant |
| 2 | **R2 Storage** | 10 GB free | Cada tenant nuevo (~50 GB c/u) | $0.015/GB ($0 egress) | Cada tenant |
| 3 | **Resend emails** | 50K emails (Pro) | ~17 tenants (a 3K emails/tenant) | $0.90/1K extra o upgrade a Scale $90 | ~17 tenants |
| 4 | **Supabase Branching** | Pay per use | Siempre variable | $0.01344/hr por branch | Cada branch |
| 5 | **Supabase DB size** | 8 GB | ~8 tenants (1 GB/tenant) | $0.125/GB extra | ~8 tenants |
| 6 | **Supabase Egress** | 250 GB/mes | ~8 tenants (30 GB/tenant) | $0.09/GB extra | ~8 tenants |
| 7 | **Supabase Storage** | 100 GB | ~10 tenants (10 GB docs/tenant) | $0.021/GB extra | ~10 tenants |
| 8 | **Supabase Compute** | Medium (4 GB RAM) | Queries lentas bajo carga | +$100 → Large (8 GB) | ~30 tenants |
| 9 | **Supabase MAUs** | 100K | >100K usuarios únicos/mes | $0.00325/MAU extra | ~100 tenants |
| 10 | **CF Workers req** | 10M/mes | Alto tráfico (200K req/tenant) | $0.30/millón extra | ~50 tenants |
| 11 | **CF KV reads** | 10M/mes | Cache de muchas orgs | $0.50/M reads extra | ~50 tenants |
| 12 | **Sentry** | 5K errors/mes | Más tráfico, más errores | +$26 → Team plan | ~20 tenants |

---

## 7. Escalado por Tenant (~100 Usuarios, 50 GB Storage, 3K Emails)

### Costo marginal por tenant adicional (todos los recursos)

| Recurso | Costo/tenant/mes | Cálculo |
|---|---|---|
| **Gemini 3.1 Flash-Lite** | **~$33.00** | 70 users × 8 queries × 22 días × (1K in + 1.2K out) + 30% margen |
| **Resend emails** | **~$2.70** | ~3K emails/tenant × $0.90/1K (overage cuando excede 50K) |
| **Supabase Egress** | ~$2.70 | ~30 GB/tenant × $0.09/GB (cuando excede 250 GB incluidos) |
| **R2 Storage** | ~$0.75 | 50 GB/tenant × $0.015/GB. Egress siempre $0 |
| **Supabase Storage** | ~$0.21 | ~10 GB docs/tenant × $0.021/GB (cuando excede 100 GB) |
| **Supabase DB** | ~$0.13 | ~1 GB data/tenant × $0.125/GB (cuando excede 8 GB) |
| **Workers requests** | ~$0.06 | ~200K req/tenant × $0.30/M (cuando excede 10M) |
| **KV reads** | ~$0.05 | ~100K reads/tenant × $0.50/M (cuando excede 10M) |
| **Total por tenant extra** | **~$40/tenant** | Redondeado con margen |

> [!NOTE]
> **Gemini API = 83% del costo variable por tenant.** Las optimizaciones de AI (caching, modelo híbrido, rate limiting) pueden bajar el costo marginal a ~$20-25/tenant.

### Tabla de escalado completo (todos los costos desglosados)

| Tenants | Usuarios | Gemini | R2 | Resend | SB Egress | SB DB | SB Storage | SB Compute | CF Workers | Branching | Sentry | **Total variable** | Fijos | **TOTAL** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **5** | 500 | $165 | $4 | $0* | $0* | $0* | $0* | $0* | $0* | $8 | $0* | **$177** | $588 | **~$765** |
| **10** | 1K | $330 | $8 | $0* | $20 | $1 | $0* | $0* | $0* | $8 | $0* | **$367** | $588 | **~$955** |
| **17** | 1.7K | $561 | $13 | $0* | $46 | $2 | $7 | $0* | $0* | $8 | $0* | **$637** | $588 | **~$1,225** |
| **20** | 2K | $660 | $15 | $9† | $59 | $3 | $10 | $0* | $0* | $8 | $26‡ | **$790** | $588 | **~$1,378** |
| **30** | 3K | $990 | $23 | $27† | $92 | $5 | $16 | $100§ | $0* | $8 | $26 | **$1,287** | $588 | **~$1,875** |
| **50** | 5K | $1,650 | $38 | $70¶ | $155 | $8 | $26 | $100 | $3 | $8 | $26 | **$2,084** | $588 | **~$2,672** |
| **100** | 10K | $3,300 | $75 | $180¶ | $310 | $17 | $53 | $150§§ | $8 | $8 | $26 | **$4,127** | $588 | **~$4,715** |

> \* Dentro de los límites incluidos del plan fijo
> † Overage: (emails - 50K) × $0.90/1K
> ‡ Sentry upgrade a Team ($26/mes) a partir de ~20 tenants
> § Upgrade Supabase Compute → Large ($100/mes extra) a partir de ~30 tenants
> §§ Upgrade Supabase Compute → XL ($150/mes extra) a partir de ~50 tenants
> ¶ Upgrade Resend Scale ($90/mes) + overage a partir de ~34 tenants

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

## 9. Proyección a 3 Años (2 devs + 3 equipo, crecimiento orgánico)

| Periodo | Tenants | Usuarios | Total/mes | Total periodo |
|---|---|---|---|---|
| **Mes 1-6** | 1-5 | 500 | ~$765 | $4,590 |
| **Mes 7-12** | 6-10 | 1,000 | ~$955 | $5,730 |
| **Año 2** | 11-25 | 2,500 | ~$1,300 | $15,600 |
| **Año 3** | 26-50 | 5,000 | ~$2,300 | $27,600 |
| **Total 3 años** | | | | **$53,520** |

### Break-even

| Precio/tenant/mes | Tenants necesarios | Cuándo |
|---|---|---|
| $500/mes | 2 clientes | Mes 1 |
| $300/mes | 3 clientes | Mes 2 |
| $200/mes | 4 clientes | Mes 3 |
| $100/mes | 8 clientes | Mes 8 |

---

## 10. Resumen Ejecutivo

```
┌──────────────────────────────────────────────────────────────────────────┐
│  GRIXI — COSTOS MENSUALES (2 DEVS + 3 EQUIPO, 5 TENANTS, ~500 USERS)   │
│  100 users/tenant · 50 GB storage/tenant · 3K emails/tenant             │
│  Gemini 3.1 Flash-Lite · Estimados HOLGADOS (+30% margen AI)            │
│                                                                          │
│  🛠️  EQUIPO                                                             │
│  ├── 2 Developers (Antigravity, GitHub, Workspace)                      │
│  └── 3 Equipo (Workspace, Jira, Discord)                                │
│                                                                          │
│  🔒 COSTOS FIJOS                                      $587.99/mes       │
│  ├── Antigravity Ultra (hasta 5 devs, usada por 2)    $249.99           │
│  ├── Supabase Pro                                     $25.00            │
│  ├── Supabase Compute Medium (2 vCPU, 4 GB)           $60.00            │
│  ├── Supabase crédito                                 -$10.00           │
│  ├── Supabase PITR 7 días                             $100.00           │
│  ├── Google Workspace (5 personas × $14)              $70.00            │
│  ├── Discord Level 2                                  $40.00            │
│  ├── Cloudflare Pro (CDN + WAF + DDoS)                $20.00            │
│  ├── Resend Pro (50K emails base)                     $20.00            │
│  ├── GitHub Team (2 devs × $4)                        $8.00             │
│  ├── Cloudflare Workers Paid (+ KV + Hyperdrive)      $5.00             │
│  └── Sentry + Jira                                    $0.00             │
│                                                                          │
│  📈 COSTOS VARIABLES (holgados, ~5 tenants)           ~$177/mes         │
│  ├── Gemini 3.1 Flash-Lite (5 × ~$25/tenant)         ~$125.00          │
│  ├── Gemini margen seguridad (+30%)                   ~$40.00           │
│  ├── Supabase Branching (~3 branches, 2 devs)         ~$8.00            │
│  ├── R2 Storage (5 × 50 GB = 250 GB)                 ~$3.60            │
│  └── Resend, Egress, DB, KV (dentro de incluidos)     ~$0.00            │
│                                                                          │
│  ═══════════════════════════════════════════════════════                 │
│  TOTAL                                                ~$765/mes         │
│  ═══════════════════════════════════════════════════════                 │
│                                                                          │
│  📊 ESCALADO (por tenant: ~100 users, 50 GB, 3K emails)                 │
│  ├── Costo marginal por tenant: ~$40/mes                                │
│  │   ├── Gemini (~$33) + Resend ($2.70) + Egress ($2.70)               │
│  │   └── R2 ($0.75) + Storage ($0.21) + DB ($0.13)                     │
│  ├── 10 tenants (1K users):        ~$955/mes                            │
│  ├── 20 tenants (2K users):        ~$1,378/mes                          │
│  ├── 50 tenants (5K users):        ~$2,672/mes                          │
│  ├── 100 tenants (10K users):      ~$4,715/mes                          │
│  └── Break-even: 2 clientes × $500/mes                                  │
│                                                                          │
│  ⚠️  Gemini 2.0 Flash Lite shutdown: 1 junio 2026                      │
│  📧 Resend: 50K emails incluidos → upgrade Scale ($90) a ~17 tenants   │
│  💾 Supabase: upgrade Large ($100 extra) a ~30 tenants                  │
│  🤖 Con optimizaciones AI (cache + híbrido): -50-70% en Gemini         │
└──────────────────────────────────────────────────────────────────────────┘
```



