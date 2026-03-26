# Google Workspace CLI (`gws`) — Guía de Configuración y Uso

> **Cuenta corporativa:** `dmera@grixi.ai` | **Proyecto GCP:** `grixi-workspace` (Org: `grixi.ai`)

---

## Estado Actual

| Campo | Valor |
|---|---|
| **CLI** | `gws 0.18.1` |
| **Cuenta** | `dmera@grixi.ai` |
| **Proyecto GCP** | `grixi-workspace` (ID: `225748449252`) |
| **Organización** | `grixi.ai` |
| **OAuth Client** | Desktop App "GWS CLI" (`225748449252-jgqqlnubgkl0qirj9e10okogm860n3oj.apps.googleusercontent.com`) |
| **Token** | Válido, cifrado con `keyring` |
| **APIs habilitadas** | 44 |
| **Scopes autorizados** | 43 (incluye Chat ⛔ restricted) |

---

## Servicios Disponibles

| Servicio | Comando de prueba | Status |
|---|---|---|
| 📁 Drive | `gws drive files list --params '{"pageSize": 5}'` | ✅ |
| 📧 Gmail | `gws gmail users messages list --params '{"userId": "me", "maxResults": 5}'` | ✅ |
| 📅 Calendar | `gws calendar events list --params '{"calendarId": "primary", "maxResults": 5}'` | ✅ |
| 💬 Chat | `gws chat spaces list` | ✅ |
| 📄 Docs | `gws docs documents get --params '{"documentId": "<ID>"}'` | ✅ |
| 📊 Sheets | `gws sheets spreadsheets get --params '{"spreadsheetId": "<ID>"}'` | ✅ |
| 🎞️ Slides | `gws slides presentations get --params '{"presentationId": "<ID>"}'` | ✅ |
| ✅ Tasks | `gws tasks tasklists list` | ✅ |
| 👥 Admin Directory | `gws admin directory users list --params '{"domain": "grixi.ai"}'` | ✅ |

---

## Comandos Comunes

### Drive

```bash
# Listar archivos
gws drive files list --params '{"pageSize": 10}' --format table

# Listar unidades compartidas
gws drive drives list --format table

# Listar archivos en un Shared Drive
gws drive files list --params '{
  "corpora": "drive",
  "driveId": "<DRIVE_ID>",
  "supportsAllDrives": true,
  "includeItemsFromAllDrives": true,
  "pageSize": 20
}' --format table

# Buscar archivos por nombre
gws drive files list --params '{"q": "name contains '\''busqueda'\''", "pageSize": 10}' --format table
```

### Gmail

```bash
# Listar mensajes
gws gmail users messages list --params '{"userId": "me", "maxResults": 5}' --format table

# Leer un mensaje específico
gws gmail users messages get --params '{"userId": "me", "id": "<MESSAGE_ID>"}' --format table

# Enviar email (via Gmail API)
gws gmail users messages send --params '{"userId": "me"}' --body '{
  "raw": "<BASE64_ENCODED_EMAIL>"
}'
```

### Chat

```bash
# Listar espacios de chat
gws chat spaces list --format table

# Listar mensajes de un espacio
gws chat spaces messages list --params '{"parent": "spaces/<SPACE_ID>"}' --format table

# Enviar mensaje a un espacio
gws chat spaces messages create --params '{"parent": "spaces/<SPACE_ID>"}' --body '{
  "text": "Hola desde el CLI"
}'
```

### Calendar

```bash
# Listar eventos
gws calendar events list --params '{
  "calendarId": "primary",
  "maxResults": 10,
  "timeMin": "2026-03-01T00:00:00Z"
}' --format table
```

---

## Archivos de Configuración

| Archivo | Ubicación |
|---|---|
| Client Secret (cifrado) | `~/.config/gws/client_secret.json` |
| Credenciales (cifrado) | `~/.config/gws/credentials.enc` |
| Token Cache | `~/.config/gws/token_cache.json` |

---

## Mantenimiento

### Re-autenticación (si el token expira)

```bash
gws auth login
```

### Verificar estado

```bash
gws auth status
```

### Resetear todo (logout completo)

```bash
gws auth logout
gws auth setup --project grixi-workspace --login
```

### Agregar/cambiar scopes

```bash
gws auth logout
gws auth login --scopes "https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/chat.messages,..."
```

---

## Configuración GCP del Proyecto

- **Proyecto:** `grixi-workspace` (ID numérico: `225748449252`)
- **Organización:** `grixi.ai`
- **OAuth Brand:** Interno a la organización (no requiere verificación de Google)
- **OAuth Client Type:** Desktop App
- **Chat App:** Configurada como "GWS CLI" con visibilidad para `dmera@grixi.ai`
- **Consola:** [Google Cloud Console](https://console.cloud.google.com/home?project=grixi-workspace)

---

## Notas Importantes

1. **Scopes restringidos de Chat:** Los scopes `chat.messages`, `chat.delete`, etc. son clasificados como "restricted" por Google. Funcionan porque el OAuth brand es interno a la organización `grixi.ai`.

2. **Shared Drives:** Para acceder a contenido de unidades compartidas, siempre incluir `"supportsAllDrives": true` y `"includeItemsFromAllDrives": true` en los params.

3. **Formato de salida:** Usar `--format table` para vista legible, `--format json` para procesamiento programático.

4. **El CLI NO depende del proyecto `trukolabs`** (cuenta personal). Todo opera exclusivamente bajo `grixi-workspace` de la organización `grixi.ai`.
