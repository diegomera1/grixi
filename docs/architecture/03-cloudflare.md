# GRIXI × Cloudflare — Seguridad, CDN y Protección

> Documento detallado sobre cómo GRIXI utiliza Cloudflare como capa de seguridad y rendimiento frente a toda la infraestructura.

---

## 1. ¿Por Qué Cloudflare?

### 1.1 El Rol de Cloudflare en la Arquitectura

Cloudflare actúa como **proxy inverso** — todo el tráfico hacia GRIXI pasa primero por la red global de Cloudflare antes de llegar a Vercel o Supabase.

```
Usuario → DNS → CLOUDFLARE → Vercel (frontend)
                           → Supabase (API/backend)

Sin Cloudflare:
  Usuario → DNS → Vercel/Supabase directamente (sin protección)
```

**Cloudflare NO es un hosting** — es una capa de protección y aceleración que se pone "en frente" de tus servicios.

### 1.2 ¿Qué Problema Resuelve?

| Problema | Sin Cloudflare | Con Cloudflare |
|---|---|---|
| **Ataque DDoS** | Tu app cae, Vercel podría facturarte el tráfico | Cloudflare absorbe el tráfico malicioso — 0 impacto |
| **Bots maliciosos** | Scraping de datos, credential stuffing, spam | Bot Management identifica y bloquea bots |
| **SQL Injection en API** | Depende solo de tu código para protegerte | WAF bloquea patterns maliciosos antes de que lleguen |
| **XSS/CSRF** | Depende solo de tus headers y sanitización | WAF detecta y bloquea payloads maliciosos |
| **Latencia global** | Cada request viaja al servidor de Vercel | CDN sirve assets desde 310+ locations |
| **Certificados SSL** | Gestionados por Vercel (OK, pero limitado) | SSL flexible + custom certificates |
| **Visibilidad de tráfico** | Solo lo que Vercel te muestra | Analytics completo de tráfico, amenazas, geographic distribution |

---

## 2. Red Global de Cloudflare

### 2.1 Infraestructura

| Métrica | Valor |
|---|---|
| **Data Centers** | 310+ ciudades en 120+ países |
| **Capacidad de Red** | 280+ Tbps |
| **Requests procesados** | 57+ millones por segundo |
| **% del Internet global** | ~20% del tráfico web pasa por Cloudflare |
| **Tiempo de respuesta DNS** | ~11ms promedio global |

### 2.2 Para GRIXI esto significa:

- Un usuario en **Guayaquil** conecta al data center de Cloudflare más cercano (posiblemente Lima o Miami)
- Assets estáticos (JS, CSS, imágenes) se sirven desde **el edge más cercano** — sin ir a Vercel
- El WAF evalúa el request en el edge — requests maliciosos **nunca llegan** a tu infraestructura
- Solo requests legítimos pasan a Vercel/Supabase

---

## 3. Plan Evolutivo: Pro → Business

### 3.1 Fase 1: Pro ($20/mes)

**Para:** Lanzamiento y primeras empresas internas.

| Característica | Incluido en Pro |
|---|---|
| **CDN Global** | ✅ 310+ PoPs |
| **SSL/TLS** | ✅ Universal (automático) |
| **DDoS Protection** | ✅ Unmetered (sin límite) |
| **WAF** | ✅ Managed Rulesets (OWASP) |
| **Custom WAF Rules** | 20 reglas |
| **Page Rules** | 20 reglas |
| **Bot Fight Mode** | ✅ Básico (challenge automático) |
| **Caching** | ✅ Completo con purge |
| **Analytics** | ✅ Web Analytics |
| **Always Online** | ✅ (sirve cache si el origen cae) |
| **Rate Limiting** | Básico (10K requests/mes gratis) |
| **Soporte** | Email |

**¿Es suficiente para empezar?** **Sí.** El Pro de Cloudflare incluye protección DDoS unmetered y WAF con reglas OWASP — suficiente para un SaaS B2B que está comenzando.

### 3.2 Fase 2: Business ($200/mes)

**Para:** Cuando entren clientes pagos y se necesite SLA garantizado.

| Característica | Qué agrega Business vs Pro |
|---|---|
| **Custom WAF Rules** | 100 reglas (vs 20 en Pro) |
| **Bot Management** | ✅ Avanzado con ML detection |
| **Uptime SLA** | ✅ 100% con créditos financieros |
| **Custom SSL** | ✅ Upload de certificados propios |
| **PCI Compliance** | ✅ Cumplimiento PCI DSS |
| **Cache Analytics** | ✅ Detallado |
| **ML-based WAF** | ✅ Machine Learning para nuevas amenazas |
| **Soporte** | 24/7/365 chat + email |
| **Railgun** | ✅ Compresión WAN |

### 3.3 ¿Cuándo migrar a Business?

| Criterio | Acción |
|---|---|
| Primer cliente externo pago | → Considerar Business |
| SLA contractual con clientes | → **Business obligatorio** (100% uptime SLA) |
| Datos financieros/bancarios | → Business (PCI compliance) |
| Ataques de bots detectados | → Business (ML bot management) |
| +50 WAF rules necesarias | → Business (100 custom rules) |

---

## 4. WAF (Web Application Firewall)

### 4.1 ¿Qué es un WAF?

Un WAF analiza cada request HTTP y bloquea los que contienen patterns maliciosos:

```
Request normal:
  GET /api/warehouses?status=active
  → WAF: ✅ PASS → Vercel → Supabase

Request malicioso (SQL injection):
  GET /api/warehouses?status=active'; DROP TABLE warehouses; --
  → WAF: ❌ BLOCKED (OWASP Rule: SQL Injection detected)
  → Nunca llega a tu infraestructura
```

### 4.2 OWASP Managed Rules (incluidas)

Cloudflare incluye reglas pre-configuradas para las **10 vulnerabilidades web más comunes** (OWASP Top 10):

| # | Vulnerabilidad | Qué hace la regla |
|---|---|---|
| A01 | **Broken Access Control** | Detecta intentos de escalación de privilegios |
| A02 | **Cryptographic Failures** | Identifica transmisiones sin cifrar |
| A03 | **Injection** (SQL, NoSQL, OS) | Bloquea payloads de inyección |
| A04 | **Insecure Design** | Patterns de abuso de API |
| A05 | **Security Misconfiguration** | Headers faltantes, paths expuestos |
| A06 | **Vulnerable Components** | Exploits conocidos en libraries |
| A07 | **Auth Failures** | Brute force, credential stuffing |
| A08 | **Software/Data Integrity** | Manipulación de datos en tránsito |
| A09 | **Security Logging Failures** | (No aplica directamente al WAF) |
| A10 | **SSRF** | Server-Side Request Forgery |

### 4.3 Custom WAF Rules para GRIXI

Reglas personalizadas que configuraremos:

```
Regla 1: Bloquear acceso a paths administrativos desde IPs no autorizadas
  IF path contains "/admin" AND ip.src NOT IN {oficina_ips}
  THEN BLOCK

Regla 2: Rate limit en API de auth
  IF path starts_with "/auth" AND rate > 20 req/min per IP
  THEN CHALLENGE (captcha)

Regla 3: Bloquear países no relevantes (opcional)
  IF ip.geoip.country NOT IN {"EC", "US", "CO", "PE", "MX"}
  THEN CHALLENGE

Regla 4: Proteger API de Supabase
  IF hostname = "api.grixi.app" AND NOT has_valid_referer
  THEN BLOCK

Regla 5: Bloquear user-agents sospechosos
  IF http.user_agent contains "sqlmap" OR "nikto" OR "nmap"
  THEN BLOCK

Regla 6: Content-Type enforcement
  IF method = "POST" AND NOT content_type contains "application/json"
  THEN BLOCK
```

---

## 5. DDoS Protection

### 5.1 ¿Qué es un Ataque DDoS?

Un DDoS (Distributed Denial of Service) intenta **saturar tu servidor** con millones de requests para que los usuarios legítimos no puedan acceder.

```
Normal:
  100 usuarios → GRIXI → responde OK ✅

DDoS:
  10,000,000 bots → GRIXI → servidor saturado → todos caen ❌

Con Cloudflare:
  10,000,000 bots → CLOUDFLARE → absorbe/bloquea → 0 bots pasan
  100 usuarios → CLOUDFLARE → pasan normal → GRIXI → OK ✅
```

### 5.2 Tipos de DDoS que Cloudflare Protege

| Capa | Tipo | Protección |
|---|---|---|
| **L3/L4 (Red)** | SYN Flood, UDP Flood, ICMP Flood | ✅ Automática, sin configuración |
| **L7 (Aplicación)** | HTTP Flood, Slowloris, API abuse | ✅ Automática + reglas custom |
| **DNS** | DNS Amplification | ✅ Automática (Cloudflare es el DNS resolver) |

### 5.3 ¿Por qué es importante para GRIXI?

- **SaaS multi-tenant**: Si GRIXI cae, **TODAS las empresas** se ven afectadas simultáneamente
- **Datos empresariales**: Downtime = pérdida de productividad de múltiples organizaciones
- **Reputación**: Un SaaS que se cae no genera confianza empresarial
- **Sin costo extra**: La protección DDoS de Cloudflare es **unmetered** — no pagues más por ataques

---

## 6. CDN (Content Delivery Network)

### 6.1 ¿Qué Cachea Cloudflare?

| Tipo de Contenido | Cacheado | TTL Sugerido | Impacto |
|---|---|---|---|
| **JavaScript bundles** | ✅ | 1 año (immutable hash) | Carga de app instantánea |
| **CSS** | ✅ | 1 año | Estilos cargados del edge |
| **Imágenes** | ✅ | 1 mes | Logos, fotos de productos desde CDN |
| **Fuentes (fonts)** | ✅ | 1 año | Instrument Serif, Geist cargados rápido |
| **HTML dinámico** | ❌ | No cachear | Pages con datos de tenant |
| **API responses** | ❌ (salvo excepciones) | No cachear | Datos en tiempo real |

### 6.2 Beneficios del CDN para GRIXI

| Beneficio | Detalle |
|---|---|
| **Reducción de Egress de Vercel** | Assets servidos desde Cloudflare CDN no consumen bandwidth de Vercel |
| **Latencia global mínima** | JS, CSS, imágenes se cargan desde el PoP más cercano al usuario |
| **Menor carga en Vercel** | Menos requests llegan al origin → menos invocaciones serverless |
| **Always Online** | Si Vercel tiene un problema, Cloudflare sirve la última versión cacheada |
| **Compresión automática** | Brotli/gzip en todos los assets |

### 6.3 Ahorro Estimado de Egress

```
Sin Cloudflare:
  200 usuarios × 50 pageviews/día × 500KB = 5GB/día → 150GB/mes
  Todo sale de Vercel bandwidth (1TB incluido)

Con Cloudflare:
  ~70-80% de requests son assets estáticos → servidos desde CDN
  Solo ~30% llega a Vercel (HTML dinámico, APIs)
  → ~45GB/mes de Vercel bandwidth (vs 150GB)
  → Ahorro de ~70% de bandwidth
```

---

## 7. SSL/TLS

### 7.1 Modos de SSL

| Modo | Descripción | Recomendado |
|---|---|---|
| **Off** | Sin SSL | ❌ Nunca |
| **Flexible** | SSL entre usuario y Cloudflare, HTTP al origin | ❌ No seguro |
| **Full** | SSL end-to-end, certificado del origin puede ser self-signed | ⚠️ Aceptable |
| **Full (Strict)** | SSL end-to-end, certificado del origin válido | ✅ **Usar este** |

### 7.2 Configuración para GRIXI

```
Cloudflare SSL Mode: Full (Strict)
  
  Usuario ←── HTTPS ──→ Cloudflare ←── HTTPS ──→ Vercel
                                    ←── HTTPS ──→ Supabase
  
  Vercel: Certificado SSL automático (Let's Encrypt)
  Supabase: Certificado SSL incluido en custom domain
```

### 7.3 Ventajas

- **Certificados automáticos** — Cloudflare genera y renueva SSL gratis
- **TLS 1.3** — Protocolo más rápido y seguro por defecto
- **HSTS** — Fuerza HTTPS en todos los subdominios
- **Minimum TLS Version** — Configurable (recomendado: TLS 1.2+)
- **Automatic HTTPS Rewrites** — Convierte links HTTP a HTTPS

---

## 8. Bot Protection

### 8.1 Tipos de Bots

| Tipo | Ejemplo | Acción |
|---|---|---|
| **Bueno** (Verified) | Google Bot, Bing Bot | ✅ Permitir |
| **Bueno** (Known) | Monitoring services, API clients | ✅ Permitir |
| **Sospechoso** | Scrapers genéricos, headless browsers | ⚠️ Challenge (CAPTCHA) |
| **Malicioso** | Credential stuffers, DDoS bots, vulnerability scanners | ❌ Bloquear |

### 8.2 Bot Protection en Pro vs Business

| Característica | Pro | Business |
|---|---|---|
| **Bot Fight Mode** | ✅ (JS challenge automático) | ✅ |
| **Super Bot Fight Mode** | Básico | ✅ Avanzado |
| **Bot Score** | ❌ | ✅ (1-99 score per request) |
| **ML-based detection** | ❌ | ✅ |
| **Verified bots allowlist** | ✅ | ✅ |
| **Custom bot rules** | Limitado | ✅ Completo |

### 8.3 ¿Por qué importa para GRIXI?

- **Credential stuffing**: Bots que intentan miles de combinaciones de email/password en `/auth/login`
- **Price scraping**: Si GRIXI tiene datos de precios/compras, bots podrían extraerlos
- **API abuse**: Bots que consumen Edge Functions de Supabase (= costos de invocaciones)
- **Form spam**: Bots que envían datos basura a formularios

---

## 9. Analytics y Visibilidad

### 9.1 Métricas Disponibles

| Métrica | Qué muestra |
|---|---|
| **Total Requests** | Requests totales por período (legítimos + bloqueados) |
| **Cached vs Uncached** | Porcentaje de requests servidos desde CDN |
| **Threats** | Requests bloqueados por WAF, DDoS, bots |
| **Top Countries** | De dónde vienen los usuarios |
| **Top IPs** | IPs que generan más tráfico (detectar abuso) |
| **Bandwidth Saved** | Cuánto bandwidth ahorraste con CDN caching |
| **SSL Handshakes** | TLS versions usadas |
| **Status Codes** | Distribución de 200/301/404/500 |

### 9.2 Firewall Analytics

- **WAF Events**: Cada request bloqueado/challengeado con detalles completos
- **Rate Limiting Events**: Requests que excedieron los límites
- **IP Access Rules**: Logs de IPs bloqueadas/permitidas
- **Origin Errors**: Problemas de conexión con Vercel/Supabase

---

## 10. Configuración DNS

### 10.1 Zona DNS de GRIXI en Cloudflare

```
# grixi.com (landing page)
grixi.com.          A       → Vercel IP (proxied ☁️)
www.grixi.com.      CNAME   → grixi.com (proxied ☁️)

# app.grixi.com (dashboard principal)
app.grixi.com.      CNAME   → cname.vercel-dns.com (proxied ☁️)

# *.grixi.app (tenant wildcard)
*.grixi.app.        CNAME   → cname.vercel-dns.com (proxied ☁️)

# api.grixi.app (Supabase custom domain)
api.grixi.app.      CNAME   → [supabase-custom-domain].supabase.co (proxied ☁️)

# Email (para enviar desde @grixi.com)
grixi.com.          MX      → mx.resend.com
grixi.com.          TXT     → v=spf1 include:resend.com ~all
grixi.com.          TXT     → [DKIM record from Resend]
```

### 10.2 ¿Por qué el ☁️ (Proxied)?

Cuando un record DNS está "proxied" (nube naranja), el tráfico pasa por Cloudflare:

- ✅ WAF protege el request
- ✅ CDN cachea assets
- ✅ DDoS protection activa
- ✅ La IP real de Vercel/Supabase está **oculta**

Si NO está proxied (DNS only/gris), Cloudflare solo resuelve el DNS pero NO protege.

---

## 11. Checklist de Configuración

```
CLOUDFLARE DASHBOARD:
├── DNS
│   ├── [x] grixi.com → Vercel (proxied)
│   ├── [x] app.grixi.com → Vercel (proxied)
│   ├── [x] *.grixi.app → Vercel (proxied)
│   ├── [x] api.grixi.app → Supabase (proxied)
│   └── [x] MX + SPF + DKIM para email
│
├── SSL/TLS
│   ├── [x] Mode: Full (Strict)
│   ├── [x] Minimum TLS: 1.2
│   ├── [x] TLS 1.3: Enabled
│   ├── [x] HSTS: Enabled (max-age: 31536000)
│   ├── [x] Always Use HTTPS: Enabled
│   └── [x] Automatic HTTPS Rewrites: Enabled
│
├── Security
│   ├── [x] WAF: OWASP rules enabled
│   ├── [x] Bot Fight Mode: Enabled
│   ├── [x] Security Level: Medium
│   ├── [x] Challenge Passage: 30 minutes
│   └── [x] Browser Integrity Check: Enabled
│
├── Caching
│   ├── [x] Caching Level: Standard
│   ├── [x] Browser Cache TTL: Respect Existing Headers
│   ├── [x] Always Online: Enabled
│   └── [x] Tiered Cache: Enabled
│
├── Speed
│   ├── [x] Auto Minify: JS + CSS + HTML
│   ├── [x] Brotli: Enabled
│   ├── [x] Early Hints: Enabled
│   └── [x] HTTP/3 (QUIC): Enabled
│
└── Network
    ├── [x] HTTP/2: Enabled
    ├── [x] HTTP/3: Enabled
    ├── [x] WebSockets: Enabled (para Supabase Realtime)
    ├── [x] Onion Routing: Enabled
    └── [x] IP Geolocation: Enabled
```
