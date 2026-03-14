"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { processVoiceCommand } from "@/features/ai/actions/voice-action";

export type VoiceState = "idle" | "connecting" | "listening" | "processing" | "speaking";

export type VoiceTranscript = {
  id: string;
  text: string;
  role: "user" | "assistant";
  timestamp: number;
};

// ── SpeechRecognition types ──────────────────────────
type SpeechRecognitionEvent = {
  results: { [key: number]: { [key: number]: { transcript: string } }; length: number };
  resultIndex: number;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
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

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const isActiveRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Process user speech ───────────────────────────
  const processText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Add user transcript
      setTranscripts((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text: text.trim(), role: "user", timestamp: Date.now() },
      ]);
      setCurrentUserText("");
      setState("processing");

      try {
        const result = await processVoiceCommand(text.trim(), {
          currentPage: pathname,
        });

        // Add assistant transcript
        setTranscripts((prev) => [
          ...prev,
          { id: crypto.randomUUID(), text: result.text, role: "assistant", timestamp: Date.now() },
        ]);
        setCurrentAssistantText(result.text);
        setState("speaking");

        // Speak the response
        const utterance = new SpeechSynthesisUtterance(result.text);
        utterance.lang = "es-ES";
        utterance.rate = 1.05;
        utterance.pitch = 1.0;

        // Try to find a Spanish voice
        const voices = speechSynthesis.getVoices();
        const spanishVoice = voices.find(
          (v) => v.lang.startsWith("es") && v.name.toLowerCase().includes("google")
        ) || voices.find((v) => v.lang.startsWith("es"));
        if (spanishVoice) utterance.voice = spanishVoice;

        utteranceRef.current = utterance;

        utterance.onend = () => {
          setCurrentAssistantText("");
          // Navigate if requested
          if (result.navigationRoute) {
            router.push(result.navigationRoute);
          }
          // Resume listening if still active
          if (isActiveRef.current) {
            setState("listening");
            try {
              recognitionRef.current?.start();
            } catch {
              // Already started
            }
          } else {
            setState("idle");
          }
        };

        utterance.onerror = () => {
          setCurrentAssistantText("");
          if (result.navigationRoute) {
            router.push(result.navigationRoute);
          }
          if (isActiveRef.current) {
            setState("listening");
            try {
              recognitionRef.current?.start();
            } catch {
              // Already started
            }
          } else {
            setState("idle");
          }
        };

        speechSynthesis.speak(utterance);
      } catch (err) {
        console.error("[GRIXI Voice] Processing error:", err);
        setError("Error al procesar tu comando");
        if (isActiveRef.current) {
          setState("listening");
          try {
            recognitionRef.current?.start();
          } catch {
            // Already started
          }
        } else {
          setState("idle");
        }
      }
    },
    [pathname, router]
  );

  // ── Start ─────────────────────────────────────────
  const start = useCallback(async () => {
    if (state === "connecting" || state === "listening") return;
    setError(null);
    setState("connecting");

    // Check browser support
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError("Tu navegador no soporta reconocimiento de voz. Usa Chrome.");
      setState("idle");
      return;
    }

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // Audio level visualization
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
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

      // Set up speech recognition
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "es-ES";
      recognitionRef.current = recognition;

      let finalTranscript = "";

      recognition.onstart = () => {
        setState("listening");
        finalTranscript = "";
        setCurrentUserText("");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const isFinal = !!(event.results[i] as unknown as { isFinal: boolean }).isFinal;
          if (isFinal) {
            finalTranscript += transcript;
          } else {
            interim += transcript;
          }
        }
        setCurrentUserText(finalTranscript || interim);

        // Reset silence timer on each result
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      recognition.onend = () => {
        const textToProcess = finalTranscript.trim();
        if (textToProcess && isActiveRef.current) {
          processText(textToProcess);
        } else if (isActiveRef.current) {
          // No speech detected, restart
          try {
            recognition.start();
          } catch {
            // Already started
          }
        }
      };

      recognition.onerror = (event: { error: string }) => {
        if (event.error === "no-speech") {
          // No speech detected, restart listening
          if (isActiveRef.current) {
            try {
              recognition.start();
            } catch {
              // Already started
            }
          }
          return;
        }
        if (event.error === "aborted") return;
        console.error("[GRIXI Voice] Recognition error:", event.error);
        setError(`Error de reconocimiento: ${event.error}`);
      };

      isActiveRef.current = true;
      recognition.start();
    } catch (err) {
      console.error("[GRIXI Voice] Start error:", err);
      setError(err instanceof Error ? err.message : "Error al iniciar GRIXI Voice");
      setState("idle");
    }
  }, [state, processText]);

  // ── Stop ──────────────────────────────────────────
  const stop = useCallback(() => {
    isActiveRef.current = false;

    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }

    // Stop speech synthesis
    speechSynthesis.cancel();
    utteranceRef.current = null;

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

    // Stop animation
    cancelAnimationFrame(animFrameRef.current);

    // Clear timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
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
