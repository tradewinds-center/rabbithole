/**
 * Playwright verification for Phase 1.5 Directives tab UI.
 *
 * Logs in as the test teacher, navigates to the test scholar's profile,
 * opens the Directives tab, and walks through:
 *   1. Confirm 3 existing directives render (Block A, Block B, Playwright E2E test)
 *   2. Create a new directive via the Add button
 *   3. Edit an existing directive's content
 *   4. Delete the new directive
 *
 * Headless by default; set HEADED=1 to watch it.
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:1041";
const TEACHER_USERNAME = process.env.TEACHER_USERNAME ?? "testteacher_1776564762723";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD ?? "testpass123";
const SCHOLAR_ID = process.env.SCHOLAR_ID ?? "k9720mk6bw8pyy4mhenepsjvx58545t3";
const HEADED = process.env.HEADED === "1";

function log(msg) {
  console.log(msg);
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
}

async function run() {
  const results = { passed: [], failed: [] };
  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (["error"].includes(msg.type())) {
      console.log(`  [browser ${msg.type()}]`, msg.text());
    }
  });

  try {
    // ─── Login ────────────────────────────────────────────────────
    log("→ Logging in...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500); // let React hydrate
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
    // Wait until the button becomes enabled
    for (let i = 0; i < 20; i++) {
      if (!(await signInButton.isDisabled().catch(() => true))) break;
      await page.waitForTimeout(500);
    }
    await signInButton.click();
    // Cold Next.js compile can take 30-60s on a freshly-restarted dev server;
    // also, auth resolution may briefly land at / before redirecting.
    await page.waitForURL(/\/teacher|\/scholar|\/admin/, { timeout: 90_000 });
    ok(`Logged in (${page.url()})`);

    // ─── Navigate to scholar directives tab ──────────────────────
    log("→ Navigating to scholar Directives tab...");
    // We're already at /teacher. Wait a moment for hydration.
    await page.waitForTimeout(4000);
    // Known issue: Next.js 14 dev server has an HMR race that causes
    // "Could not find Convex client" intermittently in Playwright. If we
    // see the error boundary, click "Try again" which remounts the tree.
    for (let i = 0; i < 6; i++) {
      const tryAgain = page.locator('button:has-text("Try again")');
      const visible = (await tryAgain.count()) > 0 && (await tryAgain.first().isVisible().catch(() => false));
      if (!visible) break;
      log(`  ⚠ HMR error boundary — clicking "Try again" (attempt ${i + 1})...`);
      await tryAgain.first().click();
      await page.waitForTimeout(2000);
    }
    // Navigate to the scholar via the Scholars tab & clicking on the scholar
    // Use full URL navigation with networkidle to let Next fully compile
    await page.goto(
      `${BASE_URL}/teacher?tab=scholars&scholar=${SCHOLAR_ID}&stab=directives`,
      { waitUntil: "networkidle", timeout: 60_000 }
    );
    // After navigation, check for error boundary again and retry
    for (let i = 0; i < 6; i++) {
      const tryAgain = page.locator('button:has-text("Try again")');
      const visible = (await tryAgain.count()) > 0 && (await tryAgain.first().isVisible().catch(() => false));
      if (!visible) break;
      log(`  ⚠ Post-nav HMR error — clicking "Try again" (attempt ${i + 1})...`);
      await tryAgain.first().click();
      await page.waitForTimeout(3000);
    }

    // Click the Directives tab to ensure it's active
    const directivesTab = page.locator('button[role="tab"]:has-text("Directives")').first();
    await directivesTab.waitFor({ timeout: 30_000 });
    await directivesTab.click();
    await page.waitForTimeout(1500);
    ok("Directives tab is clickable");

    // ─── Test case 1: Confirm 3 existing directives render ────────
    log("→ Test case 1: Confirm existing directives render");
    const pageText1 = await page.evaluate(() => document.body.innerText);
    const expectedLabels = ["Block A", "Block B", "Playwright E2E test"];
    const missing1 = expectedLabels.filter((l) => !pageText1.includes(l));
    if (missing1.length === 0) {
      ok("All 3 existing directives render");
      results.passed.push("existing directives render");
    } else {
      fail(`Missing directives: ${missing1.join(", ")}`);
      results.failed.push(`existing directives render (missing: ${missing1.join(", ")})`);
    }

    // ─── Test case 2: Create a new directive ──────────────────────
    log("→ Test case 2: Create a new directive");
    await page.locator('button:has-text("Add Directive")').first().click();
    await page.waitForTimeout(500);
    await page.locator('input[placeholder*="Label"]').first().fill("UI test");
    await page.locator('textarea[placeholder*="Standing rule"]').first().fill("created via the new tab");
    // Click the Save button inside the New Directive form (not the first global Save)
    await page
      .locator('div:has(> p:has-text("New Directive")) button:has-text("Save"), div:has(> * p:has-text("New Directive")) button:has-text("Save")')
      .first()
      .click()
      .catch(async () => {
        // Fallback: find the Save button adjacent to the Cancel in the new directive form
        await page.locator('button:has-text("Save")').first().click();
      });
    await page.waitForTimeout(2000);
    const pageText2 = await page.evaluate(() => document.body.innerText);
    if (pageText2.includes("UI test") && pageText2.includes("created via the new tab")) {
      ok('New directive "UI test" appears');
      results.passed.push("create directive");
    } else {
      fail('New directive "UI test" not found');
      results.failed.push("create directive");
    }

    // ─── Test case 3: Edit an existing directive ──────────────────
    log("→ Test case 3: Edit Block A's content");
    // Find the edit button inside Block A's card (label exact match).
    // XPath walks up to the nearest ancestor card div that contains both the
    // label <p> and the edit button.
    const blockAEditButton = page
      .locator('p', { hasText: /^Block A$/ })
      .first()
      .locator('xpath=ancestor::div[.//button[@aria-label="Edit directive"]][1]')
      .locator('button[aria-label="Edit directive"]');
    await blockAEditButton.click();
    await page.waitForTimeout(500);
    // A textarea appears in the card. Find textarea near Block A.
    // Most recent textarea in the DOM should be the edit one
    const editTextarea = page.locator('textarea').last();
    await editTextarea.fill("EDITED via UI test");
    // Click Save (inline save button in the card)
    await page.locator('button:has-text("Save")').first().click();
    await page.waitForTimeout(2000);
    const pageText3 = await page.evaluate(() => document.body.innerText);
    if (pageText3.includes("EDITED via UI test")) {
      ok("Block A content updated to 'EDITED via UI test'");
      results.passed.push("edit directive");
    } else {
      fail("Updated Block A content not found");
      results.failed.push("edit directive");
    }

    // ─── Test case 4: Delete the 'UI test' directive ──────────────
    log("→ Test case 4: Delete the 'UI test' directive");
    // Find the card by its exact label (label is rendered as a <p> with
    // fontWeight=600). Don't match on content since one card's content may
    // contain "UI test" as a substring after an earlier edit. Use an XPath
    // locator to walk up to the enclosing card div, then click its delete
    // button.
    const deleteButton = page
      .locator('p', { hasText: /^UI test$/ })
      .first()
      // Chakra cards render the label <p> inside an HStack inside the outer
      // Box. Two ancestor-Box hops up gets us to the card root.
      .locator('xpath=ancestor::div[.//button[@aria-label="Delete directive"]][1]')
      .locator('button[aria-label="Delete directive"]');
    await deleteButton.click();
    await page.waitForTimeout(500);
    // Confirm deletion — the dialog's "Delete" button is inside a Dialog.Footer.
    // Target it via the dialog role to avoid matching the delete-icon buttons.
    await page.locator('[role="dialog"] button:has-text("Delete")').first().click();
    await page.waitForTimeout(2000);
    // Check: no card has an exact-match "UI test" label anymore. Don't do a
    // substring scan of body text — after test case 3 edits a card to contain
    // "EDITED via UI test", that would match.
    const uiTestCardsRemaining = await page.locator('p', { hasText: /^UI test$/ }).count();
    if (uiTestCardsRemaining === 0) {
      ok("'UI test' directive removed");
      results.passed.push("delete directive");
    } else {
      fail(`'UI test' directive still present (${uiTestCardsRemaining} card(s))`);
      results.failed.push("delete directive");
    }

    // ─── Screenshot final state ───────────────────────────────────
    await page.screenshot({ path: "/tmp/directives-tab.png", fullPage: true });
    ok("Screenshot saved to /tmp/directives-tab.png");

    // Summary
    console.log("─".repeat(60));
    console.log(`PASSED: ${results.passed.length}`);
    results.passed.forEach((t) => console.log(`  ✓ ${t}`));
    if (results.failed.length > 0) {
      console.log(`FAILED: ${results.failed.length}`);
      results.failed.forEach((t) => console.log(`  ✗ ${t}`));
    }
    console.log("─".repeat(60));
  } catch (err) {
    console.error("Test failed with error:", err);
    try {
      await page.screenshot({ path: "/tmp/directives-tab-error.png", fullPage: true });
      console.log("Error screenshot: /tmp/directives-tab-error.png");
    } catch {}
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
