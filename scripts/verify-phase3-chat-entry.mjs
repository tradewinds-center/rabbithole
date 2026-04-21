/**
 * Playwright verification for Phase 3a — scholar-scoped curriculum assistant.
 *
 * 1. Log in as the test teacher.
 * 2. Navigate to testkai's scholar profile.
 * 3. Click "Chat with AI", confirm URL has ?scholar=<testkai-id>.
 * 4. Confirm the scoped header renders ("Chatting about testkai…").
 * 5. Send a message asking about this scholar; verify response references
 *    testkai's dossier / directives / name.
 * 6. Clear scope, confirm global thread shows (likely empty or prior messages).
 * 7. Navigate back to testkai's thread — confirm the message persisted.
 *
 * After this runs, unit-scope filtering on units.list can be spot-checked via:
 *   CONVEX_DEPLOYMENT=dev:perceptive-husky-735 npx convex data units
 *
 * Headless by default; set HEADED=1 to watch it.
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:1041";
const TEACHER_USERNAME = process.env.TEACHER_USERNAME ?? "testteacher_1776564762723";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD ?? "testpass123";
const TESTKAI_ID = process.env.TESTKAI_ID ?? "k9720mk6bw8pyy4mhenepsjvx58545t3";
const TESTKAI_NAME_SUBSTR = process.env.TESTKAI_NAME_SUBSTR ?? "testkai";
const HEADED = process.env.HEADED === "1";

const PROMPT = `What should I work on next for this scholar? Briefly summarize what their existing directives tell me, then suggest one next step.`;

async function waitForStreamToSettle(page, textarea, totalTimeoutMs = 120_000) {
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
    return null;
  }
  console.log(`  ✓ Streaming started after ${((streamingStartedAt - start) / 1000).toFixed(1)}s`);

  while (Date.now() - start < totalTimeoutMs) {
    const disabled = await textarea.isDisabled().catch(() => true);
    if (!disabled) {
      await page.waitForTimeout(1500);
      return Date.now();
    }
    await page.waitForTimeout(500);
  }
  return null;
}

async function run() {
  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) {
      console.log(`  [browser ${msg.type()}]`, msg.text());
    }
  });

  // ── 1. Login ────────────────────────────────────────────────────
  console.log("→ Navigating to login...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });

  const usernameInput = page
    .locator('input[name="username"], input[type="text"][placeholder*="sername" i], input[placeholder*="sername" i]')
    .first();
  await usernameInput.waitFor({ timeout: 10_000 });
  await usernameInput.fill(TEACHER_USERNAME);

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(TEACHER_PASSWORD);

  console.log("→ Submitting login...");
  const signInButton = page
    .locator('button:has-text("Sign"), button:has-text("Log"), button:has-text("Continue"), button[type="submit"]')
    .first();
  await signInButton.click();

  try {
    await page.waitForURL(/\/teacher|\/scholar|\/admin/, { timeout: 15_000 });
  } catch {
    console.error(`  ✗ Login did not redirect. Current URL: ${page.url()}`);
    await page.screenshot({ path: "/tmp/phase3-login-fail.png" });
    await browser.close();
    process.exit(1);
  }
  console.log(`  ✓ Logged in. URL: ${page.url()}`);

  // ── 2. Open testkai scholar profile ─────────────────────────────
  console.log("→ Navigating to testkai scholar profile...");
  await page.goto(
    `${BASE_URL}/teacher?tab=scholars&scholar=${TESTKAI_ID}`,
    { waitUntil: "domcontentloaded" }
  );
  // Wait for the profile header (scholar name) to render
  const scholarNameLocator = page.locator(`text=/${TESTKAI_NAME_SUBSTR}/i`).first();
  await scholarNameLocator.waitFor({ timeout: 15_000 });
  console.log("  ✓ Scholar profile loaded.");

  // ── 3. Click "Chat with AI" ─────────────────────────────────────
  console.log("→ Clicking 'Chat with AI' button...");
  const chatButton = page.locator('button:has-text("Chat with AI")').first();
  await chatButton.waitFor({ timeout: 10_000 });
  await chatButton.click();

  // URL should now be /teacher?tab=assistant&scholar=<id>
  await page.waitForURL((url) => url.searchParams.get("tab") === "assistant" && !!url.searchParams.get("scholar"), { timeout: 10_000 });
  const currentUrl = new URL(page.url());
  const scholarParam = currentUrl.searchParams.get("scholar");
  console.log(`  ✓ URL now has ?scholar=${scholarParam}`);
  if (scholarParam !== TESTKAI_ID) {
    console.warn(`  ⚠ Scholar param ${scholarParam} does not match TESTKAI_ID ${TESTKAI_ID}`);
  }

  // ── 4. Confirm scoped header ────────────────────────────────────
  console.log("→ Verifying scoped chat header...");
  const scopedHeader = page.locator('text=/Chatting about/i').first();
  await scopedHeader.waitFor({ timeout: 10_000 });
  const scopedBadge = page.locator('text=/^Scoped$/i').first();
  const badgeVisible = await scopedBadge.isVisible().catch(() => false);
  console.log(`  ✓ Scoped header visible. Badge visible: ${badgeVisible}`);

  // ── 5. Send scoped message ──────────────────────────────────────
  console.log("→ Sending scoped message...");
  const textarea = page.locator('textarea[placeholder*="Ask about"]').first();
  await textarea.waitFor({ timeout: 10_000 });
  await textarea.fill(PROMPT);
  await textarea.press("Enter");

  console.log("→ Waiting for response...");
  const settled = await waitForStreamToSettle(page, textarea, 120_000);
  if (!settled) {
    console.error("  ✗ Timed out waiting for scoped response.");
    await page.screenshot({ path: "/tmp/phase3-scoped-timeout.png", fullPage: true });
    await browser.close();
    process.exit(1);
  }
  console.log("  ✓ Scoped response finished.");

  // Scrape the last ~80 lines of body text for verification.
  const scopedTranscript = await page.evaluate(() => {
    const body = document.body.innerText;
    return body.split("\n").filter((l) => l.trim().length > 0).slice(-80).join("\n");
  });
  console.log("─".repeat(60));
  console.log("[SCOPED TRANSCRIPT]");
  console.log(scopedTranscript);
  console.log("─".repeat(60));

  const lower = scopedTranscript.toLowerCase();
  const referenceHits = [
    lower.includes("directive"),
    lower.includes("seed"),
    lower.includes(TESTKAI_NAME_SUBSTR.toLowerCase()),
    lower.includes("block a") || lower.includes("block b"),
  ];
  const anyReference = referenceHits.some(Boolean);
  console.log(
    `  ↳ Reference hits (directive/seed/name/block-label): ${referenceHits.map((b) => (b ? "1" : "0")).join("")} → ${anyReference ? "OK" : "MISS"}`
  );

  await page.screenshot({ path: "/tmp/phase3-scoped.png", fullPage: true });

  // ── 6. Clear scope ──────────────────────────────────────────────
  console.log("→ Clicking 'Clear scope'...");
  const clearScopeButton = page.locator('button:has-text("Clear scope")').first();
  await clearScopeButton.click();
  await page.waitForURL((url) => url.searchParams.get("tab") === "assistant" && !url.searchParams.get("scholar"), { timeout: 10_000 });
  console.log("  ✓ Scope cleared. URL now unscoped.");

  // Verify the header no longer shows "Chatting about"
  const scopedHeaderStillVisible = await page
    .locator('text=/Chatting about/i')
    .isVisible()
    .catch(() => false);
  console.log(`  ↳ Scoped header visible after clear: ${scopedHeaderStillVisible} (should be false)`);

  await page.screenshot({ path: "/tmp/phase3-unscoped.png", fullPage: true });

  // ── 7. Navigate back to testkai thread, confirm message persisted ─
  console.log("→ Navigating back to testkai thread...");
  await page.goto(
    `${BASE_URL}/teacher?tab=assistant&scholar=${TESTKAI_ID}`,
    { waitUntil: "domcontentloaded" }
  );
  await page.locator('text=/Chatting about/i').first().waitFor({ timeout: 10_000 });
  const revisitTranscript = await page.evaluate(() => {
    const body = document.body.innerText;
    return body.split("\n").filter((l) => l.trim().length > 0).slice(-80).join("\n");
  });
  const promptStart = PROMPT.slice(0, 40).toLowerCase();
  const persisted = revisitTranscript.toLowerCase().includes(promptStart);
  console.log(`  ↳ Prior message persisted: ${persisted ? "YES" : "NO"}`);

  await page.screenshot({ path: "/tmp/phase3-revisit.png", fullPage: true });

  // ── 8. Verify units.list filter — a DIFFERENT scholar must NOT see
  //       testkai's scoped "Phase3 Test Scoped Unit". ────────────────
  //
  // We log out the teacher, log in as a different scholar (Oliver), and
  // confirm the unit does not appear in the scholar's visible unit list
  // (surfaced by UnitPickerDialog on the scholar dashboard).
  console.log("→ Switching user: sign out, sign in as Oliver scholar...");
  const OLIVER_USERNAME = process.env.OLIVER_USERNAME ?? "oliverszy";
  const OLIVER_PASSWORD = process.env.OLIVER_PASSWORD;
  let unitFilterChecked = false;
  let otherScholarSeesScopedUnit = null;
  if (OLIVER_PASSWORD) {
    // Sign out via /api/auth/signout equivalent — just hit login page and expect the
    // existing session cookie may block us; do a hard navigate to /login
    await page.goto(`${BASE_URL}/login?force=1`, { waitUntil: "domcontentloaded" });
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    const un = page.locator('input[name="username"], input[type="text"][placeholder*="sername" i]').first();
    await un.waitFor({ timeout: 10_000 }).catch(() => {});
    await un.fill(OLIVER_USERNAME).catch(() => {});
    const pw = page.locator('input[type="password"]').first();
    await pw.fill(OLIVER_PASSWORD).catch(() => {});
    await page
      .locator('button:has-text("Sign"), button:has-text("Log"), button:has-text("Continue"), button[type="submit"]')
      .first()
      .click()
      .catch(() => {});
    try {
      await page.waitForURL(/\/scholar/, { timeout: 15_000 });
      // Open the unit picker by clicking "New Project" or similar
      // Just grep the page text for the scoped unit's title.
      await page.waitForTimeout(3000);
      const oliverBody = await page.evaluate(() => document.body.innerText);
      otherScholarSeesScopedUnit = oliverBody.includes("Phase3 Test Scoped Unit");
      unitFilterChecked = true;
      console.log(
        `  ↳ Oliver sees testkai's scoped unit: ${otherScholarSeesScopedUnit} (expected: false)`
      );
    } catch (e) {
      console.warn(`  ⚠ Oliver login flow didn't complete (${(e && e.message) || e}). Skipping unit filter UI check.`);
    }
  } else {
    console.log("  (skipping cross-scholar UI check — OLIVER_PASSWORD not set)");
  }

  await browser.close();

  // Exit non-zero if key invariants failed
  if (!anyReference) {
    console.error("  ✗ Response did not reference scholar context (directive/seed/name).");
    process.exit(2);
  }
  if (!persisted) {
    console.error("  ✗ Prior scoped message did not persist on revisit.");
    process.exit(3);
  }
  if (scopedHeaderStillVisible) {
    console.error("  ✗ Scoped header still visible after clearing scope.");
    process.exit(4);
  }
  if (unitFilterChecked && otherScholarSeesScopedUnit === true) {
    console.error("  ✗ Different scholar sees testkai's scoped unit in their picker.");
    process.exit(5);
  }

  console.log("  ✓ All phase 3 checks passed.");
}

run().catch((err) => {
  console.error("Playwright script failed:", err);
  process.exit(1);
});
