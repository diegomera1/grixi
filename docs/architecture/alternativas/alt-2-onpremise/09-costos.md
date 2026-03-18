# Alternativa 2 — Costos

> Desglose completo de inversión inicial y costos recurrentes.

---

## Inversión Inicial (One-Time)

| Concepto | Costo |
|---|---|
| Mac Studio M4 Max 64 GB / 1 TB | $2,499 |
| UPS APC 1500VA | $250 |
| SSD Externo Samsung T7 2 TB | $150 |
| Cable Ethernet Cat 6a | $10 |
| **Total** | **~$2,910** |

## Costos Recurrentes

| Servicio | Costo/mes |
|---|---|
| **Cloudflare Pro** (CDN + WAF + DNS + Tunnel) | $20 |
| **GitHub Teams** (3 users) | $12 |
| **Electricidad** (Mac Studio ~60W 24/7) | ~$6 |
| **Cloudflare R2** (backups offsite ~20GB) | ~$2 |
| **Dominio** grixi.com (anual/12) | ~$1 |
| **Total** | **~$41/mes** |

## Comparación con Arquitectura Actual

| Concepto | Actual | On-Premise |
|---|---|---|
| Hosting (Vercel) | $20/mes | $0 |
| Backend (Supabase) | $140/mes | $0 |
| Cloudflare | $20/mes | $20/mes |
| GitHub | $12/mes | $12/mes |
| Electricidad | $0 | ~$6/mes |
| R2 backups | $0 | ~$2/mes |
| Hardware (amortizado 36 meses) | $0 | ~$81/mes |
| **Total** | **$192/mes** | **~$121/mes** (con amortización) |
| **Total sin amortización** | $192/mes | **~$41/mes** |

## Break-Even

```
Ahorro mensual: $192 - $41 = $151/mes
Inversión: $2,910
Break-even: $2,910 ÷ $151 = ~19 meses
```

> Después del mes 19, el ahorro es de **~$151/mes** — **$1,812/año**.

## Proyección a 3 Años

| Concepto | Actual (3 años) | On-Premise (3 años) |
|---|---|---|
| Costo total | $6,912 | $2,910 + $1,476 = **$4,386** |
| Ahorro total | — | **$2,526** |
