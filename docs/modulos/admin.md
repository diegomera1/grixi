# Módulo: Admin Portal

> Estado: ✅ Implementado
> Última actualización: 2026-04-01

## Descripción

Portal de administración de plataforma, accesible desde **admin.grixi.ai**.
Gestión cross-tenant de organizaciones, usuarios globales, notificaciones y configuración.

## Acceso

- URL: `https://admin.grixi.ai`
- Requiere: registro en tabla `platform_admins`
- Rate limit: 30 req/min por IP

## Archivos Clave

| Archivo | Descripción |
|---------|-------------|
| `app/routes/admin-layout.tsx` | Layout del portal admin con sidebar |
| `app/routes/admin/organizations.tsx` | Lista de organizaciones, crear, suspender |
| `app/routes/admin/organizations.$id.tsx` | Detalle de org: miembros, roles, módulos, dominios |
| `app/routes/admin/users.tsx` | Lista global de usuarios, promote/demote admin |
| `app/routes/admin/notifications.tsx` | Sistema de notificaciones admin (push + in-app) |
| `app/routes/admin/settings.tsx` | Configuración global de la plataforma |

## Funcionalidades

### Organizaciones
- CRUD completo de organizaciones
- Activar / suspender organizaciones
- Gestión de módulos habilitados por organización
- Domain whitelisting
- Invitar miembros desde panel admin

### Usuarios
- Vista global de todos los usuarios del sistema
- Promote / demote a platform admin
- Vista de memberships por usuario

### Notificaciones
- Envío de notificaciones in-app a usuarios
- Push notifications (Web Push Protocol)
- Limpieza de subscriptions expiradas

### Settings
- Configuración global: planes, límites, defaults

## Tablas DB

- `platform_admins` — usuarios con acceso admin
- `organizations` — todas las organizaciones
- `platform_settings` — configuración global key-value
