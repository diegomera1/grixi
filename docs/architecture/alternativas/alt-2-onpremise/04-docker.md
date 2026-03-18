# Alternativa 2 — Docker Compose

> Stack completo de servicios en Docker con Docker Compose para el Mac Studio.

---

## 1. Docker Runtime

| Opción | Plataforma | Recomendación |
|---|---|---|
| **OrbStack** | macOS (ARM nativo) | ✅ **Recomendado** — más rápido y ligero que Docker Desktop |
| Docker Desktop | macOS | Funciona pero más pesado |
| Colima | macOS (CLI) | Ligero, headless |

---

## 2. Docker Compose Completo

```yaml
# docker-compose.yml
version: '3.9'

services:
  # ─────────────────────────────────────────
  # REVERSE PROXY
  # ─────────────────────────────────────────
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
    networks:
      - grixi

  # ─────────────────────────────────────────
  # NEXT.JS APPLICATION
  # ─────────────────────────────────────────
  app:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://grixi:${DB_PASSWORD}@postgres:5432/grixi
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      MINIO_ENDPOINT: http://minio:9000
      MINIO_ACCESS_KEY: ${MINIO_USER}
      MINIO_SECRET_KEY: ${MINIO_PASSWORD}
      BETTER_AUTH_SECRET: ${AUTH_SECRET}
      BETTER_AUTH_URL: https://app.grixi.com
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - grixi

  # ─────────────────────────────────────────
  # POSTGRESQL
  # ─────────────────────────────────────────
  postgres:
    image: pgvector/pgvector:pg17
    restart: unless-stopped
    environment:
      POSTGRES_DB: grixi
      POSTGRES_USER: grixi
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./supabase/migrations:/docker-entrypoint-initdb.d
      - ./config/postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    shm_size: '2g'
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U grixi"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - grixi

  # ─────────────────────────────────────────
  # REDIS
  # ─────────────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: >
      redis-server 
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 4gb
      --maxmemory-policy allkeys-lru
      --appendonly yes
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - grixi

  # ─────────────────────────────────────────
  # MINIO (S3-Compatible Storage)
  # ─────────────────────────────────────────
  minio:
    image: minio/minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes:
      - miniodata:/data
    networks:
      - grixi

  # ─────────────────────────────────────────
  # BULLMQ WORKER (Background Jobs)
  # ─────────────────────────────────────────
  worker:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.worker
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://grixi:${DB_PASSWORD}@postgres:5432/grixi
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    depends_on:
      - postgres
      - redis
    networks:
      - grixi

  # ─────────────────────────────────────────
  # CLOUDFLARE TUNNEL
  # ─────────────────────────────────────────
  tunnel:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --config /etc/cloudflared/config.yml run
    volumes:
      - ./config/cloudflared:/etc/cloudflared
    depends_on:
      - caddy
    networks:
      - grixi

  # ─────────────────────────────────────────
  # MONITORING
  # ─────────────────────────────────────────
  uptime-kuma:
    image: louislam/uptime-kuma:1
    restart: unless-stopped
    volumes:
      - uptimekuma:/app/data
    networks:
      - grixi

  grafana:
    image: grafana/grafana-oss:latest
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafanadata:/var/lib/grafana
    networks:
      - grixi

  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheusdata:/prometheus
    networks:
      - grixi

volumes:
  pgdata:
  redisdata:
  miniodata:
  caddy_data:
  caddy_config:
  uptimekuma:
  grafanadata:
  prometheusdata:

networks:
  grixi:
    driver: bridge
```

---

## 3. Caddyfile

```
# config/Caddyfile
{
  email admin@grixi.com
}

app.grixi.com, *.grixi.app {
  reverse_proxy app:3000

  header {
    X-Frame-Options "DENY"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
  }
}

storage.grixi.com {
  reverse_proxy minio:9000
}

monitor.grixi.com {
  reverse_proxy grafana:3000
  basicauth {
    admin $2a$14$... # bcrypt hash
  }
}
```

---

## 4. PostgreSQL Config Optimizado

```ini
# config/postgresql.conf
max_connections = 200
shared_buffers = 8GB
effective_cache_size = 24GB
work_mem = 64MB
maintenance_work_mem = 1GB
wal_buffers = 64MB
max_wal_size = 4GB
min_wal_size = 1GB
random_page_cost = 1.1
effective_io_concurrency = 200
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
```

---

## 5. Dockerfile para Next.js

```dockerfile
# apps/web/Dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 6. Variables de Entorno

```env
# .env (NO commitear a Git)
DB_PASSWORD=super-secure-password-here
REDIS_PASSWORD=another-secure-password
MINIO_USER=grixi-admin
MINIO_PASSWORD=minio-secure-password
AUTH_SECRET=random-256-bit-secret
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GEMINI_API_KEY=xxx
GRAFANA_PASSWORD=admin-password
```
