---
description: Cómo gestionar el perfil de usuario, avatar y preferencias en GRIXI
---

# Gestión de Perfil de Usuario

## Ruta

`/configuracion?tab=perfil` → `app/routes/configuracion/perfil.tsx`

## Funcionalidades

### 1. Editar nombre

El nombre se actualiza via `supabase.auth.admin.updateUserById()` (admin client).
Se guarda en `auth.users.user_metadata.full_name`.

### 2. Subir avatar

**Flujo:**
1. Usuario selecciona imagen (max 2MB, jpg/png/webp)
2. Frontend envía como `multipart/form-data` al action
3. Action sube a R2: `avatars/{userId}/avatar.{ext}`
4. URL pública: `https://assets.grixi.ai/avatars/{userId}/avatar.{ext}`
5. Se actualiza `auth.users.user_metadata.avatar_url`

**R2 Bucket:** `grixi-assets` (binding: `ASSETS_BUCKET`)

### 3. Selector de Tema

Opciones: `light`, `dark`, `system`

**Persistencia:**
- Cookie `grixi_theme` → fast-path para SSR (evita flash)
- DB `user_preferences` → persistencia cross-device

**Flujo:**
1. Usuario selecciona tema
2. Action escribe en `user_preferences` (key: `theme`)
3. Action setea cookie `grixi_theme`
4. Root loader lee cookie para SSR inmediato

### 4. Historial de Sesiones

Datos de `login_history`:
- Browser, OS, tipo de dispositivo
- IP address
- Timestamp

Se registra automáticamente en `auth.callback.tsx`.

## Archivos Relacionados

- `app/routes/configuracion/perfil.tsx` — UI + action
- `app/routes/auth.callback.tsx` — login recording
- `app/lib/audit.ts` — audit events + parseDeviceInfo
- `workers/app.ts` — security headers + R2 binding
