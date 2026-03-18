# Alternativa 2 — Cloudflare Tunnel

> Cloudflare Tunnel expone el Mac Studio al internet sin abrir puertos en el router. Zero-trust networking.

---

## 1. ¿Cómo Funciona?

```
SIN Tunnel:
  Usuario → DNS → Tu IP pública → Puerto 443 abierto → Mac Studio
  Riesgo: IP expuesta, puertos abiertos, ataques directos

CON Tunnel:
  Usuario → Cloudflare Edge → Tunnel (encriptado) → Mac Studio
  ✅ IP oculta, 0 puertos abiertos, WAF protege
```

El tunnel establece una **conexión outbound** desde el Mac Studio a Cloudflare. No se necesita abrir ningún puerto.

---

## 2. Configuración

### Crear el Tunnel

```bash
# Instalar cloudflared
brew install cloudflare/cloudflare/cloudflared

# Autenticar
cloudflared tunnel login

# Crear tunnel
cloudflared tunnel create grixi-tunnel

# Esto genera un archivo de credenciales:
# ~/.cloudflared/<tunnel-id>.json
```

### config.yml

```yaml
# config/cloudflared/config.yml
tunnel: grixi-tunnel
credentials-file: /etc/cloudflared/<tunnel-id>.json

ingress:
  # Frontend
  - hostname: app.grixi.com
    service: http://caddy:443
    originRequest:
      noTLSVerify: true

  # Wildcard para tenants
  - hostname: "*.grixi.app"
    service: http://caddy:443
    originRequest:
      noTLSVerify: true

  # Monitoring (acceso restringido)
  - hostname: monitor.grixi.com
    service: http://grafana:3000

  # Uptime Kuma
  - hostname: status.grixi.com
    service: http://uptime-kuma:3001

  # MinIO console (acceso restringido)
  - hostname: storage.grixi.com
    service: http://minio:9001

  # Catch-all
  - service: http_status:404
```

### DNS en Cloudflare

```
# Se configuran automáticamente al crear routes:
cloudflared tunnel route dns grixi-tunnel app.grixi.com
cloudflared tunnel route dns grixi-tunnel "*.grixi.app"
cloudflared tunnel route dns grixi-tunnel monitor.grixi.com
```

Esto crea CNAMEs que apuntan al tunnel:
```
app.grixi.com       CNAME   <tunnel-id>.cfargotunnel.com
*.grixi.app         CNAME   <tunnel-id>.cfargotunnel.com
monitor.grixi.com   CNAME   <tunnel-id>.cfargotunnel.com
```

---

## 3. Docker Compose (Tunnel como servicio)

```yaml
# Incluido en docker-compose.yml
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
```

---

## 4. Seguridad del Tunnel

| Protección | Detalle |
|---|---|
| **Zero puertos abiertos** | El tunnel es una conexión outbound |
| **IP oculta** | La IP del Mac Studio **nunca** se expone |
| **WAF activo** | Todo el tráfico pasa por Cloudflare WAF antes de llegar al tunnel |
| **DDoS protection** | Cloudflare absorbe ataques |
| **TLS end-to-end** | Tunnel encriptado + Caddy HTTPS |
| **Access policies** | Cloudflare Access para endpoints sensibles (monitor, storage) |
