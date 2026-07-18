import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __SSUAI_VITALS__?: {
      cls: number;
      lcp: number | null;
    };
  }
}

const PUBLIC_ROUTES = [
  { path: "/", name: "홈" },
  { path: "/chat", name: "챗봇" },
  { path: "/academics", name: "학사" },
  { path: "/library", name: "도서관" },
  { path: "/campus", name: "캠퍼스" },
] as const;

async function isolateFromLiveServices(page: Page) {
  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        code: "E2E_OFFLINE_FIXTURE",
        message: "브라우저 검증은 외부 학교 시스템을 호출하지 않습니다.",
      }),
    });
  });
}

async function observeWebVitals(page: Page) {
  await page.addInitScript(() => {
    window.__SSUAI_VITALS__ = { cls: 0, lcp: null };

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput) {
          window.__SSUAI_VITALS__!.cls += (entry as PerformanceEntry & { value: number }).value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });

    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries.at(-1);
      if (last) window.__SSUAI_VITALS__!.lcp = last.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
}

for (const route of PUBLIC_ROUTES) {
  test(`${route.name} 화면은 오프라인 상태에서도 탐색 가능하고 심각한 접근성 위반이 없다`, async ({
    page,
  }) => {
    await isolateFromLiveServices(page);
    await page.goto(route.path, { waitUntil: "networkidle" });

    await expect(page).toHaveURL(new RegExp(`${route.path === "/" ? "/?$" : `${route.path}/?$`}`));
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("navigation", { name: /주 메뉴|하단 탭/ }).first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(({ impact }) => impact === "critical" || impact === "serious");

    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}

test("모바일 첫 진입 스플래시는 종료 후 화면 이동 때 다시 표시되지 않는다", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile", "모바일 전용 시작 화면");

  await isolateFromLiveServices(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const splash = page.getByTestId("app-launch-splash");
  const splashImage = page.getByTestId("app-launch-splash-image");
  await expect(splash).toBeVisible();
  await expect(splashImage).toHaveCSS(
    "animation-name",
    /launch-splash-reveal.*launch-splash-breathe/,
  );

  await expect(splash).toHaveCount(0, { timeout: 5_000 });

  await page
    .getByRole("navigation", { name: "하단 탭" })
    .getByRole("link", { name: "챗봇" })
    .click();
  await expect(page).toHaveURL(/\/chat\/?$/);
  await expect(splash).toHaveCount(0);
});

test("홈의 실험실 Web Vitals 예산을 기록하고 지킨다", async ({ page }, testInfo) => {
  await isolateFromLiveServices(page);
  await observeWebVitals(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1_000);

  const vitals = await page.evaluate(() => window.__SSUAI_VITALS__);
  expect(vitals).toBeDefined();
  expect(vitals!.lcp, "Chromium이 LCP entry를 기록해야 한다").not.toBeNull();

  await testInfo.attach("web-vitals.json", {
    body: Buffer.from(JSON.stringify({ route: "/", mode: "local-offline", ...vitals }, null, 2)),
    contentType: "application/json",
  });

  expect(vitals!.lcp!).toBeLessThanOrEqual(2_500);
  expect(vitals!.cls).toBeLessThanOrEqual(0.1);
});
