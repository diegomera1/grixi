"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { GRIXI_VOICE_TOOLS, buildVoiceSystemPrompt } from "@/features/ai/voice-functions";
import { createClient } from "@/lib/supabase/client";

export type VoiceState = "idle" | "connecting" | "listening" | "speaking" | "processing";

export type VoiceTranscript = {
  id: string;
  text: string;
  role: "user" | "assistant";
  timestamp: number;
};

// ── Audio helpers ────────────────────────────────────
function pcm16ToFloat32(pcm16: ArrayBuffer): Float32Array {
  const int16 = new Int16Array(pcm16);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

function float32ToPcm16(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    let s = float32[i];
    s = Math.max(-1, Math.min(1, s));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

// ── Main Voice Hook ──────────────────────────────────
export function useGrixiVoice() {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<VoiceState>("idle");
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [currentUserText, setCurrentUserText] = useState("");
  const [currentAssistantText, setCurrentAssistantText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const sessionRef = useRef<Session | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  // ── Function Call Handler ──────────────────────────
  const handleFunctionCall = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      const supabase = createClient();

      switch (name) {
        case "navigate_to_module": {
          const route = args.route as string;
          const label = args.label as string;
          router.push(route);
          return { success: true, message: `Navegando a ${label}` };
        }

        case "get_kpi_summary": {
          const [
            { count: totalProducts },
            { count: openPOs },
            { count: activeUsers },
            { data: incomeData },
            { data: expenseData },
          ] = await Promise.all([
            supabase.from("products").select("*", { count: "exact", head: true }),
            supabase.from("purchase_orders").select("*", { count: "exact", head: true }).not("status", "in", '("closed","cancelled")'),
            supabase.from("active_sessions").select("*", { count: "exact", head: true }).eq("is_active", true),
            supabase.from("finance_transactions").select("amount_usd").eq("transaction_type", "income").gte("posting_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
            supabase.from("finance_transactions").select("amount_usd").eq("transaction_type", "expense").gte("posting_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
          ]);
          const revenue = (incomeData || []).reduce((s, t) => s + Number(t.amount_usd || 0), 0);
          const expenses = (expenseData || []).reduce((s, t) => s + Math.abs(Number(t.amount_usd || 0)), 0);
          return {
            totalProducts: totalProducts || 0,
            openPurchaseOrders: openPOs || 0,
            activeUsersOnline: activeUsers || 0,
            monthlyRevenue: revenue,
            monthlyExpenses: expenses,
            netIncome: revenue - expenses,
          };
        }

        case "get_warehouse_occupancy": {
          const { data: warehouses } = await supabase.from("warehouses").select("id, name");
          const { data: racks } = await supabase.from("racks").select("id, warehouse_id");
          const { data: positions } = await supabase.from("rack_positions").select("rack_id, status");

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

          return (warehouses || []).map((w) => {
            const wRacks = racksByWh.get(w.id) || [];
            let total = 0, occ = 0;
            for (const rId of wRacks) {
              const s = posByRack.get(rId);
              if (s) { total += s.total; occ += s.occupied; }
            }
            return {
              warehouse: w.name,
              occupancy: total > 0 ? Math.round((occ / total) * 100) : 0,
              occupied: occ,
              total,
            };
          });
        }

        case "get_open_purchase_orders": {
          let query = supabase
            .from("purchase_orders")
            .select("po_number, status, total, currency, created_at")
            .not("status", "in", '("closed","cancelled")')
            .order("created_at", { ascending: false })
            .limit(10);

          if (args.status_filter && args.status_filter !== "all") {
            query = query.eq("status", args.status_filter as string);
          }

          const { data } = await query;
          return {
            count: (data || []).length,
            totalAmount: (data || []).reduce((s, po) => s + Number(po.total || 0), 0),
            orders: (data || []).map((po) => ({
              number: po.po_number,
              status: po.status,
              total: Number(po.total),
            })),
          };
        }

        case "get_financial_summary": {
          const now = new Date();
          let start: string;
          const period = (args.period as string) || "this_month";
          switch (period) {
            case "today":
              start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
              break;
            case "this_week":
              start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
              break;
            case "this_year":
              start = new Date(now.getFullYear(), 0, 1).toISOString();
              break;
            default:
              start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          }
          const [{ data: inc }, { data: exp }] = await Promise.all([
            supabase.from("finance_transactions").select("amount_usd").eq("transaction_type", "income").gte("posting_date", start),
            supabase.from("finance_transactions").select("amount_usd").eq("transaction_type", "expense").gte("posting_date", start),
          ]);
          const revenue = (inc || []).reduce((s, t) => s + Number(t.amount_usd || 0), 0);
          const expenses = (exp || []).reduce((s, t) => s + Math.abs(Number(t.amount_usd || 0)), 0);
          return { period, revenue, expenses, netIncome: revenue - expenses, ebitda: revenue - expenses };
        }

        case "get_low_stock_alerts": {
          const { data } = await supabase.from("products").select("name, min_stock, category").gt("min_stock", 0).limit(10);
          return { lowStockProducts: data || [], count: (data || []).length };
        }

        case "get_active_users": {
          const { data: sessions } = await supabase
            .from("active_sessions")
            .select("user_id, last_seen_at")
            .eq("is_active", true)
            .gte("last_seen_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
          const userIds = [...new Set((sessions || []).map((s) => s.user_id).filter(Boolean))];
          if (userIds.length === 0) return { activeUsers: [], count: 0 };
          const { data: profiles } = await supabase.from("profiles").select("full_name, department").in("id", userIds);
          return {
            activeUsers: (profiles || []).map((p) => ({ name: p.full_name, department: p.department })),
            count: userIds.length,
          };
        }

        default:
          return { error: `Función desconocida: ${name}` };
      }
    },
    [router]
  );

  // ── Audio Playback Queue ───────────────────────────
  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    const chunk = audioQueueRef.current.shift()!;
    const ctx = playbackContextRef.current || new AudioContext({ sampleRate: 24000 });
    playbackContextRef.current = ctx;

    try {
      const float32 = pcm16ToFloat32(chunk);
      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        isPlayingRef.current = false;
        playNextAudio();
      };
      source.start();
    } catch {
      isPlayingRef.current = false;
      playNextAudio();
    }
  }, []);

  // ── Start Session ──────────────────────────────────
  const start = useCallback(async () => {
    if (state === "connecting" || state === "listening") return;
    setError(null);
    setState("connecting");

    try {
      // 1. Get ephemeral token from server
      const tokenRes = await fetch("/api/ai/ephemeral-token", { method: "POST", credentials: "include" });
      if (!tokenRes.ok) throw new Error("No se pudo obtener el token de autenticación");
      const { token, userName, userDepartment, userPosition } = await tokenRes.json();

      // 2. Create client with ephemeral token
      const client = new GoogleGenAI({
        apiKey: token,
      });

      // 3. Build system prompt
      const systemPrompt = buildVoiceSystemPrompt({
        userName,
        userDepartment,
        userPosition,
        currentPage: pathname,
      });

      // 4. Connect to Live API
      const session = await client.live.connect({
        model: "gemini-2.5-flash-preview-native-audio-dialog",
        config: {
          responseModalities: [Modality.AUDIO, Modality.TEXT],
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          tools: GRIXI_VOICE_TOOLS,
          speechConfig: {
            languageCode: "es-ES",
          },
        },
        callbacks: {
          onopen: () => {
            setState("listening");
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle audio response
            if (msg.data && typeof msg.data === "string") {
              try {
                const audioBytes = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
                audioQueueRef.current.push(audioBytes.buffer);
                setState("speaking");
                playNextAudio();
              } catch {
                // Not audio data
              }
            }

            // Handle server content (text transcriptions)
            if (msg.serverContent) {
              const sc = msg.serverContent;
              // Model turn text
              if (sc.modelTurn?.parts) {
                for (const part of sc.modelTurn.parts) {
                  if (part.text) {
                    setCurrentAssistantText((prev) => prev + part.text);
                  }
                  if (part.inlineData?.data) {
                    const audioBytes = Uint8Array.from(
                      atob(part.inlineData.data),
                      (c) => c.charCodeAt(0)
                    );
                    audioQueueRef.current.push(audioBytes.buffer);
                    setState("speaking");
                    playNextAudio();
                  }
                }
              }
              // Input transcription (user's speech)
              if (sc.inputTranscription?.text) {
                setCurrentUserText(sc.inputTranscription.text);
              }
              // Output transcription (AI's speech)
              if (sc.outputTranscription?.text) {
                setCurrentAssistantText((prev) => prev + sc.outputTranscription!.text);
              }
              // Turn complete
              if (sc.turnComplete) {
                // Finalize transcripts
                if (currentUserText.trim()) {
                  setTranscripts((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), text: currentUserText, role: "user", timestamp: Date.now() },
                  ]);
                  setCurrentUserText("");
                }
                setTranscripts((prev) => {
                  const assistantText = currentAssistantText.trim();
                  if (assistantText) {
                    return [
                      ...prev,
                      { id: crypto.randomUUID(), text: assistantText, role: "assistant", timestamp: Date.now() },
                    ];
                  }
                  return prev;
                });
                setCurrentAssistantText("");
                setState("listening");
              }
            }

            // Handle tool calls (function calling)
            if (msg.toolCall) {
              setState("processing");
              const results = [];
              for (const fc of msg.toolCall.functionCalls || []) {
                const fnName = fc.name || "";
                const result = await handleFunctionCall(fnName, (fc.args || {}) as Record<string, unknown>);
                results.push({
                  id: fc.id || "",
                  name: fnName,
                  response: result,
                });
              }
              // Send tool responses back
              if (sessionRef.current) {
                sessionRef.current.sendToolResponse({
                  functionResponses: results.map((r) => ({
                    id: r.id,
                    name: r.name,
                    response: (Array.isArray(r.response)
                      ? { data: r.response }
                      : r.response) as Record<string, unknown>,
                  })),
                });
              }
            }
          },
          onerror: (err: ErrorEvent) => {
            console.error("[GRIXI Voice] Error:", err);
            setError("Error de conexión con GRIXI Voice");
            setState("idle");
          },
          onclose: () => {
            setState("idle");
          },
        },
      });

      sessionRef.current = session;

      // 5. Start microphone input
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Set up AudioContext for capturing PCM
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      // Create analyser for visualization
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Audio level visualization loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 255);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // Use ScriptProcessor for PCM data (AudioWorklet may not be available)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (sessionRef.current && state !== "speaking") {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = float32ToPcm16(inputData);
          const base64 = btoa(
            String.fromCharCode(...new Uint8Array(pcm16))
          );
          try {
            sessionRef.current.sendRealtimeInput({
              media: {
                data: base64,
                mimeType: "audio/pcm;rate=16000",
              },
            });
          } catch {
            // Session may not be ready yet
          }
        }
      };
    } catch (err) {
      console.error("[GRIXI Voice] Start error:", err);
      setError(err instanceof Error ? err.message : "Error al iniciar GRIXI Voice");
      setState("idle");
    }
  }, [state, pathname, handleFunctionCall, playNextAudio, currentUserText, currentAssistantText]);

  // ── Stop Session ───────────────────────────────────
  const stop = useCallback(() => {
    // Stop microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Close audio contexts
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Close Live API session
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }

    // Stop animation
    cancelAnimationFrame(animFrameRef.current);

    // Clear playback
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    setAudioLevel(0);
    setState("idle");
    setCurrentUserText("");
    setCurrentAssistantText("");
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    state,
    transcripts,
    currentUserText,
    currentAssistantText,
    error,
    audioLevel,
    start,
    stop,
    isActive: state !== "idle",
  };
}
