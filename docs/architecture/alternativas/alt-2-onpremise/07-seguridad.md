# Alternativa 2 — Seguridad On-Premise

> Las 5 capas de seguridad adaptadas a la arquitectura on-premise.

---

## Modelo Defense-in-Depth

```
Capa 5: RED          → Cloudflare WAF + DDoS + Tunnel (IP oculta)
Capa 4: PROXY        → Caddy (HTTPS, security headers, rate limiting)
Capa 3: APLICACIÓN   → Zod + Better Auth middleware + CSRF
Capa 2: AUTH         → Better Auth (OAuth, MFA, sessions en Redis)
Capa 1: DATOS        → PostgreSQL RLS (policies manuales — misma lógica)
```

---

## Diferencias vs Arquitectura Actual

| Capa | Actual | On-Premise |
|---|---|---|
| **Red** | Cloudflare Proxy | Cloudflare Tunnel (más seguro — 0 puertos) |
| **Edge** | Vercel Middleware | Caddy + Next.js middleware |
| **App** | Zod + Server Actions | Zod + Server Actions (igual) |
| **Auth** | Supabase Auth | Better Auth (self-hosted) |
| **Datos** | Supabase RLS | PostgreSQL RLS (mismas policies) |

---

## Better Auth — Configuración de Seguridad

```typescript
// lib/auth.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

export const auth = betterAuth({
  database: drizzleAdapter(db),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 3600, // 1 hora
    updateAge: 300, // refresh cada 5 min
  },
  rateLimit: {
    window: 60, // 1 minuto
    max: 30, // max 30 requests
  },
  advanced: {
    useSecureCookies: true,
    cookiePrefix: 'grixi',
  },
})
```

## RLS — Se Mantiene Idéntico

Las mismas policies RLS de Supabase se aplican al PostgreSQL local:

```sql
-- Mismas helper functions
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = current_setting('app.user_id')::UUID
  AND is_active = true
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Mismas policies
CREATE POLICY "tenant_read" ON warehouses FOR SELECT USING (
  organization_id IN (SELECT get_user_org_ids())
  OR is_platform_admin()
);
```

> [!NOTE]
> En Supabase, `auth.uid()` resuelve el usuario automáticamente. En PostgreSQL standalone, hay que setear `app.user_id` manualmente vía `SET LOCAL` al inicio de cada request en el middleware de Drizzle.
