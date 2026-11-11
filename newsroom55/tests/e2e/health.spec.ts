import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const media =
  process.env.SCREENSHOT_DIR || path.resolve("/cursor/stores/self/media");

test("health administration, privacy and display authorization", async ({
  page,
}) => {
  const user = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  test.skip(!user || !password, "ADMIN_USERNAME / ADMIN_PASSWORD not set");

  fs.mkdirSync(media, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/login");
  await page.locator('input[autocomplete="username"]').fill(user!);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Activity & Sleep" }).click();
  await expect(
    page.getByRole("heading", { name: "Activity & Sleep Pulse" }),
  ).toBeVisible();

  await page
    .getByRole("checkbox", { name: /Afficher le panneau personnel/ })
    .check();
  await page.getByRole("checkbox", { name: /Mode confidentiel/ }).check();
  await page
    .getByRole("button", { name: "Enregistrer la configuration" })
    .click();
  await expect(
    page.getByText(/Configuration Activity & Sleep enregistrée/),
  ).toBeVisible();

  expect(
    await page.evaluate(() =>
      fetch("/api/pulse").then((response) => response.status),
    ),
  ).toBe(401);

  await page.getByRole("button", { name: "Autoriser cet écran" }).click();
  await expect(page.getByText(/Cet écran est autorisé/)).toBeVisible();
  const privatePayload = await page.evaluate(() =>
    fetch("/api/pulse").then(async (response) => ({
      status: response.status,
      cache: response.headers.get("cache-control"),
      body: await response.json(),
    })),
  );
  expect(privatePayload).toMatchObject({
    status: 200,
    cache: "private, no-store",
    body: { privacyMode: true },
  });
  expect(privatePayload.body).not.toHaveProperty("activity");
  expect(privatePayload.body).not.toHaveProperty("sleep");

  const destination = path.join(media, "newsroom-health-admin.png");
  await page.screenshot({ path: destination, fullPage: true });
  expect(fs.existsSync(destination)).toBe(true);
});
