import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const DEMO_ORG_ID = "a0000000-0000-0000-0000-000000000001";

const MOVEMENT_DESCRIPTIONS: Record<string, string> = {
  "101": "Entrada de mercancía",
  "102": "Anulación de entrada",
  "201": "Salida por centro de costo",
  "261": "Salida por pedido de venta",
  "262": "Anulación de salida",
  "301": "Traspaso entre almacenes",
  "311": "Traspaso interno",
  "551": "Salida por merma",
};

// ══════════════════════════════════════════════════════════
// Helper: generate next sequential number
// ══════════════════════════════════════════════════════════
async function getNextNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  column: string,
  prefix: string
) {
  const { data } = await supabase
    .from(table)
    .select(column)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const record = data as Record<string, unknown> | null;
  const lastNum = record?.[column]
    ? parseInt(String(record[column]).split("-").pop() || "0")
    : 0;
  return `${prefix}-2026-${String(lastNum + 1).padStart(4, "0")}`;
}

// ══════════════════════════════════════════════════════════
// Helper: create inventory movement record
// ══════════════════════════════════════════════════════════
async function createMovement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    warehouse_id: string;
    product_id: string;
    movement_type: string;
    sap_movement_type: string;
    quantity: number;
    reference_type: string;
    reference_id: string;
    reference_number: string;
    position_id?: string;
    lot_number?: string;
    storage_unit_id?: string;
  }
) {
  return supabase.from("inventory_movements").insert({
    org_id: DEMO_ORG_ID,
    product_id: params.product_id,
    movement_type: params.movement_type,
    movement_description: MOVEMENT_DESCRIPTIONS[params.sap_movement_type] || params.movement_type,
    sap_movement_type: params.sap_movement_type,
    quantity: params.quantity,
    reference_type: params.reference_type,
    reference_id: params.reference_id,
    reference: params.reference_number,
    from_position_id: params.position_id || null,
    lot_number: params.lot_number || null,
    storage_unit_id: params.storage_unit_id || null,
  });
}

// ══════════════════════════════════════════════════════════
// POST Operations: GR, GI, Transfer, Physical Count
// ══════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;
    const supabase = await createClient();

    switch (action) {
      // ──────────────────────────────────────────────────
      // GOODS RECEIPT — Full flow with lots + UAs
      // ──────────────────────────────────────────────────
      case "create_goods_receipt": {
        const {
          warehouse_id, po_id, delivery_note, carrier, plate_number,
          quality_checked, notes, items
        } = params;

        const receiptNumber = await getNextNumber(supabase, "goods_receipts", "receipt_number", "GR");

        // 1. Create GR header
        const { data: gr, error: grError } = await supabase
          .from("goods_receipts")
          .insert({
            org_id: DEMO_ORG_ID,
            receipt_number: receiptNumber,
            warehouse_id,
            po_id,
            receipt_date: new Date().toISOString().split("T")[0],
            status: "posted",
            movement_type: "101",
            delivery_note: delivery_note || null,
            carrier: carrier || null,
            plate_number: plate_number || null,
            quality_checked: quality_checked || false,
            notes: notes || null,
          })
          .select("id")
          .single();

        if (grError) throw grError;

        type GRItemInput = {
          product_id: string;
          product_name?: string;
          quantity_received: number;
          quantity_rejected: number;
          rejection_reason?: string;
          lot_number?: string;
          expiry_date?: string;
          su_type?: string;
          position_id?: string;
          position_label?: string;
        };

        const grItems = items as GRItemInput[];
        let totalReceived = 0;
        let totalRejected = 0;
        const createdSUs: string[] = [];

        for (const item of grItems) {
          if (item.quantity_received <= 0) continue;

          totalReceived += item.quantity_received;
          totalRejected += (item.quantity_rejected || 0);

          // 2. Auto-generate lot number
          let lotNumber = item.lot_number;
          let lotId: string | null = null;

          if (!lotNumber) {
            const { data: genLot } = await supabase.rpc("wms_generate_lot_number", {
              p_org_id: DEMO_ORG_ID,
            });
            lotNumber = genLot as string || `LOT-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-001`;
          }

          // 3. Create lot_tracking record
          const { data: lot, error: lotErr } = await supabase
            .from("lot_tracking")
            .insert({
              org_id: DEMO_ORG_ID,
              lot_number: lotNumber,
              product_id: item.product_id,
              status: "active",
              total_quantity: item.quantity_received,
              remaining_quantity: item.quantity_received,
              expiry_date: item.expiry_date || null,
              manufacturing_date: new Date().toISOString().split("T")[0],
              auto_generated: true,
              gr_number: receiptNumber,
            })
            .select("id")
            .single();

          if (lotErr) {
            console.error("[GR] Lot creation error:", lotErr);
            // Try to find existing lot
            const { data: existingLot } = await supabase
              .from("lot_tracking")
              .select("id")
              .eq("lot_number", lotNumber)
              .eq("product_id", item.product_id)
              .maybeSingle();
            lotId = existingLot?.id || null;
          } else {
            lotId = lot.id;
          }

          // 4. Auto-generate UA code
          const { data: suCode } = await supabase.rpc("wms_generate_su_code", {
            p_org_id: DEMO_ORG_ID,
          });
          const uaCode = (suCode as string) || `UA-${String(Date.now()).slice(-6)}`;

          // 5. Create storage_unit
          const suType = item.su_type || "tina";
          const positionId = item.position_id || null;

          if (lotId && positionId) {
            const { data: su, error: suErr } = await supabase
              .from("storage_units")
              .insert({
                org_id: DEMO_ORG_ID,
                su_code: uaCode,
                su_type: suType,
                warehouse_id,
                position_id: positionId,
                product_id: item.product_id,
                lot_id: lotId,
                quantity: item.quantity_received,
                reserved_quantity: 0,
                status: "available",
              })
              .select("id")
              .single();

            if (!suErr && su) {
              createdSUs.push(su.id);

              // 6. Update rack_position status
              await supabase
                .from("rack_positions")
                .update({ status: "occupied" })
                .eq("id", positionId);
            }

            // 7. Insert GR item (FIXED FK: receipt_id, not goods_receipt_id)
            await supabase.from("goods_receipt_items").insert({
              receipt_id: gr.id,
              product_id: item.product_id,
              quantity_received: item.quantity_received,
              quantity_rejected: item.quantity_rejected || 0,
              rejection_reason: item.rejection_reason || null,
              lot_number: lotNumber,
              target_position_id: positionId,
              storage_unit_id: su?.id || null,
              su_type: suType,
              su_code: uaCode,
              org_id: DEMO_ORG_ID,
            });

            // 8. Create inventory movement
            await createMovement(supabase, {
              warehouse_id,
              product_id: item.product_id,
              movement_type: "receipt",
              sap_movement_type: "101",
              quantity: item.quantity_received,
              reference_type: "goods_receipt",
              reference_id: gr.id,
              reference_number: receiptNumber,
              position_id: positionId,
              lot_number: lotNumber,
              storage_unit_id: su?.id || undefined,
            });
          } else {
            // No position or lot — still create item
            await supabase.from("goods_receipt_items").insert({
              receipt_id: gr.id,
              product_id: item.product_id,
              quantity_received: item.quantity_received,
              quantity_rejected: item.quantity_rejected || 0,
              rejection_reason: item.rejection_reason || null,
              lot_number: lotNumber,
              org_id: DEMO_ORG_ID,
            });
          }
        }

        // 9. Update PO received quantities
        if (po_id) {
          await supabase
            .from("purchase_orders")
            .update({ status: "partially_received" })
            .eq("id", po_id);
        }

        revalidatePath("/almacenes");
        return NextResponse.json({
          success: true,
          message: `Entrada ${receiptNumber} contabilizada — ${totalReceived} recibidos, ${totalRejected} rechazados, ${createdSUs.length} UAs creadas`,
          id: gr.id,
          receipt_number: receiptNumber,
        });
      }

      // ──────────────────────────────────────────────────
      // GOODS ISSUE — Picking with UAs + reservations
      // ──────────────────────────────────────────────────
      case "create_goods_issue": {
        const {
          warehouse_id, so_id, issue_type = "sales_order",
          items: giItemsInput, picking_lines, notes: giNotes,
          draft = false,
        } = params;

        const isDraft = draft === true;
        const issueNumber = await getNextNumber(supabase, "goods_issues", "issue_number", "GI");
        const movType = issue_type === "cost_center" ? "201" : issue_type === "scrap" ? "551" : "261";

        // 1. Create GI header
        const { data: gi, error: giError } = await supabase
          .from("goods_issues")
          .insert({
            org_id: DEMO_ORG_ID,
            issue_number: issueNumber,
            warehouse_id,
            issue_type,
            status: isDraft ? "draft" : "posted",
            movement_type: movType,
            reference_type: so_id ? "sales_order" : null,
            reference_id: so_id || null,
            notes: giNotes || null,
            posted_at: isDraft ? null : new Date().toISOString(),
          })
          .select("id")
          .single();

        if (giError) throw giError;

        // ── If draft, just save items without touching inventory ──
        if (isDraft) {
          type DraftGIItem = { product_id: string; quantity_picked: number };
          type DraftPickLine = { product_id: string; su_id: string; su_code?: string; quantity: number };
          const rawItems = (giItemsInput || []) as DraftGIItem[];
          const draftLines = (picking_lines || []) as DraftPickLine[];

          for (const item of rawItems) {
            await supabase.from("goods_issue_items").insert({
              issue_id: gi.id,
              product_id: item.product_id,
              quantity_requested: item.quantity_picked,
              quantity_issued: 0,
              quantity_picked: 0,
              unit: "UN",
              org_id: DEMO_ORG_ID,
            });
          }

          // Save picking lines as JSON in notes for now (or a separate table)
          if (draftLines.length > 0) {
            await supabase
              .from("goods_issues")
              .update({ notes: JSON.stringify({ picking_lines: draftLines, original_notes: giNotes || "" }) })
              .eq("id", gi.id);
          }

          revalidatePath("/almacenes");
          return NextResponse.json({
            success: true,
            message: `Borrador ${issueNumber} guardado — ${rawItems.length} materiales`,
            id: gi.id,
            issue_number: issueNumber,
            status: "draft",
          });
        }

        type PickLineInput = {
          product_id: string;
          su_id: string;
          su_code?: string;
          lot_id?: string;
          quantity: number;
        };

        type GIItemInput = {
          product_id: string;
          quantity_picked: number;
        };

        const lines = (picking_lines || []) as PickLineInput[];
        const rawItems = (giItemsInput || []) as GIItemInput[];
        let totalPicked = 0;

        // Build a set of product_ids already covered by picking_lines
        const coveredProducts = new Set(lines.map(l => l.product_id));

        // ── Process explicit picking lines (with SU) ──
        for (const line of lines) {
          totalPicked += line.quantity;

          // Get lot_number from SU for the GI item
          const { data: suDetail } = await supabase
            .from("storage_units")
            .select("quantity, reserved_quantity, lot_id, position_id, lot_tracking(lot_number)")
            .eq("id", line.su_id)
            .single();

          const lotInfo = suDetail?.lot_tracking as unknown as { lot_number: string } | null;

          // Insert GI item with SU reference
          await supabase.from("goods_issue_items").insert({
            issue_id: gi.id,
            product_id: line.product_id,
            quantity_requested: line.quantity,
            quantity_issued: line.quantity,
            quantity_picked: line.quantity,
            storage_unit_id: line.su_id,
            lot_number: lotInfo?.lot_number || null,
            unit: "UN",
            org_id: DEMO_ORG_ID,
          });

          // Deduct from storage unit
          if (suDetail) {
            const newQty = Math.max(0, Number(suDetail.quantity) - line.quantity);
            const newReserved = Math.max(0, Number(suDetail.reserved_quantity));
            const newStatus = newQty <= 0 ? "empty" : "available";

            await supabase
              .from("storage_units")
              .update({
                quantity: newQty,
                reserved_quantity: newReserved,
                status: newStatus,
                updated_at: new Date().toISOString(),
              })
              .eq("id", line.su_id);

            // Free position if SU is empty
            if (newQty <= 0 && suDetail.position_id) {
              const { count } = await supabase
                .from("storage_units")
                .select("id", { count: "exact", head: true })
                .eq("position_id", suDetail.position_id)
                .neq("status", "empty")
                .neq("id", line.su_id);

              if ((count || 0) === 0) {
                await supabase
                  .from("rack_positions")
                  .update({ status: "available" })
                  .eq("id", suDetail.position_id);
              }
            }

            // Update lot remaining
            if (suDetail.lot_id) {
              const { data: lot } = await supabase
                .from("lot_tracking")
                .select("remaining_quantity")
                .eq("id", suDetail.lot_id)
                .single();

              if (lot) {
                const newRemaining = Math.max(0, Number(lot.remaining_quantity) - line.quantity);
                await supabase
                  .from("lot_tracking")
                  .update({ remaining_quantity: newRemaining, updated_at: new Date().toISOString() })
                  .eq("id", suDetail.lot_id);
              }
            }
          }

          // Create inventory movement
          await createMovement(supabase, {
            warehouse_id,
            product_id: line.product_id,
            movement_type: "issue",
            sap_movement_type: movType,
            quantity: -line.quantity,
            reference_type: "goods_issue",
            reference_id: gi.id,
            reference_number: issueNumber,
            position_id: suDetail?.position_id || undefined,
            lot_number: lotInfo?.lot_number || undefined,
            storage_unit_id: line.su_id,
          });
        }

        // ── Process items NOT covered by picking_lines (auto-resolve SU) ──
        for (const item of rawItems) {
          if (coveredProducts.has(item.product_id)) continue;
          if (item.quantity_picked <= 0) continue;

          let remainingQty = item.quantity_picked;

          // Find available SUs for this product in this warehouse (FIFO order)
          const { data: availableSUs } = await supabase
            .from("storage_units")
            .select("id, su_code, quantity, reserved_quantity, lot_id, position_id, lot_tracking(lot_number)")
            .eq("warehouse_id", warehouse_id)
            .eq("product_id", item.product_id)
            .in("status", ["available", "reserved"])
            .gt("quantity", 0)
            .order("created_at", { ascending: true });

          if (availableSUs && availableSUs.length > 0) {
            for (const su of availableSUs) {
              if (remainingQty <= 0) break;

              const available = Math.max(0, Number(su.quantity) - Number(su.reserved_quantity || 0));
              if (available <= 0) continue;

              const pickQty = Math.min(available, remainingQty);
              remainingQty -= pickQty;
              totalPicked += pickQty;

              const lotInfo = su.lot_tracking as unknown as { lot_number: string } | null;

              // Insert GI item with SU
              await supabase.from("goods_issue_items").insert({
                issue_id: gi.id,
                product_id: item.product_id,
                quantity_requested: pickQty,
                quantity_issued: pickQty,
                quantity_picked: pickQty,
                storage_unit_id: su.id,
                lot_number: lotInfo?.lot_number || null,
                unit: "UN",
                org_id: DEMO_ORG_ID,
              });

              // Deduct from SU
              const newQty = Math.max(0, Number(su.quantity) - pickQty);
              const newStatus = newQty <= 0 ? "empty" : "available";

              await supabase
                .from("storage_units")
                .update({
                  quantity: newQty,
                  status: newStatus,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", su.id);

              // Free position if empty
              if (newQty <= 0 && su.position_id) {
                const { count } = await supabase
                  .from("storage_units")
                  .select("id", { count: "exact", head: true })
                  .eq("position_id", su.position_id)
                  .neq("status", "empty")
                  .neq("id", su.id);

                if ((count || 0) === 0) {
                  await supabase
                    .from("rack_positions")
                    .update({ status: "available" })
                    .eq("id", su.position_id);
                }
              }

              // Update lot remaining
              if (su.lot_id) {
                const { data: lot } = await supabase
                  .from("lot_tracking")
                  .select("remaining_quantity")
                  .eq("id", su.lot_id)
                  .single();

                if (lot) {
                  await supabase
                    .from("lot_tracking")
                    .update({ remaining_quantity: Math.max(0, Number(lot.remaining_quantity) - pickQty), updated_at: new Date().toISOString() })
                    .eq("id", su.lot_id);
                }
              }

              // Create movement
              await createMovement(supabase, {
                warehouse_id,
                product_id: item.product_id,
                movement_type: "issue",
                sap_movement_type: movType,
                quantity: -pickQty,
                reference_type: "goods_issue",
                reference_id: gi.id,
                reference_number: issueNumber,
                position_id: su.position_id || undefined,
                lot_number: lotInfo?.lot_number || undefined,
                storage_unit_id: su.id,
              });
            }
          }

          // If still remaining (no SU found), create item without SU as fallback
          if (remainingQty > 0) {
            totalPicked += remainingQty;
            await supabase.from("goods_issue_items").insert({
              issue_id: gi.id,
              product_id: item.product_id,
              quantity_requested: remainingQty,
              quantity_issued: remainingQty,
              quantity_picked: 0,
              unit: "UN",
              org_id: DEMO_ORG_ID,
            });
          }
        }

        // Update SO status
        if (so_id) {
          await supabase.from("sales_orders").update({ status: "shipped" }).eq("id", so_id);
        }

        revalidatePath("/almacenes");
        return NextResponse.json({
          success: true,
          message: `Salida ${issueNumber} contabilizada — ${totalPicked} unidades despachadas`,
          id: gi.id,
          issue_number: issueNumber,
          status: "posted",
        });
      }

      // ──────────────────────────────────────────────────
      // POST GOODS ISSUE — Confirm picking + post
      // ──────────────────────────────────────────────────
      case "post_goods_issue": {
        const { id } = params;

        // Get the GI and its items
        const { data: gi } = await supabase
          .from("goods_issues")
          .select("id, issue_number, warehouse_id, movement_type, reference_id")
          .eq("id", id)
          .single();

        if (!gi) throw new Error("Salida no encontrada");

        const { data: giItems } = await supabase
          .from("goods_issue_items")
          .select("id, product_id, quantity_issued, storage_unit_id")
          .eq("issue_id", id);

        const lowStockAlerts: { product_name: string; remaining: number; min_stock: number }[] = [];

        for (const item of giItems || []) {
          const qty = Number(item.quantity_issued) || 0;

          // Deduct from storage unit
          if (item.storage_unit_id) {
            const { data: su } = await supabase
              .from("storage_units")
              .select("id, quantity, reserved_quantity, position_id, lot_id, warehouse_id")
              .eq("id", item.storage_unit_id)
              .single();

            if (su) {
              const newQty = Math.max(0, Number(su.quantity) - qty);
              const newReserved = Math.max(0, Number(su.reserved_quantity) - qty);
              const newStatus = newQty <= 0 ? "empty" : newReserved > 0 ? "reserved" : "available";

              await supabase
                .from("storage_units")
                .update({
                  quantity: newQty,
                  reserved_quantity: newReserved,
                  status: newStatus,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", item.storage_unit_id);

              // If empty, free up rack position
              if (newQty <= 0) {
                // Check if other SUs still in this position
                const { count } = await supabase
                  .from("storage_units")
                  .select("id", { count: "exact", head: true })
                  .eq("position_id", su.position_id)
                  .neq("status", "empty")
                  .neq("id", item.storage_unit_id);

                if ((count || 0) === 0) {
                  await supabase
                    .from("rack_positions")
                    .update({ status: "available" })
                    .eq("id", su.position_id);
                }
              }

              // Update lot remaining quantity
              if (su.lot_id) {
                const { data: lot } = await supabase
                  .from("lot_tracking")
                  .select("remaining_quantity")
                  .eq("id", su.lot_id)
                  .single();

                if (lot) {
                  await supabase
                    .from("lot_tracking")
                    .update({
                      remaining_quantity: Math.max(0, Number(lot.remaining_quantity) - qty),
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", su.lot_id);
                }
              }

              // Create movement
              await createMovement(supabase, {
                warehouse_id: gi.warehouse_id,
                product_id: item.product_id,
                movement_type: "issue",
                sap_movement_type: gi.movement_type || "261",
                quantity: -qty,
                reference_type: "goods_issue",
                reference_id: gi.id,
                reference_number: gi.issue_number,
                position_id: su.position_id,
                storage_unit_id: item.storage_unit_id,
              });
            }
          }

          // Release reservations
          await supabase
            .from("storage_unit_reservations")
            .update({ status: "released", released_at: new Date().toISOString() })
            .eq("reference_type", "goods_issue")
            .eq("reference_id", id)
            .eq("status", "reserved");
        }

        // Update GI status
        await supabase
          .from("goods_issues")
          .update({ status: "posted", posted_at: new Date().toISOString() })
          .eq("id", id);

        // Update SO status
        if (gi.reference_id) {
          await supabase.from("sales_orders").update({ status: "shipped" }).eq("id", gi.reference_id);
        }

        revalidatePath("/almacenes");
        return NextResponse.json({
          success: true,
          message: `Salida ${gi.issue_number} contabilizada`,
          low_stock_alerts: lowStockAlerts,
        });
      }

      // ──────────────────────────────────────────────────
      // TRANSFER — Create with pending state  
      // ──────────────────────────────────────────────────
      case "create_transfer": {
        const {
          from_warehouse_id, to_warehouse_id,
          transfer_type, priority: transferPriority,
          reason, transfer_items, notes: toNotes
        } = params;

        const isInternal = from_warehouse_id === to_warehouse_id;
        const movType = isInternal ? "311" : "301";
        const transferNumber = await getNextNumber(supabase, "transfer_orders", "transfer_number", "TO");

        // 1. Create TO header in 'pending' state
        const { data: to, error: toError } = await supabase
          .from("transfer_orders")
          .insert({
            org_id: DEMO_ORG_ID,
            transfer_number: transferNumber,
            transfer_type: transfer_type || (isInternal ? "internal" : "cross_warehouse"),
            from_warehouse_id,
            to_warehouse_id,
            status: "pending",
            movement_type: movType,
            priority: transferPriority || "medium",
            reason: reason || null,
            notes: toNotes || null,
          })
          .select("id")
          .single();

        if (toError) throw toError;

        type TransferItemInput = {
          su_id: string;
          su_code?: string;
          product_id: string;
          quantity: number;
          from_position_label?: string;
          to_position_id?: string;
          to_position_label?: string;
          lot_number?: string;
        };

        const tItems = (transfer_items || []) as TransferItemInput[];

        for (const item of tItems) {
          await supabase.from("transfer_order_items").insert({
            transfer_id: to.id,
            product_id: item.product_id,
            quantity: item.quantity,
            storage_unit_id: item.su_id,
            from_su_code: item.su_code || null,
            to_position_label: item.to_position_label || null,
            to_position_id: item.to_position_id || null,
            lot_number: item.lot_number || null,
            status: "pending",
          });
        }

        revalidatePath("/almacenes");
        return NextResponse.json({
          success: true,
          message: `Traspaso ${transferNumber} creado — pendiente de envío`,
          id: to.id,
          transfer_number: transferNumber,
          status: "pending",
        });
      }

      // ──────────────────────────────────────────────────
      // TRANSFER — Start transit (confirm shipment)
      // ──────────────────────────────────────────────────
      case "start_transfer": {
        const { id } = params;

        const { data: to } = await supabase
          .from("transfer_orders")
          .select("id, transfer_number, from_warehouse_id, status")
          .eq("id", id)
          .single();

        if (!to) throw new Error("Traspaso no encontrado");
        if (to.status !== "pending" && to.status !== "approved") {
          throw new Error("Solo se puede iniciar un traspaso en estado pendiente");
        }

        // Get TO items and mark source UAs as in_transit
        const { data: toItems } = await supabase
          .from("transfer_order_items")
          .select("id, storage_unit_id, quantity")
          .eq("transfer_id", id);

        for (const item of toItems || []) {
          if (item.storage_unit_id) {
            await supabase
              .from("storage_units")
              .update({ status: "in_transit", updated_at: new Date().toISOString() })
              .eq("id", item.storage_unit_id);
          }
        }

        await supabase
          .from("transfer_orders")
          .update({ status: "in_transit" })
          .eq("id", id);

        revalidatePath("/almacenes");
        return NextResponse.json({
          success: true,
          message: `Traspaso ${to.transfer_number} en tránsito`,
        });
      }

      // ──────────────────────────────────────────────────
      // TRANSFER — Confirm receipt at destination
      // ──────────────────────────────────────────────────
      case "confirm_transfer": {
        const { id, destination_positions } = params;

        const { data: to } = await supabase
          .from("transfer_orders")
          .select("id, transfer_number, from_warehouse_id, to_warehouse_id, movement_type")
          .eq("id", id)
          .single();

        if (!to) throw new Error("Traspaso no encontrado");

        const { data: toItems } = await supabase
          .from("transfer_order_items")
          .select("id, storage_unit_id, product_id, quantity, lot_number")
          .eq("transfer_id", id);

        type DestPosition = { item_id: string; position_id: string; position_label: string };
        const destPositions = (destination_positions || []) as DestPosition[];

        for (const item of toItems || []) {
          const dest = destPositions.find(d => d.item_id === item.id);
          const destPositionId = dest?.position_id;

          if (item.storage_unit_id) {
            // Move UA to destination
            const updates: Record<string, unknown> = {
              warehouse_id: to.to_warehouse_id,
              status: "available",
              updated_at: new Date().toISOString(),
            };
            if (destPositionId) {
              updates.position_id = destPositionId;
            }

            await supabase
              .from("storage_units")
              .update(updates)
              .eq("id", item.storage_unit_id);

            // Release origin rack position
            const { data: origSU } = await supabase
              .from("storage_units")
              .select("position_id")
              .eq("id", item.storage_unit_id)
              .single();

            if (origSU?.position_id && destPositionId) {
              // Mark destination as occupied
              await supabase
                .from("rack_positions")
                .update({ status: "occupied" })
                .eq("id", destPositionId);
            }

            // Create movement
            await createMovement(supabase, {
              warehouse_id: to.to_warehouse_id,
              product_id: item.product_id,
              movement_type: "transfer",
              sap_movement_type: to.movement_type || "311",
              quantity: Number(item.quantity),
              reference_type: "transfer_order",
              reference_id: to.id,
              reference_number: to.transfer_number,
              position_id: destPositionId,
              lot_number: item.lot_number || undefined,
              storage_unit_id: item.storage_unit_id,
            });
          }

          // Update item status
          await supabase
            .from("transfer_order_items")
            .update({
              status: "completed",
              to_position_label: dest?.position_label || null,
              to_position_id: dest?.position_id || null,
              confirmed_at: new Date().toISOString(),
            })
            .eq("id", item.id);
        }

        // Post the transfer
        await supabase
          .from("transfer_orders")
          .update({ status: "posted", posted_at: new Date().toISOString() })
          .eq("id", id);

        revalidatePath("/almacenes");
        return NextResponse.json({
          success: true,
          message: `Traspaso ${to.transfer_number} confirmado y contabilizado`,
        });
      }

      // ──────────────────────────────────────────────────
      // TRANSFER — Create draft (material + source only)
      // ──────────────────────────────────────────────────
      case "create_transfer_draft": {
        const {
          from_warehouse_id, transfer_type,
          priority: draftPriority, reason: draftReason,
          transfer_items: draftItems, notes: draftNotes,
        } = params;

        const isInternalDraft = transfer_type === "internal";
        const draftMovType = isInternalDraft ? "311" : "301";
        const draftNumber = await getNextNumber(supabase, "transfer_orders", "transfer_number", "TO");

        // Create TO header in 'draft' state — to_warehouse_id is NULL
        const { data: draftTO, error: draftError } = await supabase
          .from("transfer_orders")
          .insert({
            org_id: DEMO_ORG_ID,
            transfer_number: draftNumber,
            transfer_type: transfer_type || "cross_warehouse",
            from_warehouse_id,
            to_warehouse_id: null, // Will be assigned later
            status: "draft",
            movement_type: draftMovType,
            priority: draftPriority || "medium",
            reason: draftReason || null,
            notes: draftNotes || null,
          })
          .select("id")
          .single();

        if (draftError) throw draftError;

        type DraftTransferItem = {
          su_id: string;
          su_code?: string;
          product_id: string;
          quantity: number;
          from_position_id?: string;
          from_position_label?: string;
          lot_number?: string;
        };

        const dItems = (draftItems || []) as DraftTransferItem[];

        for (const item of dItems) {
          await supabase.from("transfer_order_items").insert({
            transfer_id: draftTO.id,
            product_id: item.product_id,
            quantity: item.quantity,
            storage_unit_id: item.su_id,
            from_su_code: item.su_code || null,
            from_position_id: item.from_position_id || null,
            from_position_label: item.from_position_label || null,
            lot_number: item.lot_number || null,
            status: "pending",
          });
        }

        revalidatePath("/almacenes");
        return NextResponse.json({
          success: true,
          message: `Borrador ${draftNumber} guardado — pendiente de asignar destino`,
          id: draftTO.id,
          transfer_number: draftNumber,
          status: "draft",
        });
      }

      // ──────────────────────────────────────────────────
      // TRANSFER — Assign destination + putaway positions
      // ──────────────────────────────────────────────────
      case "assign_transfer_destination": {
        const { id, to_warehouse_id, destination_positions } = params;

        const { data: toData } = await supabase
          .from("transfer_orders")
          .select("id, transfer_number, from_warehouse_id, status")
          .eq("id", id)
          .single();

        if (!toData) throw new Error("Traspaso no encontrado");
        if (toData.status !== "draft") {
          throw new Error("Solo se puede asignar destino a un traspaso en borrador");
        }

        const isInternalAssign = toData.from_warehouse_id === to_warehouse_id;

        // Update the header with destination
        await supabase
          .from("transfer_orders")
          .update({
            to_warehouse_id,
            transfer_type: isInternalAssign ? "internal" : "cross_warehouse",
            movement_type: isInternalAssign ? "311" : "301",
            status: "pending",
          })
          .eq("id", id);

        // Assign destination positions to items
        type DestPosAssign = { item_id?: string; product_id?: string; position_id: string; position_label: string };
        const destPos = (destination_positions || []) as DestPosAssign[];

        if (destPos.length > 0) {
          // Get all items for this transfer
          const { data: allItems } = await supabase
            .from("transfer_order_items")
            .select("id, product_id")
            .eq("transfer_id", id);

          for (const dp of destPos) {
            const matchItem = dp.item_id
              ? (allItems || []).find(i => i.id === dp.item_id)
              : (allItems || []).find(i => i.product_id === dp.product_id);
            if (matchItem) {
              await supabase
                .from("transfer_order_items")
                .update({
                  to_position_id: dp.position_id,
                  to_position_label: dp.position_label,
                })
                .eq("id", matchItem.id);
            }
          }
        }

        revalidatePath("/almacenes");
        return NextResponse.json({
          success: true,
          message: `Destino asignado — ${toData.transfer_number} listo para envío`,
          id,
          status: "pending",
        });
      }

      // ──────────────────────────────────────────────────
      // Legacy post actions (simplified)
      // ──────────────────────────────────────────────────
      case "post_goods_receipt": {
        const { id } = params;
        await supabase
          .from("goods_receipts")
          .update({ status: "posted" })
          .eq("id", id);
        revalidatePath("/almacenes");
        return NextResponse.json({ success: true, message: "Entrada contabilizada exitosamente" });
      }

      case "post_transfer": {
        const { id } = params;
        await supabase
          .from("transfer_orders")
          .update({ status: "posted", posted_at: new Date().toISOString() })
          .eq("id", id);
        revalidatePath("/almacenes");
        return NextResponse.json({ success: true, message: "Traspaso contabilizado exitosamente" });
      }

      // ──────────────────────────────────────────────────
      // PHYSICAL COUNT (preserved from original)
      // ──────────────────────────────────────────────────
      case "create_physical_count": {
        const { warehouse_id, count_type, notes } = params;

        const countNumber = await getNextNumber(supabase, "physical_counts", "count_number", "PC");

        const { data: occupiedSUs, error: suErr } = await supabase
          .from("storage_units")
          .select(`id, quantity, product_id, lot_id, position_id, lot_tracking(lot_number)`)
          .eq("warehouse_id", warehouse_id)
          .neq("status", "empty")
          .gt("quantity", 0);

        if (suErr) throw suErr;

        const positions = occupiedSUs || [];

        const { data: pc, error: pcError } = await supabase
          .from("physical_counts")
          .insert({
            org_id: DEMO_ORG_ID,
            count_number: countNumber,
            warehouse_id,
            count_type: count_type || "cycle",
            status: "in_progress",
            start_date: new Date().toISOString(),
            total_positions: positions.length,
            counted_positions: 0,
            variance_count: 0,
            notes: notes || null,
          })
          .select("id")
          .single();

        if (pcError) throw pcError;

        if (positions.length > 0) {
          const countItems = positions.map((su: Record<string, unknown>) => {
            const lot = su.lot_tracking as { lot_number: string } | null;
            return {
              count_id: pc.id,
              position_id: su.position_id as string,
              product_id: su.product_id as string,
              system_quantity: su.quantity as number,
              counted_quantity: null,
              lot_number: lot?.lot_number || null,
              status: "pending",
            };
          });

          const { error: itemsErr } = await supabase.from("physical_count_items").insert(countItems);
          if (itemsErr) throw itemsErr;
        }

        revalidatePath("/almacenes");
        return NextResponse.json({
          success: true,
          message: `Conteo ${countNumber} creado con ${positions.length} posiciones`,
          id: pc.id,
        });
      }

      case "save_count_item": {
        const { item_id, counted_quantity, item_notes } = params;
        const countedQty = Number(counted_quantity);

        const { data: item, error: itemErr } = await supabase
          .from("physical_count_items")
          .select("count_id, system_quantity, status")
          .eq("id", item_id)
          .single();

        if (itemErr || !item) throw itemErr || new Error("Item not found");

        const systemQty = Number(item.system_quantity) || 0;
        const wasAlreadyCounted = item.status === "counted";

        const { error: updateErr } = await supabase
          .from("physical_count_items")
          .update({
            counted_quantity: countedQty,
            status: "counted",
            counted_at: new Date().toISOString(),
            notes: item_notes || null,
          })
          .eq("id", item_id);

        if (updateErr) throw updateErr;

        const variance = countedQty - systemQty;

        if (!wasAlreadyCounted) {
          const { data: parentCount } = await supabase
            .from("physical_counts")
            .select("counted_positions")
            .eq("id", item.count_id)
            .single();

          if (parentCount) {
            await supabase
              .from("physical_counts")
              .update({ counted_positions: ((parentCount.counted_positions as number) || 0) + 1 })
              .eq("id", item.count_id);
          }
        }

        const { count: varCount } = await supabase
          .from("physical_count_items")
          .select("id", { count: "exact", head: true })
          .eq("count_id", item.count_id)
          .eq("status", "counted")
          .neq("variance", 0);

        await supabase
          .from("physical_counts")
          .update({ variance_count: varCount || 0 })
          .eq("id", item.count_id);

        revalidatePath("/almacenes");
        return NextResponse.json({
          success: true,
          message: variance === 0 ? "Coincide con el sistema" : `Varianza: ${variance > 0 ? "+" : ""}${variance}`,
          variance,
        });
      }

      case "complete_physical_count": {
        const { id } = params;
        await supabase
          .from("physical_counts")
          .update({ status: "completed", end_date: new Date().toISOString() })
          .eq("id", id);
        revalidatePath("/almacenes");
        return NextResponse.json({ success: true, message: "Conteo finalizado exitosamente" });
      }

      case "adjust_physical_count": {
        const { id } = params;
        await supabase
          .from("physical_counts")
          .update({ status: "posted", end_date: new Date().toISOString() })
          .eq("id", id);
        revalidatePath("/almacenes");
        return NextResponse.json({ success: true, message: "Ajuste de inventario aplicado exitosamente" });
      }

      case "update_lot_status": {
        const { lot_id, new_status } = params;
        await supabase
          .from("lot_tracking")
          .update({ status: new_status, updated_at: new Date().toISOString() })
          .eq("id", lot_id);
        revalidatePath("/almacenes");
        return NextResponse.json({ success: true, message: `Estado del lote actualizado a ${new_status}` });
      }

      default:
        return NextResponse.json({ success: false, message: `Acción desconocida: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("[WMS API] Operations error:", err);
    const msg = err instanceof Error
      ? err.message
      : (typeof err === "object" && err !== null && "message" in err)
        ? String((err as Record<string, unknown>).message)
        : JSON.stringify(err);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
