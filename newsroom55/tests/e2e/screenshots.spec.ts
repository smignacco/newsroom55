import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const media = process.env.SCREENSHOT_DIR || path.resolve("/cursor/stores/self/media");

function ensureDir() {
  fs.mkdirSync(media, { recursive: true });
}

test.describe("Centre de nouvelles visual board", () => {
  test("1920x1080 board", async ({ page }) => {
    ensureDir();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByText("CENTRE DE NOUVELLES")).toBeVisible();
    await expect(page.locator('img[src="/cisco-logo.png"]')).toBeVisible();
    await expect(page.getByText(/Actualisation (\d{2}:\d{2}|imminente)/)).toBeVisible();
    await expect(page.getByTestId("iptv-wait")).toBeVisible();
    await expect(page.getByText("Marchés", { exact: true })).toBeVisible();
    const dest = path.join(media, "newsroom-1920x1080.png");
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });

  test("3840x2160 board", async ({ page }) => {
    ensureDir();
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByText("INFORMATION EN CONTINU")).toBeVisible();
    const dest = path.join(media, "newsroom-3840x2160.png");
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });

  test("1366x768 board", async ({ page }) => {
    ensureDir();
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByText("CENTRE DE NOUVELLES")).toBeVisible();
    const dest = path.join(media, "newsroom-1366x768.png");
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });

  test("IPTV channel overlay", async ({ page }) => {
    ensureDir();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("iptv-wait").click();
    await expect(page.getByRole("dialog", { name: "Channel selection" })).toBeVisible({ timeout: 10_000 });
    const dest = path.join(media, "newsroom-iptv-wait.png");
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });

  test("admin console", async ({ page }) => {
    ensureDir();
    const user = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    test.skip(!user || !password, "ADMIN_USERNAME / ADMIN_PASSWORD not set");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/login");
    await page.locator('input[autocomplete="username"]').fill(user!);
    await page.locator('input[type="password"]').fill(password!);
    await page.getByRole("button", { name: "Enter" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Sources")).toBeVisible();
    await expect(page.getByText("BBC News")).toBeVisible();
    await page.getByRole("button", { name: "Finance" }).click();
    await expect(page.getByRole("heading", { name: "Actions et fonds" })).toBeVisible();
    await page
      .getByRole("textbox", { name: "Rechercher une entreprise ou un fonds" })
      .fill("Cisco");
    await page.getByRole("button", { name: "Rechercher" }).click();
    await expect(page.getByText(/CISCO SYS/i).first()).toBeVisible();
    const financeDest = path.join(media, "newsroom-finance-admin.png");
    await page.screenshot({ path: financeDest, fullPage: false });
    expect(fs.existsSync(financeDest)).toBe(true);
    await page.getByRole("button", { name: "Television" }).click();
    await expect(page.getByRole("heading", { name: "Gestion des stations" })).toBeVisible();
    await expect(page.getByText("Listes du dépôt")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ajouter" }).first()).toBeEnabled();
    await expect(page.getByRole("button", { name: "Synchroniser maintenant" })).toBeVisible();
    await expect(page.locator(".tv-playlist-card").first()).toBeVisible();
    const admin = page.locator(".nr-admin");
    expect(
      await admin.evaluate((element) => element.scrollHeight > element.clientHeight),
    ).toBe(true);
    await admin.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect
      .poll(() => admin.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await admin.evaluate((element) => element.scrollTo(0, 0));
    const dest = path.join(media, "newsroom-admin.png");
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".nr-admin-nav")).toBeVisible();
    expect(
      await admin.evaluate((element) => element.scrollHeight > element.clientHeight),
    ).toBe(true);
    await admin.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect
      .poll(() => admin.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
  });

  test("mobile remote control", async ({ page }) => {
    ensureDir();
    const user = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    test.skip(!user || !password, "ADMIN_USERNAME / ADMIN_PASSWORD not set");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/remote");
    await expect(page).toHaveURL(/\/admin\/login\?next=(?:%2F|\/)remote$/);
    await page.locator('input[autocomplete="username"]').fill(user!);
    await page.locator('input[type="password"]').fill(password!);
    await page.getByRole("button", { name: "Enter" }).click();
    await expect(page).toHaveURL(/\/remote$/);
    await expect(page.getByRole("heading", { name: "Télécommande" })).toBeVisible();
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      "/apple-touch-icon.png",
    );
    expect(
      await page.evaluate(() =>
        fetch("/manifest.webmanifest").then((response) => response.json()),
      ),
    ).toMatchObject({ start_url: "/remote", display: "standalone" });
    await expect(page.getByRole("button", { name: /Mettre en veille|Réafficher/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Diminuer le volume" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Augmenter le volume" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Quitter Halfwake" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
    await expect(page.getByLabel("Chaîne de la source 1")).toBeVisible();
    await expect(page.locator(".remote-view-picker")).toContainText("Focus");
    await expect(page.getByRole("button", { name: /Audio actif|Écouter/ })).toBeVisible();
    expect(
      await page.evaluate(() =>
        fetch("/api/admin/control", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ muted: true }),
        }).then((response) => response.status),
      ),
    ).toBe(403);

    const audio = page.getByRole("button", { name: /Réactiver le son|Couper le son/ });
    const before = await audio.textContent();
    await audio.click();
    await expect(audio).not.toHaveText(before ?? "");

    const dest = path.join(media, "newsroom-remote.png");
    await page.screenshot({ path: dest, fullPage: true });
    expect(fs.existsSync(dest)).toBe(true);
    await page.setViewportSize({ width: 390, height: 500 });
    const remote = page.locator(".remote-shell");
    expect(
      await remote.evaluate((element) => element.scrollHeight > element.clientHeight),
    ).toBe(true);
    await remote.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect
      .poll(() => remote.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await remote.evaluate((element) => element.scrollTo(0, 0));
    if ((await audio.textContent())?.includes("Couper le son")) {
      await audio.click();
      await expect(audio).toContainText("Réactiver le son");
    }
  });
});
