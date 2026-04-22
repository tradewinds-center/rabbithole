/**
 * Visual tour of the Rabbithole teacher UI — captures full-page PNG screenshots
 * of every key screen across Phase 1, 2, and 3a for Andy to review async.
 *
 * Captures ~14 screenshots to /tmp/rabbithole-tour/.
 *
 * Side effects during run (all cleaned up at the end):
 *   - Inserts ONE fixture scholarDocument on testkai (via adminFixtureInsertReady)
 *   - Runs a real Claude proposal against that fixture doc (burns a tiny amount of Gemini/Claude credits)
 *   - Approves a subset of the proposal (writes 1-2 teacherDirectives + seeds on testkai)
 *
 * Cleanup (always, even on failure):
 *   - Deletes the fixture doc + its audit + its proposal
 *   - Removes the directives and seeds the test run created on testkai
 *   - Leaves the 3 pre-existing testkai directives (Block A, Block B, Playwright E2E test) untouched
 *
 * Headless by default; set HEADED=1 to watch it.
 */
import { chromium } from "playwright";
import { execSync } from "child_process";
import { mkdirSync, existsSync } from "fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:1041";
const TEACHER_USERNAME = process.env.TEACHER_USERNAME ?? "testteacher_1776564762723";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD ?? "testpass123";
const SCHOLAR_ID = process.env.SCHOLAR_ID ?? "k9720mk6bw8pyy4mhenepsjvx58545t3";
const TEACHER_ID = process.env.TEACHER_ID ?? "k97fa4st37gf2fjvqvegqrr9dx854m39";
const CONVEX_DEPLOYMENT = "dev:perceptive-husky-735";
const OUT_DIR = "/tmp/rabbithole-tour";
const HEADED = process.env.HEADED === "1";

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Realistic-feeling synthetic summary — gifted + attention pattern + literacy gap 2e-style.
// No real names. No real data.
const FIXTURE_TITLE = `[Tour ${Date.now()}] Synthetic cognitive profile`;
const FIXTURE_SUMMARY =
  "Cognitive assessment indicates superior verbal reasoning (VCI well above age peers) paired with markedly slower processing speed. Working memory is a relative strength. On decoding and spelling the student sits near the age-expected mean — a meaningful gap from what verbal ability would predict, consistent with a stealth dyslexia pattern. Attention and task-engagement observations during testing suggest the student can sustain focus on open-ended, high-interest tasks for long stretches but struggles with rote, timed, or heavily procedural work.\n\nRecommended supports include structured word inquiry as the literacy on-ramp rather than phonics drills, extended time on any timed assessment, and frontloading intellectual hooks into dry content. Strong candidate for rich, multi-layer project work and Socratic dialogue; weaker fit for speed-based or worksheet-heavy environments.";
const FIXTURE_KEY_FINDINGS = [
  "Superior verbal reasoning coexists with near-average decoding/spelling — a classic stealth-dyslexia gap. Structured word inquiry is likely to land better than phonics-first drills.",
  "Processing speed is a bottleneck. Avoid timed drills and allow extended time on assessments.",
  "Strong working memory; engages deeply on open-ended, high-interest tasks. Use rich project work as the primary vehicle.",
  "Rote or heavily procedural work is a misfit. Frontload the intellectual hook before any mechanical practice.",
];

function log(msg) { console.log(msg); }
function ok(msg) { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); }

function convexRun(fn, argsObj) {
  const raw = execSync(
    `CONVEX_DEPLOYMENT=${CONVEX_DEPLOYMENT} npx convex run ${fn} '${JSON.stringify(argsObj)}'`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
  );
  return raw.trim();
}

async function shot(page, name) {
  const path = `${OUT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 ${name}.png`);
  return path;
}

async function waitForText(page, regex, timeout = 15_000) {
  await page.locator(`text=${regex}`).first().waitFor({ timeout });
}

async function run() {
  const captured = [];
  const errors = [];
  let createdDocId = null;
  let approvedDirectiveLabels = [];
  let approvedSeedTopics = [];

  // ── Seed fixture doc ─────────────────────────────────────────
  log("→ Seeding fixture document via Convex CLI...");
  try {
    const out = convexRun("scholarDocuments:adminFixtureInsertReady", {
      scholarId: SCHOLAR_ID,
      uploadedBy: TEACHER_ID,
      title: FIXTURE_TITLE,
      extractedText: "(fixture — not a real PDF)",
      redactedSummary: FIXTURE_SUMMARY,
      aiKeyFindings: FIXTURE_KEY_FINDINGS,
    });
    const match = out.match(/\S+$/m);
    createdDocId = match ? match[0].replace(/['"]/g, "") : null;
    if (!createdDocId) throw new Error("Could not parse doc id from CLI output");
    ok(`Seeded fixture doc ${createdDocId}`);
  } catch (err) {
    fail(`Seeding failed: ${err.message}`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // quiet — uncomment for debugging
      // console.log("  [browser error]", msg.text());
    }
  });

  try {
    // ── Login ─────────────────────────────────────────────────
    log("→ Logging in as test teacher...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const usernameInput = page
      .locator('input[name="username"], input[type="text"][placeholder*="sername" i]')
      .first();
    await usernameInput.waitFor({ timeout: 10_000 });
    await usernameInput.fill(TEACHER_USERNAME);
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(TEACHER_PASSWORD);
    await page.waitForTimeout(400);
    const signInButton = page
      .locator('button:has-text("Sign"), button:has-text("Log"), button:has-text("Continue"), button[type="submit"]')
      .first();
    for (let i = 0; i < 20; i++) {
      if (!(await signInButton.isDisabled().catch(() => true))) break;
      await page.waitForTimeout(500);
    }
    await signInButton.click();
    await page.waitForURL(/\/teacher|\/scholar|\/admin/, { timeout: 90_000 });
    ok(`Logged in -> ${page.url()}`);

    // ── 00: Teacher landing ─────────────────────────────────────
    log("→ 00: Teacher landing page");
    await page.goto(`${BASE_URL}/teacher`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(1500);
    captured.push(await shot(page, "00-teacher-landing"));

    // ── 01: Scholar activity tab ───────────────────────────────
    log("→ 01: Scholar profile (activity tab)");
    await page.goto(
      `${BASE_URL}/teacher?tab=scholars&scholar=${SCHOLAR_ID}`,
      { waitUntil: "networkidle", timeout: 30_000 }
    );
    await waitForText(page, /testkai/i, 15_000);
    await page.waitForTimeout(1500);
    captured.push(await shot(page, "01-scholar-profile-activity"));

    // ── 02: Directives tab ─────────────────────────────────────
    log("→ 02: Directives tab (before apply)");
    await page.goto(
      `${BASE_URL}/teacher?tab=scholars&scholar=${SCHOLAR_ID}&stab=directives`,
      { waitUntil: "networkidle", timeout: 30_000 }
    );
    await page.waitForTimeout(1500);
    captured.push(await shot(page, "02-scholar-profile-directives"));

    // ── 03: Documents tab — empty-ish state ────────────────────
    // We already have ONE fixture doc, but the tab itself is "the documents list";
    // the most informative screenshot is with the fixture visible but no detail pane open.
    log("→ 03: Documents tab (list, before detail opened)");
    await page.goto(
      `${BASE_URL}/teacher?tab=scholars&scholar=${SCHOLAR_ID}&stab=documents`,
      { waitUntil: "networkidle", timeout: 30_000 }
    );
    await waitForText(page, new RegExp(FIXTURE_TITLE.slice(0, 20)), 15_000);
    await page.waitForTimeout(1200);
    captured.push(await shot(page, "03-documents-tab-empty"));

    // ── 04: Documents tab with ready fixture doc highlighted ──
    log("→ 04: Documents tab with ready fixture doc (same URL, with card present)");
    captured.push(await shot(page, "04-documents-tab-ready"));

    // ── 05: Detail pane open ──────────────────────────────────
    log("→ 05: Detail pane open (summary + key findings)");
    await page.locator(`text=${FIXTURE_TITLE}`).first().click();
    await page.waitForTimeout(1200);
    await waitForText(page, /REDACTED SUMMARY/i, 10_000).catch(() => {});
    captured.push(await shot(page, "05-documents-tab-detail"));

    // ── 06: Generate proposal & open diff modal ───────────────
    log("→ 06: Generate proposal (real Claude) then open diff modal...");
    await page.locator('button:has-text("Generate proposal")').first().click();
    const viewBtn = page.locator('button:has-text("View proposal")').first();
    try {
      await viewBtn.waitFor({ state: "visible", timeout: 120_000 });
      ok("Proposal generated");
    } catch (err) {
      fail("Proposal timed out");
      captured.push(await shot(page, "ERROR-proposal-timeout"));
      errors.push("proposal generation timed out");
      throw new Error("proposal timeout");
    }
    await page.waitForTimeout(800);
    await viewBtn.click();
    await page.waitForTimeout(1500);
    await waitForText(page, /Proposed Changes for This Scholar/i, 15_000);
    await page.waitForTimeout(800);
    captured.push(await shot(page, "06-proposal-diff-modal"));

    // ── Approve a subset ─────────────────────────────────────
    // Uncheck the FIRST directive checkbox (to exercise the subset-approve flow),
    // record the labels of everything still checked (directives + seeds).
    const directiveCheckboxes = page.locator(
      '[role="dialog"] input[aria-label^="Approve directive"]'
    );
    const directiveCount = await directiveCheckboxes.count();
    if (directiveCount >= 2) {
      const firstLbl = await directiveCheckboxes.first().getAttribute("aria-label");
      log(`  Unchecking first directive: ${firstLbl}`);
      await directiveCheckboxes.first().uncheck();
      await page.waitForTimeout(400);
    }

    // Collect what's still approved
    const activeDirBoxes = page.locator(
      '[role="dialog"] input[aria-label^="Approve directive"]:checked'
    );
    const nDirs = await activeDirBoxes.count();
    for (let i = 0; i < nDirs; i++) {
      const label = await activeDirBoxes.nth(i).getAttribute("aria-label");
      if (label) approvedDirectiveLabels.push(label.replace(/^Approve directive\s*/, ""));
    }
    log(`  Approving directives: ${approvedDirectiveLabels.join(", ") || "(none)"}`);

    // ── 07: Approve & capture applied state ───────────────────
    log("→ 07: Approve selected and capture applied state");
    const approveBtn = page.locator('[role="dialog"] button:has-text("Approve selected")').first();
    await approveBtn.click();
    await page.waitForTimeout(3000);
    // The modal stays open with a "Proposal applied" banner visible.
    captured.push(await shot(page, "07-proposal-applied"));

    // Close modal
    const closeBtn = page.locator('[role="dialog"] button:has-text("Close")').first();
    await closeBtn.click().catch(() => {});
    await page.waitForTimeout(800);

    // ── 08: Directives tab after apply ────────────────────────
    log("→ 08: Directives tab after apply (new directive should show)");
    await page.goto(
      `${BASE_URL}/teacher?tab=scholars&scholar=${SCHOLAR_ID}&stab=directives`,
      { waitUntil: "networkidle", timeout: 30_000 }
    );
    await page.waitForTimeout(1500);
    captured.push(await shot(page, "08-directives-after-apply"));

    // ── 09: Scholar profile header w/ "Chat with AI" button ──
    log("→ 09: Scholar profile header showing Chat with AI button");
    await page.goto(
      `${BASE_URL}/teacher?tab=scholars&scholar=${SCHOLAR_ID}`,
      { waitUntil: "networkidle", timeout: 30_000 }
    );
    await waitForText(page, /Chat with AI/i, 15_000);
    await page.waitForTimeout(800);
    captured.push(await shot(page, "09-scholar-profile-chat-button"));

    // ── 10: Scoped chat empty state ──────────────────────────
    log("→ 10: Scoped chat thread (initial state w/ Scoped badge)");
    await page.locator('button:has-text("Chat with AI")').first().click();
    await page.waitForURL((u) => u.searchParams.get("tab") === "assistant" && !!u.searchParams.get("scholar"), { timeout: 15_000 });
    await waitForText(page, /Chatting about/i, 15_000);
    await page.waitForTimeout(800);
    captured.push(await shot(page, "10-chat-scoped-empty"));

    // ── 11: Scoped thread with an AI response ────────────────
    log("→ 11: Scoped chat with AI response");
    const textarea = page.locator('textarea[placeholder*="Ask about"]').first();
    await textarea.waitFor({ timeout: 10_000 });
    await textarea.fill(
      "In 2 sentences, what do this scholar's current directives tell me about how to approach them?"
    );
    await textarea.press("Enter");

    // Wait for streaming to start, then settle
    const start = Date.now();
    let streamingStarted = false;
    while (Date.now() - start < 20_000) {
      if (await textarea.isDisabled().catch(() => false)) {
        streamingStarted = true;
        break;
      }
      await page.waitForTimeout(200);
    }
    if (!streamingStarted) warn("Streaming never started for scoped chat");
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (!(await textarea.isDisabled().catch(() => true))) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);
    captured.push(await shot(page, "11-chat-scoped-with-response"));

    // ── 12: Global (unscoped) chat ───────────────────────────
    log("→ 12: Global curriculum assistant thread (unscoped)");
    await page.locator('button:has-text("Clear scope")').first().click();
    await page.waitForURL((u) => u.searchParams.get("tab") === "assistant" && !u.searchParams.get("scholar"), { timeout: 10_000 });
    await waitForText(page, /Curriculum Assistant/i, 15_000);
    await page.waitForTimeout(1000);
    captured.push(await shot(page, "12-chat-global"));

    // ── 13: Curriculum designer tools — show an assistant response
    //        that invokes the tooling (ideally a directive upsert).
    //
    // For screenshot purposes we just ask a tooling-adjacent question in the
    // GLOBAL thread so Andy can see the generic assistant state + any prior
    // tool activity. A real tool-invoking screenshot requires a prompt that
    // triggers a tool — we'll ask for one.
    log("→ 13: Curriculum designer assistant — ask a tool-triggering question");
    const globalTextarea = page.locator('textarea[placeholder*="Ask about"]').first();
    await globalTextarea.fill(
      "List the active units and count them. Just use the tools and report the count and titles."
    );
    await globalTextarea.press("Enter");
    const s2 = Date.now();
    while (Date.now() - s2 < 20_000) {
      if (await globalTextarea.isDisabled().catch(() => false)) break;
      await page.waitForTimeout(200);
    }
    const d2 = Date.now() + 90_000;
    while (Date.now() < d2) {
      if (!(await globalTextarea.isDisabled().catch(() => true))) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);
    captured.push(await shot(page, "13-curriculum-designer-tools"));

    ok(`Captured ${captured.length} screenshots`);
  } catch (err) {
    fail(`Tour failed: ${err.message}`);
    errors.push(err.message);
    try {
      await shot(page, `ERROR-final-state`);
    } catch {}
  } finally {
    await browser.close();

    // ── Discover seeds created during this run (best-effort) ─
    try {
      const seedsListRaw = execSync(
        `CONVEX_DEPLOYMENT=${CONVEX_DEPLOYMENT} npx convex run seeds:activeByScholar '${JSON.stringify({ scholarId: SCHOLAR_ID })}'`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      );
      const seedsList = JSON.parse(seedsListRaw);
      const cutoff = Date.now() - 15 * 60 * 1000;
      approvedSeedTopics = seedsList
        .filter((s) => s.origin === "teacher" && s._creationTime >= cutoff)
        .map((s) => s.topic);
    } catch (err) {
      warn(`Could not discover seeds for cleanup: ${err.message}`);
    }

    // ── Cleanup ────────────────────────────────────────────
    log("→ Cleaning up fixture data...");
    try {
      if (createdDocId) {
        convexRun("scholarDocuments:adminFixtureDelete", {
          documentId: createdDocId,
        });
        ok(`Deleted fixture doc ${createdDocId}`);
      }
    } catch (err) {
      fail(`Doc cleanup failed: ${err.message}`);
    }
    try {
      const cleanupOut = convexRun(
        "scholarDocuments:adminFixtureCleanupScholar",
        {
          scholarId: SCHOLAR_ID,
          directiveLabels: approvedDirectiveLabels,
          seedTopics: approvedSeedTopics,
        }
      );
      ok(`Scholar cleanup: ${cleanupOut.replace(/\s+/g, " ")}`);
    } catch (err) {
      fail(`Scholar cleanup failed: ${err.message}`);
    }

    // ── Summary ────────────────────────────────────────────
    console.log("─".repeat(60));
    console.log(`CAPTURED: ${captured.length} screenshot${captured.length === 1 ? "" : "s"} in ${OUT_DIR}`);
    for (const p of captured) console.log(`  ✓ ${p.split("/").pop()}`);
    if (errors.length > 0) {
      console.log(`ERRORS (${errors.length}):`);
      for (const e of errors) console.log(`  ✗ ${e}`);
    }
    console.log("─".repeat(60));
  }
}

run().catch((err) => {
  console.error("Script failed outer:", err);
  process.exit(1);
});
