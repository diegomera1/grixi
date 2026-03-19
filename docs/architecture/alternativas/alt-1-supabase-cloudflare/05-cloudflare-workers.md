# Alternativa 1 — Cloudflare Workers: Deployment y CI/CD

> Configuración de Cloudflare Workers para ejecutar React Router v7 (Vite 8 + Rolldown build), incluyendo wrangler.toml, CI/CD con GitHub Actions, y preview deployments.

---

## 1. Configuración del Proyecto

### wrangler.toml

```toml
name = "grixi"
compatibility_date = "2026-03-01"
compatibility_flags = ["nodejs_compat"]
main = ".react-router/worker.ts"

# Assets estáticos (JS, CSS, fonts, images)
[assets]
directory = ".react-router/client"

# Bindings de Cloudflare
[[kv_namespaces]]
binding = "KV_CACHE"
id = "abc123..."

# Variables de entorno (no sensibles)
[vars]
SUPABASE_URL = "https://api.grixi.app"
APP_ENV = "production"

# Secrets (sensibles — se configuran con wrangler secret put)
# SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# GEMINI_API_KEY
```

### Secrets Management

```bash
# Configurar secrets (una vez)
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put GEMINI_API_KEY
```

---

## 2. Build & Deploy

### Deploy Manual

```bash
# Build React Router v7 con Vite 8 (Rolldown bundler)
pnpm build    # ~5-10 segundos (vs ~60-90s con Vite 7)

# Deploy a Workers
wrangler deploy
```

### Preview Deployments (Branches)

```bash
# Deploy a un environment de preview
wrangler deploy --env preview

# O usando wrangler versions
wrangler versions upload
```

---

## 3. CI/CD con GitHub Actions

### Deploy a Producción (push a main)

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    name: Build & Deploy to Cloudflare
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      # Quality checks
      - name: TypeScript Check
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      # Build con Vite 8 + Rolldown (~5-10s)
      - name: Build
        run: pnpm build

      # Deploy to Cloudflare Workers
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

### Preview Deployments (PRs)

```yaml
# .github/workflows/deploy-preview.yml
name: Deploy Preview
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  preview:
    name: Build & Deploy Preview
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: Deploy Preview
        uses: cloudflare/wrangler-action@v3
        id: deploy
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: versions upload

      - name: Comment Preview URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.pull_request.number,
              body: `🚀 Preview: ${{ steps.deploy.outputs.deployment-url }}`
            })
```

---

## 4. Dominios

| Dominio | Configuración |
|---|---|
| `app.grixi.com` | Custom domain en Workers → `wrangler.toml` routes |
| `*.grixi.app` | Wildcard domain en Workers para tenants |
| `api.grixi.app` | CNAME → Supabase custom domain (sin cambios) |

```toml
# wrangler.toml — rutas
[[routes]]
pattern = "app.grixi.com/*"
custom_domain = true

[[routes]]
pattern = "*.grixi.app/*"
custom_domain = true
```

---

## 5. Monitoreo

| Herramienta | Qué monitorea |
|---|---|
| **Cloudflare Workers Analytics** | Requests, CPU time, errors, latencia |
| **Cloudflare Logs** | Request logs, Worker exceptions |
| **Sentry** | Error tracking, crashes, performance |
| **wrangler tail** | Logs en tiempo real (desarrollo) |
| **Supabase Dashboard** | DB, Auth, Realtime, Storage (sin cambios) |
| **Vite 8 Devtools** | Module graph, plugin transforms (opt-in dev) |
