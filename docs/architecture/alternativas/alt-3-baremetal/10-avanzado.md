# Alternativa 3 — Avanzado: RAID, Latencia, Scaling, y Provisioning

> Temas específicos de bare metal cloud que no aplican al on-premise local.

---

## 1. RAID 1 — Monitoreo y Procedimientos

### Setup RAID 1

```bash
# Al instalar Ubuntu en Hetzner, configurar RAID 1 software
mdadm --create /dev/md0 --level=1 --raid-devices=2 /dev/nvme0n1p1 /dev/nvme1n1p1
mkfs.ext4 /dev/md0
mount /dev/md0 /data

# Persistir en fstab
echo '/dev/md0 /data ext4 defaults 0 2' >> /etc/fstab
```

### Monitoreo de RAID

```bash
# Estado del RAID
cat /proc/mdstat
# Personalities : [raid1]
# md0 : active raid1 nvme1n1p1[1] nvme0n1p1[0]
#       976762880 blocks super 1.2 [2/2] [UU]  ← UU = ambos discos OK

# Script de alerta
#!/bin/bash
# /opt/grixi/scripts/check-raid.sh
STATUS=$(cat /proc/mdstat | grep -c '\[UU\]')
if [ "$STATUS" -eq 0 ]; then
  curl -X POST "https://hooks.slack.com/..." \
    -d '{"text":"🚨 RAID DEGRADED — disco fallido en servidor GRIXI"}'
fi
```

### Cron de monitoreo

```bash
# Cada 5 minutos
*/5 * * * * /opt/grixi/scripts/check-raid.sh
```

### Procedimiento de reemplazo de disco

```bash
# 1. Identificar disco fallido
mdadm --detail /dev/md0

# 2. Marcar como fallido y remover
mdadm /dev/md0 --fail /dev/nvme1n1p1
mdadm /dev/md0 --remove /dev/nvme1n1p1

# 3. Solicitar reemplazo a Hetzner (ticket en Robot)
# Hetzner reemplaza el disco físicamente (~1-4 horas)

# 4. Agregar nuevo disco al RAID
mdadm /dev/md0 --add /dev/nvme1n1p1

# 5. Verificar reconstrucción
watch cat /proc/mdstat
# El rebuild toma ~30-60 min para 1 TB NVMe
```

---

## 2. Latencia LATAM ↔ Europa

### Problema

Hetzner (Falkenstein, Alemania) → Ecuador: **~150-180ms** de latencia base.

### Mitigación

| Estrategia | Reducción | Cómo |
|---|---|---|
| **Cloudflare CDN** | Assets: ~20ms | JS, CSS, fonts, imágenes servidos desde edge PoP más cercano |
| **Workers KV cache** | API data: ~30ms | Datos frecuentes cacheados en el PoP de Ecuador |
| **Realtime: WebSocket** | Constante | Una vez conectado, la latencia del WS es fija |
| **Optimistic updates** | Percibido: 0ms | UI se actualiza antes de confirmar el server |
| **Prefetch/preload** | Navegación: ~0ms | `<link rel="prefetch">` en links visibles |

### Flujo Optimizado

```
Sin optimizar:
  Click → 180ms → Server → 50ms DB → 180ms → Render
  Total: ~410ms (perceptible)

Optimizado:
  Click → Optimistic UI (0ms) + 180ms → Server → 50ms DB → 180ms → Confirm
  Percibido: ~0ms (el usuario ve el cambio inmediato)
  
Assets:
  Request → Cloudflare PoP Ecuador (~20ms) → Asset cached
  No toca Hetzner para assets estáticos
```

### Hetzner Helsinki (Alternativa)

| Datacenter | Latencia a Ecuador | Precio |
|---|---|---|
| Falkenstein (DE) | ~150-180ms | Estándar |
| Helsinki (FI) | ~180-200ms | Estándar |
| **Hetzner US (planned)** | ~80-100ms | TBD |

> Hetzner no tiene datacenter en LATAM. Para latencia < 100ms, considerar OVH (Vinhedo, Brasil) o DigitalOcean (NYC).

---

## 3. Scaling Horizontal (2do Servidor)

### Cuándo agregar un 2do servidor

| Señal | Umbral |
|---|---|
| CPU sostenido > 80% | Sí |
| RAM > 90% | Sí |
| > 30 tenants | Considerar |
| > 500 users concurrentes | Considerar |
| Necesidad de HA (99.9%+) | Sí |

### Arquitectura con 2 Servidores

```
Cloudflare (Load Balancer via DNS)
    │
    ├── Server 1 (Primary)
    │   ├── Next.js App
    │   ├── PostgreSQL (Primary)
    │   └── Redis (Primary)
    │
    └── Server 2 (Replica)
        ├── Next.js App
        ├── PostgreSQL (Replica — streaming replication)
        └── Redis (Replica)
```

### PostgreSQL Streaming Replication

```ini
# Server 1 (Primary) — postgresql.conf
wal_level = replica
max_wal_senders = 5
wal_keep_size = '1GB'

# Server 2 (Replica) — postgresql.conf
primary_conninfo = 'host=server1-ip port=5432 user=replicator password=xxx'
hot_standby = on
```

### Costo de 2 servidores

| Config | Costo/mes |
|---|---|
| 1× AX52 (actual) | ~$108 |
| 2× AX52 (HA) | ~$181 |
| 1× AX52 + 1× AX42 (asiétrico) | ~$170 |

---

## 4. Automated Provisioning (Ansible)

### Playbook de Setup

```yaml
# ansible/setup-server.yml
---
- hosts: grixi-servers
  become: yes
  roles:
    - base-hardening    # UFW, fail2ban, SSH, updates
    - docker            # Install Docker + Compose
    - coolify           # Install Coolify PaaS
    - monitoring        # Prometheus, Grafana, Node Exporter
    - raid              # Configure RAID 1 (if applicable)
    - backup-scripts    # Install backup cron jobs

- hosts: grixi-servers
  tasks:
    - name: Copy docker-compose
      copy: src=docker-compose.yml dest=/opt/grixi/

    - name: Copy configs
      copy: src=config/ dest=/opt/grixi/config/

    - name: Start services
      command: docker compose up -d
      args:
        chdir: /opt/grixi
```

### Inventario

```ini
# ansible/inventory.ini
[grixi-servers]
primary ansible_host=xxx.xxx.xxx.xxx ansible_user=grixi
# replica ansible_host=yyy.yyy.yyy.yyy ansible_user=grixi  # Futuro
```

### Reproducir desde cero

```bash
# Si el servidor muere, setup completo en ~30 minutos:
ansible-playbook -i inventory.ini setup-server.yml
# + restaurar último backup de R2 (~30 min más)
# Total RTO: ~1 hora
```

---

## 5. Hetzner Robot & Rescue

### KVM Console

```
Hetzner Robot → Server → KVM → Acceso directo al servidor
Útil cuando: SSH no funciona, boot falla, necesitas rescue
```

### Rescue System

```bash
# Activar rescue system en Robot
# 1. Robot → Server → Rescue → Activar (Linux 64-bit)
# 2. Reboot server
# Server arranca en rescue mode con root password temporal

# Desde rescue, puedes:
mount /dev/md0 /mnt           # Montar RAID
chroot /mnt                   # Acceder al filesystem
# ... reparar lo que sea necesario
```

---

## 6. Hetzner Storage Box (Backup Alternativo)

| Servicio | Capacidad | Precio/mes | Protocolo |
|---|---|---|---|
| BX11 | 1 TB | €3.81 | SFTP, SCP, rsync, Samba |
| BX21 | 5 TB | €9.52 | SFTP, SCP, rsync, Samba |
| Cloudflare R2 | Pay-as-go | ~$0.015/GB/mes | S3 API |

```bash
# Backup a Hetzner Storage Box
rsync -avz /opt/grixi/backups/ \
  u123456@u123456.your-storagebox.de:/grixi-backups/

# Más barato que R2 para > 250 GB de backups
```
