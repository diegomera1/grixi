---
description: Cómo registrar eventos de auditoría en GRIXI
---

# Audit Logs en GRIXI

Toda acción significativa debe quedar registrada en `audit_logs`.

## Uso

```typescript
import { logAuditEvent, getClientIP } from "~/lib/audit";

// En un action:
await logAuditEvent(adminClient, {
  actorId: user.id,                    // Quién hizo la acción
  action: "invitation.create",          // Qué acción (verbo.sustantivo)
  entityType: "invitation",             // Tipo de entidad afectada
  entityId: invitation.id,              // ID de la entidad (opcional)
  organizationId: org.id,               // Org afectada (opcional)
  metadata: { email, roleId },          // Datos extra (JSON, opcional)
  ipAddress: getClientIP(request),      // IP del actor
});
```

## Convención de Actions

```
{entidad}.{verbo}
```

| Action | Descripción |
|--------|-------------|
| `invitation.create` | Creación de invitación |
| `invitation.resend` | Reenvío de invitación |
| `invitation.cancel` | Cancelación de invitación |
| `invitation.accept` | Aceptación de invitación |
| `member.change_role` | Cambio de rol de miembro |
| `member.suspend` | Suspensión/activación de miembro |
| `member.remove` | Eliminación de miembro |
| `org.update_settings` | Actualización de configuración |
| `module.toggle` | Activación/desactivación de módulo |
| `domain.add` | Agregar dominio whitelist |
| `domain.remove` | Eliminar dominio whitelist |

## Importante

- Siempre usar `createSupabaseAdminClient` (service role) para insertar audit logs
- No usar el Supabase client del usuario — las políticas RLS podrían bloquear
- `getClientIP()` usa `CF-Connecting-IP` primero (Cloudflare), luego `X-Forwarded-For`
- Los metadata deben ser serializables como JSON

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `app/lib/audit.ts` | Funciones `logAuditEvent` y `getClientIP` |
| `app/components/admin/audit-realtime.tsx` | Widget realtime del admin |
