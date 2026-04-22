/**
 * Playwright verification for Phase 1.5 teacher-aide tools.
 *
 * Logs in as the test teacher, opens the curriculum-designer chat, asks the AI
 * to invoke both new tools (upsert_teacher_directive, create_scholar_seed)
 * against the test scholar, and prints the last section of the response.
 *
 * After this runs, verify the actual writes via:
 *   CONVEX_DEPLOYMENT=dev:perceptive-husky-735 npx convex run teacherDirectives:listActiveByScholarInternal ...
 *   CONVEX_DEPLOYMENT=dev:perceptive-husky-735 npx convex run seeds:activeByScholar ...
 *
 * Headless by default; set HEADED=1 to watch it in a real window.
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:1041";
const TEACHER_USERNAME = process.env.TEACHER_USERNAME ?? "testteacher_1776564762723";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD ?? "testpass123";
const HEADED = process.env.HEADED === "1";

const PROMPT = `For the scholar whose username is testkai_1776564548270 (display name "testkai_1776564548270"):

1. Call the upsert_teacher_directive tool with label "Playwright E2E test" and content "this directive was added via curriculum-designer AI tool invocation from a Playwright run on 2026-04-21 — if you can read this, the end-to-end wiring works".

2. Call the create_scholar_seed tool with topic "Playwright E2E seed", domain "language arts", rationale "verifying the create_scholar_seed tool works end-to-end from the curriculum designer", approachHint "no human action required — this is an automated verification".

Invoke both tools now. After each invocation, confirm success briefly.`;

async function run() {
  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) {
      console.log(`  [browser ${msg.type()}]`, msg.text());
    }
  });

  console.log("→ Navigating to login...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });

  // Find the username input (login form uses username, not email)
  const usernameInput = page
    .locator('input[name="username"], input[type="text"][placeholder*="sername" i], input[placeholder*="sername" i]')
    .first();
  await usernameInput.waitFor({ timeout: 10_000 });
  await usernameInput.fill(TEACHER_USERNAME);

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(TEACHER_PASSWORD);

  console.log("→ Submitting login...");
  // Try a labeled button first; fall back to any submit.
  const signInButton = page
    .locator('button:has-text("Sign"), button:has-text("Log"), button:has-text("Continue"), button[type="submit"]')
    .first();
  await signInButton.click();

  // Wait for the dashboard to load.
  try {
    await page.waitForURL(/\/teacher|\/scholar|\/admin/, { timeout: 15_000 });
  } catch {
    console.error(`  ✗ Login did not redirect. Current URL: ${page.url()}`);
    await page.screenshot({ path: "/tmp/login-fail.png" });
    await browser.close();
    process.exit(1);
  }
  console.log(`  ✓ Logged in. URL: ${page.url()}`);

  console.log("→ Navigating to curriculum designer (Assistant tab)...");
  await page.goto(`${BASE_URL}/teacher?tab=assistant`, { waitUntil: "domcontentloaded" });

  const textarea = page.locator('textarea[placeholder*="Ask about"]').first();
  await textarea.waitFor({ timeout: 10_000 });
  console.log("  ✓ Chat textarea found.");

  console.log("→ Typing prompt...");
  await textarea.fill(PROMPT);

  console.log("→ Sending (Enter)...");
  await textarea.press("Enter");

  // Wait for streaming to kick in (send-button disabled is the signal), then
  // wait for it to end (send-button re-enabled). Works with the
  // `disabled={!input.trim() || isStreaming}` pattern in CurriculumAssistant.tsx.
  console.log("→ Waiting for streaming to start...");
  const sendButton = page.locator('button[aria-label], button').filter({ hasText: "" }).first();
  // Simpler: the textarea becomes disabled while streaming (disabled={isStreaming} on line 283).
  const start = Date.now();

  // First, wait for textarea to become disabled (streaming started) — up to 15s.
  let streamingStartedAt = null;
  while (Date.now() - start < 15_000) {
    const disabled = await textarea.isDisabled().catch(() => false);
    if (disabled) {
      streamingStartedAt = Date.now();
      break;
    }
    await page.waitForTimeout(200);
  }
  if (!streamingStartedAt) {
    console.warn("  ⚠ Streaming never started (textarea never went disabled).");
  } else {
    console.log(`  ✓ Streaming started after ${((streamingStartedAt - start) / 1000).toFixed(1)}s`);
  }

  // Now wait for streaming to end (textarea re-enabled) — up to 120s total.
  console.log("→ Waiting for streaming to finish (up to 120s)...");
  let settledAt = null;
  while (Date.now() - start < 120_000) {
    const disabled = await textarea.isDisabled().catch(() => true);
    if (!disabled) {
      // Give a moment for final tokens and tool completions to render.
      await page.waitForTimeout(1500);
      settledAt = Date.now();
      break;
    }
    await page.waitForTimeout(500);
  }
  if (!settledAt) {
    console.error("  ✗ Timed out waiting for response.");
    await page.screenshot({ path: "/tmp/chat-timeout.png" });
  } else {
    console.log(`  ✓ Settled after ${((settledAt - start) / 1000).toFixed(1)}s total`);
  }

  // Pull the last assistant message text.
  console.log("→ Reading last messages...");
  const transcript = await page.evaluate(() => {
    // Look for chat message elements. Fall back to grabbing last ~100 lines of body text.
    const body = document.body.innerText;
    const lines = body.split("\n").filter((l) => l.trim().length > 0);
    return lines.slice(-60).join("\n");
  });
  console.log("─".repeat(60));
  console.log(transcript);
  console.log("─".repeat(60));

  await page.screenshot({ path: "/tmp/chat-final.png", fullPage: true });
  console.log("→ Saved screenshot to /tmp/chat-final.png");

  await browser.close();
}

run().catch((err) => {
  console.error("Playwright script failed:", err);
  process.exit(1);
});
