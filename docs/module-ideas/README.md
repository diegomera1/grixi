# Grixi — Módulos Propuestos

> Cada módulo está diseñado para integrarse con SAP/ERP y funcionar como la capa inteligente
> que unifica la experiencia de toda la empresa.

## Visión

Grixi no reemplaza SAP — **lo complementa**. SAP es el motor transaccional; Grixi es la **capa de experiencia, inteligencia y visualización** que los usuarios finales aman usar.

```
┌─────────────────────────────────────────────────────────┐
│                    GRIXI (Capa UX + AI)                  │
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐ │
│  │Finanzas │ │ Compras │ │ Ventas  │ │  Producción  │ │
│  └────┬────┘ └────┬────┘ └────┬────┘ └──────┬───────┘ │
│       │           │           │              │         │
│  ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌──────┴───────┐ │
│  │Mantenim.│ │  RRHH   │ │Calidad │ │   Proyectos  │ │
│  └────┬────┘ └────┬────┘ └────┬────┘ └──────┬───────┘ │
│       └───────────┴───────────┴──────────────┘         │
│                          │                              │
│              ┌───────────▼──────────┐                   │
│              │   Hub Integraciones  │                   │
│              │   (SAP + ERP + IoT)  │                   │
│              └──────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
                          │
              ┌───────────▼──────────┐
              │   SAP / ERP Backend  │
              │   (Datos reales)     │
              └──────────────────────┘
```

## Módulos Existentes ✅

| #   | Módulo         | Ruta              | Estado      |
| --- | -------------- | ----------------- | ----------- |
| 1   | Landing Page   | `/`               | ✅ Completo |
| 2   | Dashboard      | `/dashboard`      | ✅ Completo |
| 3   | Usuarios       | `/usuarios`       | ✅ Completo |
| 4   | Administración | `/administracion` | ✅ Completo |
| 5   | Almacenes 3D   | `/almacenes`      | ✅ Completo |
| 6   | Grixi AI       | `/ai`             | ✅ Completo |

## Módulos Propuestos 🚀

| #   | Módulo                | Ruta             | SAP Equiv. | Prioridad | Doc                                            |
| --- | --------------------- | ---------------- | ---------- | --------- | ---------------------------------------------- |
| 7   | **Finanzas**          | `/finanzas`      | FI/CO      | 🔴 Alta   | [finanzas.md](./finanzas.md)                   |
| 8   | **Compras**           | `/compras`       | MM         | 🔴 Alta   | [compras.md](./compras.md)                     |
| 9   | **Ventas**            | `/ventas`        | SD         | 🔴 Alta   | [ventas.md](./ventas.md)                       |
| 10  | **Producción**        | `/produccion`    | PP         | 🟡 Media  | [produccion.md](./produccion.md)               |
| 11  | **Mantenimiento**     | `/mantenimiento` | PM         | 🟡 Media  | [mantenimiento.md](./mantenimiento.md)         |
| 12  | **RRHH**              | `/rrhh`          | HCM        | 🟡 Media  | [rrhh.md](./rrhh.md)                           |
| 13  | **Calidad**           | `/calidad`       | QM         | 🟢 Baja   | [calidad.md](./calidad.md)                     |
| 14  | **Proyectos**         | `/proyectos`     | PS         | 🟢 Baja   | [proyectos.md](./proyectos.md)                 |
| 15  | **Hub Integraciones** | `/integraciones` | —          | 🟡 Media  | [hub-integraciones.md](./hub-integraciones.md) |

## Orden Recomendado de Implementación

```
Fase 8:  Finanzas (FI/CO)        → Todo CEO ve esto primero
Fase 9:  Compras (MM)            → Conecta con Almacenes existente
Fase 10: Ventas (SD)             → Completa el ciclo comercial
Fase 11: Hub de Integraciones    → Visualiza las conexiones SAP
Fase 12: Producción (PP)         → Impacto visual con Gantt + monitor
Fase 13: Mantenimiento (PM)      → Calendario + equipos + predictivo
Fase 14: RRHH (HCM)             → Organigramas + nómina
Fase 15: Calidad (QM)           → Inspecciones + certificaciones
Fase 16: Proyectos (PS)         → Kanban + Gantt
```

## Filosofía de Diseño por Módulo

Cada módulo debe seguir estos principios:

1. **Vista principal** = Cards/tabla con KPIs + filtros premium
2. **Vista detalle** = Sheet lateral o página con tabs
3. **AI integrada** = Gemini puede responder preguntas sobre cada módulo
4. **Datos SAP** = Demo con datos realistas tipo SAP (códigos, montos, fechas)
5. **Audit trail** = Todo queda registrado en `audit_logs`
6. **Multi-tenant** = Filtrado por `org_id` con RLS
7. **Responsive** = Mobile-first, funciona en tablet para usuarios en planta
