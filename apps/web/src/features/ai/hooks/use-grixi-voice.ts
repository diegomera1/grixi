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

// ── Main Voice Hook (MediaRecorder + Gemini Audio) ──
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

  // ── Speak response ────────────────────────────────
  const speak = useCallback(
    (text: string, navigationRoute?: string | null) => {
      setState("speaking");
      setCurrentAssistantText(text);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-ES";
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Find a good Spanish voice
      const voices = speechSynthesis.getVoices();
      const spanishVoice =
        voices.find((v) => v.lang.startsWith("es") && v.name.toLowerCase().includes("google")) ||
        voices.find((v) => v.lang.startsWith("es"));
      if (spanishVoice) utterance.voice = spanishVoice;

      utterance.onend = () => {
        setCurrentAssistantText("");
        if (navigationRoute) router.push(navigationRoute);
        // Auto-restart listening if still active
        if (isActiveRef.current) {
          startRecording();
        } else {
          setState("idle");
        }
      };

      utterance.onerror = () => {
        setCurrentAssistantText("");
        if (navigationRoute) router.push(navigationRoute);
        if (isActiveRef.current) {
          startRecording();
        } else {
          setState("idle");
        }
      };

      speechSynthesis.speak(utterance);
    },
    [router]
  );

  // ── Process recorded audio ────────────────────────
  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      if (audioBlob.size < 1000) {
        // Too small, likely silence — restart listening
        if (isActiveRef.current) {
          startRecording();
        }
        return;
      }

      setCurrentUserText("Procesando audio...");
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

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        // Add transcripts
        setTranscripts((prev) => [
          ...prev,
          { id: crypto.randomUUID(), text: "🎤 [Audio]", role: "user", timestamp: Date.now() },
          { id: crypto.randomUUID(), text: data.text, role: "assistant", timestamp: Date.now() },
        ]);

        setCurrentUserText("");
        speak(data.text, data.navigationRoute);
      } catch (err) {
        console.error("[GRIXI Voice] Processing error:", err);
        setError(err instanceof Error ? err.message : "Error al procesar audio");
        setCurrentUserText("");
        if (isActiveRef.current) {
          // Retry listening
          setTimeout(() => startRecording(), 500);
        } else {
          setState("idle");
        }
      }
    },
    [pathname, speak]
  );

  // ── Start recording ───────────────────────────────
  const startRecording = useCallback(() => {
    if (!streamRef.current || !isActiveRef.current) return;

    chunksRef.current = [];
    silenceCountRef.current = 0;

    try {
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (chunksRef.current.length > 0 && isActiveRef.current) {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          processAudio(blob);
        }
      };

      recorder.start(250); // Collect data every 250ms for silence detection
      mediaRecorderRef.current = recorder;
      setState("listening");

      // Auto-stop after detecting silence (3s of low audio) or max 10s
      const checkSilence = () => {
        if (!isActiveRef.current || !analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

        if (avg < 8) {
          silenceCountRef.current++;
        } else {
          silenceCountRef.current = 0;
        }

        // Stop after 3s of silence (30 checks * 100ms) and at least 1s of recording
        if (silenceCountRef.current > 30 && chunksRef.current.length > 4) {
          if (recorder.state === "recording") {
            recorder.stop();
          }
          return;
        }

        silenceTimerRef.current = setTimeout(checkSilence, 100);
      };

      // Start silence detection after a 1s grace period
      setTimeout(() => {
        if (isActiveRef.current) checkSilence();
      }, 1000);

      // Max recording time: 10 seconds
      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 10000);
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
      // Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Audio visualization
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Audio level animation loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 255);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // Load voices for TTS
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

    // Stop silence detection
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Stop recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* already stopped */
      }
    }
    mediaRecorderRef.current = null;

    // Stop speech
    speechSynthesis.cancel();

    // Stop microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Close audio context
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

  // Unmount cleanup
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
