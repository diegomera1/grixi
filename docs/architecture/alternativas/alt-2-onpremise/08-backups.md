# Alternativa 2 — Backups y Disaster Recovery

> Estrategia de backups para on-premise: local + offsite + verificación.

---

## 1. Estrategia 3-2-1

| Regla | Implementación |
|---|---|
| **3 copias** | Original (PostgreSQL) + SSD externo + Cloudflare R2 |
| **2 medios** | NVMe interno + SSD/USB externo |
| **1 offsite** | Cloudflare R2 (cloud) |

---

## 2. Backups de PostgreSQL

### Script de Backup Automático

```bash
#!/bin/bash
# scripts/backup-db.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
BACKUP_FILE="$BACKUP_DIR/grixi_$TIMESTAMP.sql.gz"

# Crear backup comprimido
docker exec postgres pg_dump -U grixi grixi | gzip > "$BACKUP_FILE"

# Copiar a SSD externo
cp "$BACKUP_FILE" /Volumes/BackupSSD/postgres/

# Subir a Cloudflare R2 (offsite)
rclone copy "$BACKUP_FILE" r2:grixi-backups/postgres/

# Eliminar backups locales > 7 días
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "✅ Backup completado: $BACKUP_FILE"
```

### Cron Schedule

```bash
# crontab -e
# Backup cada 6 horas
0 */6 * * * /scripts/backup-db.sh >> /logs/backup.log 2>&1

# Backup completo semanal (domingo 3 AM)
0 3 * * 0 /scripts/backup-full.sh >> /logs/backup.log 2>&1
```

---

## 3. Backups de Redis

```bash
# Redis con AOF (append-only file) — recuperación granular
# Ya configurado en docker-compose con --appendonly yes

# Backup periódico del dump
docker exec redis redis-cli -a $REDIS_PASSWORD BGSAVE
cp /docker-volumes/redis/dump.rdb /Volumes/BackupSSD/redis/
```

---

## 4. Backups de MinIO (Archivos)

```bash
# Sincronizar buckets a R2
rclone sync minio:documents r2:grixi-backups/minio/documents
rclone sync minio:avatars r2:grixi-backups/minio/avatars
rclone sync minio:branding r2:grixi-backups/minio/branding
```

---

## 5. Cloudflare R2 como Offsite

```ini
# ~/.config/rclone/rclone.conf
[r2]
type = s3
provider = Cloudflare
access_key_id = xxx
secret_access_key = xxx
endpoint = https://<account-id>.r2.cloudflarestorage.com
```

---

## 6. Disaster Recovery

| Escenario | Acción | RTO |
|---|---|---|
| **Corrupción de datos** | Restaurar pg_dump más reciente (<6h) | ~30 min |
| **Fallo de disco** | Restaurar desde SSD externo | ~1 hora |
| **Fallo del Mac Studio** | Comprar nuevo + restaurar backups desde R2 | ~24-48 horas |
| **Corte de luz** | UPS mantiene 30 min. Si dura más → auto-shutdown limpio | ~5 min recovery |
| **Corte de internet** | GRIXI offline hasta que vuelva la fibra | Variable |

> [!WARNING]
> **RPO (Recovery Point Objective):** Máximo **6 horas** de pérdida de datos (frecuencia de backups). Para RPO más bajo, considerar WAL shipping a R2 (recuperación por minuto).
