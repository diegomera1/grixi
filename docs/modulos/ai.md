# Módulo: GRIXI AI

> Estado: ✅ Implementado
> Última actualización: 2026-04-01

## Descripción

Asistente inteligente basado en **Google Gemini 2.5 Pro**. Chat conversacional con
contexto multi-módulo, Canvas split-view, y outputs interactivos (charts, imágenes).

## Archivos Clave

| Archivo | Descripción |
|---------|-------------|
| `app/routes/ai.tsx` | Interfaz de chat con Canvas |
| `app/routes/api.ai.chat.ts` | Streaming SSE con Gemini |
| `app/routes/api.ai.conversations.ts` | CRUD de conversaciones |
| `app/routes/api.ai.upload.ts` | Upload de archivos para contexto AI |

## Características

- **Streaming SSE**: Respuestas en tiempo real via Server-Sent Events
- **Canvas Split-View**: Panel dividido chat + preview
- **Rich Outputs**: Charts Recharts, imágenes generadas, tablas
- **Conversaciones**: Historial persistido en Supabase
- **Context Injection**: Prompt enrichment con datos del módulo activo
- **File Upload**: Subida de archivos a R2 como contexto

## API

```
POST /api/ai/chat — Stream de chat
GET  /api/ai/conversations — Listar conversaciones
POST /api/ai/conversations — Crear conversación
POST /api/ai/upload — Subir archivo para contexto
```

## Tablas DB

- `ai_conversations` — metadatos de conversaciones
- `ai_messages` — mensajes (role, content, metadata)
