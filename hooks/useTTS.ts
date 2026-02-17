"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type TTSState = "idle" | "loading" | "playing";

// Module-level singleton: only one audio plays at a time across all instances
let activeAudio: HTMLAudioElement | null = null;
let activeAbort: AbortController | null = null;
let activeBlobUrl: string | null = null;
let activeSetState: ((s: TTSState) => void) | null = null;

function stopGlobal() {
  if (activeAbort) {
    activeAbort.abort();
    activeAbort = null;
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }
  if (activeBlobUrl) {
    URL.revokeObjectURL(activeBlobUrl);
    activeBlobUrl = null;
  }
  if (activeSetState) {
    activeSetState("idle");
    activeSetState = null;
  }
}

export function useTTS() {
  const [state, setState] = useState<TTSState>("idle");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // If this instance owns the active playback, stop it
      if (activeSetState === setState) {
        stopGlobal();
      }
    };
  }, []);

  const speak = useCallback(async (text: string) => {
    // Stop any existing playback (from any instance)
    stopGlobal();

    const abort = new AbortController();
    activeAbort = abort;
    activeSetState = setState;
    setState("loading");

    try {
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!.replace(
        ".cloud",
        ".site"
      );
      const res = await fetch(`${convexUrl}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abort.signal,
      });

      if (!res.ok) {
        throw new Error(`TTS request failed: ${res.status}`);
      }

      const blob = await res.blob();
      if (!mountedRef.current || abort.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      activeBlobUrl = url;

      const audio = new Audio(url);
      activeAudio = audio;

      audio.onended = () => {
        if (activeAudio === audio) {
          URL.revokeObjectURL(url);
          activeBlobUrl = null;
          activeAudio = null;
          activeAbort = null;
          if (mountedRef.current && activeSetState === setState) {
            setState("idle");
          }
          activeSetState = null;
        }
      };

      audio.onerror = () => {
        if (activeAudio === audio) {
          URL.revokeObjectURL(url);
          activeBlobUrl = null;
          activeAudio = null;
          activeAbort = null;
          if (mountedRef.current && activeSetState === setState) {
            setState("idle");
          }
          activeSetState = null;
        }
      };

      setState("playing");
      await audio.play();
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("TTS error:", err);
      if (mountedRef.current && activeSetState === setState) {
        setState("idle");
      }
      activeSetState = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (activeSetState === setState) {
      stopGlobal();
    }
  }, []);

  const toggle = useCallback(
    (text: string) => {
      if (state === "idle") {
        speak(text);
      } else {
        stop();
      }
    },
    [state, speak, stop]
  );

  return { state, speak, stop, toggle };
}
