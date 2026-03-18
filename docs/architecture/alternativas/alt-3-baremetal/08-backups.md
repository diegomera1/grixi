# Alternativa 3 — Backups y Disaster Recovery

> Estrategia de backups reforzada con RAID 1 y WAL shipping para bare metal.

---

## 1. RAID 1 (Mirror de Discos)

El AX52 viene con **2 × 1 TB NVMe**. Se configura RAID 1 (mirror) para redundancia:

```bash
# Crear RAID 1
mdadm --create /dev/md0 --level=1 --raid-devices=2 /dev/nvme0n1p1 /dev/nvme1n1p1

# Si un disco falla, el servidor sigue operando con el otro
# Monitorear salud del RAID:
cat /proc/mdstat
```

| Sin RAID | Con RAID 1 |
|---|---|
| Un disco falla → **datos perdidos** | Un disco falla → **servidor sigue operando** |
| 2 TB útiles | 1 TB útil (mirror) |

---

## 2. Estrategia de Backups

### Misma Estrategia 3-2-1 que Alt. 2

| Regla | Implementación |
|---|---|
| **3 copias** | Original (RAID 1) + Local backup + Cloudflare R2 |
| **2 medios** | NVMe RAID + R2 cloud |
| **1 offsite** | Cloudflare R2 |

### pg_dump + rclone (cada 6 horas)

```bash
#!/bin/bash
# /opt/grixi/scripts/backup.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/grixi/backups"

# PostgreSQL dump
docker exec postgres pg_dump -U grixi --format=custom grixi > \
  "$BACKUP_DIR/grixi_$TIMESTAMP.dump"

# Comprimir
gzip "$BACKUP_DIR/grixi_$TIMESTAMP.dump"

# Subir a R2
rclone copy "$BACKUP_DIR/grixi_$TIMESTAMP.dump.gz" r2:grixi-backups/daily/

# MinIO files backup (weekly)
if [ $(date +%u) -eq 7 ]; then
  rclone sync /opt/grixi/minio-data r2:grixi-backups/minio/
fi

# Cleanup: borrar backups locales > 7 días
find "$BACKUP_DIR" -name "*.dump.gz" -mtime +7 -delete

echo "[$(date)] Backup completed: grixi_$TIMESTAMP" >> /var/log/grixi-backup.log
```

### WAL Archiving (Opcional — RPO de Minutos)

Para recovery más granular (point-in-time a nivel de minuto):

```ini
# PostgreSQL conf
archive_mode = on
archive_command = 'rclone copy %p r2:grixi-backups/wal/%f'
```

---

## 3. Disaster Recovery Comparativo

| Escenario | Alt. 2 (On-Premise) | Alt. 3 (Bare Metal) |
|---|---|---|
| **Fallo de 1 disco** | ❌ Datos perdidos (1 SSD) | ✅ RAID 1 — sigue operando |
| **Corrupción de datos** | Restaurar dump (<6h) | Restaurar dump (<6h) o WAL (<1min) |
| **Fallo del servidor** | Comprar Mac (días) | Ordenar nuevo Hetzner (horas) + restore |
| **Corte de luz** | UPS 30 min → shutdown | ❌ N/A — datacenter tiene generadores |
| **Corte de internet** | GRIXI offline | ❌ N/A — 1 Gbps datacenter |
| **RPO** | 6 horas | **Minutos** (con WAL) |
| **RTO** | 24-48 horas | **2-4 horas** |
