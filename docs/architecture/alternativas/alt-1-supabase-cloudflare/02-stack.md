# Alternativa 1 — Stack Tecnológico Completo

> Comparación detallada de cada capa tecnológica: qué cambia, qué se mantiene, y por qué.
> **Actualizado:** 20 de marzo, 2026. Alineado con Vite 8 + Rolldown, Hyperdrive, y React Router v7.13.

---

## Stack Completo

| Capa | Tecnología | ¿Cambia? | Justificación |
|---|---|---|---|
| **Framework** | React Router v7.13+ (framework mode) | ✅ Cambia | Adapter oficial GA Cloudflare. Loaders/Actions nativos. `crossOrigin` prop, stable API refresh |
| **Build Tool** | **Vite 8** | ✅ Cambia | Build unificado con Rolldown (Rust). 10-30x más rápido. Released 12 Marzo 2026 |
| **Bundler** | **Rolldown** (via Vite 8) | ✅ Nuevo | Un solo bundler dev+prod. Elimina inconsistencias dev/prod |
| **JS Transforms** | **Oxc** (via Vite 8) | ✅ Nuevo | React Refresh sin Babel. `@vitejs/plugin-react v6` |
| **CSS Minifier** | **Lightning CSS** (via Vite 8) | ✅ Nuevo | CSS moderno, output más pequeño. Dependencia estándar |
| **Runtime** | Cloudflare Workers (V8 isolates) | ✅ Cambia | 310+ PoPs, 0ms cold starts, reemplaza Vercel Serverless |
| **Lenguaje** | TypeScript 5.x (strict mode) | ❌ Igual | Ecosistema estándar |
| **UI Library** | React 19 | ❌ Igual | Todos los componentes se reutilizan |
| **UI Components** | shadcn/ui + CVA | ❌ Igual | Funciona con cualquier framework React |
| **Estilos** | Tailwind CSS 4 | ❌ Igual | Compatible con Vite 8 |
| **Estado Client** | Zustand 5 | ❌ Igual | Store global, sin dependencia de meta-framework |
| **Animaciones** | Framer Motion + GSAP + Lenis | ❌ Igual | Librería React pura |
| **3D** | React Three Fiber + drei | ❌ Igual | Librería React pura |
| **Gráficos** | Recharts | ❌ Igual | — |
| **Tablas** | TanStack Table | ❌ Igual | — |
| **ORM** | **Drizzle ORM** | ✅ Nuevo | Type-safe, ~7KB. Mejor que supabase-js para queries complejas |
| **DB Connection** | **Cloudflare Hyperdrive** | ✅ Nuevo | Connection pooling global para PostgreSQL. ~4x menos latencia |
| **DB** | Supabase PostgreSQL 17 (OrioleDB) | ❌ Igual | Schema, RLS, extensions — todo intacto |
| **Auth** | Supabase Auth | ❌ Igual | Google OAuth, MFA, JWT hooks |
| **Realtime** | Supabase Realtime | ❌ Igual | CDC, Presence, Broadcast (client-side) |
| **Storage** | Supabase Storage + **Cloudflare R2** (cache) | ⚠️ Mejora | R2 como CDN acelerado, $0 egress |
| **Edge Functions** | Supabase Edge Functions (Deno) | ❌ Igual | Webhooks, email, SAP |
| **Cache** | **Cloudflare Workers KV** | ✅ Nuevo | ISR / cache de datos en 310+ PoPs |
| **AI** | Gemini 2.0 Flash Lite | ❌ Igual | Llamada vía loader/action server-side |
| **CDN + WAF** | Cloudflare Pro | ❌ Igual | Ya pagamos CF, ahora también es host |
| **CI/CD** | GitHub Actions → Vite 8 build → `wrangler deploy` | ✅ Cambia | Build ~5-10s (Rolldown). Wrangler deploy al edge |
| **Repo** | GitHub Teams | ❌ Igual | — |
| **Fuentes** | `@fontsource/*` packages | ✅ Cambia | Reemplaza `next/font` |
| **Validación** | Zod | ❌ Igual | Client + Server |
| **Forms** | `<Form>` nativo de React Router + Zod | ✅ Cambia | Progressive enhancement. Reemplaza react-hook-form |
| **Monitoreo** | CF Analytics + Sentry + Supabase Dashboard | ⚠️ Cambia | CF Analytics reemplaza Vercel Dashboard |

---

## Resumen de Migración

| Categoría | Cantidad |
|---|---:|
| **Se mantiene sin cambios** | 16 |
| **Cambia o se agrega** | 13 |
| **Se elimina** | 1 (Vercel) |

---

## Vite 8 Toolchain Unificado (Released 12 Marzo 2026)

```
Vite 8 (orquestador)
  ├── Rolldown (bundler — Rust, reemplaza esbuild + Rollup)
  ├── Oxc (transforms JS/TS — Rust, reemplaza Babel)
  └── Lightning CSS (minifier CSS — Rust, reemplaza esbuild CSS)

Todo mantenido por VoidZero (Evan You). Un solo equipo, un toolchain.
```

| Métrica | Antes (Vite 7 / Turbopack) | Ahora (Vite 8) |
|---|---|---|
| **Production build** | ~60-90s | **~5-10s** (Rolldown, hasta 87% más rápido) |
| **Dev server start** | ~2-3s | **~500ms** |
| **React Refresh** | Babel-based | **Babel-free** (Oxc via `@vitejs/plugin-react v6`) |
| **CSS output** | esbuild | **Lightning CSS** (más pequeño, moderno) |
| **Dev/Prod consistency** | ⚠️ Diferente bundler | ✅ **Mismo bundler** (Rolldown) |
| **tsconfig paths** | Plugin externo | ✅ **Built-in** (`resolve.tsconfigPaths: true`) |
| **Devtools** | Externo | ✅ **Integrado** (opt-in desde dev server) |
| **Wasm SSR** | ❌ | ✅ `.wasm?init` funciona en SSR |
| **Browser console** | — | ✅ Forward de logs del browser al terminal |
| **Decorator metadata** | Manual config | ✅ Automático (`emitDecoratorMetadata`) |

### Full Bundle Mode (Experimental)

Vite 8 incluye un modo experimental que bundlea módulos incluso en dev, para:
- Startup aún más rápido
- Menos requests de red en dev
- Reloads más rápidos

---

## Hyperdrive — Connection Pooling Global

**Nuevo en este stack.** Hyperdrive mantiene pools de conexiones TCP+TLS pre-establecidas desde cada PoP de Cloudflare hacia Supabase PostgreSQL.

| Sin Hyperdrive | Con Hyperdrive |
|---|---|
| TCP + TLS + PG auth en cada request | Conexión pool caliente |
| ~100-200ms primer query | **~20-30ms** primer query |
| Cada Worker abre/cierra conexión | Conexiones reusadas globalmente |

Incluido en Workers Paid. Se configura con una línea en `wrangler.toml`.

---

## Qué Se Reutiliza vs Qué Requiere Trabajo

### ✅ Reutilizable (0 rewrite)

- Todos los componentes UI (`components/ui/`)
- Tailwind config, `globals.css`, CSS variables, design tokens
- Zustand stores (`lib/store/`)
- Framer Motion animaciones
- React Three Fiber scenes y componentes 3D
- Zod schemas de validación
- Supabase migrations (SQL)
- Supabase Edge Functions
- Supabase RLS policies
- Types globales (`types/`)

### ⚠️ Requiere Adaptación

| Componente | De → A | Esfuerzo |
|---|---|---|
| Estructura de rutas | `app/` Next.js → `app/routes/` React Router | Medio |
| Server Components | RSC → `loader()` functions | Medio |
| Server Actions | `'use server'` → `action()` functions | Medio |
| DB client | `createServerClient()` → Drizzle ORM + Hyperdrive | Bajo |
| `next/font` | → `@fontsource` packages | Bajo |
| `next.config.ts` | → `wrangler.toml` | Bajo |
| Middleware | `middleware.ts` Next.js → React Router middleware | Bajo |
| Theme provider | `next-themes` → provider custom (simple) | Bajo |

### 🔄 Rewrite Necesario

| Componente | Detalle |
|---|---|
| `next/image` | → Cloudflare Images o `<img>` con lazy loading |
| `revalidatePath()` | → Revalidación automática post-action + Workers KV invalidation |
| `generateMetadata()` | → `meta()` function de React Router |
| `loading.tsx` / `error.tsx` | → React Router `ErrorBoundary` + `HydrateFallback` por ruta |

---

## Nota: TanStack Start como Alternativa Futura

**TanStack Start** (RC, Marzo 2026) es una alternativa a React Router v7 con:
- Types end-to-end automáticos (superior DX)
- TanStack Query integrado (cache automático)
- Cloudflare es **partner oficial** de hosting
- Deploy a Workers "funciona con zero issues" (reportes de la comunidad)

**Estado actual:** RC — funcional pero aún madurando. React Router v7 es la opción estable hoy. Monitorear TanStack Start para posible migración en 2027+ cuando alcance 1.0 estable.
