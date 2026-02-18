"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Fetch a YouTube video transcript.
 * Extracts video ID from various URL formats, fetches captions from
 * YouTube's timedtext XML API. Returns combined transcript text with
 * [M:SS] timestamps.
 *
 * Falls back through multiple methods:
 * 1. Direct timedtext XML API (works for most videos with captions)
 * 2. Page scrape for caption track URLs
 */
export const fetchTranscript = action({
  args: {
    youtubeUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const videoId = extractVideoId(args.youtubeUrl);
    if (!videoId) {
      throw new Error(
        "Could not extract video ID from URL. Supported formats: youtube.com/watch?v=, youtu.be/, youtube.com/embed/"
      );
    }

    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    // Method 1: Direct timedtext API (works for manually-added captions)
    for (const lang of ["en", "en-US"]) {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
      const res = await fetch(url, { headers: { "User-Agent": ua } });
      if (res.ok) {
        const xml = await res.text();
        if (xml.length > 0) {
          const segments = parseTimedTextXml(xml);
          if (segments.length > 0) {
            return { transcript: formatTranscript(segments) };
          }
        }
      }
    }

    // Method 2: Try auto-generated captions
    for (const lang of ["en", "en-US"]) {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&kind=asr&fmt=srv3`;
      const res = await fetch(url, { headers: { "User-Agent": ua } });
      if (res.ok) {
        const xml = await res.text();
        if (xml.length > 0) {
          const segments = parseTimedTextXml(xml);
          if (segments.length > 0) {
            return { transcript: formatTranscript(segments) };
          }
        }
      }
    }

    // Method 3: Scrape the page for caption track URLs and try each
    const pageRes = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      { headers: { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9" } }
    );
    if (pageRes.ok) {
      const html = await pageRes.text();
      const captionsMatch = html.match(/"captions":(.*?),"videoDetails/);
      if (captionsMatch) {
        try {
          const captionsData = JSON.parse(captionsMatch[1]);
          const tracks =
            captionsData?.playerCaptionsTracklistRenderer?.captionTracks;
          if (tracks && tracks.length > 0) {
            // Prefer English, fall back to first
            const track =
              tracks.find(
                (t: { languageCode: string }) => t.languageCode === "en"
              ) ?? tracks[0];
            const captionRes = await fetch(track.baseUrl, {
              headers: { "User-Agent": ua },
            });
            if (captionRes.ok) {
              const xml = await captionRes.text();
              if (xml.length > 0) {
                const segments = parseTimedTextXml(xml);
                if (segments.length > 0) {
                  return { transcript: formatTranscript(segments) };
                }
              }
            }
          }
        } catch {
          // Continue to error
        }
      }
    }

    throw new Error(
      "Could not fetch transcript. The video may not have captions available, or YouTube may be blocking server-side requests. Try pasting the transcript manually."
    );
  },
});

function extractVideoId(url: string): string | null {
  const watchMatch = url.match(
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/
  );
  if (watchMatch) return watchMatch[1];

  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  return null;
}

function parseTimedTextXml(
  xml: string
): { start: number; text: string }[] {
  const segments: { start: number; text: string }[] = [];
  const regex = /<text[^>]*start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const start = parseFloat(match[1]);
    const text = decodeHtmlEntities(match[2]).replace(/\n/g, " ").trim();
    if (text) {
      segments.push({ start, text });
    }
  }
  return segments;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function formatTranscript(
  segments: { start: number; text: string }[]
): string {
  return segments
    .map((seg) => {
      const totalSeconds = Math.floor(seg.start);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const ts = `[${minutes}:${seconds.toString().padStart(2, "0")}]`;
      return `${ts} ${seg.text}`;
    })
    .join("\n");
}
