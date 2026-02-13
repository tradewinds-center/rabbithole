"use client";

import { useState, useRef, useCallback } from "react";

type DictationState = "idle" | "recording" | "transcribing";

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

export function useVoiceDictation(onTranscript: (text: string) => void) {
  const [state, setState] = useState<DictationState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const toggleRecording = useCallback(async () => {
    if (state === "transcribing") return;

    // Stop recording
    if (state === "recording" && recorderRef.current) {
      recorderRef.current.stop();
      return;
    }

    // Start recording
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

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Release mic
      stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (blob.size === 0) {
        setState("idle");
        return;
      }

      setState("transcribing");
      try {
        const form = new FormData();
        form.append("audio", blob, mimeType.includes("mp4") ? "recording.mp4" : "recording.webm");

        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        if (!res.ok) throw new Error("Transcription failed");

        const data = await res.json();
        if (data.text) onTranscript(data.text);
      } catch {
        setError("Transcription failed. Please try again.");
      } finally {
        setState("idle");
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    setState("recording");
  }, [state, onTranscript]);

  return { state, error, toggleRecording };
}
