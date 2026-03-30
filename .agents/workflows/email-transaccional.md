---
description: Cómo enviar emails transaccionales en GRIXI usando Resend API
---

# Email Transaccional con Resend

GRIXI usa **Resend API** (fetch directo, sin SDK) para enviar emails transaccionales desde Cloudflare Workers.

## Configuración

| Variable | Ubicación | Valor |
|----------|-----------|-------|
| `RESEND_API_KEY` | Cloudflare Workers Secret | `re_...` |
| `RESEND_API_KEY` | `.dev.vars` (local) | Mismo valor |
| Dominio verificado | Resend Dashboard | `grixi.ai` |
| From address | Código | `GRIXI <noreply@grixi.ai>` |

### Gestión del Secret

```bash
# Agregar o actualizar el secret en producción
npx wrangler secret put RESEND_API_KEY

# Agregar en .dev.vars para desarrollo local
echo 'RESEND_API_KEY=re_xxxxx' >> .dev.vars
```

## Uso en Código

### 1. Import

```typescript
import { sendEmail, sendInvitationEmail } from "~/lib/email.server";
```

### 2. Obtener API Key (en loader/action)

```typescript
const resendKey = (env as any).RESEND_API_KEY;
if (!resendKey) {
  console.warn("[EMAIL] RESEND_API_KEY not configured");
  // Graceful degradation — no bloquear el flujo
}
```

### 3. Email genérico

```typescript
const result = await sendEmail(resendKey, {
  to: "usuario@empresa.com",
  subject: "Asunto del email",
  html: "<h1>Hola</h1><p>Contenido</p>",
  from: "GRIXI <noreply@grixi.ai>",  // opcional, default ya configurado
});

if (!result.success) {
  console.error("[EMAIL] Error:", result.error);
}
```

### 4. Email de invitación (template branded)

```typescript
await sendInvitationEmail(resendKey, {
  to: "nuevo@empresa.com",
  inviterName: "Diego Mera",
  orgName: "Acme Corp",
  roleName: "admin",
  invitationLink: `https://${slug}.grixi.ai/?invitation=${invitationId}`,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
});
```

## Agregar Nuevos Templates

Para agregar un nuevo tipo de email:

1. Crear una nueva función en `app/lib/email.server.ts`
2. Usar `emailLayout(content)` para envolver el contenido en el layout base GRIXI
3. Llamar `sendEmail()` con el HTML generado

```typescript
export async function sendWelcomeEmail(resendApiKey: string, params: {
  to: string;
  userName: string;
  orgName: string;
}): Promise<{ success: boolean; error?: string }> {
  const content = `
    <h1 style="...">¡Bienvenido a ${params.orgName}!</h1>
    <p style="...">Hola ${params.userName}, tu cuenta está lista.</p>
  `;
  
  return sendEmail(resendApiKey, {
    to: params.to,
    subject: `Bienvenido a ${params.orgName} en GRIXI`,
    html: emailLayout(content),
  });
}
```

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `app/lib/email.server.ts` | Servicio de email + templates |
| `app/routes/configuracion/invitaciones.tsx` | Envío desde tenant |
| `app/routes/admin/organizations.$id.tsx` | Envío desde admin portal |
| `.dev.vars` | Secrets locales |
| `wrangler.jsonc` | Configuración de Workers |

## Monitoreo

```bash
# Ver emails enviados en Resend
curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/emails?limit=20

# Ver estado de un email específico
curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/emails/{id}

# Ver dominios verificados
curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/domains
```

## Limitaciones

- **Resend Free tier:** 100 emails/día, 3000/mes
- **No SDK:** Usamos fetch directo por compatibilidad con Cloudflare Workers edge runtime
- **Sin reply-to:** Los emails son `noreply@grixi.ai` — no esperar respuestas
