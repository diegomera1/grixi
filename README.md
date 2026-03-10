# Grixi

> **La interconexión inteligente de toda la empresa**

Plataforma SaaS enterprise multi-tenant para empresas medianas y grandes que necesitan conectar, visualizar y gestionar su información de manera inteligente.

## Stack

| Capa       | Descripción                                        |
| ---------- | -------------------------------------------------- |
| Framework  | App Router + Server Components (última generación) |
| UI Runtime | Componentes reactivos con strict typing            |
| Estilos    | Design Tokens + utility-first CSS                  |
| Backend    | Base de datos relacional + Auth + Realtime         |
| 3D         | Visualización 3D interactiva de almacenes          |
| AI         | Inteligencia artificial integrada en cada módulo   |
| Deploy     | Edge Runtime + CI/CD automático                    |

## Módulos

- 🏠 **Landing Page** — Marketing + Login con Google
- 👤 **Usuarios** — Registro, roles dinámicos, permisos granulares
- 🔍 **Administración** — Auditoría completa, tracking de clicks, cierre remoto
- 🏭 **Almacenes** — Vista 2D/3D de racks, inventario en tiempo real
- 🤖 **AI Chat** — IA integrada con function calling

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
