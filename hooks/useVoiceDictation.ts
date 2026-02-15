"use client";

import { useState, useRef, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

type DictationState = "idle" | "recording" | "transcribing";

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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const transcribe = useAction(api.audioActions.transcribe);

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
  }, [state, onTranscript, transcribe]);

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

  return { state, error, toggleRecording, startRecording, stopRecording };
}
