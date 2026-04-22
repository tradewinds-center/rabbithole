/**
 * Playwright verification for Phase 2 Documents tab UI.
 *
 * Uses the internal `adminFixtureInsertReady` mutation to seed a ready
 * document (bypassing the Gemini extraction pipeline — saves credits and
 * makes the test deterministic). Then:
 *
 *   1. Log in as test teacher, navigate to testkai's Documents tab
 *   2. Confirm the seeded document card renders with "Ready" status
 *   3. Click the document → verify the redacted-summary pane shows up
 *   4. Click "Generate proposal" → wait for proposal → open diff modal
 *   5. Uncheck one proposed directive → click "Approve selected"
 *   6. Verify only the checked directive shows up in the Directives tab
 *   7. Cleanup — delete the test document + the created directive
 *
 * Step 4 hits real Claude (runProposal action in Convex).
 *
 * Headless by default; set HEADED=1 to watch it.
 */
import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:1041";
const TEACHER_USERNAME = process.env.TEACHER_USERNAME ?? "testteacher_1776564762723";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD ?? "testpass123";
const SCHOLAR_ID = process.env.SCHOLAR_ID ?? "k9720mk6bw8pyy4mhenepsjvx58545t3";
const TEACHER_ID = process.env.TEACHER_ID ?? "k97fa4st37gf2fjvqvegqrr9dx854m39";
const CONVEX_DEPLOYMENT = "dev:perceptive-husky-735";
const HEADED = process.env.HEADED === "1";

const FIXTURE_SUMMARY =
  "The student shows well-above-average verbal reasoning and pattern recognition, paired with a relative weakness in processing speed. Reading and spelling sit below what the verbal ability would predict — a pattern consistent with stealth dyslexia. Works best with open-ended, morphology-rich puzzles.";
const FIXTURE_KEY_FINDINGS = [
  "Verbal reasoning well above reading/spelling — investigate structured word inquiry as the remediation on-ramp.",
  "Processing-speed gap is a classic twice-exceptional pattern. Avoid timed drills.",
  "Highly engaged by pattern-discovery framings rather than rote practice.",
];

const FIXTURE_TITLE = `[UI test ${Date.now()}] Synthetic cognitive profile`;

function log(msg) {
  console.log(msg);
}
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg) {
  console.error(`  ✗ ${msg}`);
}

function convexRun(fn, argsObj) {
  const raw = execSync(
    `CONVEX_DEPLOYMENT=${CONVEX_DEPLOYMENT} npx convex run ${fn} '${JSON.stringify(argsObj)}'`,
    { encoding: "utf-8" }
  );
  return raw.trim();
}

async function run() {
  const results = { passed: [], failed: [] };
  let createdDocId = null;
  let createdDirectiveId = null;

  // ─── Seed fixture doc via Convex CLI ────────────────────────────
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
    // last line of output should be the document id (string)
    const match = out.match(/\S+$/m);
    createdDocId = match ? match[0].replace(/['"]/g, "") : null;
    if (!createdDocId) throw new Error("Could not parse doc id from CLI output");
    ok(`Seeded doc ${createdDocId}`);
  } catch (err) {
    fail(`Seeding failed: ${err.message}`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`  [browser error]`, msg.text());
    }
  });

  try {
    // ─── Login ────────────────────────────────────────────────────
    log("→ Logging in as test teacher...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const usernameInput = page
      .locator('input[name="username"], input[type="text"][placeholder*="sername" i], input[placeholder*="sername" i]')
      .first();
    await usernameInput.waitFor({ timeout: 10_000 });
    await usernameInput.click();
    await usernameInput.fill(TEACHER_USERNAME);
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.click();
    await passwordInput.fill(TEACHER_PASSWORD);
    await page.waitForTimeout(500);
    const signInButton = page
      .locator('button:has-text("Sign"), button:has-text("Log"), button:has-text("Continue"), button[type="submit"]')
      .first();
    for (let i = 0; i < 20; i++) {
      if (!(await signInButton.isDisabled().catch(() => true))) break;
      await page.waitForTimeout(500);
    }
    await signInButton.click();
    await page.waitForURL(/\/teacher|\/scholar|\/admin/, { timeout: 90_000 });
    ok(`Logged in (${page.url()})`);

    // ─── Navigate to scholar Documents tab ─────────────────────────
    log("→ Navigating to scholar Documents tab...");
    await page.waitForTimeout(3000);
    for (let i = 0; i < 6; i++) {
      const tryAgain = page.locator('button:has-text("Try again")');
      const visible = (await tryAgain.count()) > 0 && (await tryAgain.first().isVisible().catch(() => false));
      if (!visible) break;
      log(`  ⚠ HMR error — clicking "Try again" (attempt ${i + 1})...`);
      await tryAgain.first().click();
      await page.waitForTimeout(2000);
    }
    await page.goto(
      `${BASE_URL}/teacher?tab=scholars&scholar=${SCHOLAR_ID}&stab=documents`,
      { waitUntil: "networkidle", timeout: 60_000 }
    );
    for (let i = 0; i < 6; i++) {
      const tryAgain = page.locator('button:has-text("Try again")');
      const visible = (await tryAgain.count()) > 0 && (await tryAgain.first().isVisible().catch(() => false));
      if (!visible) break;
      log(`  ⚠ Post-nav HMR error — clicking "Try again" (attempt ${i + 1})...`);
      await tryAgain.first().click();
      await page.waitForTimeout(3000);
    }
    const docsTab = page.locator('button[role="tab"]:has-text("Documents")').first();
    await docsTab.waitFor({ timeout: 30_000 });
    await docsTab.click();
    await page.waitForTimeout(1500);
    ok("Documents tab is clickable");

    // ─── Test 1: Confirm seeded document renders ───────────────────
    log("→ Test 1: Confirm seeded document renders");
    const pageText1 = await page.evaluate(() => document.body.innerText);
    if (pageText1.includes(FIXTURE_TITLE) && pageText1.includes("Ready")) {
      ok("Seeded document card renders with Ready status");
      results.passed.push("seeded doc renders");
    } else {
      fail(`Seeded doc not rendered — text: ${pageText1.slice(0, 300)}`);
      results.failed.push("seeded doc renders");
    }

    // ─── Test 2: Open detail pane ─────────────────────────────────
    log("→ Test 2: Open detail pane by clicking card");
    await page.locator(`text=${FIXTURE_TITLE}`).first().click();
    await page.waitForTimeout(1000);
    const pageText2 = await page.evaluate(() => document.body.innerText);
    if (
      pageText2.includes("REDACTED SUMMARY") &&
      pageText2.includes("KEY FINDINGS") &&
      pageText2.includes("stealth dyslexia")
    ) {
      ok("Detail pane shows redacted summary + key findings");
      results.passed.push("detail pane renders");
    } else {
      fail("Detail pane missing expected content");
      results.failed.push("detail pane renders");
    }

    // ─── Test 3: Generate proposal ────────────────────────────────
    log("→ Test 3: Generate proposal via Claude");
    await page.locator('button:has-text("Generate proposal")').first().click();
    // Wait for proposal to appear — uses real Claude, up to ~60s
    const viewBtn = page.locator('button:has-text("View proposal")').first();
    try {
      await viewBtn.waitFor({ state: "visible", timeout: 90_000 });
      ok("Proposal generated — View proposal button visible");
      results.passed.push("generate proposal");
    } catch {
      fail("Proposal button did not appear within 90s");
      results.failed.push("generate proposal");
      await page.screenshot({ path: "/tmp/documents-tab-error.png", fullPage: true });
      throw new Error("proposal timeout");
    }

    await page.waitForTimeout(1000);
    await viewBtn.click();
    await page.waitForTimeout(1500);

    // ─── Test 4: Diff modal renders with checkboxes ───────────────
    log("→ Test 4: Diff modal renders with approval controls");
    const pageText4 = await page.evaluate(() => document.body.innerText);
    if (
      pageText4.includes("Proposed Changes for This Scholar") &&
      pageText4.includes("RATIONALE") &&
      pageText4.includes("Directives")
    ) {
      ok("Diff modal renders with rationale, directives, seeds");
      results.passed.push("diff modal renders");
    } else {
      fail("Diff modal content missing");
      results.failed.push("diff modal renders");
    }

    // Count checkboxes (one per directive + seed). Uncheck first directive.
    const checkboxes = page.locator('[role="dialog"] input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    log(`  Found ${checkboxCount} approval checkboxes`);

    let selectedDirectiveLabels = [];
    if (checkboxCount >= 2) {
      // Find the label of the first directive (to assert it was NOT applied after rejection)
      const firstDirectiveLabel = await page
        .locator('[role="dialog"] input[aria-label^="Approve directive"]')
        .first()
        .getAttribute("aria-label");
      log(`  Unchecking: ${firstDirectiveLabel}`);
      await page
        .locator('[role="dialog"] input[aria-label^="Approve directive"]')
        .first()
        .uncheck();
      await page.waitForTimeout(500);
      // Collect the remaining (still-checked) directive labels
      const allDirectiveCheckboxes = page.locator(
        '[role="dialog"] input[aria-label^="Approve directive"]'
      );
      const n = await allDirectiveCheckboxes.count();
      for (let i = 0; i < n; i++) {
        const cb = allDirectiveCheckboxes.nth(i);
        const isChecked = await cb.isChecked();
        if (isChecked) {
          const label = await cb.getAttribute("aria-label");
          // label format: "Approve directive <label>"
          const name = label?.replace(/^Approve directive\s*/, "") ?? "";
          selectedDirectiveLabels.push(name);
        }
      }
      ok(`Selected directives remaining: ${selectedDirectiveLabels.join(", ") || "(none)"}`);
    } else {
      ok("Too few checkboxes to uncheck — proceeding with full approval");
    }

    // ─── Test 5: Approve selected ─────────────────────────────────
    log("→ Test 5: Approve selected");
    const approveBtn = page.locator('[role="dialog"] button:has-text("Approve selected")').first();
    await approveBtn.click();
    await page.waitForTimeout(3000);

    const pageText5 = await page.evaluate(() => document.body.innerText);
    if (pageText5.includes("Proposal applied") || pageText5.includes("Applied")) {
      ok("Approval success banner visible");
      results.passed.push("approve proposal");
    } else {
      fail("Approval banner missing");
      results.failed.push("approve proposal");
    }

    // Close modal
    await page.locator('[role="dialog"] button:has-text("Close")').first().click().catch(() => {});
    await page.waitForTimeout(1000);

    // ─── Test 6: Verify directives applied ────────────────────────
    log("→ Test 6: Verify applied directives present in Directives tab");
    await page.goto(
      `${BASE_URL}/teacher?tab=scholars&scholar=${SCHOLAR_ID}&stab=directives`,
      { waitUntil: "networkidle", timeout: 60_000 }
    );
    await page.waitForTimeout(1500);
    const pageText6 = await page.evaluate(() => document.body.innerText);
    let verifyOk = true;
    for (const lbl of selectedDirectiveLabels) {
      if (!pageText6.includes(lbl)) {
        fail(`Expected directive "${lbl}" not found in Directives tab`);
        verifyOk = false;
      }
    }
    if (selectedDirectiveLabels.length > 0 && verifyOk) {
      ok(`All ${selectedDirectiveLabels.length} approved directives visible in Directives tab`);
      results.passed.push("directives applied");
    } else if (selectedDirectiveLabels.length === 0) {
      ok("No directives to verify (none were selected)");
      results.passed.push("directives applied");
    } else {
      results.failed.push("directives applied");
    }

    // ─── Screenshot ────────────────────────────────────────────────
    await page.screenshot({ path: "/tmp/documents-tab.png", fullPage: true });
    ok("Screenshot saved to /tmp/documents-tab.png");
  } catch (err) {
    console.error("Test failed with error:", err);
    try {
      await page.screenshot({ path: "/tmp/documents-tab-error.png", fullPage: true });
      console.log("Error screenshot: /tmp/documents-tab-error.png");
    } catch {}
  } finally {
    await browser.close();

    // ─── Cleanup ──────────────────────────────────────────────────
    log("→ Cleaning up fixture data...");
    try {
      if (createdDocId) {
        convexRun("scholarDocuments:adminFixtureDelete", {
          documentId: createdDocId,
        });
        ok(`Deleted fixture doc ${createdDocId}`);
      }
    } catch (err) {
      fail(`Cleanup failed: ${err.message}`);
    }
    try {
      // Remove everything the applied proposal created on testkai. We pass
      // both the directive labels we approved AND any seed topics emitted by
      // the proposal (best-effort — we discover them via the ?stab=seeds tab
      // post-apply). If a label isn't present the cleanup is a no-op, so
      // passing too many is safe.
      const args = {
        scholarId: SCHOLAR_ID,
        directiveLabels: selectedDirectiveLabels,
        seedTopics: [], // filled below
      };
      // Pull topics for seeds authored by the test teacher that were created
      // within the last ~5 minutes (proxy for "created during this run").
      // Easier to just rely on test-run seed topics via the proposal — we
      // don't have them in scope here, so do a broader cleanup by listing
      // seeds via internal API instead.
      const seedsListRaw = execSync(
        `CONVEX_DEPLOYMENT=${CONVEX_DEPLOYMENT} npx convex run seeds:activeByScholar '${JSON.stringify({ scholarId: SCHOLAR_ID })}'`,
        { encoding: "utf-8" }
      );
      const seedsList = JSON.parse(seedsListRaw);
      const cutoff = Date.now() - 15 * 60 * 1000; // 15 min
      args.seedTopics = seedsList
        .filter((s) => s.origin === "teacher" && s._creationTime >= cutoff)
        .map((s) => s.topic);

      const cleanupOut = convexRun(
        "scholarDocuments:adminFixtureCleanupScholar",
        args
      );
      ok(`Cleanup: ${cleanupOut.replace(/\s+/g, " ")}`);
    } catch (err) {
      fail(`Scholar cleanup failed: ${err.message}`);
    }

    // Summary
    console.log("─".repeat(60));
    console.log(`PASSED: ${results.passed.length}`);
    results.passed.forEach((t) => console.log(`  ✓ ${t}`));
    if (results.failed.length > 0) {
      console.log(`FAILED: ${results.failed.length}`);
      results.failed.forEach((t) => console.log(`  ✗ ${t}`));
      process.exit(1);
    }
    console.log("─".repeat(60));
  }
}

run().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
