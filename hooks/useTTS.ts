"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type TTSState = "idle" | "loading" | "playing";

// Module-level singleton: only one audio plays at a time across all instances
let activeAudio: HTMLAudioElement | null = null;
let activeAbort: AbortController | null = null;
let activeBlobUrl: string | null = null;
let activeMediaSource: MediaSource | null = null;
let activeSetState: ((s: TTSState) => void) | null = null;

const TTS_DEBUG = true;
function log(...args: unknown[]) {
  if (TTS_DEBUG) console.log("[TTS]", ...args);
}

function stopGlobal() {
  log("stopGlobal called");
  if (activeAbort) {
    activeAbort.abort();
    activeAbort = null;
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.removeAttribute("src");
    activeAudio.load();
    activeAudio = null;
  }
  if (activeMediaSource) {
    try {
      if (activeMediaSource.readyState === "open") {
        activeMediaSource.endOfStream();
      }
    } catch (_) {}
    activeMediaSource = null;
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

/** Wait for an event with a timeout. Returns true if event fired, false if timed out. */
function waitForEvent(
  target: EventTarget,
  event: string,
  timeoutMs: number,
  abort: AbortController
): Promise<boolean> {
  return new Promise((resolve) => {
    if (abort.signal.aborted) { resolve(false); return; }
    const timer = setTimeout(() => { resolve(false); }, timeoutMs);
    const handler = () => { clearTimeout(timer); resolve(true); };
    target.addEventListener(event, handler, { once: true });
    abort.signal.addEventListener("abort", () => { clearTimeout(timer); resolve(false); }, { once: true });
  });
}

function playViaBlob(
  res: Response,
  abort: AbortController,
  setState: (s: TTSState) => void,
  mountedRef: React.RefObject<boolean>
): Promise<void> {
  return (async () => {
    log("BLOB: downloading full response");
    const blob = await res.blob();
    log("BLOB: received", blob.size, "bytes, type:", blob.type);
    if (!mountedRef.current || abort.signal.aborted) return;

    const url = URL.createObjectURL(blob);
    activeBlobUrl = url;
    const audio = new Audio(url);
    activeAudio = audio;
    setupAudioCleanup(audio, url, setState, mountedRef);
    setState("playing");
    await audio.play();
  })();
}

async function streamAudio(
  res: Response,
  abort: AbortController,
  setState: (s: TTSState) => void,
  mountedRef: React.RefObject<boolean>
) {
  const canStreamMp3 =
    typeof MediaSource !== "undefined" &&
    MediaSource.isTypeSupported("audio/mpeg");

  log("streamAudio called", {
    canStreamMp3,
    hasBody: !!res.body,
    contentType: res.headers.get("content-type"),
    contentLength: res.headers.get("content-length"),
  });

  if (!canStreamMp3 || !res.body) {
    log("FALLBACK: no MediaSource support or no body");
    return playViaBlob(res, abort, setState, mountedRef);
  }

  // Streaming path: MediaSource + SourceBuffer
  log("STREAMING: creating MediaSource");
  const mediaSource = new MediaSource();
  activeMediaSource = mediaSource;
  const url = URL.createObjectURL(mediaSource);
  activeBlobUrl = url;

  const audio = new Audio();
  activeAudio = audio;

  audio.addEventListener("error", () => {
    const e = audio.error;
    log("audio ERROR event:", e?.code, e?.message);
  });
  audio.addEventListener("stalled", () => log("audio STALLED"));
  audio.addEventListener("waiting", () => log("audio WAITING"));
  audio.addEventListener("canplay", () => log("audio CANPLAY"));
  audio.addEventListener("canplaythrough", () => log("audio CANPLAYTHROUGH"));
  audio.addEventListener("playing", () => log("audio PLAYING"));
  audio.addEventListener("ended", () => log("audio ENDED"));

  audio.src = url;
  log("audio.src set, waiting for sourceopen...");

  setupAudioCleanup(audio, url, setState, mountedRef);

  // Wait for MediaSource to open (timeout 3s → fall back to blob)
  const opened = await waitForEvent(mediaSource, "sourceopen", 3000, abort);
  if (!opened) {
    log("sourceopen TIMED OUT — falling back to blob");
    // Can't reuse res (body already locked by MediaSource), so we need to refetch
    // but actually the body hasn't been read yet — MediaSource just opens from the object URL
    // We can't easily fall back here, so just fail gracefully
    throw new Error("MediaSource sourceopen timed out");
  }
  log("sourceopen fired, readyState:", mediaSource.readyState);

  if (abort.signal.aborted) {
    log("aborted after sourceopen");
    return;
  }

  let sourceBuffer: SourceBuffer;
  try {
    sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
    log("SourceBuffer created successfully");
  } catch (e) {
    log("addSourceBuffer FAILED:", e);
    throw e;
  }

  sourceBuffer.addEventListener("error", () => log("sourceBuffer ERROR"));
  sourceBuffer.addEventListener("abort", () => log("sourceBuffer ABORT"));

  const reader = res.body!.getReader();
  let playStarted = false;
  let totalBytes = 0;
  let chunkCount = 0;

  const pump = async () => {
    while (true) {
      if (abort.signal.aborted) {
        log("aborted during pump");
        reader.cancel();
        return;
      }

      const { done, value } = await reader.read();

      if (done) {
        log("stream done, total:", totalBytes, "bytes in", chunkCount, "chunks");
        if (sourceBuffer.updating) {
          await new Promise<void>((resolve) =>
            sourceBuffer.addEventListener("updateend", () => resolve(), {
              once: true,
            })
          );
        }
        if (mediaSource.readyState === "open") {
          log("calling endOfStream");
          mediaSource.endOfStream();
        }
        return;
      }

      chunkCount++;
      totalBytes += value.length;
      log(`chunk #${chunkCount}: ${value.length} bytes (total: ${totalBytes})`);

      // Wait if buffer is still updating from previous append
      if (sourceBuffer.updating) {
        log("waiting for previous append to finish...");
        await new Promise<void>((resolve) =>
          sourceBuffer.addEventListener("updateend", () => resolve(), {
            once: true,
          })
        );
      }

      if (abort.signal.aborted) {
        reader.cancel();
        return;
      }

      try {
        sourceBuffer.appendBuffer(value);
        log(`appendBuffer ok, buffered ranges:`, sourceBuffer.buffered.length > 0
          ? `${sourceBuffer.buffered.start(0).toFixed(2)}-${sourceBuffer.buffered.end(0).toFixed(2)}s`
          : "empty");
      } catch (e) {
        log("appendBuffer FAILED:", e);
        throw e;
      }

      // Start playback once audio has enough data (wait for canplay)
      if (!playStarted) {
        await new Promise<void>((resolve) =>
          sourceBuffer.addEventListener("updateend", () => resolve(), {
            once: true,
          })
        );
        if (abort.signal.aborted) return;

        log("chunk appended, buffered:",
          sourceBuffer.buffered.length > 0
            ? `${sourceBuffer.buffered.start(0).toFixed(2)}-${sourceBuffer.buffered.end(0).toFixed(2)}s`
            : "empty",
          "audio.readyState:", audio.readyState,
          "audio.paused:", audio.paused,
          "audio.error:", audio.error?.code, audio.error?.message
        );

        // Wait for the audio element to have enough data to play
        if (audio.readyState < 3) {
          log("waiting for canplay event (readyState:", audio.readyState, ")...");
          const canPlay = await waitForEvent(audio, "canplay", 5000, abort);
          if (!canPlay) {
            log("canplay TIMED OUT, readyState:", audio.readyState, "— trying play() anyway");
          }
        }
        if (abort.signal.aborted) return;

        setState("playing");
        try {
          await audio.play();
          log("audio.play() resolved, paused:", audio.paused);
        } catch (playErr) {
          log("audio.play() FAILED:", playErr);
          throw playErr;
        }
        playStarted = true;
      }
    }
  };

  try {
    await pump();
  } catch (err) {
    log("pump error:", err);
    throw err;
  }
}

function setupAudioCleanup(
  audio: HTMLAudioElement,
  url: string,
  setState: (s: TTSState) => void,
  mountedRef: React.RefObject<boolean>
) {
  const cleanup = () => {
    log("audio cleanup triggered (ended or error)");
    if (activeAudio === audio) {
      URL.revokeObjectURL(url);
      activeBlobUrl = null;
      activeAudio = null;
      activeAbort = null;
      activeMediaSource = null;
      if (mountedRef.current && activeSetState === setState) {
        setState("idle");
      }
      activeSetState = null;
    }
  };
  audio.onended = cleanup;
  audio.onerror = cleanup;
}

export function useTTS() {
  const [state, setState] = useState<TTSState>("idle");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (activeSetState === setState) {
        stopGlobal();
      }
    };
  }, []);

  const speak = useCallback(async (text: string) => {
    stopGlobal();

    const abort = new AbortController();
    activeAbort = abort;
    activeSetState = setState;
    setState("loading");

    log("speak() called, text length:", text.length);

    try {
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!.replace(
        ".cloud",
        ".site"
      );
      log("fetching", `${convexUrl}/tts`);
      const res = await fetch(`${convexUrl}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abort.signal,
      });

      log("fetch response:", res.status, res.statusText);

      if (!res.ok) {
        throw new Error(`TTS request failed: ${res.status}`);
      }

      if (!mountedRef.current || abort.signal.aborted) return;

      await streamAudio(res, abort, setState, mountedRef);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        log("speak aborted (AbortError)");
        return;
      }
      console.error("TTS error:", err);
    } finally {
      // Always reset state if we're still the active speaker and not playing
      if (mountedRef.current && activeSetState === setState && activeAudio === null) {
        setState("idle");
        activeSetState = null;
      }
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
