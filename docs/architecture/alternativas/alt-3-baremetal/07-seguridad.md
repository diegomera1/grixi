# Alternativa 3 — Seguridad Bare Metal

> 6 capas de seguridad — una más que las alternativas cloud, gracias al control directo del OS.

---

## Modelo Defense-in-Depth

```
Capa 6: RED/CDN      → Cloudflare WAF + DDoS + Bot Protection + Access
Capa 5: FIREWALL OS  → UFW (solo CF IPs) + fail2ban (SSH brute-force)
Capa 4: PROXY        → Caddy (HTTPS, headers, rate limiting)
Capa 3: APLICACIÓN   → Zod validation + CSRF + helmet headers
Capa 2: AUTH         → Better Auth (OAuth, MFA, sessions en Redis)
Capa 1: DATOS        → PostgreSQL RLS (policies multi-tenant)
```

> La capa adicional (Capa 5: Firewall OS) provee hardening a nivel de sistema operativo que no existe en las alternativas cloud.

---

## Hardening del Servidor

### SSH Seguro

```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no     # Solo key-based
PubkeyAuthentication yes
MaxAuthTries 3
AllowUsers grixi              # Solo este usuario
Port 22                       # Considerar cambiar a puerto no-estándar
```

### Actualizaciones Automáticas

```bash
# Instalar unattended-upgrades
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Configurar para security updates automáticos
# /etc/apt/apt.conf.d/50unattended-upgrades
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
```

### Auditoría

```bash
# Instalar auditd para logging de sistema
sudo apt install auditd

# Reglas de auditoría para cambios en archivos sensibles
sudo auditctl -w /etc/passwd -p wa -k passwd_changes
sudo auditctl -w /etc/shadow -p wa -k shadow_changes
sudo auditctl -w /etc/ssh/sshd_config -p wa -k ssh_config
```

---

## Monitoreo de Seguridad

| Herramienta | Qué monitorea |
|---|---|
| **Cloudflare WAF** | Ataques L7, SQL injection, XSS |
| **fail2ban** | Intentos de SSH brute-force |
| **UFW logs** | Tráfico bloqueado |
| **auditd** | Cambios en archivos del sistema |
| **Prometheus + Grafana** | Métricas de CPU, RAM, disco, red |
| **Loki** | Logs centralizados de todos los servicios |
| **Uptime Kuma** | Disponibilidad de endpoints |
