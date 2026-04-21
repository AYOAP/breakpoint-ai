import { chromium } from "playwright";

const baseUrl = process.argv[2] || process.env.AUDIT_URL || "http://127.0.0.1:3020";

async function collectScrollableNodes(page, label) {
  const result = await page.evaluate(() => {
    const describeNode = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      return {
        tag: el.tagName.toLowerCase(),
        className: typeof el.className === "string" ? el.className.slice(0, 180) : "",
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        top: Math.round(rect.top),
        height: Math.round(rect.height),
      };
    };

    const scrollableNodes = [document.documentElement, document.body, ...Array.from(document.querySelectorAll("*"))]
      .map(describeNode)
      .filter((node) => {
        const hasVerticalScrollOwner =
          ["auto", "scroll", "overlay"].includes(node.overflowY) &&
          node.scrollHeight > node.clientHeight + 2;
        const hasHorizontalOverflow =
          !["hidden", "clip"].includes(node.overflowX) &&
          node.scrollWidth > node.clientWidth + 2 &&
          node.clientWidth >= window.innerWidth - 4;

        return hasVerticalScrollOwner || hasHorizontalOverflow;
      });

    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      page: {
        documentScrollHeight: document.documentElement.scrollHeight,
        documentClientHeight: document.documentElement.clientHeight,
        bodyScrollHeight: document.body.scrollHeight,
        bodyClientHeight: document.body.clientHeight,
      },
      scrollableNodes,
    };
  });

  return { label, ...result };
}

function assertSingleScrollOwner(state) {
  const offenders = state.scrollableNodes.filter((node) => {
    const isDocumentRoot = node.tag === "html" || node.tag === "body";
    const verticalOwner =
      ["auto", "scroll", "overlay"].includes(node.overflowY) &&
      node.scrollHeight > node.clientHeight + 2;
    const horizontalOwner =
      !["hidden", "clip"].includes(node.overflowX) &&
      node.scrollWidth > node.clientWidth + 2 &&
      node.clientWidth >= state.viewport.width - 4;

    return !isDocumentRoot && (verticalOwner || horizontalOwner);
  });

  if (offenders.length) {
    throw new Error(
      `${state.label} has nested scroll/horizontal overflow owners:\n${JSON.stringify(offenders, null, 2)}`,
    );
  }
}

async function moveToClarify(page) {
  await page.locator("textarea").first().fill(
    "A workflow platform for independent dental offices that automates insurance verification, benefits checks, and claim follow-up for front-desk teams.",
  );
  await page.waitForTimeout(120);
  await page.getByRole("button", { name: /calibrate pressure test/i }).click();
  await page.getByText(/how developed is this idea right now/i).waitFor();
  await page.getByText(/planned out but not built/i).click();
  await page.locator("textarea").last().fill("Still validating office manager demand and willingness to pay.");
  await page.getByRole("button", { name: /continue to pressure points/i }).click();
  await page.waitForTimeout(3500);
}

async function answerClarifications(page) {
  const answerText =
    "Independent dental practices with 3 to 15 staff that lose hours each week to manual insurance work and delayed claims.";

  for (let index = 0; index < 5; index += 1) {
    if (await page.getByRole("button", { name: /show me the breakdown/i }).count()) {
      return;
    }

    const answerBox = page.locator("textarea").last();
    await answerBox.fill(answerText);
    await page.getByRole("button", { name: /lock answer|pressure test venture/i }).click();
    await page.waitForTimeout(3600);
  }
}

async function dismissOnboardingIfPresent(page) {
  const onboardingDialog = page.locator('[role="dialog"]');

  if (await onboardingDialog.count()) {
    await onboardingDialog.waitFor();
    await page.getByRole("button", { name: /skip intro/i }).click();
    await onboardingDialog.waitFor({ state: "hidden" });
    await page.getByRole("heading", { name: /what are you thinking of building/i }).waitFor();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(45000);

  await page.route("**/api/clarify", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        questions: [
          "Who is the first real buyer, and what job are they already trying to solve today?",
          "What monthly improvement would make this worth paying for instead of staying manual?",
          "What has to be true about distribution for this to reach practices without founder-only hustle?",
          "What proof would convince you this saves enough time to survive budget scrutiny?",
        ],
      }),
    });
  });

  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        venture_summary:
          "A subscription workflow tool for independent dental offices that reduces insurance verification and claim follow-up work for front-desk teams.",
        invincibility_score: 63,
        verdict: "Needs Market Proof",
        core_break_point:
          "The buyer pain is plausible, but willingness to pay and repeatable distribution are still unproven.",
        structural_weak_points: [
          "The workflow pain is obvious, but the budget owner may still see this as staff labor rather than software spend.",
          "The product value collapses if offices still need too much manual exception handling.",
        ],
        failure_scenarios: [
          "Practices like the demo but will not change behavior enough to replace current admin habits.",
          "Acquisition depends on founder-led sales with no repeatable channel into small practices.",
        ],
        kill_conditions: [
          "If offices will not pay after a time-saved pilot, the model is structurally weak.",
          "If integrations and payer edge cases require heavy human ops, margins disappear.",
        ],
        proof_required_before_launch: [
          "Run a paid pilot with at least three practices and measure whether usage holds for 30 days.",
          "Show that the workflow reduces staff hours enough to justify the subscription without founder explanation.",
        ],
        hidden_assumptions: [
          "Office managers can adopt a new workflow without resistance from dentists or billing staff.",
          "Insurance edge cases are limited enough that automation remains credible after onboarding.",
        ],
        strengthening_moves: [
          "Narrow the first wedge to one recurring verification workflow before expanding the product surface.",
          "Build a proof-led sales motion around measured hours saved and claim follow-up reduction.",
        ],
      }),
    });
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await dismissOnboardingIfPresent(page);

  const defineState = await collectScrollableNodes(page, "define");
  assertSingleScrollOwner(defineState);

  await moveToClarify(page);

  const clarifyState = await collectScrollableNodes(page, "clarify");
  assertSingleScrollOwner(clarifyState);

  await answerClarifications(page);

  const verdictButton = page.getByRole("button", { name: /show me the breakdown/i });
  if (await verdictButton.count()) {
    const verdictState = await collectScrollableNodes(page, "verdict");
    assertSingleScrollOwner(verdictState);

    await verdictButton.click();
    await page.waitForTimeout(1200);

    const breakdownState = await collectScrollableNodes(page, "breakdown-390");
    assertSingleScrollOwner(breakdownState);

    await page.setViewportSize({ width: 320, height: 740 });
    await page.waitForTimeout(1000);
    assertSingleScrollOwner(await collectScrollableNodes(page, "breakdown-320"));

    await page.setViewportSize({ width: 1024, height: 900 });
    await page.waitForTimeout(1000);
    assertSingleScrollOwner(await collectScrollableNodes(page, "breakdown-1024"));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1000);
    assertSingleScrollOwner(await collectScrollableNodes(page, "breakdown-390-return"));
  }

  await browser.close();
  console.log("Scroll audit passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
