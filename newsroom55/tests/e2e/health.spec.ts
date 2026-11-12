import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const media =
  process.env.SCREENSHOT_DIR || path.resolve("/cursor/stores/self/media");

test("health administration, privacy and display authorization", async ({
  page,
  context,
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
  const toggleBox = await page
    .locator(".health-toggle input[type=checkbox]")
    .first()
    .boundingBox();
  expect(toggleBox?.width).toBeLessThan(50);
  expect(toggleBox?.height).toBeLessThan(30);

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

  const board = await context.newPage();
  await board.setViewportSize({ width: 1920, height: 1080 });
  await board.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    board.getByRole("region", { name: "Écran non autorisé" }),
  ).toBeVisible();
  const pairingCode = (
    await board.locator(".nr-pulse-pairing-code").textContent()
  )?.trim();
  expect(pairingCode).toMatch(/^\d{3} \d{3}$/);
  const pairingDestination = path.join(media, "newsroom-health-board-pairing.png");
  await board.screenshot({ path: pairingDestination, fullPage: false });
  expect(fs.existsSync(pairingDestination)).toBe(true);
  const repeatedCodes = await page.evaluate(async () => {
    const codes: string[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch("/api/pulse/display-pairing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const data = (await response.json()) as { code: string };
      codes.push(data.code);
    }
    return codes;
  });
  expect(new Set(repeatedCodes)).toEqual(
    new Set([pairingCode!.replace(/\s/g, "")]),
  );
  await page
    .getByRole("textbox", { name: "Code affiché sur le Board" })
    .fill(pairingCode!);
  await page.getByRole("button", { name: "Autoriser le Board" }).click();
  await expect(page.getByText(/Le Board est autorisé/)).toBeVisible();
  await expect(board.getByText("Indicateurs personnels masqués.")).toBeVisible({
    timeout: 10_000,
  });
  const privatePayload = await page.evaluate(async () => {
    const pulse = await fetch("/api/pulse");
    return {
      status: pulse.status,
      cache: pulse.headers.get("cache-control"),
      body: await pulse.json(),
    };
  });
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
  await board.close();
});
