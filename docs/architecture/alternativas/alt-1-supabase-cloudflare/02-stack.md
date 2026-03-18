# Alternativa 1 — Stack Tecnológico Completo

> Comparación detallada de cada capa tecnológica: qué cambia, qué se mantiene, y por qué.

---

## Stack Completo

| Capa | Tecnología | ¿Cambia? | Justificación |
|---|---|---|---|
| **Framework** | React Router v7 (framework mode) | ✅ Cambia | Adapter oficial GA de Cloudflare. Loaders/Actions nativos |
| **Runtime** | Cloudflare Workers | ✅ Cambia | 310+ PoPs, 0ms cold starts, reemplaza Vercel Serverless |
| **Lenguaje** | TypeScript (strict mode) | ❌ Igual | Ecosistema estándar, Zod, Drizzle — todo TypeScript |
| **UI Library** | React 19 | ❌ Igual | React Router v7 usa React — todos los componentes se reutilizan |
| **UI Components** | shadcn/ui + CVA | ❌ Igual | shadcn funciona con cualquier framework React |
| **Estilos** | Tailwind CSS 4 | ❌ Igual | Compatible con React Router v7, mismo DX |
| **Estado Client** | Zustand | ❌ Igual | Store global, sin dependencia de meta-framework |
| **Animaciones** | Framer Motion + GSAP + Lenis | ❌ Igual | Librería de React, funciona igual |
| **3D** | React Three Fiber + drei | ❌ Igual | Librería de React, no depende del meta-framework |
| **ORM** | Drizzle ORM | ✅ Nuevo | Type-safe, ~7KB. Mejor que supabase-js para queries complejas |
| **DB** | Supabase PostgreSQL (OrioleDB) | ❌ Igual | Toda la estrategia RLS se mantiene intacta |
| **Auth** | Supabase Auth | ❌ Igual | Google OAuth, MFA, JWT hooks — todo igual |
| **Realtime** | Supabase Realtime | ❌ Igual | CDC, Presence, Broadcast — sin cambios |
| **Storage** | Supabase Storage + Cloudflare R2 (cache) | ⚠️ Mejora | R2 como CDN acelerado frente a Supabase Storage |
| **Edge Functions** | Supabase Edge Functions (Deno) | ❌ Igual | Webhooks, email, SAP — sin cambio |
| **Cache** | Cloudflare Workers KV | ✅ Nuevo | ISR / cache de datos en el edge |
| **AI** | Gemini 2.0 Flash Lite | ❌ Igual | Llamada vía loader/action server-side |
| **CDN + WAF** | Cloudflare Pro | ❌ Igual | Ya pagamos CF, ahora también es nuestro host |
| **CI/CD** | GitHub Actions → wrangler deploy | ✅ Cambia | Wrangler CLI en vez de Vercel GitHub Integration |
| **Repo** | GitHub Teams | ❌ Igual | — |
| **Fuentes** | Instrument Serif + Geist Sans + Geist Mono | ❌ Igual | Vía `@fontsource` o CDN |
| **Validación** | Zod | ❌ Igual | Client + Server, en loaders/actions |
| **Forms** | `<Form>` nativo de React Router + Zod | ✅ Cambia | Progressive enhancement nativo. Reemplaza react-hook-form |
| **Monitoreo** | Cloudflare Analytics + Supabase Dashboard | ⚠️ Cambia | CF Analytics en vez de Vercel Dashboard |

---

## Resumen de Migración

| Categoría | Cantidad de técnologías |
|---|---|
| **Se mantiene sin cambios** | 16 |
| **Cambia o se agrega** | 7 |
| **Se elimina** | 1 (Vercel) |

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
| `createServerClient()` | Supabase SSR → Drizzle ORM (opcional) | Bajo |
| `next/font` | → `@fontsource` packages | Bajo |
| `next.config.ts` | → `wrangler.toml` | Bajo |
| Middleware | `middleware.ts` Next.js → React Router middleware | Bajo |

### 🔄 Rewrite Necesario

| Componente | Detalle |
|---|---|
| `next/image` | → Componente custom con Cloudflare Images o `<img>` optimizado |
| `revalidatePath()` | → `revalidate()` API de React Router o Workers KV invalidation |
| `generateMetadata()` | → `meta()` function de React Router |
| `loading.tsx` / `error.tsx` | → React Router `ErrorBoundary` por ruta |
