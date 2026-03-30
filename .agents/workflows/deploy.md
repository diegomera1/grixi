---
description: Cómo compilar y desplegar GRIXI a producción en Cloudflare Workers
---

# Deploy de GRIXI

GRIXI se despliega en **Cloudflare Workers** con React Router v7 + Vite.

## Flujo Estándar

// turbo-all

### 1. Build

```bash
npm run build
```

Salida esperada: `✓ built in ~1s` con archivos en `build/server/` y `build/client/`.

### 2. Deploy

```bash
npx wrangler deploy
```

Salida esperada:
```
Uploaded grixi-app (X sec)
Deployed grixi-app triggers
  https://grixi-app.grixi.workers.dev
  *.grixi.ai/* (zone name: grixi.ai)
  grixi.ai (custom domain)
```

### 3. Verificar

Abrir en el navegador: `https://admin.grixi.ai` o `https://{tenant}.grixi.ai`

## Gestión de Secrets

```bash
# Agregar un secret nuevo
npx wrangler secret put NOMBRE_DEL_SECRET

# Listar secrets (no muestra valores)
npx wrangler secret list

# Eliminar un secret
npx wrangler secret delete NOMBRE_DEL_SECRET
```

### Secrets Actuales

| Secret | Propósito |
|--------|-----------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Key pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Key admin de Supabase (bypassa RLS) |
| `GEMINI_API_KEY` | API key de Google Gemini AI |
| `RESEND_API_KEY` | API key de Resend (emails) |

### Variables de Entorno (no secretas)

Definidas en `wrangler.jsonc` → `vars`:
- `APP_ENV`: `"production"`
- `APP_DOMAIN`: `"grixi.ai"`

## Desarrollo Local

```bash
# Iniciar dev server
npm run dev

# Los secrets locales van en .dev.vars (NO commitear)
cat .dev.vars
```

## Dominios

| Dominio | Propósito |
|---------|-----------|
| `grixi.ai` | Landing page / root |
| `admin.grixi.ai` | Portal admin plataforma |
| `{tenant}.grixi.ai` | Tenant individual (ej: `empresa-x.grixi.ai`) |
| `grixi-app.grixi.workers.dev` | Workers dev (fallback) |

## Bindings de Workers

| Binding | Tipo | Config |
|---------|------|--------|
| `ASSETS_BUCKET` | R2 Bucket | `grixi-assets` |
| `ADMIN_RATE_LIMITER` | Rate Limit | 30 req/60s |

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `wrangler.jsonc` | Configuración de Workers |
| `workers/app.ts` | Entry point del Worker |
| `.dev.vars` | Secrets locales (gitignored) |
| `worker-configuration.d.ts` | Types generados |
| `vite.config.ts` | Configuración de Vite + React Router |
