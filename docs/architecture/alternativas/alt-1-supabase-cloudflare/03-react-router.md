# Alternativa 1 — React Router v7 (ex-Remix)

> Guía de migración de Next.js 16 App Router a React Router v7 framework mode sobre Cloudflare Workers.

---

## 1. ¿Qué es React Router v7?

React Router v7 es la **evolución de Remix**. En 2024, Remix se fusionó oficialmente con React Router:

| Antes (2023) | Ahora (2025+) |
|---|---|
| React Router (solo routing) | React Router v7 **framework mode** (full-stack) |
| Remix (full-stack framework) | Deprecated — todo es React Router v7 |

**React Router v7 en framework mode** = lo que era Remix + lo mejor de React Router, con adapter oficial GA para Cloudflare Workers.

---

## 2. ¿Por Qué React Router v7 y No Next.js?

| Factor | Next.js en Cloudflare | React Router v7 en Cloudflare |
|---|---|---|
| **Adapter** | `@opennextjs/cloudflare` (community) | ✅ **Adapter oficial Cloudflare (GA)** |
| **Mantenido por** | Comunidad open-source | Cloudflare + Shopify |
| **Acceso a CF APIs** | Limitado | ✅ Workers KV, D1, R2, Durable Objects nativos |
| **Bundle size** | ~85KB base | ~60KB base |
| **Data fetching** | Mezcla: RSC + fetch + use | Un solo pattern: `loader()` + `action()` |
| **Forms** | react-hook-form + Server Actions | ✅ `<Form>` nativo, progressive enhancement |
| **Error handling** | Requiere config manual | ✅ `ErrorBoundary` built-in por ruta |
| **Streaming** | Soportado | ✅ `defer()` con streaming SSR |

---

## 3. Conceptos Equivalentes

| Next.js 16 | React Router v7 | Notas |
|---|---|---|
| `page.tsx` | `route.tsx` con `default export` | Componente de la ruta |
| `layout.tsx` | `root.tsx` + layout routes | Layouts anidados |
| `loading.tsx` | `HydrateFallback` | Skeleton durante carga |
| `error.tsx` | `ErrorBoundary` export | Error boundary por ruta |
| `not-found.tsx` | Ruta catch-all `$.tsx` | 404 handling |
| Server Components (RSC) | `loader()` function | Data fetching server-side |
| Server Actions (`'use server'`) | `action()` function | Mutations server-side |
| `generateMetadata()` | `meta()` function | SEO metadata por ruta |
| `middleware.ts` | Middleware de React Router | Auth, tenant resolution |
| `useSearchParams()` | `useSearchParams()` | ❌ Mismo nombre, misma API |
| `useRouter()` | `useNavigate()` | Navegación programática |
| `<Link>` | `<Link>` | ❌ Mismo componente |
| `revalidatePath()` | `revalidate()` / recarga automática | Post-action |
| `next/image` | Cloudflare Images o `<img>` custom | Image optimization |
| `next/font` | `@fontsource/*` packages | Font loading |
| `NEXT_PUBLIC_*` env vars | `.dev.vars` + `context.cloudflare.env` | Environment variables |

---

## 4. Ejemplos de Migración

### 4.1 Data Fetching

```typescript
// ❌ ANTES (Next.js Server Component)
// app/warehouses/page.tsx
export default async function WarehousesPage() {
  const supabase = await createServerClient()
  const { data } = await supabase.from('warehouses').select('*')
  return <WarehouseList warehouses={data} />
}

// ✅ DESPUÉS (React Router v7 Loader)
// app/routes/warehouses.tsx
import { data } from 'react-router'
import type { Route } from './+types/warehouses'

export async function loader({ context }: Route.LoaderArgs) {
  const supabase = createClient(context.cloudflare.env)
  const { data: warehouses } = await supabase.from('warehouses').select('*')
  return data({ warehouses })
}

export default function WarehousesPage({ loaderData }: Route.ComponentProps) {
  return <WarehouseList warehouses={loaderData.warehouses} />
}
```

### 4.2 Mutations (Actions)

```typescript
// ❌ ANTES (Next.js Server Action)
// app/warehouses/actions.ts
'use server'
export async function createWarehouse(formData: FormData) {
  const supabase = await createServerClient()
  const parsed = warehouseSchema.parse(Object.fromEntries(formData))
  await supabase.from('warehouses').insert(parsed)
  revalidatePath('/warehouses')
}

// ✅ DESPUÉS (React Router v7 Action)
// app/routes/warehouses.tsx
export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData()
  const parsed = warehouseSchema.parse(Object.fromEntries(formData))
  const supabase = createClient(context.cloudflare.env)
  await supabase.from('warehouses').insert(parsed)
  return data({ success: true })
  // React Router revalida automáticamente los loaders después de un action
}

// En el componente — ¡sin useEffect ni estados manuales!
export default function WarehousesPage({ loaderData }: Route.ComponentProps) {
  return (
    <Form method="post">
      <input name="name" required />
      <button type="submit">Crear</button>
      {/* Progressive enhancement: funciona sin JS! */}
    </Form>
  )
}
```

### 4.3 Metadata / SEO

```typescript
// ❌ ANTES (Next.js)
export function generateMetadata() {
  return { title: 'Almacenes — GRIXI', description: '...' }
}

// ✅ DESPUÉS (React Router v7)
export function meta() {
  return [
    { title: 'Almacenes — GRIXI' },
    { name: 'description', content: '...' },
  ]
}
```

### 4.4 Error Handling

```typescript
// ✅ React Router v7 — ErrorBoundary por ruta (built-in)
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Error</h1>
        <p>{error.message}</p>
      </div>
    </div>
  )
}
```

---

## 5. Estructura de Rutas

```
app/
├── root.tsx                      ← Layout raíz (equivale a layout.tsx)
├── routes.ts                     ← Definición de rutas
├── routes/
│   ├── _index.tsx                ← Landing page (/)
│   ├── login.tsx                 ← /login
│   ├── dashboard.tsx             ← /dashboard (layout)
│   ├── dashboard._index.tsx      ← /dashboard (contenido)
│   ├── warehouses.tsx            ← /warehouses (layout)
│   ├── warehouses._index.tsx     ← /warehouses (lista)
│   ├── warehouses.$id.tsx        ← /warehouses/:id (detalle)
│   ├── compras.tsx               ← /compras (layout)
│   ├── compras._index.tsx        ← /compras (lista)
│   ├── finanzas.tsx              ← /finanzas
│   ├── rrhh.tsx                  ← /rrhh
│   └── $.tsx                     ← Catch-all (404)
├── components/                   ← Componentes (REUTILIZADOS de Next.js)
│   ├── ui/                       ← shadcn/ui (sin cambios)
│   ├── layout/                   ← Sidebar, Topbar (sin cambios)
│   └── shared/                   ← DataTable, Charts (sin cambios)
├── lib/
│   ├── supabase/                 ← Clients (adaptados a CF env)
│   ├── store/                    ← Zustand (sin cambios)
│   └── utils/                    ← Helpers (sin cambios)
└── types/                        ← Types globales (sin cambios)
```

---

## 6. Plan de Migración

| Fase | Tareas | Tiempo |
|---|---|---|
| **1. Setup** | Crear proyecto React Router v7 + wrangler.toml + Cloudflare config | 1 día |
| **2. Layout** | Migrar root layout, sidebar, topbar, theme provider | 2 días |
| **3. Rutas Core** | Migrar rutas principales (dashboard, warehouses, compras) a loaders/actions | 3-4 días |
| **4. Componentes** | Copiar componentes UI (son React, funcionan igual) | 1 día |
| **5. Auth** | Configurar Supabase Auth con middleware de React Router | 1-2 días |
| **6. Realtime** | Migrar suscripciones de Supabase Realtime | 1 día |
| **7. Testing** | Verificar todas las rutas, forms, auth, realtime | 2-3 días |
| **8. Deploy** | Configurar CI/CD con GitHub Actions + Wrangler | 1 día |
| **Total** | | **~2-3 semanas** |
