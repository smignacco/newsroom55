import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

const media =
  process.env.SCREENSHOT_DIR || path.resolve("/cursor/stores/self/media");

test("board volume slider sits beside the layout dock", async ({ page }) => {
  fs.mkdirSync(media, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("layout-dock")).toBeVisible();
  const volume = page.getByTestId("board-volume");
  await expect(volume).toBeVisible();
  await volume.scrollIntoViewIfNeeded();
  const before = Number(await volume.getAttribute("aria-valuenow"));
  const volumeBox = await volume.boundingBox();
  expect(volumeBox).toBeTruthy();
  await page.mouse.move(volumeBox!.x + 10, volumeBox!.y + volumeBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    volumeBox!.x + volumeBox!.width - 8,
    volumeBox!.y + volumeBox!.height / 2,
    {
      steps: 6,
    },
  );
  await page.mouse.up();
  await expect
    .poll(async () => Number(await volume.getAttribute("aria-valuenow")))
    .toBeGreaterThan(before);
  await page.screenshot({
    path: path.join(media, "newsroom-board-volume.png"),
    fullPage: false,
  });
});

test("admin appearance exposes the Board startup volume", async ({ page }) => {
  const user = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  test.skip(!user || !password, "ADMIN_USERNAME / ADMIN_PASSWORD not set");
  fs.mkdirSync(media, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/login");
  await page.locator('input[autocomplete="username"]').fill(user!);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Appearance" }).click();
  await expect(page.getByLabel("Volume initial du Board")).toBeVisible();
  await page.screenshot({
    path: path.join(media, "newsroom-admin-volume.png"),
    fullPage: false,
  });
});

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
