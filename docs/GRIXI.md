# GRIXI — Plataforma SaaS Enterprise

> **La interconexión inteligente de toda la empresa.**
> Estado actual: **Demo funcional** · Última actualización: 14 de marzo, 2026.

---

## 1. ¿Qué es GRIXI?

GRIXI es una plataforma SaaS **multi-tenant** diseñada para centralizar la gestión operativa de empresas industriales y corporativas. Funciona como un **ERP moderno basado en la nube** que conecta almacenes, compras, finanzas, talento humano y más — todo con inteligencia artificial integrada y visualización 3D en tiempo real.

### Propuesta de Valor

- **Un solo lugar** para toda la operación: inventarios, compras, RRHH, finanzas
- **IA integrada** (GRIXI AI) que analiza datos y responde preguntas en lenguaje natural
- **3D inmersivo** para monitoreo de almacenes con digital twins
- **PWA nativa** — funciona como app en iPhone/Android sin App Store
- **Multi-tenant** — una instancia sirve múltiples empresas con total aislamiento de datos

---

## 2. Estado Actual de la Demo

La demo es una **aplicación funcional completa** desplegada en producción con datos sintéticos realistas.

### Módulos Activos

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| **Dashboard** | ✅ Funcional | KPIs principales, gráficos de ocupación, actividad reciente |
| **Almacenes** | ✅ Funcional | Vista 2D con cards + Vista 3D con Three.js, detalle de racks y posiciones |
| **Compras** | ✅ Funcional | Órdenes de compra, requisiciones, proveedores, recepciones |
| **Finanzas** | ✅ Funcional | Libro Mayor, CxC, CxP, presupuestos, transacciones |
| **RRHH** | ✅ Funcional | Empleados, asistencia, nómina, evaluaciones, feed de actividad |
| **Usuarios** | ✅ Funcional | Gestión de usuarios, roles, permisos, sesiones activas |
| **Administración** | ✅ Funcional | Configuración del sistema, audit logs |
| **GRIXI AI** | ✅ Funcional | Chat con IA, canvas, gráficos generados, contexto multi-módulo |
| **Command Center** | ✅ Funcional | Paleta de comandos (⌘K), navegación rápida |

### Datos de la Demo

| Tabla | Registros | Descripción |
|-------|-----------|-------------|
| `warehouses` | 5 | Almacenes con dimensiones 3D |
| `racks` | 306 | Racks distribuidos en los almacenes |
| `rack_positions` | 8,163 | Posiciones individuales con estado |
| `inventory` | 6,869 | Items de inventario con SKU, lotes, fechas |
| `products` | 60 | Catálogo de productos por categoría |
| `purchase_orders` | 200 | Órdenes de compra con items |
| `purchase_order_items` | 605 | Líneas de detalle de cada OC |
| `vendors` | 12 | Proveedores con scoring |
| `finance_transactions` | 787 | Transacciones financieras |
| `hr_employees` | 80 | Empleados con datos completos |
| `hr_attendance_records` | 9,440 | Registros de asistencia |
| `hr_payroll_records` | 480 | Registros de nómina |
| `hr_performance_reviews` | 158 | Evaluaciones de desempeño |
| `profiles` | 38 | Usuarios registrados |
| `audit_logs` | 658 | Logs de auditoría |
| `ai_conversations` | 30 | Conversaciones con la IA |
| `ai_messages` | 117 | Mensajes de chat IA |
| `activity_tracking` | 5,001 | Tracking de actividad de usuarios |

> **Total: 44 tablas** · Todas con **RLS habilitado** · 1 organización demo activa

---

## 3. Stack Tecnológico

### Frontend

| Tecnología | Versión | Uso |
|------------|---------|-----|
| **Next.js** (App Router) | `16.1.6` | Framework principal, Server Components, Server Actions |
| **React** | `19.2.3` | UI library con RSC |
| **TypeScript** | `5.x` (strict) | Lenguaje — todo tipado estricto |
| **Tailwind CSS** | `4.x` | Estilos utility-first con design tokens |
| **shadcn/ui** | latest | Componentes base (Button, Dialog, etc.) |
| **Framer Motion** | `12.35.1` | Animaciones y transiciones |
| **Recharts** | `3.8.0` | Gráficos y visualización de datos |
| **Three.js** | `0.183.2` | Renderizado 3D (almacenes) |
| **@react-three/fiber** | latest | React wrapper para Three.js |
| **@react-three/drei** | latest | Helpers 3D (OrbitControls, Text, Html) |
| **Zustand** | `5.0.11` | Estado global del cliente |
| **GSAP** | `3.14.2` | Animaciones avanzadas |
| **Lenis** | `1.3.18` | Smooth scrolling |
| **Lucide React** | latest | Sistema de iconos |
| **Zod** | `4.3.6` | Validación de schemas |
| **React Hook Form** | `7.71.2` | Manejo de formularios |

### Backend

| Tecnología | Uso |
|------------|-----|
| **Supabase** (Pro) | Base de datos PostgreSQL 17.6 (OrioleDB), Auth, Realtime, Storage, Edge Functions |
| **Supabase Auth** | Google OAuth + Email/Password, JWT con custom claims |
| **Supabase Realtime** | Notificaciones, actualizaciones en vivo, chat |
| **Supabase Edge Functions** | AI proxy (Gemini), webhooks, emails, crons |
| **PostgREST** | API REST automática con RLS |
| **Row Level Security (RLS)** | Aislamiento multi-tenant en todas las tablas |

### IA

| Tecnología | Uso |
|------------|-----|
| **Google Gemini 2.0 Flash Lite** | Motor de IA para chat, análisis, recomendaciones |
| **Function Calling** | Acciones interactivas desde la IA (generar gráficos, navegar) |
| **Context Injection** | Enriquecimiento de prompts con datos reales de cada módulo |

### Infraestructura

| Servicio | Plan | Uso |
|----------|------|-----|
| **Vercel** | Pro | Hosting, builds, preview deployments, edge middleware |
| **Cloudflare** | Pro | CDN, WAF, DDoS protection, SSL/TLS |
| **GitHub** | Teams | Monorepo Turborepo, CI/CD, code review |

### Fuentes

| Fuente | Uso |
|--------|-----|
| **Instrument Serif** | Títulos y headings |
| **Geist Sans** | Texto principal (body) |
| **Geist Mono** | Código y datos tabulares |

---

## 4. Arquitectura

### Visión General

```
┌──────────────────────────────────────────────────────────────┐
│                     USUARIOS FINALES                         │
│              PWA (iOS/Android) + Desktop Web                 │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
                   ┌───────────────┐
                   │  CLOUDFLARE   │  CDN · WAF · DDoS · SSL
                   └───────┬───────┘
                           ↓
              ┌────────────┴────────────┐
              ↓                         ↓
     ┌────────────────┐       ┌─────────────────┐
     │    VERCEL       │       │    SUPABASE      │
     │                │       │                 │
     │  Next.js 16    │──────→│  PostgreSQL     │
     │  App Router    │  API  │  Auth (OAuth)   │
     │  RSC + SSR     │       │  Realtime       │
     │  Server Actions│       │  Edge Functions │
     │                │       │  Storage        │
     └────────────────┘       └─────────────────┘
                                      │
                              ┌───────┴───────┐
                              │  GEMINI AI    │
                              │  (via Edge)   │
                              └───────────────┘
```

### Patrón Arquitectónico

GRIXI es un **monolito moderno** — toda la lógica vive en Next.js con Server Components y Server Actions. No hay backend separado.

| Capa | Implementación |
|------|----------------|
| **UI** | React 19 Server Components (default) + Client Components donde se necesita interactividad |
| **Lógica de negocio** | Server Actions (formularios, mutaciones) + SQL Functions (queries complejas) |
| **Datos** | Supabase PostgreSQL con RLS — PostgREST API automática |
| **Auth** | Supabase Auth con Google OAuth, JWT, custom claims por organización |
| **Real-time** | Supabase Realtime con canales filtrados por `organization_id` |
| **AI** | Edge Functions como proxy a Gemini con context injection |
| **Archivos** | Supabase Storage con políticas por tenant |

### Estructura del Proyecto

```
grixi/
├── apps/
│   └── web/                    ← Next.js 16 App
│       └── src/
│           ├── app/            ← Pages y Layouts (App Router)
│           │   ├── (platform)/ ← Layout principal con dot-grid
│           │   │   ├── dashboard/
│           │   │   ├── almacenes/
│           │   │   ├── compras/
│           │   │   ├── finanzas/
│           │   │   ├── rrhh/
│           │   │   ├── usuarios/
│           │   │   ├── administracion/
│           │   │   ├── ai/
│           │   │   └── command-center/
│           │   ├── login/
│           │   └── globals.css
│           ├── components/     ← Componentes reutilizables
│           │   ├── ui/         ← shadcn/ui base
│           │   ├── layout/     ← Sidebar, Nav, GrixiOrb
│           │   └── shared/     ← DataTable, Charts
│           ├── features/       ← Lógica por módulo
│           │   ├── almacenes/  ← 3D, HUD, racks, búsqueda
│           │   ├── compras/    ← OC, requisiciones, proveedores
│           │   ├── finance/    ← Transacciones, presupuestos
│           │   ├── rrhh/       ← Empleados, asistencia, nómina
│           │   ├── ai/         ← Chat, canvas, voice
│           │   └── auth/       ← Login, passkeys
│           ├── lib/            ← Utilidades core
│           │   ├── supabase/   ← Server + Browser clients
│           │   ├── hooks/      ← Global hooks
│           │   └── utils/      ← Helpers (cn, formatDate, etc.)
│           └── types/          ← Types globales
├── docs/                       ← Documentación
└── turbo.json                  ← Turborepo config
```

### Multi-Tenant

- **Estrategia:** Shared Database + Row Level Security con `organization_id`
- **Aislamiento:** Cada fila tiene `organization_id` → RLS filtra automáticamente
- **Auth:** JWT con custom claims que incluyen `org_ids[]`
- **Dominio:** Wildcard `*.grixi.app` (cada empresa accede en su subdominio)
- **44 tablas** con RLS habilitado sin excepción

---

## 5. Features Destacados

### 🏭 Almacenes 3D (Digital Twin)

- Visualización 3D completa del almacén con **Three.js + React Three Fiber**
- Racks interactivos con colores por categoría de producto
- **8 modos de visualización:** Normal, Heat Map, ABC, Antigüedad, Peligros, Conteo Cíclico
- **HUD interactivo:** IoT sensors, operarios, wave management, alertas, capacidad, slotting
- **Vista FPS:** recorre el almacén en primera persona (WASD)
- **Tutorial guiado** de 8 pasos con navegación automática
- Forklifts animados, partículas, picking paths
- Búsqueda de productos por nombre/SKU con navegación al rack

### 🤖 GRIXI AI

- Chat en lenguaje natural sobre datos de todos los módulos
- **Canvas split-view** para generar gráficos interactivos (Recharts)
- **Generación de imágenes** con Gemini
- **Context injection** — la IA recibe datos reales del módulo seleccionado
- Multi-módulo: almacenes + compras + finanzas + RRHH en una respuesta

### 📱 PWA (Progressive Web App)

- Instalable como app nativa en iOS y Android
- Safe area handling para iPhone (notch, home indicator)
- Bottom navigation dock con haptic feedback
- Soporte offline parcial
- View Transition API para transiciones fluidas entre temas
- Prevención de zoom en inputs (font-size 16px + user-scalable=no)

### 🎨 Diseño Premium

- **Dot-grid background** animado con blur diferenciado
- **Dark/Light mode** con transiciones suaves (View Transition API)
- **Glassmorphism** — backdrop-blur en barras y paneles
- **GrixiOrb** — botón flotante de acceso rápido a la IA
- Tipografía: Instrument Serif (headings) + Geist Sans (body) + Geist Mono (datos)
- Skeleton loading en lugar de spinners
- Paleta de comandos (⌘K) para navegación rápida

---

## 6. Seguridad

| Capa | Protección |
|------|-----------|
| **Cloudflare** | WAF, DDoS unmetered, bot protection, SSL/TLS |
| **Vercel** | Edge middleware, environment secrets, CSP headers |
| **Supabase Auth** | JWT verification, Google OAuth, rate limiting |
| **RLS** | Row Level Security en las 44 tablas — aislamiento a nivel de base de datos |
| **Código** | Zod validation (client + server), CSRF en Server Actions, no API keys en cliente |
| **Passkeys** | WebAuthn para autenticación biométrica (en desarrollo) |

---

## 7. URLs

| Recurso | URL |
|---------|-----|
| **Demo Production** | [web-two-beta-20.vercel.app](https://web-two-beta-20.vercel.app) |
| **Repositorio** | [github.com/diegomera1/grixi](https://github.com/diegomera1/grixi) |
| **Supabase** | Panel de administración de Supabase |

---

## 8. Roadmap

| Fase | Estado | Descripción |
|------|--------|-------------|
| **Fase 1: Demo** | ✅ Actual | Plataforma funcional con datos sintéticos, todos los módulos operativos |
| **Fase 2: MVP** | 🔜 Próximo | Multi-tenant real, onboarding de empresas, datos reales |
| **Fase 3: Producción** | 📋 Planificado | Cloudflare WAF, custom domains, PITR, Supabase Team |
| **Fase 4: Escala** | 📋 Planificado | 10-20 empresas, integraciones SAP, SSO enterprise |
