import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

const media = process.env.SCREENSHOT_DIR || path.resolve("/cursor/stores/self/media");

test("plays one enabled HLS channel through the signed proxy", async ({ page }) => {
  test.skip(process.env.PLAYBACK_SMOKE !== "1", "Run only with a temporary enabled smoke-test channel");
  fs.mkdirSync(media, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/", { waitUntil: "networkidle" });

  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState), { timeout: 45_000 })
    .toBeGreaterThanOrEqual(2);
  await expect(page.getByText("Diffusion en direct")).toBeVisible();
  await expect(page.locator(".nr-viewfinder.playing .nr-scan-line")).toBeHidden();

  const destination = path.join(media, "newsroom-hls-browser.png");
  await page.screenshot({ path: destination, fullPage: false });
  expect(fs.existsSync(destination)).toBe(true);
});
