# Alternativa 3 — Networking, Firewall y DNS

> A diferencia de Alt. 2 (Tunnel), el bare metal tiene IP pública directa. Se protege con Cloudflare Proxy + UFW + fail2ban.

---

## 1. Modelo de Red

```
Alt. 2 (On-Premise):
  Mac Studio → Cloudflare Tunnel (outbound) → Cloudflare Edge → Usuario
  IP oculta: ✅ (tunnel)
  Puertos abiertos: 0

Alt. 3 (Bare Metal):  
  Hetzner Server ← Cloudflare Proxy ← Usuario
  IP oculta: ✅ (Cloudflare proxied records)
  Puertos abiertos: 80, 443 (solo tráfico de Cloudflare)
```

---

## 2. Firewall (UFW)

```bash
# Denegar todo por defecto
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir SSH (solo desde tu IP)
sudo ufw allow from YOUR_IP to any port 22

# Permitir HTTPS solo desde Cloudflare IPs
# https://www.cloudflare.com/ips-v4/
sudo ufw allow from 173.245.48.0/20 to any port 443
sudo ufw allow from 103.21.244.0/22 to any port 443
sudo ufw allow from 103.22.200.0/22 to any port 443
sudo ufw allow from 103.31.4.0/22 to any port 443
sudo ufw allow from 141.101.64.0/18 to any port 443
sudo ufw allow from 108.162.192.0/18 to any port 443
sudo ufw allow from 190.93.240.0/20 to any port 443
sudo ufw allow from 188.114.96.0/20 to any port 443
sudo ufw allow from 197.234.240.0/22 to any port 443
sudo ufw allow from 198.41.128.0/17 to any port 443
sudo ufw allow from 162.158.0.0/15 to any port 443
sudo ufw allow from 104.16.0.0/13 to any port 443
sudo ufw allow from 104.24.0.0/14 to any port 443
sudo ufw allow from 172.64.0.0/13 to any port 443
sudo ufw allow from 131.0.72.0/22 to any port 443

# Activar
sudo ufw enable
```

---

## 3. fail2ban (Protección SSH)

```ini
# /etc/fail2ban/jail.local
[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 3600
findtime = 600

[caddy-auth]
enabled = true
port = 443
filter = caddy-auth
logpath = /var/log/caddy/access.log
maxretry = 5
bantime = 3600
```

---

## 4. DNS en Cloudflare

```
# Registros DNS — todos proxied (☁️ naranja)
app.grixi.com       A      xxx.xxx.xxx.xxx   ☁️ Proxied
*.grixi.app         A      xxx.xxx.xxx.xxx   ☁️ Proxied
monitor.grixi.com   A      xxx.xxx.xxx.xxx   ☁️ Proxied
admin.grixi.com     A      xxx.xxx.xxx.xxx   ☁️ Proxied

# API de Supabase (si se usara — no aplica en esta alt)
# Todos los registros proxied: la IP real NUNCA se expone
```

> [!IMPORTANT]
> **Todos los registros deben ser Proxied (☁️).** Si un registro es DNS-only (☁️ gris), la IP real del servidor se expone. NUNCA usar registros no-proxied para servicios públicos.

---

## 5. SSL/TLS

| Configuración | Valor |
|---|---|
| **Cloudflare SSL mode** | Full (Strict) |
| **Caddy** | Let's Encrypt automático (o Cloudflare origin certs) |
| **End-to-end** | ✅ HTTPS en todo el camino |

```
Usuario → HTTPS → Cloudflare Edge → HTTPS → Caddy → HTTP → Next.js (internal)
```

---

## 6. Cloudflare Access (Endpoints Sensibles)

Para dashboard de monitoreo y administración:

```
monitor.grixi.com → Cloudflare Access (require email OTP)
admin.grixi.com   → Cloudflare Access (require email OTP)
storage.grixi.com → Cloudflare Access (require email OTP)
```

Esto añade autenticación a nivel de CDN **antes** de que el request llegue al servidor.
