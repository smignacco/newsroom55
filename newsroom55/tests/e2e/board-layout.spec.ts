import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

const media =
  process.env.SCREENSHOT_DIR || path.resolve("/cursor/stores/self/media");

test("board layout dock switches 1–4 feeds and drag promotes focus", async ({
  page,
}) => {
  fs.mkdirSync(media, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("layout-dock")).toBeVisible();

  const four = page.getByTestId("layout-count-4");
  test.skip(
    (await four.getAttribute("disabled")) !== null,
    "Need four enabled catalogue channels to exercise multiview on the Board",
  );

  await four.click();
  await expect(page.locator(".nr-multiview-4")).toBeVisible();
  await expect(page.getByTestId("multiview-tile")).toHaveCount(4);
  await page.screenshot({
    path: path.join(media, "newsroom-board-layout-4.png"),
    fullPage: false,
  });

  const tile = page.getByTestId("multiview-tile").nth(1);
  const box = await tile.boundingBox();
  expect(box).toBeTruthy();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 90, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".nr-multiview-focus")).toBeVisible();
  await expect(page.getByTestId("layout-mode-focus")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.screenshot({
    path: path.join(media, "newsroom-board-layout-focus.png"),
    fullPage: false,
  });

  await page.getByTestId("layout-mode-grid").click();
  await expect(page.locator(".nr-multiview-focus")).toHaveCount(0);
  await page.getByTestId("layout-count-1").click();
  await expect(page.locator(".nr-multiview-1")).toBeVisible();
  await expect(page.getByTestId("multiview-tile")).toHaveCount(1);
});
