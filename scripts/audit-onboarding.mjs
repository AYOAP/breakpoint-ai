import { chromium } from "playwright";

const baseUrl = process.argv[2] || process.env.AUDIT_URL || "http://127.0.0.1:3026";

const viewports = [
  { width: 320, height: 740, label: "mobile-320" },
  { width: 390, height: 844, label: "mobile-390" },
  { width: 1024, height: 900, label: "desktop-1024" },
];

async function assertOnboardingFocusTrap(page, label) {
  await page.getByRole("dialog").waitFor();

  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    const state = await page.evaluate(() => {
      const active = document.activeElement;
      const dialog = document.querySelector('[role="dialog"]');

      return {
        activeTag: active?.tagName?.toLowerCase() || null,
        activeText: (active?.textContent || active?.getAttribute?.("aria-label") || "").trim().slice(0, 60),
        insideDialog: Boolean(dialog && active && dialog.contains(active)),
      };
    });

    if (!state.insideDialog) {
      throw new Error(
        `${label}: keyboard focus escaped the onboarding dialog to ${state.activeTag ?? "unknown"} "${state.activeText}".`,
      );
    }
  }
}

async function assertFocusAfterDismiss(page, label) {
  await page.waitForFunction(() => document.activeElement?.tagName?.toLowerCase() === "textarea");
  const activeTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase() || null);

  if (activeTag !== "textarea") {
    throw new Error(`${label}: focus did not return to the main intake textarea after dismissing onboarding.`);
  }
}

async function assertDocumentStructure(page, label) {
  const state = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const hasLabel = (field) => {
      const ariaLabel = field.getAttribute("aria-label");
      const ariaLabelledBy = field.getAttribute("aria-labelledby");
      const id = field.getAttribute("id");

      if (ariaLabel || ariaLabelledBy) {
        return true;
      }

      if (!id) {
        return false;
      }

      return Boolean(document.querySelector(`label[for="${id}"]`));
    };

    const landmarkSelector =
      "header, nav, main, footer, aside, section[aria-label], section[aria-labelledby], [role='banner'], [role='navigation'], [role='main'], [role='contentinfo'], [role='complementary'], [role='region']";
    const textNodesOutsideLandmarks = Array.from(document.querySelectorAll("body *"))
      .filter((element) => {
        if (!(element instanceof HTMLElement) || !isVisible(element)) {
          return false;
        }

        if (element.closest(".sr-only")) {
          return false;
        }

        if (element.closest(landmarkSelector) || element.matches("script, style")) {
          return false;
        }

        return Array.from(element.childNodes).some(
          (node) => node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim().length > 0,
        );
      })
      .slice(0, 10)
      .map((element) => element.tagName.toLowerCase());

    const currentStep = document.querySelector('[aria-current="step"]');
    const textareas = Array.from(document.querySelectorAll("textarea")).map((field) => ({
      id: field.id || null,
      labelled: hasLabel(field),
      describedBy: field.getAttribute("aria-describedby"),
    }));

    return {
      h1Count: document.querySelectorAll("h1").length,
      hasMain: Boolean(document.querySelector("main#breakpoint-main")),
      hasHeader: Boolean(document.querySelector("header")),
      hasProgressNav: Boolean(document.querySelector('nav[aria-label="Workflow progress"]')),
      hasLiveRegion: Boolean(document.querySelector('[aria-live="polite"][role="status"]')),
      hasCurrentStep: Boolean(currentStep),
      textareas,
      textNodesOutsideLandmarks,
    };
  });

  if (state.h1Count !== 1) {
    throw new Error(`${label}: expected exactly one h1, found ${state.h1Count}.`);
  }

  if (!state.hasMain || !state.hasHeader || !state.hasProgressNav || !state.hasLiveRegion || !state.hasCurrentStep) {
    throw new Error(`${label}: missing a required landmark or workflow status region.`);
  }

  const unlabeledField = state.textareas.find((field) => !field.labelled);

  if (unlabeledField) {
    throw new Error(`${label}: found an unlabeled textarea${unlabeledField.id ? ` (${unlabeledField.id})` : ""}.`);
  }

  if (state.textNodesOutsideLandmarks.length) {
    throw new Error(`${label}: found visible content outside landmarks: ${state.textNodesOutsideLandmarks.join(", ")}.`);
  }
}

async function assertInfoHint(page, label) {
  const hint = page.locator("button[aria-expanded]").first();

  if (!(await hint.count())) {
    throw new Error(`${label}: no explainer hint button was rendered.`);
  }

  const before = await hint.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    return {
      height: rect.height,
      width: rect.width,
      controls: button.getAttribute("aria-controls"),
      expanded: button.getAttribute("aria-expanded"),
    };
  });

  if (before.width < 32 || before.height < 32) {
    throw new Error(`${label}: explainer hint button is smaller than 32px.`);
  }

  await hint.click();

  const after = await hint.evaluate((button) => ({
    controls: button.getAttribute("aria-controls"),
    describedBy: button.getAttribute("aria-describedby"),
    expanded: button.getAttribute("aria-expanded"),
  }));

  if (after.expanded !== "true" || !after.controls || !after.describedBy || after.controls !== after.describedBy) {
    throw new Error(`${label}: explainer hint button does not expose linked tooltip semantics when opened.`);
  }
}

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
  await assertOnboardingFocusTrap(page, `${viewport.label}-focus`);
  await page.getByRole("button", { name: /next step/i }).click();
  await page.getByRole("heading", { name: /answer the pressure questions/i }).waitFor();
  await assertModalFits(page, `${viewport.label}-step-2`);
  await page.getByRole("button", { name: /next step/i }).click();
  await page.getByRole("heading", { name: /read the verdict, then the memo/i }).waitFor();
  await assertModalFits(page, `${viewport.label}-step-3`);
  await page.getByRole("button", { name: /start pressure test/i }).click();
  await page.getByText(/what are you thinking of building/i).waitFor();
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await assertFocusAfterDismiss(page, `${viewport.label}-dismiss`);
  await assertDocumentStructure(page, `${viewport.label}-define`);

  await page.locator("textarea").first().fill(
    "A workflow platform for independent dental offices that automates insurance verification and claim follow-up for front-desk teams.",
  );
  await page.getByRole("button", { name: /calibrate pressure test/i }).click();
  await page.getByRole("heading", { name: /how developed is this idea right now/i }).waitFor();
  await assertInfoHint(page, `${viewport.label}-calibrate`);

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
