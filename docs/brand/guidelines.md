# Grixi — Libro de Marca

## Identidad

| Atributo          | Valor                                           |
| ----------------- | ----------------------------------------------- |
| **Nombre**        | Grixi                                           |
| **Pronunciación** | _/ˈɡɹɪk.si/_ (Grik-si)                          |
| **Tagline**       | La interconexión inteligente de toda la empresa |
| **Tipo**          | Enterprise SaaS Platform                        |
| **Personalidad**  | Profesional, moderno, confiable, inteligente    |

## Logotipo

El logo de Grixi se basa en la idea de **interconexión** — nodos que se conectan formando una red inteligente.

### Variantes

- **Logo completo** (horizontal): Icono + wordmark
- **Icono** (cuadrado): Solo el símbolo — para favicon, app icon
- **Wordmark** (solo texto): "Grixi" en la tipografía de marca

### Uso

- **Fondo claro:** Logo negro (`#09090B`)
- **Fondo oscuro:** Logo blanco (`#FAFAFA`)
- **Mínimo:** No usar a menos de 24px de altura
- **Zona segura:** 1x altura del logo en cada lado

### Archivos

```
docs/brand/
├── logo-light.svg     → Logo para fondo claro
├── logo-dark.svg      → Logo para fondo oscuro
├── icon.svg           → Solo el icono
├── favicon.ico        → Favicon 32x32
└── og-image.png       → Open Graph 1200x630
```

---

## Colores de Marca

### Primarios

| Nombre           | Hex       | Uso                                    |
| ---------------- | --------- | -------------------------------------- |
| **Grixi Black**  | `#09090B` | Texto principal, logo light mode       |
| **Grixi White**  | `#FAFAFA` | Backgrounds, logo dark mode            |
| **Grixi Violet** | `#7C3AED` | Accent de marca, CTAs, enlaces activos |

### Secundarios

| Nombre             | Hex       | Uso                                |
| ------------------ | --------- | ---------------------------------- |
| **Violet Light**   | `#A78BFA` | Hover states, badges               |
| **Violet Surface** | `#F5F3FF` | Background de áreas con accent     |
| **Neutral 50**     | `#FAFAFA` | Background principal               |
| **Neutral 200**    | `#E4E4E7` | Borders                            |
| **Neutral 500**    | `#71717A` | Texto secundario                   |
| **Neutral 900**    | `#18181B` | Texto principal dark mode surfaces |

### No usar

- No alterar los colores de marca
- No usar gradientes en el logo
- No usar colores de marca con opacidad menor a 50%

---

## Tipografía

### Fuente Display

**Instrument Serif** (Google Fonts)

- Uso: Landing page headings, hero text
- Peso: 400 (regular)
- Tamaño: 72-96px desktop, 36-48px mobile

### Fuente UI Principal

**Geist Sans** (Vercel)

- Uso: Toda la interfaz de la plataforma
- Pesos: 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- Tamaño body: 15px (desktop), 14px (mobile)

### Fuente Monospace

**Geist Mono** (Vercel)

- Uso: Códigos, SKUs, datos técnicos, IDs
- Peso: 400 (regular)
- Tamaño: 13px

---

## Iconografía

- **Librería:** Lucide React
- **Estilo:** Stroke 1.5px, rounded caps
- **Tamaños:** 16px (inline), 20px (standard), 24px (large)
- **Color:** Heredan `currentColor`

---

## Voz y Tono

### Principios

1. **Profesional pero cercano** — No corporativo frío, no informal
2. **Claro y directo** — Todo usuario debe entender sin explicación extra
3. **En español** — Toda la UI, pero términos técnicos se mantienen en inglés (Dashboard, Rack, Warehouse)

### Ejemplos

| ❌ No                                          | ✅ Sí                               |
| ---------------------------------------------- | ----------------------------------- |
| "Se produjo un error inesperado en el sistema" | "Algo salió mal. Intenta de nuevo." |
| "Ítem eliminado exitosamente"                  | "Elemento eliminado"                |
| "¿Está seguro de que desea proceder?"          | "¿Eliminar este registro?"          |
