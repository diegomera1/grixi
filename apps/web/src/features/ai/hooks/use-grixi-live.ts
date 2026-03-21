"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { VOICE_FUNCTION_DECLARATIONS, buildVoiceSystemPrompt } from "@/features/ai/voice-functions";

// ── Types ──────────────────────────────────────────────
export type LiveState = "idle" | "connecting" | "listening" | "speaking" | "processing";

export type LiveTranscript = {
  id: string;
  text: string;
  role: "user" | "assistant";
  timestamp: number;
};

export type AudioDevice = {
  deviceId: string;
  label: string;
};

type TokenResponse = {
  token: string;
  userName: string;
  userDepartment: string;
  userPosition: string;
  dataContext: string;
};

// ── Constants ──────────────────────────────────────────
const WS_BASE = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";
const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
const VOICE = "Aoede";
const SAMPLE_RATE_OUT = 24000;
const CHUNK_SIZE = 4096;

// ── Main Hook ──────────────────────────────────────────
export function useGrixiLive() {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<LiveState>("idle");
  const [transcripts, setTranscripts] = useState<LiveTranscript[]>([]);
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const isConnectedRef = useRef(false);
  const pendingInputRef = useRef("");
  const pendingOutputRef = useRef("");
  const routerRef = useRef(router);
  routerRef.current = router;

  // ── Enumerate audio input devices ─────────────────
  const refreshDevices = useCallback(async () => {
    try {
      // Request mic access first to get labeled devices
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((t) => t.stop());

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Micrófono ${i + 1}`,
        }));
      setDevices(audioInputs);

      // Set default device if not already selected
      if (!selectedDeviceId && audioInputs.length > 0) {
        setSelectedDeviceId(audioInputs[0].deviceId);
      }

      console.log("[GRIXI Live] Audio devices:", audioInputs.map((d) => d.label));
    } catch (err) {
      console.error("[GRIXI Live] Error enumerating devices:", err);
    }
  }, [selectedDeviceId]);

  // ── Select a specific device ──────────────────────
  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    console.log("[GRIXI Live] Selected device:", deviceId);
  }, []);

  // ── Float32 → PCM16 base64 ────────────────────────
  const float32ToPCM16Base64 = useCallback((float32: Float32Array): string => {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const bytes = new Uint8Array(int16.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }, []);

  // ── Resample audio to 16kHz ───────────────────────
  const resampleTo16k = useCallback((input: Float32Array, fromRate: number): Float32Array => {
    if (fromRate === 16000) return input;
    const ratio = fromRate / 16000;
    const newLength = Math.round(input.length / ratio);
    const output = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const pos = i * ratio;
      const index = Math.floor(pos);
      const frac = pos - index;
      output[i] = index + 1 < input.length
        ? input[index] * (1 - frac) + input[index + 1] * frac
        : input[index] || 0;
    }
    return output;
  }, []);

  // ── Play audio from queue ─────────────────────────
  const drainPlaybackQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    while (playbackQueueRef.current.length > 0) {
      const chunk = playbackQueueRef.current.shift()!;
      if (!playbackCtxRef.current || playbackCtxRef.current.state === "closed") {
        playbackCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE_OUT });
      }
      const ctx = playbackCtxRef.current;
      const buffer = ctx.createBuffer(1, chunk.length, SAMPLE_RATE_OUT);
      buffer.getChannelData(0).set(chunk);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
    }

    isPlayingRef.current = false;
  }, []);

  // ── Stop audio playback ───────────────────────────
  const stopPlayback = useCallback(() => {
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    if (playbackCtxRef.current && playbackCtxRef.current.state !== "closed") {
      playbackCtxRef.current.close().catch(() => {});
      playbackCtxRef.current = null;
    }
  }, []);

  // ── Process incoming WebSocket message ────────────
  const processMessage = useCallback((data: Record<string, unknown>) => {
    if (data.setupComplete) {
      console.log("[GRIXI Live] ✅ Setup complete — ready to listen");
      setState("listening");
      return;
    }

    const serverContent = data.serverContent as Record<string, unknown> | undefined;

    if (serverContent) {
      if (serverContent.turnComplete) {
        setState("listening");
        if (pendingOutputRef.current.trim()) {
          const text = pendingOutputRef.current.trim();
          setTranscripts((prev) => [
            ...prev,
            { id: crypto.randomUUID(), text, role: "assistant", timestamp: Date.now() },
          ]);
          pendingOutputRef.current = "";
          setOutputText("");
        }
        return;
      }

      if (serverContent.interrupted) {
        stopPlayback();
        setState("listening");
        if (pendingOutputRef.current.trim()) {
          const text = pendingOutputRef.current.trim() + " [interrumpido]";
          setTranscripts((prev) => [
            ...prev,
            { id: crypto.randomUUID(), text, role: "assistant", timestamp: Date.now() },
          ]);
          pendingOutputRef.current = "";
          setOutputText("");
        }
        return;
      }

      const inputT = serverContent.inputTranscription as { text?: string; finished?: boolean } | undefined;
      if (inputT) {
        pendingInputRef.current += inputT.text || "";
        setInputText(pendingInputRef.current);
        if (inputT.finished) {
          if (pendingInputRef.current.trim()) {
            setTranscripts((prev) => [
              ...prev,
              { id: crypto.randomUUID(), text: pendingInputRef.current.trim(), role: "user", timestamp: Date.now() },
            ]);
          }
          pendingInputRef.current = "";
          setInputText("");
        }
        return;
      }

      const outputT = serverContent.outputTranscription as { text?: string; finished?: boolean } | undefined;
      if (outputT) {
        pendingOutputRef.current += outputT.text || "";
        setOutputText(pendingOutputRef.current);
        setState("speaking");
        return;
      }

      const modelTurn = serverContent.modelTurn as { parts?: Array<{ inlineData?: { data: string } }> } | undefined;
      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          if (part.inlineData?.data) {
            setState("speaking");
            const binaryStr = atob(part.inlineData.data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            const int16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
              float32[i] = int16[i] / 32768;
            }
            playbackQueueRef.current.push(float32);
            drainPlaybackQueue();
          }
        }
      }
    }

    const toolCall = data.toolCall as { functionCalls?: Array<{ name: string; id: string; args?: Record<string, unknown> }> } | undefined;
    if (toolCall?.functionCalls) {
      setState("processing");
      const functionResponses: Array<{ name: string; id: string; response: Record<string, unknown> }> = [];

      for (const fc of toolCall.functionCalls) {
        let result: Record<string, unknown> = {};
        if (fc.name === "navigate_to_module") {
          const route = (fc.args?.route as string) || "/dashboard";
          const label = (fc.args?.label as string) || "módulo";
          routerRef.current.push(route);
          result = { status: "success", message: `Navegando a ${label}` };
        } else {
          result = { status: "success", message: "Datos disponibles en la plataforma" };
        }
        functionResponses.push({ name: fc.name, id: fc.id, response: { result } });
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ toolResponse: { functionResponses } }));
      }
    }
  }, [drainPlaybackQueue, stopPlayback]);

  // ── Connect ───────────────────────────────────────
  const connect = useCallback(async () => {
    if (isConnectedRef.current || state === "connecting") return;
    setError(null);
    setState("connecting");
    setTranscripts([]);
    pendingInputRef.current = "";
    pendingOutputRef.current = "";

    try {
      // 1. Get ephemeral token
      console.log("[GRIXI Live] Fetching ephemeral token...");
      const res = await fetch("/api/ai/ephemeral-token", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Token error: ${res.status}`);
      const tokenData: TokenResponse = await res.json();
      console.log("[GRIXI Live] Token received for:", tokenData.userName);

      // 2. Get microphone with selected device
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      if (selectedDeviceId) {
        audioConstraints.deviceId = { exact: selectedDeviceId };
      }

      console.log("[GRIXI Live] Requesting microphone...", selectedDeviceId ? `Device: ${selectedDeviceId}` : "Default");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      streamRef.current = stream;

      // Log which device we got
      const track = stream.getAudioTracks()[0];
      console.log("[GRIXI Live] ✅ Microphone granted:", track.label, "| Settings:", JSON.stringify(track.getSettings()));

      // 3. Setup AudioContext
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const sampleRate = audioCtx.sampleRate;
      console.log("[GRIXI Live] AudioContext sample rate:", sampleRate);

      // Resume AudioContext if suspended (mobile browsers)
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
        console.log("[GRIXI Live] AudioContext resumed");
      }

      const sourceNode = audioCtx.createMediaStreamSource(stream);

      // Analyser for visualization
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      sourceNode.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 255);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // 4. Connect WebSocket
      const wsUrl = `${WS_BASE}?access_token=${tokenData.token}`;
      console.log("[GRIXI Live] Connecting WebSocket...");
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[GRIXI Live] ✅ WebSocket connected, sending setup...");
        isConnectedRef.current = true;

        const systemPrompt = buildVoiceSystemPrompt({
          userName: tokenData.userName,
          userDepartment: tokenData.userDepartment,
          userPosition: tokenData.userPosition,
          currentPage: pathname,
          dataContext: tokenData.dataContext,
        });

        const setupMsg = {
          setup: {
            model: `models/${MODEL}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: VOICE },
                },
              },
            },
            systemInstruction: { parts: [{ text: systemPrompt }] },
            tools: { functionDeclarations: VOICE_FUNCTION_DECLARATIONS },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
              },
            },
          },
        };

        ws.send(JSON.stringify(setupMsg));
        console.log("[GRIXI Live] ✅ Setup message sent, waiting for setupComplete...");
      };

      ws.onmessage = async (event) => {
        let msgData: Record<string, unknown>;
        try {
          if (event.data instanceof Blob) {
            const text = await event.data.text();
            msgData = JSON.parse(text);
          } else {
            msgData = JSON.parse(event.data as string);
          }
        } catch {
          return;
        }
        processMessage(msgData);
      };

      ws.onerror = (err) => {
        console.error("[GRIXI Live] ❌ WebSocket error:", err);
        setError("Error de conexión con GRIXI Voice");
        setState("idle");
        isConnectedRef.current = false;
      };

      ws.onclose = (event) => {
        console.log("[GRIXI Live] WebSocket closed:", event.code, event.reason);
        isConnectedRef.current = false;
        setState("idle");
      };

      // 5. ScriptProcessorNode for mic audio capture
      const processor = audioCtx.createScriptProcessor(CHUNK_SIZE, 1, 1);
      processorRef.current = processor;

      let chunksSent = 0;
      processor.onaudioprocess = (e) => {
        if (!isConnectedRef.current || !ws || ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Check if there's actually audio
        let maxVal = 0;
        for (let i = 0; i < inputData.length; i++) {
          const abs = Math.abs(inputData[i]);
          if (abs > maxVal) maxVal = abs;
        }

        // Skip silent frames (below noise floor)
        if (maxVal < 0.001) return;

        const resampled = resampleTo16k(new Float32Array(inputData), sampleRate);
        const base64 = float32ToPCM16Base64(resampled);

        ws.send(JSON.stringify({
          realtimeInput: {
            audio: {
              data: base64,
              mimeType: "audio/pcm;rate=16000",
            },
          },
        }));

        chunksSent++;
        if (chunksSent <= 3 || chunksSent % 50 === 0) {
          console.log(`[GRIXI Live] 📤 Audio chunk #${chunksSent} sent (peak: ${maxVal.toFixed(4)}, samples: ${resampled.length})`);
        }
      };

      // Connect source → processor → muted gain → destination
      sourceNode.connect(processor);
      const mutedGain = audioCtx.createGain();
      mutedGain.gain.value = 0;
      processor.connect(mutedGain);
      mutedGain.connect(audioCtx.destination);

      console.log("[GRIXI Live] ✅ Audio pipeline ready — waiting for you to speak...");

    } catch (err) {
      console.error("[GRIXI Live] ❌ Connect error:", err);
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Permiso de micrófono denegado. Habilita el acceso en tu navegador.");
      } else if (err instanceof Error && err.name === "OverconstrainedError") {
        setError("El micrófono seleccionado no está disponible. Selecciona otro.");
        // Reset to default device
        setSelectedDeviceId("");
      } else {
        setError(err instanceof Error ? err.message : "Error al conectar GRIXI Voice");
      }
      setState("idle");
    }
  }, [state, pathname, selectedDeviceId, processMessage, float32ToPCM16Base64, resampleTo16k]);

  // ── Disconnect ────────────────────────────────────
  const disconnect = useCallback(() => {
    isConnectedRef.current = false;
    stopPlayback();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    analyserRef.current = null;
    cancelAnimationFrame(animFrameRef.current);

    setAudioLevel(0);
    setState("idle");
    setInputText("");
    setOutputText("");
  }, [stopPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isConnectedRef.current = false;
      if (wsRef.current) wsRef.current.close();
      if (processorRef.current) processorRef.current.disconnect();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") audioCtxRef.current.close().catch(() => {});
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return {
    state,
    transcripts,
    inputText,
    outputText,
    error,
    audioLevel,
    devices,
    selectedDeviceId,
    refreshDevices,
    selectDevice,
    connect,
    disconnect,
    isActive: state !== "idle",
  };
}
