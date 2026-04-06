"use server";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

const DEMO_ORG_ID = "a0000000-0000-0000-0000-000000000001";

type InsightResult = {
  success: boolean;
  message: string;
  insights?: Array<{
    id: string;
    insight_type: string;
    severity: string;
    title: string;
    message: string;
    data: Record<string, unknown>;
    action: Record<string, unknown>;
    is_dismissed: boolean;
    warehouse_name?: string;
    created_at: string;
  }>;
};

export async function generateWmsInsights(): Promise<InsightResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, message: "GEMINI_API_KEY no configurada" };
  }

  try {
    const supabase = await createClient();

    // ── Sequential queries (prevents dev server overload) ──
    const { data: warehouses } = await supabase
      .from("warehouses")
      .select("id, name, type, sap_plant_code, sap_storage_location")
      .order("name");

    const { data: racks } = await supabase
      .from("racks")
      .select("id, warehouse_id");

    const { data: positions } = await supabase
      .from("rack_positions")
      .select("rack_id, status");

    const { data: products } = await supabase
      .from("products")
      .select("name, sku, category, valuation_price, min_stock, unit_of_measure, material_group")
      .limit(30);

    const { data: lots } = await supabase
      .from("lot_tracking")
      .select("lot_number, expiry_date, remaining_quantity, status, products(name, sku)")
      .eq("status", "active")
      .order("expiry_date", { ascending: true })
      .limit(10);

    const { data: salesOrders } = await supabase
      .from("sales_orders")
      .select("so_number, customer_name, status, total, priority, requested_delivery_date")
      .in("status", ["pending", "confirmed"])
      .order("requested_delivery_date", { ascending: true })
      .limit(10);

    // ── Build warehouse occupancy summary ──────────────
    const racksByWh = new Map<string, string[]>();
    for (const r of racks || []) {
      if (!racksByWh.has(r.warehouse_id)) racksByWh.set(r.warehouse_id, []);
      racksByWh.get(r.warehouse_id)!.push(r.id);
    }
    const posByRack = new Map<string, { total: number; occupied: number }>();
    for (const p of positions || []) {
      if (!posByRack.has(p.rack_id)) posByRack.set(p.rack_id, { total: 0, occupied: 0 });
      const s = posByRack.get(p.rack_id)!;
      s.total++;
      if (p.status === "occupied") s.occupied++;
    }

    const warehouseSummary = (warehouses || []).map(w => {
      const rackIds = racksByWh.get(w.id) || [];
      let total = 0, occupied = 0;
      for (const rId of rackIds) {
        const s = posByRack.get(rId);
        if (s) { total += s.total; occupied += s.occupied; }
      }
      const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
      return `${w.name} (Plant ${w.sap_plant_code || "N/A"}, ${w.type}): ${rackIds.length} racks, ${occupied}/${total} pos (${pct}%)`;
    }).join("\n");

    // ── Build context ─────────────────────────────────
    const now = new Date();
    const context = `FECHA: ${now.toLocaleDateString("es-EC", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

ALMACENES:
${warehouseSummary}

PRODUCTOS (${(products || []).length}):
${(products || []).slice(0, 20).map(p => `${p.name} (${p.sku}) - ${p.category} - MinStock: ${p.min_stock || "N/A"} - $${p.valuation_price || 0}`).join("\n")}

LOTES PRÓXIMOS A VENCER:
${(lots || []).map(l => {
  const prod = (l as unknown as { products: { name: string; sku: string } | null }).products;
  const days = l.expiry_date ? Math.floor((new Date(l.expiry_date).getTime() - now.getTime()) / 86400000) : null;
  return `Lote ${l.lot_number} - ${prod?.name || "?"} (${prod?.sku || "?"}) - ${days !== null ? `${days}d` : "sin fecha"} - Qty: ${l.remaining_quantity}`;
}).join("\n")}

PEDIDOS PENDIENTES:
${(salesOrders || []).map(so => `${so.so_number} - ${so.customer_name} - $${so.total} - ${so.priority} - Entrega: ${so.requested_delivery_date || "N/A"}`).join("\n")}`;

    // ── Call Gemini with timeout ──────────────────────
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Eres un analista de cadena de suministro SAP/WMS. Analiza estos datos reales y genera insights accionables.

${context}

Responde ÚNICAMENTE con JSON válido (sin markdown ni backticks):
{"insights":[{"insight_type":"prediction|optimization|warning|info","severity":"critical|high|medium|low","title":"máx 50 chars","message":"detalle con datos específicos"}]}

Genera 4-5 insights citando datos reales (productos, SKUs, %, fechas). Al menos 1 prediction, 1 optimization, 1 warning. Español profesional.`;

    const timeoutMs = 25000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let text = "";
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [prompt],
        config: {
          abortSignal: controller.signal,
        },
      });
      text = response.text || "";
    } catch (geminiError) {
      clearTimeout(timeout);
      // If abort signal doesn't work, try without it
      if (controller.signal.aborted) {
        return { success: false, message: "La consulta de IA excedió el tiempo límite (25s)" };
      }
      // Retry without abort signal
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [prompt],
      });
      text = response.text || "";
    } finally {
      clearTimeout(timeout);
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, message: "No se pudo procesar la respuesta de IA" };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      insights: Array<{
        insight_type: string;
        severity: string;
        title: string;
        message: string;
      }>;
    };

    if (!parsed.insights || !Array.isArray(parsed.insights)) {
      return { success: false, message: "Formato de respuesta inválido" };
    }

    // ── Dismiss old insights and insert new ones ──────
    await supabase
      .from("wms_ai_insights")
      .update({ is_dismissed: true })
      .eq("is_dismissed", false);

    const insightRows = parsed.insights.map(i => ({
      org_id: DEMO_ORG_ID,
      insight_type: i.insight_type,
      severity: i.severity,
      title: i.title,
      message: i.message,
      data: {},
      action: {},
      is_dismissed: false,
    }));

    const { data: inserted, error } = await supabase
      .from("wms_ai_insights")
      .insert(insightRows)
      .select("*");

    if (error) {
      console.error("[WMS AI] Insert error:", error);
      return { success: false, message: `Error al guardar: ${error.message}` };
    }

    return {
      success: true,
      message: "Insights generados exitosamente",
      insights: (inserted || []).map(i => ({
        id: i.id,
        insight_type: i.insight_type,
        severity: i.severity,
        title: i.title,
        message: i.message,
        data: (i.data as Record<string, unknown>) || {},
        action: (i.action as Record<string, unknown>) || {},
        is_dismissed: i.is_dismissed,
        created_at: i.created_at,
      })),
    };
  } catch (error) {
    console.error("[WMS AI] Error generating insights:", error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}
