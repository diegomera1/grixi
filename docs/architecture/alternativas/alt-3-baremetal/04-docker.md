# Alternativa 3 — Docker Compose

> El Docker Compose es prácticamente **idéntico al de la Alternativa 2**. Esta versión incluye optimizaciones específicas para Linux dedicado.

---

## Diferencias vs Alt. 2

| Aspecto | Alt. 2 (macOS) | Alt. 3 (Linux) |
|---|---|---|
| **PostgreSQL shm_size** | 2g | 4g (más RAM disponible) |
| **Redis maxmemory** | 4gb | 8gb |
| **Node Exporter** | No incluido | ✅ Monitoreo de hardware |
| **Loki** | No incluido | ✅ Aggregación de logs |
| **Caddy** | Sin ACME (via Tunnel) | Con Let's Encrypt (IP pública) |
| **Tunnel** | ✅ cloudflared | No necesario (IP pública) |

## Docker Compose

```yaml
# docker-compose.yml — Bare Metal (Linux)
version: '3.9'

services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on: [app]
    networks: [grixi]

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
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    networks: [grixi]

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
    shm_size: '4g'
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U grixi"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [grixi]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 8gb
      --maxmemory-policy allkeys-lru
      --appendonly yes
    volumes: [redisdata:/data]
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
    networks: [grixi]

  minio:
    image: minio/minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes: [miniodata:/data]
    networks: [grixi]

  worker:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.worker
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://grixi:${DB_PASSWORD}@postgres:5432/grixi
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    depends_on: [postgres, redis]
    networks: [grixi]

  # ─── MONITORING STACK ───
  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheusdata:/prometheus
    networks: [grixi]

  grafana:
    image: grafana/grafana-oss:latest
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes: [grafanadata:/var/lib/grafana]
    networks: [grixi]

  loki:
    image: grafana/loki:latest
    restart: unless-stopped
    volumes: [lokidata:/loki]
    networks: [grixi]

  node-exporter:
    image: prom/node-exporter:latest
    restart: unless-stopped
    pid: host
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--path.rootfs=/rootfs'
    networks: [grixi]

  uptime-kuma:
    image: louislam/uptime-kuma:1
    restart: unless-stopped
    volumes: [uptimekuma:/app/data]
    networks: [grixi]

volumes:
  pgdata:
  redisdata:
  miniodata:
  caddy_data:
  prometheusdata:
  grafanadata:
  lokidata:
  uptimekuma:

networks:
  grixi:
    driver: bridge
```
