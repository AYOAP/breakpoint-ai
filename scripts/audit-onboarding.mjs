import { chromium } from "playwright";

const baseUrl = process.argv[2] || process.env.AUDIT_URL || "http://127.0.0.1:3026";

const viewports = [
  { width: 320, height: 740, label: "mobile-320" },
  { width: 390, height: 844, label: "mobile-390" },
  { width: 1024, height: 900, label: "desktop-1024" },
];

async function assertModalFits(page, label) {
  const state = await page.locator('[role="dialog"]').evaluate((dialog) => {
    const rect = dialog.getBoundingClientRect();
    const style = getComputedStyle(dialog);

    return {
      bottom: rect.bottom,
      clientHeight: dialog.clientHeight,
      overflowY: style.overflowY,
      scrollHeight: dialog.scrollHeight,
      top: rect.top,
      viewportHeight: window.innerHeight,
    };
  });

  const fitsViewport = state.top >= 0 && state.bottom <= state.viewportHeight;
  const handlesOverflowInternally =
    ["auto", "scroll", "overlay"].includes(state.overflowY) && state.scrollHeight > state.clientHeight + 2;

  if (!fitsViewport && !handlesOverflowInternally) {
    throw new Error(`${label}: onboarding dialog exceeds the viewport without an internal scroll path.`);
  }
}

async function runOnboardingPass(browser, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.localStorage.removeItem("breakpoint-onboarding-seen");
  });
  await page.reload({ waitUntil: "networkidle" });

  await page.getByText(/how breakpoint works/i).waitFor();
  await assertModalFits(page, viewport.label);
  await page.getByRole("button", { name: /next step/i }).click();
  await page.getByRole("heading", { name: /answer the pressure questions/i }).waitFor();
  await assertModalFits(page, `${viewport.label}-step-2`);
  await page.getByRole("button", { name: /next step/i }).click();
  await page.getByRole("heading", { name: /read the verdict, then the memo/i }).waitFor();
  await assertModalFits(page, `${viewport.label}-step-3`);
  await page.getByRole("button", { name: /start pressure test/i }).click();
  await page.getByText(/what are you thinking of building/i).waitFor();

  await page.reload({ waitUntil: "networkidle" });

  if (await page.getByText(/how breakpoint works/i).count()) {
    throw new Error("Onboarding modal still appears after first dismissal.");
  }

  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  for (const viewport of viewports) {
    await runOnboardingPass(browser, viewport);
  }

  await browser.close();
  console.log("Onboarding audit passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
