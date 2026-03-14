"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export type VoiceState = "idle" | "connecting" | "listening" | "processing" | "speaking";

export type VoiceTranscript = {
  id: string;
  text: string;
  role: "user" | "assistant";
  timestamp: number;
};

// ── Main Voice Hook (MediaRecorder + Gemini STT/TTS) ──
export function useGrixiVoice() {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<VoiceState>("idle");
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [currentUserText, setCurrentUserText] = useState("");
  const [currentAssistantText, setCurrentAssistantText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const isActiveRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceCountRef = useRef(0);
  const hasVoiceRef = useRef(false);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // ── Play Gemini TTS audio ─────────────────────────
  const playGeminiAudio = useCallback(
    async (base64Audio: string, navigationRoute?: string | null) => {
      setState("speaking");

      try {
        // Decode base64 to raw audio bytes
        const binaryStr = atob(base64Audio);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        // Create audio context for playback
        const playCtx = new AudioContext({ sampleRate: 24000 });

        // Try decoding as WAV/PCM
        let audioBuffer: AudioBuffer;
        try {
          audioBuffer = await playCtx.decodeAudioData(bytes.buffer.slice(0));
        } catch {
          // If decoding fails, try interpreting as raw PCM 16-bit LE at 24kHz
          const int16 = new Int16Array(bytes.buffer);
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768;
          }
          audioBuffer = playCtx.createBuffer(1, float32.length, 24000);
          audioBuffer.getChannelData(0).set(float32);
        }

        const source = playCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(playCtx.destination);
        playbackSourceRef.current = source;

        source.onended = () => {
          playbackSourceRef.current = null;
          playCtx.close();
          setCurrentAssistantText("");
          if (navigationRoute) router.push(navigationRoute);
          if (isActiveRef.current) {
            startRecording();
          } else {
            setState("idle");
          }
        };

        source.start();
      } catch (err) {
        console.error("[GRIXI Voice] Audio playback error:", err);
        // Fallback to browser SpeechSynthesis
        fallbackSpeak(currentAssistantText, navigationRoute);
      }
    },
    [router]
  );

  // ── Fallback browser TTS ──────────────────────────
  const fallbackSpeak = useCallback(
    (text: string, navigationRoute?: string | null) => {
      setState("speaking");

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-ES";
      utterance.rate = 1.05;

      const voices = speechSynthesis.getVoices();
      const spanishVoice =
        voices.find((v) => v.lang.startsWith("es") && v.name.toLowerCase().includes("google")) ||
        voices.find((v) => v.lang.startsWith("es"));
      if (spanishVoice) utterance.voice = spanishVoice;

      utterance.onend = () => {
        setCurrentAssistantText("");
        if (navigationRoute) router.push(navigationRoute);
        if (isActiveRef.current) {
          startRecording();
        } else {
          setState("idle");
        }
      };

      utterance.onerror = () => {
        setCurrentAssistantText("");
        if (navigationRoute) router.push(navigationRoute);
        if (isActiveRef.current) startRecording();
        else setState("idle");
      };

      speechSynthesis.speak(utterance);
    },
    [router]
  );

  // ── Process recorded audio ────────────────────────
  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      // Skip if audio too small (< 2KB = likely just silence)
      if (audioBlob.size < 2000) {
        if (isActiveRef.current) startRecording();
        return;
      }

      setCurrentUserText("Escuchando...");
      setState("processing");

      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("currentPage", pathname);

        const response = await fetch("/api/ai/voice", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        // Add transcripts
        setTranscripts((prev) => [
          ...prev,
          { id: crypto.randomUUID(), text: "🎤 [Audio]", role: "user", timestamp: Date.now() },
          { id: crypto.randomUUID(), text: data.text, role: "assistant", timestamp: Date.now() },
        ]);

        setCurrentUserText("");
        setCurrentAssistantText(data.text);

        // Play Gemini TTS audio if available, otherwise browser TTS
        if (data.audioBase64) {
          playGeminiAudio(data.audioBase64, data.navigationRoute);
        } else {
          fallbackSpeak(data.text, data.navigationRoute);
        }
      } catch (err) {
        console.error("[GRIXI Voice] Processing error:", err);
        setError(err instanceof Error ? err.message : "Error al procesar audio");
        setCurrentUserText("");
        if (isActiveRef.current) {
          setTimeout(() => startRecording(), 500);
        } else {
          setState("idle");
        }
      }
    },
    [pathname, playGeminiAudio, fallbackSpeak]
  );

  // ── Start recording ───────────────────────────────
  const startRecording = useCallback(() => {
    if (!streamRef.current || !isActiveRef.current) return;

    chunksRef.current = [];
    silenceCountRef.current = 0;
    hasVoiceRef.current = false;

    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(streamRef.current, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        if (chunksRef.current.length > 0 && isActiveRef.current && hasVoiceRef.current) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          processAudio(blob);
        } else if (isActiveRef.current) {
          // No voice detected, restart
          startRecording();
        }
      };

      recorder.start(200);
      mediaRecorderRef.current = recorder;
      setState("listening");

      // Silence detection with voice activity tracking
      const checkSilence = () => {
        if (!isActiveRef.current || !analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

        // Track if voice was detected (avg > 12 indicates speech)
        if (avg > 12) {
          hasVoiceRef.current = true;
          silenceCountRef.current = 0;
        } else {
          silenceCountRef.current++;
        }

        // Only stop if: voice was detected AND 2.5s of silence after voice
        // (25 checks * 100ms = 2.5 seconds)
        if (hasVoiceRef.current && silenceCountRef.current > 25) {
          if (recorder.state === "recording") {
            recorder.stop();
          }
          return;
        }

        // If no voice after 8 seconds, restart (80 checks * 100ms)
        if (!hasVoiceRef.current && silenceCountRef.current > 80) {
          if (recorder.state === "recording") {
            recorder.stop();
          }
          return;
        }

        silenceTimerRef.current = setTimeout(checkSilence, 100);
      };

      // Start silence detection after 500ms grace
      setTimeout(() => {
        if (isActiveRef.current) checkSilence();
      }, 500);

      // Max recording: 15 seconds
      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 15000);
    } catch (err) {
      console.error("[GRIXI Voice] MediaRecorder error:", err);
      setError("Error al grabar audio");
      setState("idle");
    }
  }, [processAudio]);

  // ── Start session ─────────────────────────────────
  const start = useCallback(async () => {
    if (state === "connecting" || state === "listening") return;
    setError(null);
    setState("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Audio visualization
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 255);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // Preload TTS voices
      speechSynthesis.getVoices();

      isActiveRef.current = true;
      startRecording();
    } catch (err) {
      console.error("[GRIXI Voice] Start error:", err);
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Permiso de micrófono denegado. Habilita el acceso en tu navegador.");
      } else {
        setError(err instanceof Error ? err.message : "Error al iniciar GRIXI Voice");
      }
      setState("idle");
    }
  }, [state, startRecording]);

  // ── Stop session ──────────────────────────────────
  const stop = useCallback(() => {
    isActiveRef.current = false;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* */ }
    }
    mediaRecorderRef.current = null;

    // Stop audio playback
    if (playbackSourceRef.current) {
      try { playbackSourceRef.current.stop(); } catch { /* */ }
      playbackSourceRef.current = null;
    }
    speechSynthesis.cancel();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    cancelAnimationFrame(animFrameRef.current);

    setAudioLevel(0);
    setState("idle");
    setCurrentUserText("");
    setCurrentAssistantText("");
  }, []);

  useEffect(() => {
    return () => { stop(); };
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
