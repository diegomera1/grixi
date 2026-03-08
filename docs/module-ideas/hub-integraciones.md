# 🔌 Módulo: Hub de Integraciones

> **SAP Equivalente:** PI/PO (Process Integration) / Integration Suite
> **Ruta:** `/integraciones`
> **Prioridad:** 🟡 Media (Fase 11)

## ¿Por qué es clave?

Este es el módulo que materializa la misión de Grixi: **"la interconexión inteligente de toda la empresa"**. Muestra visualmente cómo Grixi se conecta con SAP, otros ERPs, CRMs, IoT, y servicios externos. Es el argumento de venta más potente en una demo.

## Concepto

No es solo un panel de configuración — es un **mapa visual en tiempo real** de todas las conexiones de la empresa, sus flujos de datos, y su estado de salud.

## Vistas Principales

### `/integraciones` — Mapa de Conexiones

```
┌──────────────────────────────────────────────────────────┐
│  🔌 Hub de Integraciones                                  │
│                                                          │
│  ┌───────┐    ╔═══════════╗    ┌───────┐               │
│  │  SAP  │───▶║           ║───▶│Finanzas│               │
│  │  ERP  │    ║           ║    └───────┘               │
│  └───────┘    ║           ║                             │
│               ║   GRIXI   ║    ┌───────┐               │
│  ┌───────┐    ║    HUB    ║───▶│Compras │               │
│  │Google │───▶║           ║    └───────┘               │
│  │ Auth  │    ║           ║                             │
│  └───────┘    ║           ║    ┌───────┐               │
│               ║           ║───▶│Almacén │               │
│  ┌───────┐    ║           ║    └───────┘               │
│  │IoT    │───▶║           ║                             │
│  │Sensors│    ╚═══════════╝    ┌───────┐               │
│  └───────┘                 ───▶│Ventas  │               │
│                                └───────┘               │
│  Estado: ● En línea (4)  ○ Desconectado (0)            │
│                                                          │
│  Último sync: hace 2 minutos  |  Datos hoy: 12,450     │
└──────────────────────────────────────────────────────────┘
```

### `/integraciones/[id]` — Detalle de Conector

- **Estado en tiempo real**: conectado/desconectado/error
- **Métricas**: registros sincronizados, errores, latencia
- **Log de sincronización**: timeline con cada sync (éxito/fallo)
- **Mapeo de campos**: visual de SAP field → Grixi field
- **Configuración**: URL, credenciales (ocultas), frecuencia de sync

### `/integraciones/logs` — Centro de Logs

- Timeline centralizada de todos los syncs
- Filtros: conector, estado, fecha
- Alertas de errores con retry automático
- Exportar logs

### `/integraciones/nuevo` — Crear Conector

- Wizard paso a paso: seleccionar tipo → configurar → probar → activar
- Tipos disponibles: SAP RFC, SAP OData, REST API, Webhook, Base de datos, IoT MQTT
- Test de conexión con feedback visual

## Conectores Disponibles (Demo)

| Conector            | Tipo                | Módulos que alimenta                        | Estado Demo  |
| ------------------- | ------------------- | ------------------------------------------- | ------------ |
| **SAP ECC/S4**      | RFC/OData           | Finanzas, Compras, Ventas, Producción, RRHH | 🟢 Simulado  |
| **Google Auth**     | OAuth 2.0           | Usuarios, Sesiones                          | 🟢 Real      |
| **Supabase**        | PostgreSQL          | Todos los módulos                           | 🟢 Real      |
| **Gemini AI**       | REST API            | AI Chat, Insights                           | 🟢 Real      |
| **IoT Gateway**     | MQTT/REST           | Almacenes (temperatura, humedad)            | 🟡 Simulado  |
| **SMTP/Email**      | SMTP                | Notificaciones                              | 🟡 Preparado |
| **Facturación SRI** | SOAP/REST           | Finanzas                                    | ⚪ Futuro    |
| **GitHub**          | REST API + webhooks | Proyectos                                   | ⚪ Futuro    |

## Tablas Supabase

```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'sap_rfc', 'sap_odata', 'rest_api', 'webhook',
    'database', 'mqtt', 'oauth', 'smtp'
  )),
  config JSONB NOT NULL DEFAULT '{}', -- URL, headers, auth (encrypted)
  status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'syncing')),
  sync_frequency TEXT DEFAULT 'manual' CHECK (sync_frequency IN (
    'realtime', '1min', '5min', '15min', '30min', '1hour', 'daily', 'manual'
  )),
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  total_records_synced BIGINT DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  modules_connected JSONB DEFAULT '[]', -- ['finanzas', 'compras']
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id),
  sync_type TEXT CHECK (sync_type IN ('full', 'incremental', 'webhook', 'manual')),
  status TEXT CHECK (status IN ('started', 'success', 'partial', 'failed')),
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  details JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id),
  source_field TEXT NOT NULL, -- SAP field name
  target_table TEXT NOT NULL, -- Grixi table
  target_field TEXT NOT NULL, -- Grixi column
  transformation TEXT, -- 'direct', 'uppercase', 'date_format', 'lookup'
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Visual WOW

- **Mapa de nodos** tipo flujo (React Flow / D3) con conexiones animadas
- **Pulsos de datos** — partículas que viajan por las conexiones cuando hay sync
- **Health dashboard** con status cards tipo AWS Console
- **Log timeline** con colores (verde/rojo) y retry buttons
- **Wizard de configuración** paso a paso con animaciones

## Datos Demo

- **6 conectores** pre-configurados (SAP, Google, Supabase, Gemini, IoT, SMTP)
- **500 logs** de sincronización con mezcla de éxitos y fallos
- **50 field mappings** para el conector SAP
- Datos que simulan sync cada 5 minutos
