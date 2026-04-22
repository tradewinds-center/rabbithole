"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { toaster } from "@/lib/toaster";

export interface ToolActivity {
  name: string;
  status: "running" | "complete";
  result?: string;
}

export interface SessionStreamState {
  isStreaming: boolean;
  streamingContent: string;
  streamingMsgId: string | null;
  toolActivity: ToolActivity | null;
}

const IDLE_STATE: SessionStreamState = {
  isStreaming: false,
  streamingContent: "",
  streamingMsgId: null,
  toolActivity: null,
};

interface StreamRegistryContextValue {
  startStream: (
    sessionId: string,
    url: string,
    body: Record<string, unknown>,
    initialMsgId: string
  ) => Promise<void>;
  stopStream: (sessionId: string) => void;
  getStreamState: (sessionId: string) => SessionStreamState;
  streamingSessionIds: string[];
}

const StreamRegistryContext = createContext<StreamRegistryContextValue>({
  startStream: async () => {},
  stopStream: () => {},
  getStreamState: () => IDLE_STATE,
  streamingSessionIds: [],
});

export function StreamRegistryProvider({ children }: { children: React.ReactNode }) {
  const [streams, setStreams] = useState<Record<string, SessionStreamState>>({});
  const abortRefs = useRef<Record<string, AbortController>>({});
  const toolTimerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const patchSession = useCallback(
    (sessionId: string, update: Partial<SessionStreamState> | null) => {
      setStreams((prev) => {
        if (update === null) {
          if (!prev[sessionId]) return prev;
          const next = { ...prev };
          delete next[sessionId];
          return next;
        }
        return {
          ...prev,
          [sessionId]: { ...(prev[sessionId] ?? IDLE_STATE), ...update },
        };
      });
    },
    []
  );

  const startStream = useCallback(
    async (
      sessionId: string,
      url: string,
      body: Record<string, unknown>,
      initialMsgId: string
    ) => {
      // Abort any existing stream for this session before starting a new one
      abortRefs.current[sessionId]?.abort();

      const controller = new AbortController();
      abortRefs.current[sessionId] = controller;

      patchSession(sessionId, {
        isStreaming: true,
        streamingContent: "",
        streamingMsgId: initialMsgId,
        toolActivity: null,
      });

      let fullContent = "";

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(body),
        });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split("\n");

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              let data: Record<string, unknown>;
              try {
                data = JSON.parse(line.slice(6));
              } catch {
                continue;
              }

              if (data.toolStart) {
                if (toolTimerRefs.current[sessionId]) {
                  clearTimeout(toolTimerRefs.current[sessionId]);
                  delete toolTimerRefs.current[sessionId];
                }
                const ts = data.toolStart as { name: string };
                patchSession(sessionId, {
                  toolActivity: { name: ts.name, status: "running" },
                });
              }

              if (data.toolComplete) {
                const tc = data.toolComplete as { name: string; result?: string };
                patchSession(sessionId, {
                  toolActivity: { name: tc.name, status: "complete", result: tc.result },
                });
                toolTimerRefs.current[sessionId] = setTimeout(() => {
                  patchSession(sessionId, { toolActivity: null });
                  delete toolTimerRefs.current[sessionId];
                }, 1500);
              }

              if (data.text) {
                fullContent += data.text as string;
                patchSession(sessionId, { streamingContent: fullContent });
              }

              if (data.newAssistantMsg) {
                patchSession(sessionId, {
                  streamingMsgId: data.newAssistantMsg as string,
                  streamingContent: "",
                });
                fullContent = "";
              }

              if (data.error) {
                toaster.error({
                  title: "AI error",
                  description: "Something went wrong. Please try again.",
                });
              }

              if (data.done) {
                patchSession(sessionId, null);
                delete abortRefs.current[sessionId];
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Stream error:", err);
          toaster.error({
            title: "Connection lost",
            description: "The AI response was interrupted. Please try again.",
          });
        }
      } finally {
        delete abortRefs.current[sessionId];
        // Only clear if the session is still registered as streaming (data.done may have already removed it)
        setStreams((prev) => {
          if (!prev[sessionId]) return prev;
          const next = { ...prev };
          delete next[sessionId];
          return next;
        });
      }
    },
    [patchSession]
  );

  const stopStream = useCallback(
    (sessionId: string) => {
      abortRefs.current[sessionId]?.abort();
      delete abortRefs.current[sessionId];
      patchSession(sessionId, null);
    },
    [patchSession]
  );

  const getStreamState = useCallback(
    (sessionId: string): SessionStreamState => {
      return streams[sessionId] ?? IDLE_STATE;
    },
    [streams]
  );

  return (
    <StreamRegistryContext.Provider
      value={{
        startStream,
        stopStream,
        getStreamState,
        streamingSessionIds: Object.keys(streams),
      }}
    >
      {children}
    </StreamRegistryContext.Provider>
  );
}

export function useStreamRegistry() {
  return useContext(StreamRegistryContext);
}
