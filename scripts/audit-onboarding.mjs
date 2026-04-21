import { chromium } from "playwright";

const baseUrl = process.argv[2] || process.env.AUDIT_URL || "http://127.0.0.1:3026";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  await page.goto(baseUrl, { waitUntil: "networkidle" });

  await page.getByText(/how breakpoint works/i).waitFor();
  await page.getByRole("button", { name: /next step/i }).click();
  await page.getByRole("heading", { name: /answer the pressure questions/i }).waitFor();
  await page.getByRole("button", { name: /next step/i }).click();
  await page.getByRole("heading", { name: /read the verdict, then the memo/i }).waitFor();
  await page.getByRole("button", { name: /start pressure test/i }).click();
  await page.getByText(/what are you thinking of building/i).waitFor();

  await page.reload({ waitUntil: "networkidle" });

  if (await page.getByText(/how breakpoint works/i).count()) {
    throw new Error("Onboarding modal still appears after first dismissal.");
  }

  await browser.close();
  console.log("Onboarding audit passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
