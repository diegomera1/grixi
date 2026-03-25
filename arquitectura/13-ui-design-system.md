# Alternativa 1 — Sistema de Diseño Premium GRIXI

> Paleta, tipografía, componentes, animaciones, 3D y responsive.
> Todo definido en CSS variables para dark/light mode.

---

## 1. Paleta de Colores

### Design Tokens (CSS Variables)

```css
/* globals.css — :root y .dark */
:root {
  /* Brand */
  --grixi-primary: 239 84% 67%;        /* #6366F1 — Índigo vibrante */
  --grixi-primary-hover: 239 84% 60%;
  --grixi-accent: 326 78% 60%;          /* #EC4899 — Rosa accent */
  --grixi-success: 142 76% 36%;         /* #16A34A — Verde */
  --grixi-warning: 38 92% 50%;          /* #F59E0B — Ámbar */
  --grixi-danger: 0 84% 60%;            /* #EF4444 — Rojo */

  /* Backgrounds */
  --background: 0 0% 100%;              /* Blanco */
  --foreground: 240 10% 3.9%;           /* Casi negro */
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;

  /* Borders */
  --border: 240 5.9% 90%;
  --ring: 239 84% 67%;                  /* Same as primary */

  /* Sidebar */
  --sidebar: 0 0% 98%;
  --sidebar-foreground: 240 5.3% 26.1%;
  --sidebar-accent: 240 4.8% 95.9%;

  /* Module-specific accents */
  --module-almacenes: 142 76% 36%;      /* Verde warehouse */
  --module-compras: 38 92% 50%;         /* Ámbar procurement */
  --module-finanzas: 217 91% 60%;       /* Azul finance */
  --module-rrhh: 326 78% 60%;           /* Rosa HR */
  --module-flota: 198 93% 60%;          /* Cyan fleet */
  --module-ai: 262 83% 58%;             /* Púrpura AI */
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --card: 240 10% 6%;
  --card-foreground: 0 0% 98%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --border: 240 3.7% 15.9%;
  --sidebar: 240 10% 5%;
  --sidebar-foreground: 240 4.8% 95.9%;
}
```

---

## 2. Tipografía

### Fuentes

| Fuente | Uso | Weight |
|---|---|---|
| **Instrument Serif** | Headings, hero text, brand moments | 400 (Regular) |
| **Geist Sans** | Body, UI, labels, navegación | 400, 500, 600, 700 |
| **Geist Mono** | Datos, tablas numéricas, código, logs | 400, 500 |

### Importación (sin next/font)

```typescript
// app/root.tsx
import '@fontsource/instrument-serif/400.css'
import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import '@fontsource/geist-sans/700.css'
import '@fontsource/geist-mono/400.css'
```

```css
/* globals.css */
:root {
  --font-serif: 'Instrument Serif', serif;
  --font-sans: 'Geist Sans', system-ui, sans-serif;
  --font-mono: 'Geist Mono', 'Fira Code', monospace;
}

body {
  font-family: var(--font-sans);
  font-feature-settings: 'rlig' 1, 'calt' 1;
}

h1, h2, h3 { font-family: var(--font-serif); }
code, pre, .tabular { font-family: var(--font-mono); }
.tabular-nums { font-variant-numeric: tabular-nums; }
```

### Escala Tipográfica

```css
/* Tailwind config — fontSize */
text-display:   3rem / 1.1     /* 48px — Hero de landing */
text-heading-1: 2.25rem / 1.2  /* 36px — Título de página */
text-heading-2: 1.5rem / 1.3   /* 24px — Secciones */
text-heading-3: 1.25rem / 1.4  /* 20px — Sub-secciones */
text-body:      0.875rem / 1.5  /* 14px — Body (base) */
text-small:     0.75rem / 1.5   /* 12px — Labels, captions */
text-xs:        0.625rem / 1.4  /* 10px — Micro text */
```

---

## 3. Componentes Base (shadcn/ui + CVA)

### Pattern de Componente

```typescript
// components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '~/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98]',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

// cn() helper = clsx + tailwind-merge
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Componentes Clave

| Componente | Fuente | Customización |
|---|---|---|
| Button | shadcn/ui | Active scale, colores custom |
| Card | shadcn/ui | Glassmorphism en dark, sombras suaves |
| Dialog | shadcn/ui | Backdrop blur, entrada animada |
| Sheet | shadcn/ui | Slide-in con Framer Motion |
| DataTable | TanStack Table | Zebra stripes, sticky header, skeleton |
| Tabs | shadcn/ui | Animated indicator |
| Select | shadcn/ui | Search integrado |
| Toast | Sonner | Custom theme con status colors |
| Skeleton | Custom | Shimmer animation con gradiente |

---

## 4. Animaciones

### Framer Motion — Patterns Estándar

```typescript
// lib/animations.ts — Variants reutilizables

// Fade in + slide up (para cards, contenido)
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
}

// Stagger children (para listas de cards)
export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } }
}

// Scale in (para modals, popovers)
export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2 }
}

// Slide in from right (para sheets, drawers)
export const slideInRight = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
  transition: { type: 'spring', damping: 30, stiffness: 300 }
}
```

### GSAP — Para Hero y Landing

```typescript
// Animations complejas que Framer Motion no maneja bien
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Hero KPI counter animation
gsap.to('.kpi-value', {
  textContent: targetValue,
  duration: 1.5,
  ease: 'power2.out',
  snap: { textContent: 1 },
  stagger: 0.2,
})

// Parallax scroll sections
ScrollTrigger.create({
  trigger: '.hero-section',
  start: 'top top',
  end: 'bottom top',
  scrub: true,
  animation: gsap.to('.hero-bg', { y: '30%', opacity: 0.3 }),
})
```

### Lenis — Smooth Scroll

```typescript
// app/root.tsx
import Lenis from 'lenis'

useEffect(() => {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  })

  function raf(time: number) {
    lenis.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)

  return () => lenis.destroy()
}, [])
```

---

## 5. Integración 3D (React Three Fiber)

### Carga Dinámica

```typescript
// components/shared/lazy-3d.tsx
import { lazy, Suspense } from 'react'
import { Skeleton } from '~/components/ui/skeleton'

const Warehouse3D = lazy(() => import('~/features/almacenes/components/warehouse-3d-scene'))

export function LazyWarehouse3D(props) {
  return (
    <Suspense fallback={<Skeleton className="w-full h-[600px] rounded-xl" />}>
      <Warehouse3D {...props} />
    </Suspense>
  )
}
```

### Patrones 3D

| Pattern | Uso |
|---|---|
| **Dynamic import** | Three.js (~700KB) solo se carga si el usuario navega a la vista 3D |
| **Open-top warehouse** | Modelo sin techo para ver racks desde arriba |
| **Color por ocupación** | Verde (<60%), Amarillo (60-85%), Rojo (>85%) |
| **Fly-through camera** | Animación automática con OrbitControls override |
| **Click to select** | Raycasting para seleccionar cajas individuales |
| **HUD overlay** | Overlay HTML encima del canvas 3D |

---

## 6. Layout

### Estructura Principal

```
┌──────────────────────────────────────────────────────┐
│  Topbar (sticky, blur backdrop)                       │
│  [☰ toggle] [Breadcrumbs] [Search] [Theme] [Avatar]  │
├──────┬───────────────────────────────────────────────┤
│      │                                                │
│  S   │     Main Content                               │
│  i   │     (full width, responsive padding)           │
│  d   │                                                │
│  e   │     ┌─────────────────────────────────┐        │
│  b   │     │  Module Content                  │        │
│  a   │     │  (loaded via React Router)       │        │
│  r   │     └─────────────────────────────────┘        │
│      │                                                │
│  64  │                                    [AI Orb]    │
│  px  │                                                │
├──────┴───────────────────────────────────────────────┤
│  (No footer — SaaS apps don't need footers)           │
└──────────────────────────────────────────────────────┘
```

### Responsive Breakpoints

```css
/* Mobile first */
sm: 640px     /* Sidebar collapses to hamburger menu */
md: 768px     /* 2-column grids */
lg: 1024px    /* Sidebar visible, 3-column grids */
xl: 1280px    /* Full dashboard layout */
2xl: 1536px   /* Wider content area */
```

---

## 7. Data Visualization (Recharts)

### Theme Customizado

```typescript
// lib/chart-theme.ts
export const CHART_COLORS = {
  primary: 'hsl(239 84% 67%)',
  accent: 'hsl(326 78% 60%)',
  success: 'hsl(142 76% 36%)',
  warning: 'hsl(38 92% 50%)',
  danger: 'hsl(0 84% 60%)',
  muted: 'hsl(240 3.8% 46.1%)',
}

export const CHART_CONFIG = {
  style: {
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
  },
  grid: {
    strokeDasharray: '3 3',
    stroke: 'hsl(var(--border))',
  },
  tooltip: {
    contentStyle: {
      backgroundColor: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '8px',
      fontSize: 13,
    },
  },
}
```

### Patrones de Gráficos

| Tipo | Uso | Componente |
|---|---|---|
| **AreaChart** | Cash flow, tendencias, ventas | Gradiente fill + línea suave |
| **BarChart** | Comparativas, AR aging | Barras horizontales, coloreadas por status |
| **PieChart / DonutChart** | Distribución, composición | Occupancy rings en warehouse cards |
| **LineChart** | Series temporales | Spark lines en KPI cards |

---

## 8. Micro-Interacciones

```
✨ GRIXI Micro-Interactions

• Cards: hover → translateY(-2px) + sombra elevada + scale(1.01)
• Botones: active → scale(0.98) + 100ms delay
• Sidebar items: hover → bg-accent + 150ms ease-out
• Tabs: indicator → spring animation al cambio
• KPI numbers: counter animation al entrar en viewport
• Loading: skeleton shimmer (gradient slide) — NO spinners
• Optimistic UI: acción inmediata + rollback si falla
• Toast: entrada desde bottom-right con spring
• Modal backdrop: blur + fade 200ms
• 3D hover: glow effect en cajas al pasar mouse
```
