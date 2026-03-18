# Alternativa 3 — Coolify en Servidor Remoto

> Coolify se instala **nativamente** en Linux — sin VM, sin OrbStack. Misma funcionalidad que en Alt. 2 pero con mejor rendimiento.

---

## 1. Instalación (Nativa en Ubuntu)

```bash
# SSH al servidor Hetzner
ssh grixi@xxx.xxx.xxx.xxx

# Instalación de Coolify (1 comando)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Después de la instalación:
- Dashboard disponible en `https://admin.grixi.com` (via Caddy)
- Login con email + password configurados en setup

---

## 2. Ventajas vs Alt. 2

| Aspecto | Alt. 2 (Coolify en VM macOS) | Alt. 3 (Coolify nativo Linux) |
|---|---|---|
| **Rendimiento** | Overhead de VM | ✅ Nativo, 0 overhead |
| **Docker** | Docker en VM | ✅ Docker nativo |
| **Networking** | Bridge complejo | ✅ Directo |
| **Recursos** | Compartidos con macOS | ✅ 100% dedicados |
| **Updates** | Via OrbStack | ✅ apt + Coolify auto-update |

---

## 3. Flujo de Deploy

```
1. Push a GitHub (main branch)
       │
2. GitHub webhook → Coolify (servidor Hetzner)
       │
3. Coolify ejecuta:
   a. git clone
   b. docker build (Dockerfile)
   c. docker compose up (zero-downtime rolling update)
       │
4. App live en app.grixi.com en ~2-3 minutos
```

---

## 4. Multi-Environment

```
Coolify Dashboard:
└── Project: GRIXI
    ├── Production (source: main)
    │   ├── grixi-app    → Next.js
    │   ├── grixi-db     → PostgreSQL 17
    │   ├── grixi-redis  → Redis 7
    │   ├── grixi-minio  → MinIO
    │   └── grixi-worker → BullMQ
    │
    └── Staging (source: develop)
        ├── grixi-app-stg
        ├── grixi-db-stg (schema sin datos de prod)
        └── grixi-redis-stg
```

---

## 5. Acceso Remoto al Dashboard

Coolify expone su dashboard en el puerto 8000. Se protege vía Cloudflare Access:

```
admin.grixi.com → Cloudflare Access (email OTP) → Caddy → Coolify :8000
```

> Solo usuarios autorizados pueden acceder al dashboard de administración.
