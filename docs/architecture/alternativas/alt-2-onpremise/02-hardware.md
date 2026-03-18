# Alternativa 2 — Hardware: Mac Studio M4 Max

> Especificaciones del servidor, alternativas, y accesorios necesarios.

---

## 1. Configuración Recomendada

| Componente | Especificación |
|---|---|
| **Equipo** | Apple Mac Studio (2025) |
| **Chip** | M4 Max — 16-core CPU, 40-core GPU |
| **RAM** | 64 GB Unified Memory |
| **Storage** | 1 TB NVMe SSD |
| **Conectividad** | Thunderbolt 5, HDMI, 10Gb Ethernet, Wi-Fi 6E |
| **Dimensiones** | 19.7 × 19.7 × 9.4 cm |
| **Peso** | ~2.7 kg |
| **Precio** | **~$2,499 USD** |

---

## 2. ¿Por Qué Mac Studio M4 Max?

| Factor | Mac Studio | Servidor x86 (NUC/Tower) |
|---|---|---|
| **Performance/Watt** | ~60W bajo carga → **~$5-8/mes eléctrico** | 100-400W → $15-60/mes |
| **Single-core** | M4 Max líder en single-thread | Bueno (Intel/AMD) |
| **64 GB RAM** | Unified (CPU+GPU comparten) | DDR5 separada |
| **Ruido** | Prácticamente inaudible | Variable (puede ser ruidoso) |
| **Tamaño** | 19.7 cm² — cabe en un escritorio | Variable (algunos son grandes) |
| **Docker** | OrbStack o Colima (ARM nativo) | Docker nativo (x86) |
| **Garantía** | AppleCare+ 3 años ($179) | Variable (1-2 años) |
| **Ecosistema** | macOS, Xcode, dev iOS posible | Linux headless |

---

## 3. Alternativas de Hardware

### Opciones Mac Studio

| Configuración | RAM | SSD | Precio |
|---|---|---|---|
| M4 Max 14C/32GPU, 36GB, 512GB | 36 GB | 512 GB | $1,999 |
| **M4 Max 16C/40GPU, 64GB, 1TB** ⭐ | **64 GB** | **1 TB** | **$2,499** |
| M4 Max 16C/40GPU, 128GB, 1TB | 128 GB | 1 TB | $2,899 |
| M4 Max 16C/40GPU, 128GB, 4TB | 128 GB | 4 TB | $3,499 |

### Opciones Más Económicas

| Equipo | Chip | RAM | SSD | Precio |
|---|---|---|---|---|
| **Mac Mini M4 Pro** | M4 Pro 14C | 48 GB | 1 TB | ~$1,499 |
| Mac Mini M4 Pro | M4 Pro 14C | 24 GB | 512 GB | ~$999 |
| Beelink SER8 | Ryzen 9 8945HS | 32 GB | 1 TB | ~$550 |
| Intel NUC 14 Pro | Core Ultra 9 | 64 GB | 2 TB | ~$1,200 |

> [!TIP]
> **Opción económica:** El **Mac Mini M4 Pro 48GB** ($1,499) es **suficiente** para 1-10 tenants. Upgrade al Mac Studio cuando necesites más potencia.

---

## 4. Accesorios Necesarios

| Accesorio | Modelo Sugerido | Precio | Por Qué |
|---|---|---|---|
| **UPS** | APC Back-UPS Pro 1500VA | ~$250 | Protección contra cortes eléctricos. ~30 min de autonomía |
| **SSD Externo** | Samsung T7 Shield 2TB | ~$150 | Backups locales cifrados |
| **Cable Ethernet** | Cat 6a | ~$10 | Conexión cableada al router |
| **AppleCare+** | 3 años | $179 | Garantía extendida (opcional) |

### Presupuesto Total

| Concepto | Costo |
|---|---|
| Mac Studio M4 Max 64GB / 1TB | $2,499 |
| UPS | $250 |
| SSD Backup | $150 |
| Cable Ethernet | $10 |
| **Total** | **~$2,910** |

---

## 5. Requisitos de Infraestructura

| Requisito | Mínimo | Recomendado |
|---|---|---|
| **Internet** | 50 Mbps fibra | 100+ Mbps fibra simétrica |
| **Electricidad** | Toma con tierra | Toma con tierra + UPS |
| **Espacio** | 20 × 20 cm de escritorio | Estante dedicado con ventilación |
| **Temperatura** | < 35°C | 18-27°C (climatizado) |
| **Acceso físico** | Cuando sea necesario | Acceso restringido (seguridad) |

---

## 6. Capacidad Estimada

| Carga | Mac Studio M4 Max 64GB |
|---|---|
| PostgreSQL (con datos) | ~10-15 GB RAM |
| Redis | ~2-4 GB RAM |
| Next.js (standalone) | ~500 MB - 1 GB RAM |
| MinIO | ~500 MB RAM |
| Docker overhead | ~2 GB RAM |
| Grafana + Prometheus | ~1 GB RAM |
| **Total en uso** | ~17-24 GB |
| **Disponible** | ~40-47 GB (buffer enorme) |
| **Usuarios concurrentes** | ~200-500 sin problemas |
| **Tenants** | 1-20 cómodamente |
