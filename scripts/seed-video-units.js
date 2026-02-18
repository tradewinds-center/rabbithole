#!/usr/bin/env node
/**
 * Seed video units with YouTube transcripts.
 * Fetches transcripts locally (via yt-dlp), then calls the Convex mutation.
 *
 * Usage:
 *   node scripts/seed-video-units.js          # dev
 *   node scripts/seed-video-units.js --prod   # production
 *
 * Requires: yt-dlp installed (brew install yt-dlp)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const isProd = process.argv.includes("--prod");
const prodFlag = isProd ? " --prod" : "";

const VIDEOS = [
  {
    title: "Egg Drop From Space",
    slug: "egg-drop-from-space",
    emoji: "🥚",
    description:
      "Watch Mark Rober attempt to drop an egg from space without breaking it",
    youtubeUrl: "https://www.youtube.com/watch?v=BYVZh5kqaFg",
  },
  {
    title: "What Are You?",
    slug: "what-are-you",
    emoji: "🧬",
    description:
      "Kurzgesagt explores the question: how much of yourself can you remove before you stop being you?",
    youtubeUrl: "https://www.youtube.com/watch?v=JQVmkDUkZT4",
  },
];

function extractVideoId(url) {
  const m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function json3ToTranscript(jsonPath) {
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const events = data.events || [];
  const lines = [];
  for (const event of events) {
    if (!event.segs) continue;
    const text = event.segs
      .map((s) => s.utf8 || "")
      .join("")
      .trim();
    if (!text || text === "\n") continue;
    const startMs = event.tStartMs || 0;
    const totalSeconds = Math.floor(startMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timestamp = `[${minutes}:${seconds.toString().padStart(2, "0")}]`;
    lines.push(`${timestamp} ${text.replace(/\n/g, " ")}`);
  }
  return lines.join("\n");
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "yt-"));
  const units = [];

  for (const video of VIDEOS) {
    const videoId = extractVideoId(video.youtubeUrl);
    const outPath = path.join(tmpDir, videoId);

    console.log(`Fetching transcript: ${video.title} (${videoId})...`);
    try {
      execSync(
        `yt-dlp --write-auto-sub --sub-lang en --skip-download --sub-format json3 -o "${outPath}" "${video.youtubeUrl}" 2>&1`,
        { encoding: "utf8" }
      );
    } catch (e) {
      console.error(`  Failed to fetch: ${e.message}`);
      continue;
    }

    const json3Path = `${outPath}.en.json3`;
    if (!fs.existsSync(json3Path)) {
      console.error(`  No English subtitles found for ${video.title}`);
      continue;
    }

    const transcript = json3ToTranscript(json3Path);
    console.log(`  Got ${transcript.length} chars, ${transcript.split("\n").length} lines`);

    units.push({ ...video, videoTranscript: transcript });
  }

  if (units.length === 0) {
    console.error("No transcripts fetched. Aborting.");
    process.exit(1);
  }

  // First seed the Video Reflection process
  console.log("\nSeeding Video Reflection process...");
  execSync(
    `CONVEX_DEPLOYMENT=${process.env.CONVEX_DEPLOYMENT || "perceptive-husky-735"} npx convex run seed:seedVideoReflection${prodFlag}`,
    { stdio: "inherit" }
  );

  // Then seed the units with transcripts
  console.log("\nSeeding video units...");
  const argsJson = JSON.stringify({ units });
  const argsFile = path.join(tmpDir, "args.json");
  fs.writeFileSync(argsFile, argsJson);

  execSync(
    `CONVEX_DEPLOYMENT=${process.env.CONVEX_DEPLOYMENT || "perceptive-husky-735"} npx convex run seed:seedVideoUnits "$(cat ${argsFile})"${prodFlag}`,
    { stdio: "inherit" }
  );

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
  console.log("\nDone!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
