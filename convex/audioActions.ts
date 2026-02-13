"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Transcribe audio using OpenAI Whisper API.
 * Called from the frontend via useAction.
 */
export const transcribe = action({
  args: {
    // Audio data as base64-encoded string
    audioBase64: v.string(),
    mimeType: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const audioBuffer = Buffer.from(args.audioBase64, "base64");
    const mimeType = args.mimeType || "audio/webm";
    const ext = mimeType.includes("webm") ? "webm" : "mp4";

    const blob = new Blob([audioBuffer], { type: mimeType });
    const formData = new FormData();
    formData.append("file", blob, `recording.${ext}`);
    formData.append("model", "whisper-1");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Whisper API error:", err);
      throw new Error("Transcription failed");
    }

    const data = await res.json();
    return { text: data.text as string };
  },
});
