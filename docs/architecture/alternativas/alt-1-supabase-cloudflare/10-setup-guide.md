# Alternativa 1 — Guía de Setup Completo (Día 0)

> Paso a paso para comprar, configurar y conectar **todas las herramientas** de GRIXI desde cero.
> Dominio: `grixi.io`. Equipo: 2 developers + 3 equipo.
> **Tiempo estimado:** 1 día completo (~8 horas).

---

## Orden de Configuración

```
┌──────────────────────────────────────────────────────────────────┐
│                  ORDEN DE SETUP (DEPENDENCIAS)                    │
│                                                                    │
│  1. Dominio        ← todo depende del dominio                    │
│       ↓                                                            │
│  2. Google Workspace ← necesita dominio para @grixi.io          │
│       ↓                                                            │
│  3. Cloudflare     ← DNS del dominio + CDN + Workers             │
│       ↓                                                            │
│  4. GitHub         ← repos + CI/CD (usa cuentas Workspace)       │
│       ↓                                                            │
│  5. Supabase       ← backend (custom domain via Cloudflare)      │
│       ↓                                                            │
│  6. Resend         ← emails (verifica dominio en Cloudflare DNS) │
│       ↓                                                            │
│  7. Discord        ← comunicación (invita cuentas Workspace)     │
│  8. Jira           ← project mgmt (Atlassian con Workspace SSO)  │
│  9. Sentry         ← monitoring (conecta a GitHub)               │
│  10. Antigravity   ← AI coding (conecta a GitHub)                │
│       ↓                                                            │
│  11. Conectar todo ← secrets, webhooks, CI/CD                    │
│       ↓                                                            │
│  12. Verificar     ← checklist final                             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. Dominio: grixi.io (Cloudflare Registrar)

| Campo | Valor |
|---|---|
| **Dominio** | `grixi.io` |
| **Registrador** | **Cloudflare Registrar** (at-cost, ~$13/año para .io) |
| **¿Por qué Cloudflare?** | Precio sin markup, DNS ya integrado, 0 configuración extra para Workers |
| **Uso** | Wildcard `*.grixi.io` para tenants |

### Pasos
1. Cloudflare Dashboard → **Domain Registration** → Register a new domain
2. Buscar `grixi.io` → Comprar (~$13/año)
3. El dominio queda automáticamente en Cloudflare DNS (sin cambiar nameservers)

### Subdominios planificados

| Subdominio | Uso |
|---|---|
| `app.grixi.io` | Panel SuperAdmin GRIXI |
| `*.grixi.io` | Tenants (empresa-x.grixi.io, demo.grixi.io) |
| `api.grixi.io` | Supabase custom domain (PostgREST + Auth) |
| `mail.grixi.io` | Google Workspace MX (automático) |

---

## 2. Google Workspace ($14/usuario/mes)

### Compra
1. Ir a [workspace.google.com](https://workspace.google.com)
2. Plan: **Business Starter** ($14/usuario/mes)
3. Dominio: `grixi.io`
4. Verificar propiedad del dominio (DNS TXT record)

### Cuentas a crear (5)

| Email | Persona | Rol |
|---|---|---|
| `diego@grixi.io` | Developer 1 | Owner + Dev |
| `dev2@grixi.io` | Developer 2 | Dev |
| `comercial@grixi.io` | Equipo comercial | Ventas + Demos |
| `diseno@grixi.io` | Equipo diseño | UI/UX |
| `admin@grixi.io` | Gestión | Administración |

### DNS Records (automáticos)
```
grixi.io  MX    10 aspmx.l.google.com
grixi.io  MX    20 alt1.aspmx.l.google.com
grixi.io  TXT   "v=spf1 include:_spf.google.com ~all"
```

---

## 3. Cloudflare (Pro $20/mes + Workers Paid $5/mes)

### 3.1 Agregar zona `grixi.io`

1. Crear cuenta Cloudflare (o usar existente)
2. Add Site → `grixi.io`
3. Cambiar nameservers del registrador a Cloudflare
4. Esperar propagación (~5-30 min)

### 3.2 Upgrade a Pro ($20/mes)

1. Cloudflare Dashboard → grixi.io → Overview → Plan → **Pro**
2. Esto incluye: WAF (20 reglas), DDoS avanzado, WebSockets, Cloudflare Analytics

### 3.3 Activar Workers Paid ($5/mes)

1. Workers & Pages → Plans → **Paid** ($5/mes)
2. Incluye: 10M requests, 30M CPU ms, KV (10M reads, 1M writes), Hyperdrive

### 3.4 Configurar DNS base

```
# DNS Records en Cloudflare
grixi.io        A       192.0.2.1       # Proxy (placeholder, Workers manejan el tráfico)
*.grixi.io      A       192.0.2.1       # Wildcard para tenants (proxy)
api.grixi.io    CNAME   <supabase-ref>.supabase.co  # Supabase custom domain (⏳ paso 5)
```

### 3.5 Crear KV Namespace

```bash
# Workers KV para cache
wrangler kv namespace create GRIXI_CACHE
# → Anotar el ID para wrangler.toml
```

### 3.6 Crear R2 Bucket

```bash
# R2 para object storage
wrangler r2 bucket create grixi-assets
```

### 3.7 Crear Hyperdrive Config

```bash
# Connection pooling para Supabase PostgreSQL (⏳ se configura en paso 5)
wrangler hyperdrive create grixi-db --connection-string="postgresql://..."
```

---

## 4. GitHub (Team $4/dev/mes)

### 4.1 Crear Organización

1. GitHub → New Organization → `grixi-platform`
2. Plan: **Team** ($4/usuario/mes)
3. Agregar 2 developers

### 4.2 Crear Repositorio Monorepo

```bash
# Crear monorepo con Turborepo
npx -y create-turbo@latest grixi --package-manager pnpm

# Estructura resultado
grixi/
├── apps/
│   └── web/          ← React Router v7 + Vite 8 + Cloudflare Workers
├── packages/
│   ├── ui/           ← Componentes shadcn/ui compartidos
│   ├── db/           ← Drizzle schema + tipos
│   └── config/       ← ESLint, TypeScript, Tailwind configs
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

### 4.3 Configurar Branch Protection

```
main branch:
  ✅ Require pull request reviews (1 reviewer mínimo)
  ✅ Require status checks to pass (typecheck + lint)
  ✅ Restrict pushes (admin only)

develop branch:
  ✅ Require status checks to pass
```

### 4.4 Secrets del Repositorio

```
GitHub → Settings → Secrets and Variables → Actions:
  CLOUDFLARE_API_TOKEN    = (⏳ paso 3 — Cloudflare API tokens)
  CLOUDFLARE_ACCOUNT_ID   = (⏳ paso 3)
  SUPABASE_ACCESS_TOKEN   = (⏳ paso 5)
  SENTRY_AUTH_TOKEN        = (⏳ paso 9)
```

### 4.5 Archivos Base del Repo

```
.github/
├── workflows/
│   ├── deploy-production.yml   ← Push a main → build + wrangler deploy
│   ├── deploy-preview.yml      ← PR → build + wrangler versions upload
│   └── quality-check.yml       ← Todo PR: typecheck + lint + test
├── CODEOWNERS                  ← @grixi-platform/developers
└── pull_request_template.md    ← Checklist de PR
```

---

## 5. Supabase (Pro $25/mes + Compute $60/mes + PITR $100/mes)

### 5.1 Crear Proyecto

1. [supabase.com](https://supabase.com) → New Project
2. Organización: `GRIXI`
3. Nombre: `grixi-production`
4. Región: **US East (N. Virginia)** — us-east-1
5. Password: generar una segura (guardar en 1Password)

### 5.2 Upgrade a Pro ($25/mes)

1. Project Settings → Billing → Upgrade to **Pro**
2. Crédito de $10/mes incluido

### 5.3 Compute Add-on: Medium ($60/mes)

1. Project Settings → Add-ons → Compute
2. Seleccionar **Medium** (2 vCPU ARM, 4 GB RAM)
3. Suficiente para ~500 usuarios concurrentes

### 5.4 PITR Add-on: 7 días ($100/mes)

1. Project Settings → Add-ons → PITR
2. Seleccionar **7 días**
3. Permite restaurar la DB a cualquier segundo de la última semana

### 5.5 Custom Domain

1. Project Settings → Custom Domains
2. Agregar: `api.grixi.io`
3. Supabase da un CNAME target → agregarlo en Cloudflare DNS
4. Verificar (puede tomar ~30 min)

```
# En Cloudflare DNS (ya preparado en paso 3)
api.grixi.io    CNAME   <supabase-ref>.supabase.co    (NO proxy, DNS only)
```

### 5.6 Auth Configuration

```
Supabase Dashboard → Authentication → Providers:

  ✅ Google OAuth:
     Client ID:       (crear en Google Cloud Console → grixi.io proyecto)
     Client Secret:   (mismo proyecto)
     Authorized redirect URI: https://api.grixi.io/auth/v1/callback

  ✅ Email/Password:  habilitado (fallback)
  ✅ Magic Link:      habilitado
  ❌ Phone OTP:       deshabilitado (no se usa)
```

### 5.7 Auth → URL Configuration

```
Site URL:              https://app.grixi.io
Redirect URLs:
  - https://app.grixi.io/**
  - https://*.grixi.io/**
  - http://localhost:5173/**    (desarrollo local)
```

### 5.8 Branching 2.0

1. Project Settings → Branching → Enable
2. Conectar con GitHub repo: `grixi-platform/grixi`
3. Main branch: `main`

### 5.9 Anotar Credenciales

```
Guardar de forma segura:
  SUPABASE_URL          = https://api.grixi.io (custom domain)
  SUPABASE_ANON_KEY     = eyJ...
  SUPABASE_SERVICE_KEY   = eyJ...
  DATABASE_URL          = postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres
  SUPABASE_PROJECT_REF  = <ref>
```

---

## 6. Resend (Pro $20/mes)

### 6.1 Crear Cuenta

1. [resend.com](https://resend.com) → Sign up
2. Plan: **Pro** ($20/mes — 50K emails incluidos)

### 6.2 Verificar Dominio

1. Domains → Add Domain → `grixi.io`
2. Agregar DNS records en Cloudflare:

```
# DKIM (3 registros CNAME dados por Resend)
resend._domainkey.grixi.io   CNAME   resend.domainkey1.example.com
s1._domainkey.grixi.io       CNAME   resend.domainkey2.example.com
s2._domainkey.grixi.io       CNAME   resend.domainkey3.example.com

# SPF (ya incluido en el SPF de Google, agregar Resend)
grixi.io  TXT  "v=spf1 include:_spf.google.com include:amazonses.com ~all"

# DMARC
_dmarc.grixi.io  TXT  "v=DMARC1; p=quarantine; rua=mailto:admin@grixi.io"
```

### 6.3 Crear API Key

```
Settings → API Keys → Create API Key
  Name: grixi-production
  Permission: Full access
  → Guardar: RESEND_API_KEY=re_...
```

### 6.4 Configurar Sender

```
Emails se envían desde:
  no-reply@grixi.io        ← Notificaciones automáticas
  invitaciones@grixi.io    ← Invitaciones a la plataforma
  soporte@grixi.io         ← Alertas y reportes
```

---

## 7. Discord (Level 2 ~$40/mes)

### 7.1 Crear Servidor

1. Nombre: `GRIXI Platform`
2. Template: Community

### 7.2 Canales

```
GRIXI Platform
├── #general              ← Comunicación del equipo
├── #desarrollo           ← Discusión técnica
├── #comercial            ← Oportunidades, demos, seguimiento
├── #diseño               ← UI/UX, feedback
├── #ci-cd                ← Webhooks: deployments, PRs, builds
├── #alertas              ← Sentry errors, Supabase warnings
├── #dailies              ← Standups diarios
└── #random               ← Todo lo demás
```

### 7.3 GitHub Webhook → #ci-cd

```
GitHub → Repo Settings → Webhooks → Add webhook
  URL:    (Discord webhook URL del canal #ci-cd)
  Events: Push, PR, Deployment status
```

### 7.4 Sentry Webhook → #alertas

```
Sentry → Settings → Integrations → Discord
  Channel: #alertas
  Events: Error, Crash
```

---

## 8. Jira (Free Tier)

### 8.1 Crear Proyecto

1. [atlassian.com/jira](https://www.atlassian.com/jira) → Start free
2. Crear con cuentas Workspace (@grixi.io)
3. Proyecto: `GRIXI` (key: `GRX`)
4. Template: **Scrum Board**

### 8.2 Configurar Board

```
Columnas:
  Backlog → To Do → In Progress → Code Review → Testing → Done

Issue Types:
  • Epic    ← Módulo completo (ej: Almacenes 3D)
  • Story   ← Feature (ej: Vista 3D de racks)
  • Task    ← Tarea técnica (ej: Migrar componente a loader)
  • Bug     ← Error
```

---

## 9. Sentry (Free Tier → Team cuando sea necesario)

### 9.1 Crear Proyecto

1. [sentry.io](https://sentry.io) → Create Project
2. Plataforma: **React** (JavaScript/TypeScript)
3. Nombre: `grixi-web`

### 9.2 Instalar SDK

```bash
pnpm add @sentry/react
```

### 9.3 Configurar DSN

```
Settings → Projects → grixi-web → Client Keys (DSN)
  → SENTRY_DSN=https://...@sentry.io/...
```

---

## 10. Antigravity Ultra ($249.99/mes)

### 10.1 Suscripción

1. [antigravity.dev](https://antigravity.dev) → Subscribe
2. Plan: **Ultra** ($249.99/mes — hasta 5 desarrolladores)
3. Conectar con GitHub: `grixi-platform` org

### 10.2 Configurar en IDEs

```
Cada dev instala:
  • VS Code / Cursor extension
  • Conectar con cuenta GitHub
  • Verificar que el repo grixi está indexado
```

---

## 11. Conectar Todo (Secrets + Environment)

### 11.1 Cloudflare Workers — Secrets

```bash
# Secrets de producción
wrangler secret put SUPABASE_ANON_KEY          # ← Paso 5.9
wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # ← Paso 5.9
wrangler secret put GEMINI_API_KEY              # ← Google AI Studio
wrangler secret put RESEND_API_KEY              # ← Paso 6.3
wrangler secret put SENTRY_DSN                  # ← Paso 9.3
```

### 11.2 wrangler.toml final

```toml
name = "grixi"
compatibility_date = "2026-03-22"
compatibility_flags = ["nodejs_compat"]
main = ".react-router/worker.ts"

[assets]
directory = ".react-router/client"

[[kv_namespaces]]
binding = "KV_CACHE"
id = "<KV namespace ID del paso 3.5>"

[[r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "grixi-assets"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<Hyperdrive config ID del paso 3.7>"

[vars]
SUPABASE_URL = "https://api.grixi.io"
APP_ENV = "production"
APP_DOMAIN = "grixi.io"

# Secrets (configurados con wrangler secret put):
# SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# GEMINI_API_KEY
# RESEND_API_KEY
# SENTRY_DSN
```

### 11.3 Archivo .dev.vars (desarrollo local)

```bash
# .dev.vars — NO commitear, está en .gitignore
SUPABASE_URL=https://api.grixi.io
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIza...
RESEND_API_KEY=re_...
SENTRY_DSN=https://...@sentry.io/...
```

### 11.4 GitHub Actions Secrets

```
GitHub → Settings → Secrets → Actions:
  CLOUDFLARE_API_TOKEN     = <Cloudflare API token con Workers permisos>
  CLOUDFLARE_ACCOUNT_ID    = <Account ID de Cloudflare dashboard>
```

---

## 12. Checklist de Verificación Final

```
✅ DOMINIO
  [ ] grixi.io resuelve en Cloudflare DNS
  [ ] app.grixi.io carga (aunque sea 404 del Worker)
  [ ] api.grixi.io → Supabase dahsboard funciona

✅ GOOGLE WORKSPACE
  [ ] 5 cuentas @grixi.io funcionando
  [ ] Gmail envía/recibe correctamente
  [ ] Google Meet funciona

✅ CLOUDFLARE
  [ ] Plan Pro activo
  [ ] Workers Paid activo
  [ ] KV namespace creado
  [ ] R2 bucket creado
  [ ] Hyperdrive configurado (conecta a Supabase)
  [ ] Wildcard *.grixi.io resuelve

✅ GITHUB
  [ ] Repo grixi con branch protection
  [ ] CI/CD workflows en .github/workflows/
  [ ] Secrets configurados
  [ ] 2 developers con acceso

✅ SUPABASE
  [ ] Proyecto Pro con Compute Medium + PITR
  [ ] Custom domain api.grixi.io activo
  [ ] Google OAuth configurado
  [ ] Branching 2.0 conectado a GitHub

✅ RESEND
  [ ] Dominio grixi.io verificado
  [ ] DKIM/SPF/DMARC configurados
  [ ] Email de prueba enviado exitosamente

✅ DISCORD
  [ ] Servidor con canales configurados
  [ ] Webhook de GitHub → #ci-cd
  [ ] 5 miembros del equipo invitados

✅ JIRA
  [ ] Proyecto GRX creado con board Scrum
  [ ] Epics iniciales creados (Dashboard, Almacenes, Compras, etc.)

✅ SENTRY
  [ ] Proyecto grixi-web creado
  [ ] DSN guardado en secrets

✅ ANTIGRAVITY
  [ ] Ultra plan activo
  [ ] 2 devs conectados
  [ ] Repo indexado

✅ CONEXIONES
  [ ] wrangler.toml completo con todos los bindings
  [ ] .dev.vars creado para desarrollo local
  [ ] GitHub Secrets configurados para CI/CD
  [ ] `pnpm dev` inicia correctamente
  [ ] `pnpm build && wrangler deploy` funciona
```

---

## Resumen de Costos del Setup

| Servicio | Plan | Costo/mes |
|---|---|---:|
| Antigravity Ultra | Hasta 5 devs | $249.99 |
| Supabase Pro + Medium + PITR | - crédito | $175.00 |
| Google Workspace | 5 × $14 | $70.00 |
| Discord Level 2 | | $40.00 |
| Cloudflare Pro | CDN + WAF | $20.00 |
| Resend Pro | 50K emails | $20.00 |
| GitHub Team | 2 × $4 | $8.00 |
| Cloudflare Workers | 10M req | $5.00 |
| Sentry Free | | $0.00 |
| Jira Free | | $0.00 |
| **TOTAL** | | **$587.99** |
