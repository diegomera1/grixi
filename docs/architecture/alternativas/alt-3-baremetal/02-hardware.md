# Alternativa 3 — Hardware: Servidores Hetzner

> Opciones de servidores dedicados (bare metal) en Hetzner: specs, precios, y recomendaciones.

---

## 1. ¿Por Qué Hetzner?

| Factor | Hetzner | AWS/GCP/Azure | OVH |
|---|---|---|---|
| **Precio/rendimiento** | ✅ Imbatible | ❌ 5-10x más caro | ⚠️ Competitivo |
| **Bare metal real** | ✅ Hardware dedicado | ❌ VMs (compartido) | ✅ Bare metal |
| **Ubicación** | Alemania + Finlandia | Global | Europa + NA |
| **DDoS incluido** | ✅ | ❌ (extra) | ✅ |
| **Red** | 1 Gbps unmetered | ❌ Egress costoso | 1-3 Gbps |
| **Setup rápido** | ~1-2 horas | Minutos (VM) | ~1-24 horas |
| **Soporte** | Bueno (ticket) | Enterprise ($$) | Variable |

---

## 2. Servidores Recomendados

### Opción Económica: AX42

| Componente | Especificación |
|---|---|
| **CPU** | AMD Ryzen 7 7700 — 8 cores / 16 threads @ 3.8 GHz |
| **RAM** | 64 GB DDR5 |
| **Storage** | 2 × 512 GB NVMe SSD |
| **Red** | 1 Gbps unmetered (hasta 309 TB/mes) |
| **DDoS** | Incluido |
| **Precio** | **~€57/mes (~$62 USD)** |
| **Setup fee** | ~€269 (one-time) |

### ⭐ Opción Recomendada: AX52

| Componente | Especificación |
|---|---|
| **CPU** | AMD Ryzen 7 7700 — 8 cores / 16 threads @ 3.8 GHz |
| **RAM** | 64 GB DDR5 |
| **Storage** | 2 × 1 TB NVMe SSD |
| **Red** | 1 Gbps unmetered |
| **DDoS** | Incluido |
| **Precio** | **~€67/mes (~$73 USD)** |
| **Setup fee** | ~€269 (one-time) |

### Opción Premium: AX102

| Componente | Especificación |
|---|---|
| **CPU** | AMD Ryzen 9 7950X3D — 16 cores / 32 threads @ 4.2 GHz |
| **RAM** | 128 GB DDR5 |
| **Storage** | 2 × 1.92 TB NVMe SSD (3.84 TB) |
| **Red** | 1 Gbps unmetered |
| **DDoS** | Incluido |
| **Precio** | **~€107-152/mes (~$115-165 USD)** |
| **Setup fee** | ~€269 (one-time) |

---

## 3. Comparación de Opciones

| | AX42 | AX52 ⭐ | AX102 |
|---|---|---|---|
| **Cores** | 8 | 8 | 16 |
| **RAM** | 64 GB | 64 GB | 128 GB |
| **Storage** | 1 TB | 2 TB | 3.84 TB |
| **Precio** | €57/mes | €67/mes | €107-152/mes |
| **Tenants** | 1-10 | 1-20 | 1-50+ |
| **Usuarios** | ~200 | ~500 | ~1000+ |

> [!TIP]
> **El AX52 es el sweet spot.** 2 TB NVMe permite RAID 1 (mirror) con 1 TB útil — protección contra fallo de disco. 64 GB DDR5 es más que suficiente para 20 tenants.

---

## 4. Comparación vs Mac Studio (Alt. 2)

| Aspecto | Mac Studio M4 Max | Hetzner AX52 |
|---|---|---|
| **CPU** | 16 cores (ARM, ST excelente) | 8 cores/16 threads (x86, 3D V-Cache) |
| **RAM** | 64 GB unified | 64 GB DDR5 |
| **Storage** | 1 TB NVMe | 2 × 1 TB NVMe (RAID 1 posible) |
| **Red** | Tu fibra | 1 Gbps unmetered |
| **Energía** | Tu electricidad + UPS | Datacenter (generadores) |
| **Uptime** | Sin SLA | ~99.9% |
| **Costo mensual** | ~$41 | ~$73 + $20 CF + $12 GH = **$105** |
| **Costo inicial** | $2,900 | ~$300 (setup fee) |
| **3 años total** | $4,386 | $4,080 |

> Los costos a 3 años son similares, pero el bare metal ofrece **confiabilidad de datacenter**.

---

## 5. Setup Inicial

```bash
# 1. Ordenar servidor en robot.hetzner.com
# 2. Instalar Ubuntu 24.04 LTS (Installimage o Rescue)
# 3. Primer acceso SSH
ssh root@xxx.xxx.xxx.xxx

# 4. Hardening básico
apt update && apt upgrade -y
adduser grixi
usermod -aG sudo grixi
# (configurar SSH key auth, deshabilitar password)

# 5. Instalar Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker grixi

# 6. Instalar Coolify
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# 7. Configurar RAID 1 (opcional pero recomendado)
mdadm --create /dev/md0 --level=1 --raid-devices=2 /dev/nvme0n1p1 /dev/nvme1n1p1
```
