# Grixi

> **La interconexión inteligente de toda la empresa**

Plataforma SaaS enterprise multi-tenant para empresas medianas y grandes que necesitan conectar, visualizar y gestionar su información de manera inteligente.

## Stack

| Tecnología     | Uso                                        |
| -------------- | ------------------------------------------ |
| Next.js 16     | App Router + React Server Components       |
| React 19       | UI Runtime                                 |
| TypeScript 5   | Tipo seguro en strict mode                 |
| Tailwind CSS 4 | Estilos + Design Tokens                    |
| Supabase       | PostgreSQL 17.6 + OrioleDB, Auth, Realtime |
| Three.js       | Visualización 3D de almacenes              |
| Gemini AI      | Inteligencia artificial en cada módulo     |
| Vercel         | Deploy + Edge Runtime                      |

## Módulos

- 🏠 **Landing Page** — Marketing + Login con Google
- 👤 **Usuarios** — Registro, roles dinámicos, permisos granulares
- 🔍 **Administración** — Auditoría completa, tracking de clicks, cierre remoto
- 🏭 **Almacenes** — Vista 2D/3D de racks, inventario en tiempo real
- 🤖 **AI Chat** — Gemini integrado con function calling

## Documentación

- [Arquitectura del Sistema](docs/architecture/overview.md)
- [Esquema de Base de Datos](docs/architecture/database-schema.md)
- [Design System](docs/architecture/design-system.md)
- [Plan de Fases](docs/architecture/phases.md)
- [Ideas & Módulos Futuros](docs/ideas/modulos-futuros.md)
- [Warehouse Specs](docs/ideas/warehouse-module.md)
- [AI Integration](docs/ideas/ai-integration.md)
- [Libro de Marca](docs/brand/guidelines.md)

## Setup

```bash
# Clonar
git clone https://github.com/diegomera1/grixi.git
cd grixi

# Instalar dependencias (cuando esté el monorepo)
npm install

# Variables de entorno
cp .env.example .env.local

# Dev server
npm run dev
```

## Licencia

Privado — © 2026 Grixi
