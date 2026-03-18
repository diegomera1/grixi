# Alternativa 1 — Supabase: Qué Se Mantiene

> En esta alternativa, Supabase se mantiene **exactamente igual** que en la arquitectura actual. Este documento detalla cómo se integra con el nuevo frontend (React Router v7 en Cloudflare Workers).

---

## 1. Sin Cambios en Supabase

| Componente | Estado | Notas |
|---|---|---|
| PostgreSQL 17 (OrioleDB) | ❌ Sin cambios | Todo el schema, extensiones, RLS policies |
| Supabase Auth | ❌ Sin cambios | Google OAuth, JWT hooks, MFA |
| Supabase Realtime | ❌ Sin cambios | CDC, Presence, Broadcast |
| Supabase Storage | ❌ Sin cambios | Buckets, policies, image transforms |
| Supabase Edge Functions | ❌ Sin cambios | Deno runtime, webhooks, SAP, email |
| PostgREST | ❌ Sin cambios | API REST automática |
| Branching 2.0 | ❌ Sin cambios | Preview branches, staging |
| PITR | ❌ Sin cambios | Point-in-time recovery |

---

## 2. Integración con Cloudflare Workers

### Supabase Client en Workers

```typescript
// lib/supabase/client.server.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createSupabaseClient(env: Env) {
  return createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  )
}

// Con auth del usuario (cookies)
export function createSupabaseServerClient(request: Request, env: Env) {
  const cookies = parseCookies(request.headers.get('Cookie') || '')
  const accessToken = cookies['sb-access-token']
  const refreshToken = cookies['sb-refresh-token']

  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)

  if (accessToken && refreshToken) {
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  }

  return supabase
}
```

### Uso en Loaders y Actions

```typescript
// app/routes/warehouses.tsx
import { createSupabaseServerClient } from '~/lib/supabase/client.server'

export async function loader({ request, context }: Route.LoaderArgs) {
  const supabase = createSupabaseServerClient(request, context.cloudflare.env)

  // RLS filtra automáticamente por tenant — igual que con Next.js
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('*, products(count)')
    .order('name')

  return { warehouses }
}
```

### Supabase Realtime (Client-Side)

```typescript
// Funciona EXACTAMENTE igual — es código de cliente React
import { useEffect } from 'react'
import { createBrowserClient } from '~/lib/supabase/client.browser'

export function useRealtimeWarehouse(orgId: string) {
  const supabase = createBrowserClient()

  useEffect(() => {
    const channel = supabase
      .channel(`org:${orgId}:warehouses`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'warehouses',
        filter: `organization_id=eq.${orgId}`,
      }, (payload) => {
        // Manejar cambio — igual que en Next.js
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orgId])
}
```

---

## 3. Drizzle ORM (Opcional — Para Queries Complejas)

Para queries complejas con múltiples JOINs, Drizzle ORM es más ergonómico que `supabase-js`:

```typescript
// lib/db/schema.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: text('name').notNull(),
  location: text('location'),
  createdAt: timestamp('created_at').defaultNow(),
})

// lib/db/client.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export function createDrizzleClient(env: Env) {
  const client = postgres(env.DATABASE_URL)
  return drizzle(client)
}
```

> [!NOTE]
> Drizzle ORM es **opcional**. `supabase-js` se puede seguir usando para el 90% de las queries. Drizzle es recomendado para queries complejas con subqueries y CTEs que son difíciles de expresar con `supabase-js`.
