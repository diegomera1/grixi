# Módulo: Finanzas

> Estado: ✅ Implementado
> Última actualización: 2026-04-01

## Descripción

Módulo financiero con visualización de datos contables: Libro Mayor, Cuentas por Cobrar,
Cuentas por Pagar, y Presupuestos. Integración con GRIXI AI para análisis financiero.

## Archivos Clave

| Archivo | Descripción |
|---------|-------------|
| `app/routes/finanzas.tsx` | Ruta principal con tabs financieros |
| `app/routes/api.finance-analyze.ts` | Endpoint para análisis AI de datos financieros |
| `app/routes/api.finance-notes.ts` | CRUD de notas financieras |

## Características

- **Multi-tab**: Libro Mayor, CxC, CxP, Presupuestos
- **AI Analysis**: Botón para análisis inteligente con Gemini
- **Notas**: Notas por módulo con timestamps y auditoría
- **Charts**: Recharts para visualización de flujo de caja, aging, P&L

## Permisos Requeridos

- `finance.view` — ver dashboard financiero
- `finance.manage` — crear notas, ejecutar análisis AI
