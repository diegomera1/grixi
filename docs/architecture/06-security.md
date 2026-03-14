# GRIXI — Capas de Seguridad

> Documento detallado sobre las 5 capas de seguridad de GRIXI, desde la red hasta la base de datos.

---

## 1. Modelo de Seguridad en Profundidad (Defense-in-Depth)

GRIXI implementa un modelo de **5 capas** donde cada capa es independiente y complementaria. Si una capa falla, las demás siguen protegiendo.

```
┌─────────────────────────────────────────────────────────────┐
│  CAPA 5: RED (Cloudflare)                                    │
│  → WAF, DDoS, Bot Protection, SSL/TLS                       │
│  → Primer filtro: requests maliciosos NUNCA llegan a tu app  │
├─────────────────────────────────────────────────────────────┤
│  CAPA 4: EDGE (Vercel Middleware)                            │
│  → Auth check, tenant resolution, CSP headers                │
│  → Segundo filtro: requests no autenticados se rechazan      │
├─────────────────────────────────────────────────────────────┤
│  CAPA 3: APLICACIÓN (Next.js + Zod)                         │
│  → Validación de input, sanitización, CSRF protection        │
│  → Tercer filtro: datos malformados se rechazan              │
├─────────────────────────────────────────────────────────────┤
│  CAPA 2: AUTH (Supabase Auth)                                │
│  → JWT verification, MFA, session management                 │
│  → Cuarto filtro: identidad verificada en cada request       │
├─────────────────────────────────────────────────────────────┤
│  CAPA 1: DATOS (PostgreSQL RLS)                              │
│  → Row-Level Security, helper functions, indices              │
│  → Último filtro: IMPOSIBLE acceder a datos de otro tenant   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Capa 5: Red (Cloudflare)

### 2.1 Protecciones Activas

| Protección | Qué hace | Configuración |
|---|---|---|
| **WAF OWASP** | Bloquea SQL injection, XSS, CSRF, path traversal | Managed ruleset activado |
| **DDoS L3/L4** | Absorbe ataques volumétricos (SYN flood, UDP) | Automático, sin configuración |
| **DDoS L7** | Detecta y bloquea HTTP floods | Automático + rate limiting custom |
| **Bot Fight** | Challenge a bots sospechosos (credential stuffing, scraping) | Activado |
| **SSL/TLS** | Cifrado end-to-end con TLS 1.3 | Full (Strict) mode |
| **HSTS** | Fuerza HTTPS en todo el dominio y subdominios | max-age: 31536000 |
| **IP Firewall** | Bloqueo/permiso por IP o rango | Custom rules por admin |

### 2.2 ¿Qué detiene esta capa?

```
✅ Bloqueado por Cloudflare:
  - SQL injection:  ?id=1; DROP TABLE users
  - XSS payload:    <script>steal(cookies)</script>
  - Path traversal: ../../etc/passwd
  - DDoS:           10M requests/second desde botnet
  - Known exploits: CVE-based attacks en frameworks
  - Credential stuffing: 10,000 login attempts/hour

❌ NO detiene (pasa a la siguiente capa):
  - Request legítimo con token robado
  - Lógica de negocio maliciosa con datos válidos
  - Insider threats
```

---

## 3. Capa 4: Edge (Vercel Middleware)

### 3.1 ¿Qué ejecuta el Middleware?

```typescript
// middleware.ts — Ejecuta en Vercel Edge (<50ms, 250+ PoPs)
import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // 1. Resolver tenant
  const hostname = request.headers.get('host') || ''
  const slug = hostname.split('.')[0]
  const systemDomains = ['app', 'www', 'api', 'localhost']
  
  if (!systemDomains.includes(slug)) {
    response.headers.set('x-tenant-slug', slug)
  }
  
  // 2. Verificar autenticación
  const supabase = createMiddlewareClient(request, response)
  const { data: { session } } = await supabase.auth.getSession()
  
  const isPublicPath = ['/login', '/signup', '/forgot-password'].some(
    p => request.nextUrl.pathname.startsWith(p)
  )
  
  if (!session && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // 3. Security Headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()')
  
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/).*)']
}
```

### 3.2 Security Headers

| Header | Valor | Propósito |
|---|---|---|
| `X-Frame-Options` | `DENY` | Previene clickjacking (embeber en iframe) |
| `X-Content-Type-Options` | `nosniff` | Previene MIME type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controla info en referer header |
| `Permissions-Policy` | `camera=(), microphone=(self)` | Restringe APIs del browser |
| `Content-Security-Policy` | (configurado en next.config) | Previene XSS, inline scripts |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Fuerza HTTPS (vía Cloudflare) |

### 3.3 CSP (Content Security Policy)

```typescript
// next.config.ts
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' blob: data: https://*.supabase.co;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`
```

---

## 4. Capa 3: Aplicación (Next.js + Zod)

### 4.1 Validación con Zod

TODA data del usuario se valida antes de procesarla:

```typescript
import { z } from 'zod'

// Schema de validación
const warehouseSchema = z.object({
  name: z.string()
    .min(2, 'Mínimo 2 caracteres')
    .max(100, 'Máximo 100 caracteres')
    .trim(),
  location: z.string().max(200).optional(),
  capacity: z.number().int().positive().max(1_000_000),
  settings: z.record(z.unknown()).optional(),
})

// Server Action con validación SERVER-SIDE
'use server'
export async function createWarehouse(formData: FormData) {
  // 1. Validar input (server-side)
  const parsed = warehouseSchema.safeParse({
    name: formData.get('name'),
    location: formData.get('location'),
    capacity: Number(formData.get('capacity')),
  })
  
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }
  
  // 2. Insertar (RLS filtra automáticamente)
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('warehouses')
    .insert(parsed.data) // Solo datos validados
    .select()
    .single()
  
  // 3. Revalidar cache
  revalidatePath('/warehouses')
  return { data, error }
}
```

### 4.2 Sanitización de Input

| Tipo de dato | Validación | Ejemplo |
|---|---|---|
| **Strings** | `.trim().min().max()` | Nombres, descripciones |
| **Emails** | `.email()` | Correos electrónicos |
| **URLs** | `.url()` | Links externos |
| **Números** | `.int().positive().max()` | Cantidades, precios |
| **UUIDs** | `.uuid()` | IDs de referencia |
| **Enums** | `.enum(['a','b','c'])` | Estados, roles |
| **Dates** | `.datetime()` | Fechas de vencimiento |
| **JSONB** | `.record(z.unknown())` | Configuraciones flexibles |

### 4.3 CSRF Protection

Next.js Server Actions tienen **CSRF protection nativa**:

- El formulario genera un token CSRF automáticamente
- Server Actions verifican el origin header
- Requests desde otros dominios son rechazados

### 4.4 Protección contra Mass Assignment

```typescript
// ❌ PELIGROSO: pasar todo el body directamente
const { data } = await supabase
  .from('users')
  .update(req.body) // Un atacante podría enviar { role: 'admin' }

// ✅ SEGURO: solo campos permitidos vía Zod
const updateSchema = z.object({
  name: z.string().optional(),
  avatar_url: z.string().url().optional(),
  // role NO está en el schema → no se puede modificar
})
const parsed = updateSchema.parse(req.body)
const { data } = await supabase.from('users').update(parsed)
```

---

## 5. Capa 2: Auth (Supabase Auth)

### 5.1 Mecanismos de Protección

| Mecanismo | Detalle |
|---|---|
| **JWT Verification** | Cada request verifica firma y expiración del token |
| **Token Rotation** | Refresh tokens se rotan automáticamente al usarse |
| **Rate Limiting** | Límite en intentos de login, signup, password reset |
| **MFA (TOTP)** | Segundo factor vía Google Authenticator / Authy |
| **Session Management** | Sessions activas visibles, revocación individual |
| **Password hashing** | bcrypt con salt automático |
| **Email verification** | Confirmación por email antes de activar cuenta |
| **Magic Links** | Login sin password — token de un solo uso, con expiración |

### 5.2 Configuración Recomendada

```
SUPABASE AUTH SETTINGS:
├── JWT expiry: 3600 seconds (1 hora)
├── Refresh token rotation: ✅ Enabled
├── Refresh token reuse interval: 10 seconds
├── MFA: ✅ Enabled (opcional por usuario)
├── Password min length: 8 characters
├── Password strength: ✅ Require mixed case + numbers
├── Rate limiting:
│   ├── Sign in attempts: 30/hora
│   ├── Sign up: 5/hora  
│   ├── Password reset: 3/hora
│   └── Magic link: 5/hora
├── Email confirmations: ✅ Required
├── Phone confirmations: Disabled (no usamos)
└── External providers:
    ├── Google OAuth: ✅ Enabled
    └── Microsoft: 🔄 Future
```

### 5.3 ¿Qué detiene esta capa?

```
✅ Bloqueado por Supabase Auth:
  - Login con contraseña incorrecta (rate limited)
  - JWT expirado o con firma inválida
  - Refresh token ya rotado (reutilización = compromiso detectado)
  - Registro sin confirmación de email
  - Brute force de password (30 attempts/hour limit)

❌ NO detiene:
  - Un usuario legítimo accediendo a datos de otro tenant
    → Eso lo maneja la Capa 1 (RLS)
```

---

## 6. Capa 1: Datos (PostgreSQL RLS)

### 6.1 La Última Línea de Defensa

RLS es la capa **más crítica** porque protege los datos directamente en la base de datos. Incluso si todas las capas anteriores fallan (WAF, middleware, auth), los datos de un tenant **no pueden ser accedidos** por otro tenant.

```
Escenario: Token robado de un usuario de Empresa A

CON RLS:
  Atacante usa token de Empresa A
  → Intenta query: SELECT * FROM warehouses
  → RLS filtra: solo retorna warehouses de Empresa A
  → Atacante NO puede ver datos de Empresa B ✅
  → Daño limitado solo a la empresa del token robado

SIN RLS:
  Atacante usa token de Empresa A
  → Intenta query: SELECT * FROM warehouses
  → Retorna TODOS los warehouses de TODAS las empresas 😱
  → Data breach masivo
```

### 6.2 Reglas de Oro

1. **TODA tabla de negocio tiene RLS habilitado** — sin excepciones
2. **TODA tabla de negocio tiene `organization_id`** — sin excepciones
3. **Índice en `organization_id`** — sin excepciones
4. **`service_role` key NUNCA en el cliente** — solo server-side
5. **Helper functions son `SECURITY DEFINER`** — para bypasear RLS interno
6. **CI/CD verifica RLS compliance** — scripts automáticos en GitHub Actions

### 6.3 Service Role Key — La Llave Maestra

| Key | Dónde usarla | ¿Bypasa RLS? |
|---|---|---|
| `ANON_KEY` | Client Components, Browser | ❌ No — RLS aplica |
| `SERVICE_ROLE_KEY` | Server Actions, Edge Functions, Migrations | ✅ Sí — acceso total |

**Reglas estrictas para `SERVICE_ROLE_KEY`:**
- ❌ NUNCA en `NEXT_PUBLIC_*` environment variables
- ❌ NUNCA en código que se envía al browser
- ✅ Solo en Server Actions (`'use server'`)
- ✅ Solo en Supabase Edge Functions
- ✅ Solo en scripts de migración/seed

---

## 7. Protección de API Keys

### 7.1 Almacenamiento de Secrets

| Secret | Dónde se almacena | Accesible desde |
|---|---|---|
| `SUPABASE_URL` | Vercel env vars + `NEXT_PUBLIC_` | Client + Server |
| `SUPABASE_ANON_KEY` | Vercel env vars + `NEXT_PUBLIC_` | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env vars (sin `NEXT_PUBLIC_`) | Solo Server |
| `GEMINI_API_KEY` | Supabase Edge Function secrets | Solo Edge Functions |
| `RESEND_API_KEY` | Supabase Edge Function secrets | Solo Edge Functions |
| `SAP_CREDENTIALS` | Supabase Edge Function secrets | Solo Edge Functions |

### 7.2 ¿Por qué `NEXT_PUBLIC_SUPABASE_ANON_KEY` es seguro?

- El `ANON_KEY` es **público por diseño** — Supabase lo diseñó para estar en el cliente
- Es equivalente a un API key de lectura con RLS
- **No tiene permisos elevados** — todo pasa por RLS
- Sin RLS habilitado, sería peligroso — pero GRIXI SIEMPRE tiene RLS

---

## 8. Auditoría y Logging

### 8.1 Fuentes de Logs

| Fuente | Qué logea | Retención |
|---|---|---|
| **Cloudflare** | Requests HTTP, WAF events, DDoS | 3 días (Pro), 7 días (Business) |
| **Vercel** | Build logs, function logs, errors | 7 días |
| **Supabase API** | PostgREST requests, auth events | 7 días |
| **Supabase Auth** | Login/logout, password changes, MFA changes | 7 días |
| **Supabase Edge Functions** | Execution logs, errors | 7 días |
| **PostgreSQL** | Query logs, connection logs | 7 días |
| **Aplicación (custom)** | Audit trail en tabla custom | Indefinido |

### 8.2 Tabla de Auditoría Custom

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,        -- 'create' | 'update' | 'delete'
  resource_type TEXT NOT NULL, -- 'warehouse' | 'purchase_order' | etc.
  resource_id UUID,
  old_data JSONB,             -- datos antes del cambio
  new_data JSONB,             -- datos después del cambio
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: usuarios ven audit logs de su org
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read" ON audit_logs FOR SELECT USING (
  organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
);

-- Índices para búsqueda rápida
CREATE INDEX idx_audit_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
```

### 8.3 Trigger Automático de Auditoría

```sql
-- Función genérica de auditoría
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, new_data)
    VALUES (NEW.organization_id, auth.uid(), 'create', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, old_data, new_data)
    VALUES (NEW.organization_id, auth.uid(), 'update', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, old_data)
    VALUES (OLD.organization_id, auth.uid(), 'delete', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar a tablas críticas
CREATE TRIGGER audit_warehouses
  AFTER INSERT OR UPDATE OR DELETE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_purchase_orders
  AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

---

## 9. Checklist de Seguridad

### Para cada nueva tabla:
- [ ] `ALTER TABLE xxx ENABLE ROW LEVEL SECURITY`
- [ ] Policy de SELECT (lectura) con `get_user_org_ids()`
- [ ] Policy de INSERT con check de role
- [ ] Policy de UPDATE con check de role + `organization_id` inmutable
- [ ] Policy de DELETE restrictiva (solo admin/owner)
- [ ] Índice en `organization_id`
- [ ] Trigger de auditoría si es tabla crítica

### Para cada nuevo Server Action:
- [ ] Validación Zod del input
- [ ] Usar `createServerClient()` (no `service_role` salvo necesario)
- [ ] No exponer IDs internos en errores
- [ ] Revalidar paths después de mutations

### Para cada nueva Edge Function:
- [ ] `verify_jwt: true` (por defecto)
- [ ] Validar input con Zod o schema
- [ ] Secrets en Supabase (no hardcoded)
- [ ] Error handling sin leaking de info sensible
- [ ] Rate limiting si es endpoint público

### Revisiones periódicas:
- [ ] `supabase advisors security` — cada semana
- [ ] Dependabot alerts — cada semana
- [ ] CodeQL scan — cada merge a main
- [ ] Rotación de API keys — cada 90 días
- [ ] Review de RLS policies — cada sprint
