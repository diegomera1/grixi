# Alternativa 1 — Seguridad

> Las 5 capas de seguridad de GRIXI adaptadas a Supabase + Cloudflare Workers.

---

## Modelo Defense-in-Depth

```
Capa 5: RED          → Cloudflare WAF + DDoS + Bot Protection (IGUAL)
Capa 4: EDGE         → React Router middleware en Workers (IGUAL concepto)
Capa 3: APLICACIÓN   → Zod validation en loaders/actions (IGUAL)
Capa 2: AUTH         → Supabase Auth (SIN CAMBIOS)
Capa 1: DATOS        → PostgreSQL RLS (SIN CAMBIOS)
```

**La seguridad en esta alternativa es prácticamente idéntica a la actual.** La única diferencia es que el middleware pasa de Vercel Edge a Cloudflare Workers — pero la lógica es la misma.

### Middleware de Seguridad

```typescript
// middleware.ts — React Router v7
import { createSupabaseServerClient } from '~/lib/supabase/client.server'

export async function middleware({ request, context }: Route.MiddlewareArgs) {
  const url = new URL(request.url)
  const hostname = request.headers.get('host') || ''
  const slug = hostname.split('.')[0]

  // 1. Resolver tenant
  if (!['app', 'www', 'api'].includes(slug)) {
    context.tenantSlug = slug
  }

  // 2. Auth check
  const publicPaths = ['/login', '/signup', '/forgot-password']
  if (!publicPaths.some(p => url.pathname.startsWith(p))) {
    const supabase = createSupabaseServerClient(request, context.cloudflare.env)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/login' }
      })
    }
  }

  // 3. Security headers (set en response)
}
```

### Headers de Seguridad

Se configuran en Caddy/Cloudflare o en el Worker:

| Header | Valor |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(self)` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
