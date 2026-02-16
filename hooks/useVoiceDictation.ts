"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

type DictationState = "idle" | "recording" | "transcribing";

/** RMS dB threshold for "too loud" warning. -20 dBFS is modest speaking; above that triggers warning. */
const LOUD_THRESHOLD_DB = -20;

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Strip the data:audio/...;base64, prefix
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useVoiceDictation(onTranscript: (text: string) => void) {
  const [state, setState] = useState<DictationState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isTooLoud, setIsTooLoud] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const loudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transcribe = useAction(api.audioActions.transcribe);

  // Clean up audio analysis on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (loudTimerRef.current) clearTimeout(loudTimerRef.current);
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  /** Start monitoring audio levels via AnalyserNode. */
  const startLevelMonitor = useCallback((stream: MediaStream) => {
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Float32Array(analyser.fftSize);

      const checkLevel = () => {
        analyser.getFloatTimeDomainData(dataArray);
        // Calculate RMS
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        const db = rms > 0 ? 20 * Math.log10(rms) : -100;

        if (db > LOUD_THRESHOLD_DB) {
          setIsTooLoud(true);
          // Clear any existing hide timer
          if (loudTimerRef.current) {
            clearTimeout(loudTimerRef.current);
            loudTimerRef.current = null;
          }
        } else {
          // Delay hiding the warning so it doesn't flicker
          if (!loudTimerRef.current) {
            loudTimerRef.current = setTimeout(() => {
              setIsTooLoud(false);
              loudTimerRef.current = null;
            }, 600);
          }
        }

        rafRef.current = requestAnimationFrame(checkLevel);
      };
      rafRef.current = requestAnimationFrame(checkLevel);
    } catch {
      // AudioContext not supported — silently skip monitoring
    }
  }, []);

  /** Stop monitoring audio levels. */
  const stopLevelMonitor = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (loudTimerRef.current) {
      clearTimeout(loudTimerRef.current);
      loudTimerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsTooLoud(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (state !== "idle") return;

    setError(null);
    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      setError("Your browser does not support audio recording.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied.");
      return;
    }

    // Start volume level monitoring
    startLevelMonitor(stream);

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Release mic + stop monitoring
      stream.getTracks().forEach((t) => t.stop());
      stopLevelMonitor();

      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (blob.size === 0) {
        setState("idle");
        return;
      }

      setState("transcribing");
      try {
        const audioBase64 = await blobToBase64(blob);
        const result = await transcribe({ audioBase64, mimeType });
        if (result.text) onTranscript(result.text);
      } catch {
        setError("Transcription failed. Please try again.");
      } finally {
        setState("idle");
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    setState("recording");
  }, [state, onTranscript, transcribe, startLevelMonitor, stopLevelMonitor]);

  const stopRecording = useCallback(() => {
    if (state === "recording" && recorderRef.current) {
      recorderRef.current.stop();
    }
  }, [state]);

  const toggleRecording = useCallback(async () => {
    if (state === "transcribing") return;
    if (state === "recording") {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [state, startRecording, stopRecording]);

  return { state, error, isTooLoud, toggleRecording, startRecording, stopRecording };
}
