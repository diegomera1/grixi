# Alternativas 2 y 3 — Multi-Tenant: Migración de Supabase RLS

> Cómo replicar la estrategia multi-tenant de Supabase (RLS + `auth.uid()`) en PostgreSQL standalone con Better Auth.

---

## 1. Diferencia Fundamental

```
SUPABASE:
  Request → JWT verificado por PostgREST → auth.uid() disponible en RLS
  RLS: organization_id IN (SELECT get_user_org_ids())
  get_user_org_ids() usa auth.uid() — automático

STANDALONE:
  Request → Better Auth verifica session → Drizzle ORM → SET LOCAL app.user_id
  RLS: organization_id IN (SELECT get_user_org_ids())
  get_user_org_ids() usa current_setting('app.user_id') — manual
```

---

## 2. Helper Functions (Migradas)

```sql
-- Reemplaza auth.uid() con current_setting
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
  SELECT current_setting('app.user_id', true)::UUID;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Organizaciones del usuario actual
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = get_current_user_id()
  AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ¿Es platform admin?
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins
    WHERE user_id = get_current_user_id()
    AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

---

## 3. RLS Policies (Idénticas)

```sql
-- Las policies son EXACTAMENTE iguales que en Supabase
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON warehouses FOR SELECT USING (
  organization_id IN (SELECT get_user_org_ids())
  OR is_platform_admin()
);

CREATE POLICY "tenant_insert" ON warehouses FOR INSERT WITH CHECK (
  organization_id IN (SELECT get_user_org_ids())
);

CREATE POLICY "tenant_update" ON warehouses FOR UPDATE USING (
  organization_id IN (SELECT get_user_org_ids())
);

CREATE POLICY "tenant_delete" ON warehouses FOR DELETE USING (
  organization_id IN (SELECT get_user_org_ids())
  AND is_platform_admin()
);
```

---

## 4. Middleware de Drizzle (SET LOCAL)

El paso crítico: **inyectar el `user_id` en cada conexión de PostgreSQL** antes de ejecutar queries.

```typescript
// lib/db/middleware.ts
import { db } from './client'
import { sql } from 'drizzle-orm'

export async function withTenantContext<T>(
  userId: string,
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // SET LOCAL solo vive dentro de esta transacción
    await tx.execute(sql`SET LOCAL app.user_id = ${userId}`)
    return callback(tx)
  })
}
```

### Uso en Server Actions / API Routes

```typescript
// app/warehouses/actions.ts
import { auth } from '~/lib/auth'
import { withTenantContext } from '~/lib/db/middleware'

export async function getWarehouses() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) throw new Error('Unauthorized')

  return withTenantContext(session.user.id, async (tx) => {
    // RLS filtra automáticamente por tenant
    const result = await tx.execute(sql`SELECT * FROM warehouses ORDER BY name`)
    return result.rows
  })
}
```

---

## 5. Better Auth — Custom Claims Multi-Tenant

```typescript
// lib/auth.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db/client'

export const auth = betterAuth({
  database: drizzleAdapter(db),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 3600,
    // Custom claims: incluir org_ids en el JWT
    generateToken: async (user) => {
      const orgs = await db.execute(sql`
        SELECT organization_id, role FROM organization_members
        WHERE user_id = ${user.id} AND is_active = true
      `)
      return {
        sub: user.id,
        email: user.email,
        org_ids: orgs.rows.map(o => o.organization_id),
        roles: orgs.rows.reduce((acc, o) => {
          acc[o.organization_id] = o.role
          return acc
        }, {}),
      }
    },
  },
  rateLimit: { window: 60, max: 30 },
  advanced: {
    useSecureCookies: true,
    cookiePrefix: 'grixi',
  },
})
```

---

## 6. Multi-Org Switching

```typescript
// lib/hooks/use-active-org.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ActiveOrgStore = {
  activeOrgId: string | null
  setActiveOrg: (orgId: string) => void
}

export const useActiveOrg = create<ActiveOrgStore>()(
  persist(
    (set) => ({
      activeOrgId: null,
      setActiveOrg: (orgId) => set({ activeOrgId: orgId }),
    }),
    { name: 'grixi-active-org' }
  )
)
```

---

## 7. Tenant Onboarding (Sin Supabase)

```typescript
// lib/tenant/onboarding.ts
import { db } from '~/lib/db/client'
import { organizations, organizationMembers } from '~/lib/db/schema'

export async function onboardNewTenant(data: {
  name: string
  slug: string
  ownerUserId: string
}) {
  return db.transaction(async (tx) => {
    // 1. Crear organización
    const [org] = await tx.insert(organizations).values({
      name: data.name,
      slug: data.slug,
      isActive: true,
    }).returning()

    // 2. Asignar owner
    await tx.insert(organizationMembers).values({
      organizationId: org.id,
      userId: data.ownerUserId,
      role: 'owner',
      isActive: true,
    })

    // 3. Seed de datos iniciales (config, defaults)
    await seedTenantDefaults(tx, org.id)

    return org
  })
}
```
