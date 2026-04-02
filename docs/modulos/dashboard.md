# Módulo: Dashboard

> Estado: ✅ Implementado
> Última actualización: 2026-04-01

## Descripción

Panel principal de la plataforma GRIXI. Muestra KPIs en tiempo real,
actividad reciente del audit log, accesos rápidos a módulos y estadísticas de la organización.

## Archivos Clave

| Archivo | Descripción |
|---------|-------------|
| `app/routes/dashboard.tsx` | Ruta principal con loader de datos y componentes |
| `app/components/dashboard/hero.tsx` | KPI cards hero section |
| `app/components/dashboard/quick-access.tsx` | Grid de acceso rápido a módulos |
| `app/components/dashboard/org-info-card.tsx` | Card de información de la organización |

## KPIs Mostrados

- 👥 **Miembros activos** — count de memberships activas
- 🛡 **Roles configurados** — roles de la organización
- 🔑 **Permisos asignados** — permisos RBAC
- 📩 **Invitaciones pendientes** — invitaciones sin aceptar
- 🔔 **Notificaciones no leídas** — count de notificaciones
- 📊 **Eventos del día** — acciones registradas en audit_log (hoy)
- 🤖 **Conversaciones AI** — total de chats con GRIXI AI

## Realtime

Suscripción a cambios en `notifications` vía Supabase Realtime para actualizar KPIs en vivo.

## Loading State

Exporta `HydrateFallback` con skeleton tipo `dashboard` para SSR.
