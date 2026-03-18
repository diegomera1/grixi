# Alternativas 2 y 3 — Socket.io Realtime + MinIO Storage

> Implementación de realtime con Socket.io + pg_notify y storage con MinIO para reemplazar Supabase Realtime y Storage.

---

## Parte 1: Socket.io Realtime

### 1. Arquitectura

```
PostgreSQL → pg_notify('changes', payload)
    │
    ▼
Socket.io Server (Node.js)
    │
    ├── Channel: org:{orgId}:warehouses
    ├── Channel: org:{orgId}:notifications
    └── Channel: presence:{orgId}
    │
    ▼
Browser (Socket.io Client)
```

### 2. Trigger de PostgreSQL (CDC)

```sql
-- Trigger genérico para cualquier tabla
CREATE OR REPLACE FUNCTION notify_change() RETURNS trigger AS $$
DECLARE
  payload JSONB;
BEGIN
  payload = jsonb_build_object(
    'table', TG_TABLE_NAME,
    'operation', TG_OP,
    'org_id', COALESCE(NEW.organization_id, OLD.organization_id),
    'record_id', COALESCE(NEW.id, OLD.id),
    'new', CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END,
    'old', CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END
  );
  PERFORM pg_notify('db_changes', payload::TEXT);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar a tablas que necesitan realtime
CREATE TRIGGER warehouses_notify AFTER INSERT OR UPDATE OR DELETE 
  ON warehouses FOR EACH ROW EXECUTE FUNCTION notify_change();

CREATE TRIGGER products_notify AFTER INSERT OR UPDATE OR DELETE 
  ON products FOR EACH ROW EXECUTE FUNCTION notify_change();
```

### 3. Socket.io Server

```typescript
// lib/realtime/server.ts
import { Server } from 'socket.io'
import { createClient } from 'pg'
import { auth } from '~/lib/auth'

export function setupRealtimeServer(httpServer: any) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.APP_URL, credentials: true }
  })

  // Auth middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token
    const session = await auth.api.getSession({ headers: new Headers({ cookie: token }) })
    if (!session) return next(new Error('Unauthorized'))
    socket.data.userId = session.user.id
    socket.data.orgIds = session.user.orgIds
    next()
  })

  io.on('connection', (socket) => {
    // Auto-join org channels
    for (const orgId of socket.data.orgIds) {
      socket.join(`org:${orgId}`)
    }

    // Presence
    socket.on('presence:join', (orgId) => {
      io.to(`org:${orgId}`).emit('presence:update', {
        userId: socket.data.userId,
        status: 'online',
      })
    })

    socket.on('disconnect', () => {
      for (const orgId of socket.data.orgIds) {
        io.to(`org:${orgId}`).emit('presence:update', {
          userId: socket.data.userId,
          status: 'offline',
        })
      }
    })
  })

  // Listen to PostgreSQL NOTIFY
  const pgClient = createClient({ connectionString: process.env.DATABASE_URL })
  pgClient.connect()
  pgClient.query('LISTEN db_changes')
  pgClient.on('notification', (msg) => {
    const payload = JSON.parse(msg.payload!)
    // Emit only to the tenant's room
    io.to(`org:${payload.org_id}`).emit('db:change', payload)
  })

  return io
}
```

### 4. Client Hook

```typescript
// lib/hooks/use-realtime.ts
'use client'
import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useActiveOrg } from './use-active-org'

export function useRealtime(table: string, onEvent: (payload: any) => void) {
  const socketRef = useRef<Socket | null>(null)
  const { activeOrgId } = useActiveOrg()

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_APP_URL!, { withCredentials: true })
    socketRef.current = socket

    socket.on('db:change', (payload) => {
      if (payload.table === table && payload.org_id === activeOrgId) {
        onEvent(payload)
      }
    })

    return () => { socket.disconnect() }
  }, [table, activeOrgId])
}
```

---

## Parte 2: MinIO Storage

### 1. Estructura de Buckets

```
MinIO
├── grixi-avatars/          ← Fotos de perfil
│   └── {userId}/avatar.webp
├── grixi-documents/        ← Documentos por tenant
│   └── {orgId}/
│       ├── invoices/
│       ├── reports/
│       └── attachments/
├── grixi-branding/         ← Logos y branding
│   └── {orgId}/logo.webp
└── grixi-exports/          ← Exports temporales
    └── {orgId}/{exportId}.pdf
```

### 2. MinIO Client

```typescript
// lib/storage/client.ts
import { Client } from 'minio'

export const minio = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'minio',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
})

// Upload con validación de tenant
export async function uploadFile(orgId: string, bucket: string, path: string, file: Buffer, contentType: string) {
  const objectName = `${orgId}/${path}`
  await minio.putObject(bucket, objectName, file, file.length, { 'Content-Type': contentType })
  return objectName
}

// Presigned URL para downloads seguros
export async function getSignedUrl(bucket: string, objectName: string, expirySeconds = 3600) {
  return minio.presignedGetObject(bucket, objectName, expirySeconds)
}

// Delete con verificación de org
export async function deleteFile(orgId: string, bucket: string, path: string) {
  const objectName = `${orgId}/${path}`
  await minio.removeObject(bucket, objectName)
}
```

### 3. Políticas de Acceso por Tenant

```typescript
// Middleware: verificar que el usuario pertenece a la org antes de acceder a archivos
export async function verifyStorageAccess(userId: string, orgId: string) {
  const result = await db.execute(sql`
    SELECT 1 FROM organization_members
    WHERE user_id = ${userId} AND organization_id = ${orgId} AND is_active = true
  `)
  if (result.rows.length === 0) throw new Error('Access denied')
}
```
