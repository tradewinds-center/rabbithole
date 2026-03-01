"use client";

import { useState, useRef, useCallback } from "react";

export interface ToolActivity {
  name: string;
  status: "running" | "complete";
  result?: string;
}

/** Parsed SSE event data */
export interface StreamEvent {
  text?: string;
  done?: boolean;
  error?: string;
  toolStart?: { name: string };
  toolComplete?: { name: string; result?: string };
  artifactUpdate?: boolean;
  newArtifactId?: string;
  processStepUpdate?: { step: string; status: string; commentary?: string };
  newAssistantMsg?: string;
  generatedImage?: boolean;
  generatingImage?: string;
}

interface UseAgentStreamOptions {
  /** Called for every parsed SSE event, before default state updates. */
  onEvent?: (data: StreamEvent) => void;
}

export interface UseAgentStreamReturn {
  streamingContent: string;
  streamingMsgId: string | null;
  isStreaming: boolean;
  toolActivity: ToolActivity | null;
  generatingImage: boolean;
  send: (url: string, body: Record<string, unknown>, initialMsgId?: string) => Promise<void>;
  stop: () => void;
}

export function useAgentStream(options?: UseAgentStreamOptions): UseAgentStreamReturn {
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolActivity, setToolActivity] = useState<ToolActivity | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const toolCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (url: string, body: Record<string, unknown>, initialMsgId?: string) => {
      setIsStreaming(true);
      setStreamingContent("");
      setStreamingMsgId(initialMsgId ?? null);
      setToolActivity(null);
      setGeneratingImage(false);

      const controller = new AbortController();
      abortRef.current = controller;
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
              let data: StreamEvent;
              try {
                data = JSON.parse(line.slice(6)) as StreamEvent;
              } catch {
                continue;
              }

              // Forward to component-specific handler first
              options?.onEvent?.(data);

              // --- Tool progress events ---
              if (data.toolStart) {
                // Clear any pending "complete" display
                if (toolCompleteTimerRef.current) {
                  clearTimeout(toolCompleteTimerRef.current);
                  toolCompleteTimerRef.current = null;
                }
                setToolActivity({ name: data.toolStart.name, status: "running" });
              }

              if (data.toolComplete) {
                setToolActivity({
                  name: data.toolComplete.name,
                  status: "complete",
                  result: data.toolComplete.result,
                });
                // Clear after 1.5s
                if (toolCompleteTimerRef.current) {
                  clearTimeout(toolCompleteTimerRef.current);
                }
                toolCompleteTimerRef.current = setTimeout(() => {
                  setToolActivity(null);
                  toolCompleteTimerRef.current = null;
                }, 1500);
              }

              // --- Image generation events ---
              if (data.generatingImage === "started") {
                setGeneratingImage(true);
              }
              if (data.generatedImage) {
                setGeneratingImage(false);
              }

              // --- Text streaming ---
              if (data.text) {
                fullContent += data.text;
                setStreamingContent(fullContent);
              }

              // --- Stream split (new assistant message after tool) ---
              if (data.newAssistantMsg) {
                setStreamingMsgId(data.newAssistantMsg);
                fullContent = "";
                setStreamingContent("");
              }

              // --- Done ---
              if (data.done) {
                setStreamingContent("");
                setStreamingMsgId(null);
                setGeneratingImage(false);
                setToolActivity(null);
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Stream error:", err);
        }
        setStreamingMsgId(null);
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [options],
  );

  return {
    streamingContent,
    streamingMsgId,
    isStreaming,
    toolActivity,
    generatingImage,
    send,
    stop,
  };
}
