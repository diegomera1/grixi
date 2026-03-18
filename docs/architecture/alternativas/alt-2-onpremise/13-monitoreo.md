# Alternativas 2 y 3 — Monitoreo: Prometheus + Grafana + Alertas

> Configuración completa de observability: prometheus.yml, dashboards de Grafana, y alertas.

---

## 1. Prometheus Config

```yaml
# config/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/alerts.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

scrape_configs:
  # Node Exporter (hardware: CPU, RAM, disk, network)
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  # PostgreSQL
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Caddy
  - job_name: 'caddy'
    static_configs:
      - targets: ['caddy:2019']

  # Next.js (custom metrics endpoint)
  - job_name: 'nextjs'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/api/metrics'
```

## 2. Alertas

```yaml
# config/alerts.yml
groups:
  - name: infrastructure
    rules:
      - alert: HighCPU
        expr: 100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 85
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "CPU usage > 85% for 5 minutes"

      - alert: HighMemory
        expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 > 90
        for: 5m
        labels: { severity: critical }
        annotations:
          summary: "Memory usage > 90%"

      - alert: DiskSpaceLow
        expr: (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 > 85
        for: 10m
        labels: { severity: warning }
        annotations:
          summary: "Disk usage > 85%"

      - alert: PostgreSQLDown
        expr: pg_up == 0
        for: 1m
        labels: { severity: critical }
        annotations:
          summary: "PostgreSQL is down"

      - alert: RedisDown
        expr: redis_up == 0
        for: 1m
        labels: { severity: critical }
        annotations:
          summary: "Redis is down"

      - alert: HighPostgresConnections
        expr: pg_stat_activity_count > 150
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "PostgreSQL connections > 150 (max 200)"

      - alert: SlowQueries
        expr: rate(pg_stat_activity_max_tx_duration{datname="grixi"}[5m]) > 30
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "Slow queries detected (> 30s)"

  - name: raid  # Solo Alt. 3
    rules:
      - alert: RAIDDegraded
        expr: node_md_disks_active < node_md_disks_required
        for: 1m
        labels: { severity: critical }
        annotations:
          summary: "RAID array is degraded — disk failure detected"
```

## 3. Grafana Dashboards

### Dashboard IDs recomendados (importar de grafana.com):

| Dashboard | ID | Qué muestra |
|---|---|---|
| Node Exporter Full | 1860 | CPU, RAM, disco, red del servidor |
| PostgreSQL Database | 9628 | Connections, queries, locks, cache hit |
| Redis Dashboard | 11835 | Memory, commands, keys, connections |
| Docker Containers | 893 | CPU/RAM por container |
| Caddy Monitoring | 15364 | Requests, status codes, latency |

### Dashboard Custom: GRIXI Overview

Métricas clave a incluir:
- **Tenants activos** (query a `organizations WHERE is_active`)
- **Usuarios online** (Socket.io connections)
- **Requests/min** (Caddy metrics)
- **DB queries/sec** (PostgreSQL stats)
- **BullMQ jobs** (pendientes, completados, fallidos)
- **Storage usage** (MinIO metrics por tenant)

## 4. Docker Compose additions

```yaml
  # Añadir a docker-compose.yml
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter
    environment:
      DATA_SOURCE_NAME: "postgresql://grixi:${DB_PASSWORD}@postgres:5432/grixi?sslmode=disable"
    networks: [grixi]

  redis-exporter:
    image: oliver006/redis_exporter
    environment:
      REDIS_ADDR: redis://redis:6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    networks: [grixi]

  alertmanager:
    image: prom/alertmanager:latest
    volumes:
      - ./config/alertmanager.yml:/etc/alertmanager/alertmanager.yml
    networks: [grixi]
```
