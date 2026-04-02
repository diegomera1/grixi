# Módulo: Configuración de Organización

> Estado: ✅ Implementado
> Última actualización: 2026-04-01

## Descripción

Panel de configuración organizacional con tabs para: Equipo, Invitaciones, Roles,
Organización, Auditoría, y Perfil de Usuario. Opera bajo permisos RBAC estrictos.

## Archivos Clave

| Archivo | Descripción |
|---------|-------------|
| `app/routes/configuracion.tsx` | Layout de tabs con routing |
| `app/routes/configuracion/equipo.tsx` | Gestión de miembros del equipo |
| `app/routes/configuracion/invitaciones.tsx` | Envío y gestión de invitaciones |
| `app/routes/configuracion/roles.tsx` | CRUD de roles y asignación de permisos |
| `app/routes/configuracion/organizacion.tsx` | Datos de la organización |
| `app/routes/configuracion/auditoria.tsx` | Timeline de actividad (audit log) |
| `app/routes/configuracion/perfil.tsx` | Perfil de usuario, avatar, tema, historial de sesiones |

## Funcionalidades

### Equipo
- Listar miembros activos con avatar, email, rol
- Cambiar rol de miembros
- Suspender / reactivar / remover miembros

### Invitaciones
- Enviar invitaciones por email (Resend API)
- Reenviar / cancelar invitaciones pendientes
- Vista de estado: pendiente, aceptada, expirada

### Roles
- Crear roles personalizados con jerarquía
- Asignar permisos granulares (85+ permisos disponibles)
- Eliminar roles (validación de miembros asignados)

### Perfil
- Editar nombre de perfil
- Subir avatar a Cloudflare R2 (máx 2MB, jpg/png/webp)
- Selector de tema (Claro / Oscuro / Sistema) con persistencia en BD
- Historial de sesiones de login (browser, OS, IP, dispositivo)

### Auditoría
- Timeline de eventos con filtros
- Tipos: auth, configuración, roles, miembros, AI, sistema

## Tablas DB

- `memberships` — relación user ↔ org ↔ role
- `roles` — roles con jerarquía
- `permissions` — 85+ permisos
- `role_permissions` — asignación role ↔ permission
- `invitations` — invitaciones con token y expiración
- `user_preferences` — preferencias de usuario (tema, etc.)
- `login_history` — historial de sesiones
- `audit_logs` — toda la actividad
