# Alternativa 2 — Coolify: PaaS Self-Hosted

> Coolify reemplaza a Vercel como plataforma de deployment. Open-source, git push-to-deploy, dashboard web.

---

## 1. ¿Qué es Coolify?

Coolify es un **PaaS open-source** (como Vercel/Netlify pero self-hosted). Se instala en tu servidor y provee:

| Feature | Detalle |
|---|---|
| **Git Push to Deploy** | Conecta GitHub → auto-deploy al pushear |
| **Preview Deployments** | Cada PR genera un deploy de preview |
| **SSL automático** | Let's Encrypt via Caddy/Traefik integrado |
| **Dashboard web** | GUI para gestionar apps, DBs, envs |
| **Múltiples apps** | Next.js, PostgreSQL, Redis, MinIO — todo desde el dashboard |
| **Environment vars** | Por app y por environment |
| **Logs en tiempo real** | Streaming de logs en el dashboard |
| **Backups de DB** | Backups automáticos de PostgreSQL/Redis |
| **ARM64 support** | ✅ Funciona en Apple Silicon |
| **Costo** | **$0** (open-source) |

---

## 2. Instalación en Mac Studio

```bash
# Coolify requiere Linux — usar VM en macOS
# Opción 1: OrbStack Linux VM
orb create ubuntu coolify-host

# Dentro de la VM Ubuntu:
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

> [!NOTE]
> Coolify no corre nativamente en macOS. Se instala dentro de una VM Linux (OrbStack o UTM). OrbStack crea VMs ARM Linux ultra-livianas en Apple Silicon.

---

## 3. Configuración

### Conectar GitHub

1. Abrir Coolify dashboard → `http://localhost:8000`
2. Settings → GitHub App → Crear GitHub App
3. Instalar la app en tu repo `grixi`
4. Coolify detecta pushes automáticamente

### Configurar Aplicación

```
Coolify Dashboard:
├── Projects
│   └── GRIXI
│       ├── Production
│       │   ├── Next.js App (source: GitHub main)
│       │   ├── PostgreSQL 17 (persistent volume)
│       │   ├── Redis 7 (persistent volume)
│       │   └── MinIO (persistent volume)
│       │
│       └── Staging
│           ├── Next.js App (source: GitHub develop)
│           ├── PostgreSQL 17 (copy de prod schema)
│           └── Redis 7
```

### Workflow con Coolify

```
1. Developer pushea a GitHub (feature branch)
2. Coolify detecta el push via webhook
3. Coolify clona el repo y ejecuta build (Docker)
4. Si es PR → preview deployment con URL única
5. Si es main → production deployment
6. Rollback: 1 click en el dashboard de Coolify
```

---

## 4. Comparación: Coolify vs Vercel

| Feature | Vercel Pro ($20/mes) | Coolify ($0) |
|---|---|---|
| **Git Push Deploy** | ✅ | ✅ |
| **Preview Deployments** | ✅ Automático | ✅ Configurable |
| **SSL** | ✅ Automático | ✅ Let's Encrypt |
| **Rollback** | ✅ 1 click | ✅ 1 click |
| **Dashboard** | ✅ Premium | ✅ Funcional |
| **Edge Network** | ✅ 18 regiones | ❌ Solo tu servidor |
| **Serverless** | ✅ | ❌ |
| **Build machines** | ✅ 30 vCPU Turbo | Tu hardware |
| **Logs** | ✅ | ✅ |
| **Costo** | $20/mes | **$0** |
