# Módulo: Notificaciones — Documentación Técnica ✅

> Sistema de notificaciones in-app multi-tenant con Realtime.

---

## 1. Arquitectura

### Base de datos: `notifications`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK auto-generada |
| `user_id` | UUID | FK → auth.users |
| `organization_id` | UUID | FK → organizations |
| `title` | TEXT | Título de la notificación |
| `body` | TEXT? | Cuerpo descriptivo |
| `icon` | TEXT | Icono (lucide key): bell, dollar-sign, etc. |
| `type` | TEXT | `info` \| `success` \| `warning` \| `error` \| `action` |
| `module` | TEXT | Módulo origen: sistema, finanzas, almacenes, etc. |
| `action_url` | TEXT? | URL de destino al clickear |
| `metadata` | JSONB | Datos extra extensibles |
| `read_at` | TIMESTAMPTZ? | Timestamp de lectura |
| `archived_at` | TIMESTAMPTZ? | Soft delete |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `actor_id` | UUID? | Quién generó la notificación |
| `actor_name` | TEXT? | Nombre visible del actor |

### RLS

- SELECT/UPDATE/DELETE: `auth.uid() = user_id` (cada usuario solo ve sus propias)
- INSERT: vía admin client (backend, bypass RLS)

### Realtime

La tabla está registrada en `supabase_realtime` — INSERTs/UPDATEs se propagan automáticamente a clientes suscritos.

---

## 2. API

### `GET /api/notifications`

Lista notificaciones del usuario actual.

**Query params:**
- `orgId` (required): UUID de la organización
- `unreadOnly`: `true` para solo no leídas
- `module`: Filtrar por módulo
- `limit`: Máximo 100 (default 50)
- `offset`: Paginación

**Respuesta:**
```json
{
  "notifications": [...],
  "total": 7,
  "unreadCount": 5
}
```

### `POST /api/notifications`

Acciones sobre notificaciones.

**Body:**
```json
{ "action": "read", "notificationId": "uuid" }
{ "action": "readAll", "orgId": "uuid" }
{ "action": "delete", "notificationId": "uuid" }
{ "action": "deleteAll", "orgId": "uuid" }
```

---

## 3. Uso desde módulos (Server-side)

### Función: `createNotification()`

```typescript
import { createNotification } from "~/lib/notifications.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

// En un loader o action de cualquier módulo:
const admin = createSupabaseAdminClient(env);

await createNotification(admin, {
  userId: targetUserId,
  organizationId: orgId,
  title: "Factura aprobada",
  body: "La factura #1234 fue aprobada.",
  type: "success",
  module: "finanzas",
  actionUrl: "/finanzas?tab=facturas",
  actorId: currentUser.id,
  actorName: currentUser.name,
  metadata: { facturaId: "1234", monto: 5000 },
});
```

### Función: `createBulkNotifications()`

```typescript
await createBulkNotifications(admin, {
  userIds: ["uuid1", "uuid2", "uuid3"],
  organizationId: orgId,
  title: "Reunión programada",
  module: "team",
});
```

### Función: `notifyOrgMembers()`

```typescript
// Notificar a TODOS los miembros de la org (excepto al actor)
await notifyOrgMembers(admin, {
  organizationId: orgId,
  title: "Nueva política publicada",
  module: "admin",
  excludeUserId: currentUser.id, // no auto-notificarse
});
```

---

## 4. Componentes UI

### `<NotificationBell />`

Campana con badge de no leídas + dropdown con últimas 8 notificaciones.

**Ubicación:** Header del layout autenticado (`authenticated.tsx`)

**Props:**
- `notifications`: Array de notificaciones
- `unreadCount`: Número de no leídas
- `onMarkRead(id)`: Marcar una como leída
- `onMarkAllRead()`: Marcar todas
- `onDelete(id)`: Eliminar una

### `NotificationCenter` (Página)

**Ruta:** `/notificaciones`

Características:
- Agrupación por fecha (Hoy, Ayer, Anteriores)
- Filtros: Todas, Sin leer, Finanzas, Equipo, Sistema, AI
- Acciones: Leer todas, Limpiar todas
- Indicador LIVE (Realtime conectado)
- Cada notificación: marcar como leída, eliminar, click → navegar

### `<BottomTabBar />`

Tab bar móvil con badge de notificaciones (red dot con conteo).

---

## 5. Módulos soportados

| Módulo | Key | Icono | Color |
|--------|-----|-------|-------|
| Sistema | `system` | ⚙️ Settings | Gris |
| Dashboard | `dashboard` | 📊 LayoutDashboard | Índigo |
| Finanzas | `finanzas` | 💵 DollarSign | Índigo |
| Almacenes | `almacenes` | 🏭 Warehouse | Verde |
| Compras | `compras` | 🛒 ShoppingCart | Ámbar |
| RRHH | `rrhh` | 👥 Users | Rosa |
| Flota | `flota` | 🚛 Truck | Cyan |
| GRIXI AI | `ai` | ✨ Sparkles | Púrpura |
| Auditoría | `audit` | 🛡️ Shield | Naranja |
| Equipo | `team` | 👥 Users | Azul |
| Admin | `admin` | 🛡️ Shield | Rojo |

---

## 6. Archivos

```
app/
├── routes/
│   ├── api.notifications.ts        # API CRUD
│   └── notificaciones.tsx           # Página centro de notificaciones
├── components/
│   └── notifications/
│       └── notification-bell.tsx    # Campana + dropdown
├── lib/
│   ├── notifications.server.ts     # Utilidad servidor (createNotification)
│   └── hooks/
│       └── use-notifications.ts    # Hook con Realtime
supabase/
└── migrations/
    └── 20260401063000_tenant_notifications.sql
```

---

## 7. Tipos de notificación

| Tipo | Uso | Color |
|------|-----|-------|
| `info` | Informativa general | Azul |
| `success` | Acción completada exitosamente | Verde |
| `warning` | Advertencia / requiere atención | Ámbar |
| `error` | Error / urgente | Rojo |
| `action` | Requiere una acción del usuario | Púrpura |
