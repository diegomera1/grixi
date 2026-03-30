---
description: Cómo usar Cloudflare R2 Storage para archivos en GRIXI
---

# R2 Object Storage en GRIXI

GRIXI usa **Cloudflare R2** para almacenar archivos (attachments de AI, exports, assets).
El acceso es mediante `SecureR2Client` con 7 capas de seguridad.

## Configuración

| Recurso | Valor |
|---------|-------|
| Binding | `ASSETS_BUCKET` |
| Bucket name | `grixi-assets` |
| Definición | `wrangler.jsonc` → `r2_buckets` |
| Client | `app/lib/storage/r2-client.server.ts` |

## Uso en Código

### 1. Crear el cliente

```typescript
import { SecureR2Client } from "~/lib/storage/r2-client.server";

// En un loader/action:
const env = context.cloudflare.env;
const r2 = new SecureR2Client(env.ASSETS_BUCKET, {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB default
});
```

### 2. Subir un archivo

```typescript
const formData = await request.formData();
const file = formData.get("file") as File;

// Validar antes de subir
const error = r2.validateFile(file);
if (error) return Response.json({ error }, { status: 400 });

// Subir con namespacing automático
const result = await r2.upload({
  userId: user.id,
  orgId: orgId,
  prefix: "ai-attachments",    // carpeta lógica
  file: file,
  contextId: conversationId,   // opcional, sub-carpeta
});

// result = { key, size, etag, contentType }
```

### 3. Leer un archivo

```typescript
// Verifica ownership automáticamente
const { body, contentType, size } = await r2.get(key, user.id);

return new Response(body, {
  headers: {
    "Content-Type": contentType,
    "Content-Length": size.toString(),
    "Cache-Control": "private, max-age=86400",
  },
});
```

### 4. Eliminar un archivo

```typescript
await r2.delete(key, user.id); // Verifica ownership
```

### 5. Listar archivos por prefijo

```typescript
const files = await r2.list(`ai-attachments/${orgId}/${userId}/`, 100);
// files = [{ key, size, etag, uploaded }]
```

## Estructura de Keys

```
{prefix}/{orgId}/{userId}/{contextId?}/{uuid}_{filename}.{ext}
```

Ejemplo:
```
ai-attachments/org-uuid/user-uuid/conv-uuid/a1b2c3_mi-archivo.pdf
```

## Seguridad (7 Capas)

1. **Path namespacing** — Archivos aislados por org/user/contexto
2. **File type whitelist** — Solo imágenes, PDFs, CSV, Excel, JSON, texto
3. **Size validation** — Default 10MB configurable
4. **MIME type verification** — Verificación de tipo real
5. **Filename sanitization** — Protección contra path traversal (`../`)
6. **Ownership verification** — UserId debe estar en el key path
7. **No public access** — Todo pasa por el Worker (proxy)

## Tipos Permitidos

| Categoría | Extensiones |
|-----------|-------------|
| Imágenes | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg` |
| Documentos | `.pdf` |
| Spreadsheets | `.csv`, `.xls`, `.xlsx` |
| Texto | `.txt`, `.json` |

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `app/lib/storage/r2-client.server.ts` | Client seguro con validaciones |
| `wrangler.jsonc` | Binding del bucket R2 |
| `worker-configuration.d.ts` | Types del binding `ASSETS_BUCKET` |
