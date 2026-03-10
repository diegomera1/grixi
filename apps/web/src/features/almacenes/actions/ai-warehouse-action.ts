"use server";

import { GoogleGenAI } from "@google/genai";

type RackSummary = {
  code: string;
  type: string;
  totalPositions: number;
  occupiedPositions: number;
  products: {
    name: string;
    sku: string;
    category: string;
    quantity: number;
    daysInStock: number;
    daysUntilExpiry: number | null;
    status: string;
  }[];
};

type Recommendation = {
  type: "reubicacion" | "alerta_vencimiento" | "optimizacion_espacio" | "reabastecimiento";
  title: string;
  description: string;
  impactLevel: "alto" | "medio" | "bajo";
  rackCode: string;
  productSku?: string;
};

export async function getAIWarehouseRecommendations(
  warehouseName: string,
  rackSummaries: RackSummary[]
): Promise<{ recommendations: Recommendation[]; summary: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      recommendations: [
        {
          type: "alerta_vencimiento",
          title: "API Key no configurada",
          description: "Configura la API key de IA en .env.local para habilitar recomendaciones AI.",
          impactLevel: "alto",
          rackCode: "—",
        },
      ],
      summary: "No se pudo conectar con el servicio de IA. Configura la API key.",
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Eres un experto en gestión de almacenes e inventario. Analiza los datos del almacén "${warehouseName}" y genera recomendaciones accionables.

DATOS DEL ALMACÉN:
${JSON.stringify(rackSummaries, null, 2)}

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "summary": "Resumen ejecutivo de 2-3 líneas del estado del almacén",
  "recommendations": [
    {
      "type": "reubicacion | alerta_vencimiento | optimizacion_espacio | reabastecimiento",
      "title": "Título corto de la recomendación",
      "description": "Descripción detallada con datos específicos (menciona SKUs, racks, cantidades)",
      "impactLevel": "alto | medio | bajo",
      "rackCode": "Código del rack afectado",
      "productSku": "SKU del producto afectado (si aplica)"
    }
  ]
}

REGLAS:
- Genera 4-8 recomendaciones REALES basadas en los datos
- Identifica productos próximos a vencer y sugiere acciones
- Detecta racks con alta ocupación y sugiere redistribución
- Identifica oportunidades de optimización de espacio
- Si hay productos con baja rotación (muchos días en stock), sugiere descuentos o movimiento
- Usa lenguaje profesional en español
- Sé específico: menciona SKUs, racks y cantidades reales de los datos`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
    });

    const text = response.text || "";
    // Extract JSON from response (handle possible markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { recommendations: [], summary: "No se pudo parsear la respuesta de IA." };
    }

    const parsed = JSON.parse(jsonMatch[0]) as { summary: string; recommendations: Recommendation[] };
    return parsed;
  } catch (error) {
    console.error("AI service error:", error);
    return {
      recommendations: [],
      summary: `Error al consultar el servicio de IA: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}
