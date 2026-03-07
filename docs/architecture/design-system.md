# Grixi — Design System

> Estilo: **Refined Minimalism** | Inspirado en MetaLab
> Landing: Monocromático editorial | Dashboard: Colorido funcional

## Filosofía

> _"Si algo no tiene un propósito, elimínalo. Si algo es necesario, hazlo bello."_

La plataforma tiene **2 personalidades** visuales:

| Contexto    | Landing Page               | Dashboard / App           |
| ----------- | -------------------------- | ------------------------- |
| Tipografía  | Instrument Serif (display) | Geist Sans (funcional)    |
| Espacio     | Extremo (128px+)           | Compacto pero respirado   |
| Animaciones | Scroll reveals, parallax   | Micro-interactions        |
| Layout      | Full-width editorial       | Sidebar + content         |
| Color       | B/W + accent mínimo        | Status colors + funcional |

---

## Paleta de Colores — "Midnight Iris"

### Light Mode

| Token              | Hex       | Uso               |
| ------------------ | --------- | ----------------- |
| `--bg-primary`     | `#FAFAFA` | Fondo general     |
| `--bg-surface`     | `#FFFFFF` | Cards, sidebars   |
| `--bg-elevated`    | `#FFFFFF` | Modals, dropdowns |
| `--border`         | `#E4E4E7` | Bordes sutiles    |
| `--text-primary`   | `#09090B` | Texto principal   |
| `--text-secondary` | `#71717A` | Labels, meta      |
| `--brand`          | `#7C3AED` | Accent principal  |
| `--brand-light`    | `#A78BFA` | Hover, badges     |
| `--success`        | `#10B981` | OK, activo        |
| `--warning`        | `#F59E0B` | Precaución        |
| `--error`          | `#EF4444` | Error, crítico    |
| `--info`           | `#3B82F6` | Informativo       |

### Dark Mode

| Token              | Hex       | Uso               |
| ------------------ | --------- | ----------------- |
| `--bg-primary`     | `#09090B` | Fondo general     |
| `--bg-surface`     | `#111113` | Cards, sidebars   |
| `--bg-elevated`    | `#1A1A1D` | Modals, dropdowns |
| `--border`         | `#27272A` | Bordes sutiles    |
| `--text-primary`   | `#FAFAFA` | Texto principal   |
| `--text-secondary` | `#A1A1AA` | Labels, meta      |
| `--brand`          | `#A78BFA` | Accent principal  |

---

## Tipografía

| Uso               | Fuente           | Peso | Tamaño  |
| ----------------- | ---------------- | ---- | ------- |
| Display (landing) | Instrument Serif | 400  | 72-96px |
| H1                | Geist Sans       | 700  | 36px    |
| H2                | Geist Sans       | 600  | 28px    |
| H3                | Geist Sans       | 600  | 22px    |
| Body              | Geist Sans       | 400  | 15px    |
| Small/Caption     | Geist Sans       | 400  | 13px    |
| Monospace         | Geist Mono       | 400  | 13px    |

---

## Espaciado (8pt base)

```
4px   → micro
8px   → xs
12px  → sm
16px  → base
24px  → md
32px  → lg
48px  → xl
64px  → 2xl
96px  → 3xl
128px → 4xl (landing only)
```

---

## Componentes

### Buttons (Pill Style)

- Primary: `bg-zinc-900 text-white rounded-full px-6 py-3`
- Secondary: `border border-zinc-300 rounded-full px-6 py-3`
- Ghost: `text-zinc-600 rounded-full px-4 py-2 hover:bg-zinc-100`
- Brand: `bg-brand text-white rounded-full px-6 py-3`

### Inputs

- **Landing:** Underline-only (border-bottom)
- **Dashboard:** Bordered box con border-radius-lg

### Cards

- `bg-surface border border-border rounded-xl p-6`
- Hover: `shadow-sm transition-shadow`

### Navigation

- Header: `[Menu] — Logo — [Theme ☀/☾] [CTA]`
- Sidebar (dashboard): Collapsible, icons + text

---

## Animaciones

| Tipo              | Duración | Easing             |
| ----------------- | -------- | ------------------ |
| Micro (hover)     | 150ms    | ease-out           |
| Standard (modal)  | 300ms    | [0.4, 0, 0.2, 1]   |
| Entrance (scroll) | 500ms    | [0.22, 1, 0.36, 1] |
| Page transition   | 600ms    | [0.65, 0, 0.35, 1] |

### Stack de animación

- **CSS transitions** → hover, focus
- **Framer Motion** → modals, toasts, layout
- **GSAP ScrollTrigger** → scroll reveals
- **Lenis** → smooth scroll

---

## Colores de Estado (Warehouse)

| Estado     | Color | Hex       | Uso                     |
| ---------- | ----- | --------- | ----------------------- |
| Ocupado OK | 🟢    | `#10B981` | Producto en buen estado |
| Vencido    | 🔴    | `#EF4444` | Producto expirado       |
| Por vencer | 🟡    | `#F59E0B` | < 30 días de expiración |
| Vacío      | ⚪    | `#D4D4D8` | Sin producto            |
| Reservado  | 🔵    | `#3B82F6` | Reservado para entrada  |
| Cuarentena | 🟣    | `#7C3AED` | En revisión             |

---

## Dark Mode

Gestionado por `next-themes` con clase `.dark`.
Toggle: `☀` / `🌙` en el header.
Se persiste en `localStorage` y respeta `prefers-color-scheme`.
