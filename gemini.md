# Grixi — Reglas del Proyecto

## Identidad

- **Nombre:** Grixi
- **Tipo:** Plataforma SaaS enterprise multi-tenant
- **Misión:** Ser la interconexión inteligente de toda la empresa
- **Idioma:** Español (toda la UI, comentarios de código en inglés)

## Stack Tecnológico

| Capa          | Tecnología                                 | Versión           |
| ------------- | ------------------------------------------ | ----------------- |
| Framework     | Next.js (App Router)                       | 16+               |
| UI Runtime    | React                                      | 19+               |
| Lenguaje      | TypeScript                                 | 5.x (strict mode) |
| Estilos       | Tailwind CSS                               | 4+                |
| Componentes   | shadcn/ui (customizado)                    | latest            |
| Estado Client | Zustand                                    | 5+                |
| Animaciones   | Framer Motion + GSAP + Lenis               | latest            |
| 3D            | React Three Fiber + drei                   | latest            |
| Backend       | Supabase (PostgreSQL 17.6 + OrioleDB)      | latest            |
| Auth          | Supabase Auth (Google OAuth)               | latest            |
| Real-time     | Supabase Realtime                          | latest            |
| AI            | Google Gemini 3.1 Flash Lite Preview       | latest            |
| Deploy        | Vercel                                     | latest            |
| Monorepo      | Turborepo                                  | latest            |
| Fuentes       | Instrument Serif + Geist Sans + Geist Mono | latest            |

## Reglas de Código

### TypeScript

- **Strict mode siempre habilitado**
- Usar `type` sobre `interface` salvo para extensión
- No usar `any` — usar `unknown` si necesario
- Nombrar types en PascalCase con sufijo descriptivo: `UserProfile`, `WarehouseConfig`
- Los enums NO se usan — usar union types: `type Status = 'active' | 'expired'`

### React / Next.js

- **Server Components por defecto** — `"use client"` solo cuando se necesite estado, eventos, o hooks del browser
- **No** usar `useEffect` para data fetching — usar Server Components o Server Actions
- Composición sobre herencia — usar Compound Components (skill: `vercel-composition-patterns`)
- Todos los form inputs deben usar `react-hook-form` + `zod` validation
- Imágenes siempre con `next/image`, fuentes con `next/font`
- Metadata dinámica con `generateMetadata()` en cada page

### Naming Conventions

- **Archivos de componentes:** `kebab-case.tsx` (ej: `data-table.tsx`)
- **Componentes React:** `PascalCase` (ej: `DataTable`)
- **Hooks:** `camelCase` con prefijo `use` (ej: `useWarehouse`)
- **Utilidades/libs:** `camelCase` (ej: `formatDate.ts`)
- **Constantes:** `UPPER_SNAKE_CASE` (ej: `MAX_RACK_ROWS`)
- **Rutas de API:** `kebab-case` (ej: `/api/warehouse-stats`)
- **Tablas SQL:** `snake_case` plural (ej: `rack_positions`)
- **Funciones SQL:** `snake_case` con prefijo del dominio (ej: `warehouse_get_occupancy`)

### CSS / Tailwind

- Usar CSS variables para design tokens (definidas en `globals.css`)
- Usar `cn()` helper (clsx + tailwind-merge) para clases condicionales
- Componentes UI en `components/ui/` siguen patrón shadcn/ui con CVA
- Breakpoints: mobile-first (`sm:`, `md:`, `lg:`, `xl:`)
- Dark mode con clase `dark` (gestionado por `next-themes`)

### Supabase

- **RLS habilitado en TODAS las tablas sin excepción**
- Usar `createServerClient` en Server Components y Server Actions
- Usar `createBrowserClient` solo en Client Components
- Las queries complejas van en funciones SQL (RPCs), no en el cliente
- Indexes en TODAS las columnas usadas en WHERE y JOIN
- Connection pooling siempre habilitado

### Estructura de Carpetas

```
src/
├── app/              → Páginas y layouts (App Router)
├── components/       → Componentes reutilizables
│   ├── ui/           → shadcn/ui base
│   ├── layout/       → Sidebar, Topbar, etc.
│   ├── shared/       → Cross-feature (DataTable, Charts)
│   └── [module]/     → Module-specific
├── features/         → Lógica de negocio por módulo
│   └── [module]/
│       ├── components/
│       ├── hooks/
│       ├── actions/  → Server Actions
│       ├── utils/
│       └── types.ts
├── lib/              → Utilidades core
│   ├── supabase/     → Clients
│   ├── gemini/       → AI client
│   ├── hooks/        → Global hooks
│   ├── store/        → Zustand stores
│   └── utils/        → Helpers
├── types/            → Types globales
└── config/           → Configuración
```

### Git

- **Branch principal:** `main`
- **Feature branches:** `feature/[module]-[feature]` (ej: `feature/warehouse-3d`)
- **Commits:** Conventional Commits en inglés (`feat:`, `fix:`, `docs:`, `refactor:`)
- **PR required** para merge a main (cuando haya equipo)

### AI (Gemini)

- Modelo: `gemini-2.0-flash-lite` (API preview)
- Llamadas SIEMPRE desde Server Actions o Edge Functions — NUNCA desde el client
- API key en `.env.local` como `GEMINI_API_KEY`
- Implementar rate limiting y caching de respuestas
- Function calling para acciones interactivas en la UI

### Performance

- Core Web Vitals como prioridad: LCP < 2.5s, FID < 100ms, CLS < 0.1
- Dynamic imports para módulos pesados (Three.js, Charts)
- Suspense boundaries en cada sección de datos
- Skeleton loading en lugar de spinners
- Optimistic updates para acciones del usuario

### Seguridad

- No exponer API keys en el cliente
- Sanitizar TODA input del usuario
- RLS en Supabase como primera línea de defensa
- Validación con Zod en client Y server
- CSRF protection en Server Actions
- `Content-Security-Policy` headers configurados
