import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const media =
  process.env.SCREENSHOT_DIR || path.resolve("/cursor/stores/self/media");

function ensureDir() {
  fs.mkdirSync(media, { recursive: true });
}

test.describe("Centre de nouvelles visual board", () => {
  test("1920x1080 board", async ({ page }) => {
    ensureDir();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("CENTRE DE NOUVELLES")).toBeVisible();
    await expect(page.locator('img[src="/cisco-logo.png"]')).toBeVisible();
    await expect(
      page.getByText(/Actualisation (\d{2}:\d{2}|imminente)/),
    ).toBeVisible();
    await expect(page.getByTestId("iptv-wait")).toBeVisible();
    await expect(page.getByText("Marchés", { exact: true })).toBeVisible();
    const dest = path.join(media, "newsroom-1920x1080.png");
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
    await page
      .getByRole("button", { name: "Mettre l’affichage en veille" })
      .click();
    await expect(
      page.getByRole("button", { name: "Réactiver l’affichage" }),
    ).toBeVisible();
    const standbyDest = path.join(media, "newsroom-display-standby.png");
    await page.screenshot({ path: standbyDest, fullPage: false });
    expect(fs.existsSync(standbyDest)).toBe(true);
    await page
      .getByRole("button", { name: "Réactiver l’affichage" })
      .click();
    await expect(
      page.getByRole("button", { name: "Réactiver l’affichage" }),
    ).toBeHidden();
  });

  test("3840x2160 board", async ({ page }) => {
    ensureDir();
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("INFORMATION EN CONTINU")).toBeVisible();
    const dest = path.join(media, "newsroom-3840x2160.png");
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });

  test("1366x768 board", async ({ page }) => {
    ensureDir();
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("CENTRE DE NOUVELLES")).toBeVisible();
    const headlines = page.locator(".nr-headlines");
    expect(
      await headlines.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);
    await expect
      .poll(() => headlines.evaluate((element) => element.scrollTop), {
        timeout: 7_000,
      })
      .toBeGreaterThan(0);
    const dest = path.join(media, "newsroom-1366x768.png");
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });

  test("board tile menu, ticker and pulse fixture", async ({ page }) => {
    ensureDir();
    await page.route("**/api/pulse", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "cache-control": "private, no-store" },
        body: JSON.stringify({
          generatedAt: "2026-11-13T18:00:00.000Z",
          lastSyncAt: "2026-11-13T17:58:00.000Z",
          stale: false,
          privacyMode: false,
          activity: {
            date: "2026-11-13",
            steps: 6400,
            exerciseMinutes: 35,
            activeEnergyKcal: 420,
            dailyStepsGoal: 8000,
            dailyExerciseGoal: 30,
            weeklyExerciseMinutes: 120,
            weeklyGoalMinutes: 150,
            activeDays: 3,
            days: [
              { date: "2026-11-07", label: "SA", minutes: 20, status: "recorded" },
              { date: "2026-11-08", label: "DI", minutes: null, status: "missing" },
              { date: "2026-11-09", label: "LU", minutes: 40, status: "recorded" },
              { date: "2026-11-10", label: "MA", minutes: 15, status: "recorded" },
              { date: "2026-11-11", label: "ME", minutes: null, status: "missing" },
              { date: "2026-11-12", label: "JE", minutes: 30, status: "recorded" },
              { date: "2026-11-13", label: "VE", minutes: 35, status: "recorded" },
            ],
          },
          sleep: {
            lastNight: {
              nightDate: "2026-11-12",
              totalMinutes: 420,
              inBedMinutes: 450,
              awakeMinutes: 20,
              coreMinutes: 220,
              deepMinutes: 80,
              remMinutes: 100,
              sourceUpdatedAt: "2026-11-13T12:00:00.000Z",
            },
            averageMinutes: 410,
            nightsUsed: 5,
            incompleteHistory: true,
            targetMinutes: 480,
            showAverage: true,
            showPhases: true,
            trend: [{ nightDate: "2026-11-12", totalMinutes: 420 }],
          },
        }),
      });
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Marchés", { exact: true })).toBeVisible();
    const tickerEl = page.locator(".nr-ticker").first();
    await expect(tickerEl).toBeVisible();
    const ticker = path.join(media, "newsroom-ticker.png");
    await page.screenshot({ path: ticker, fullPage: false });
    expect(fs.existsSync(ticker)).toBe(true);

    const pulse = page.getByTestId("pulse-visual");
    if ((await pulse.count()) > 0) {
      const pulseDest = path.join(media, "newsroom-pulse.png");
      await page.screenshot({ path: pulseDest, fullPage: false });
      expect(fs.existsSync(pulseDest)).toBe(true);
    }

    const tile = page.getByRole("button", { name: /Toucher pour le menu/ }).first();
    if ((await tile.count()) > 0) {
      await tile.click();
    } else {
      await page.getByRole("button", { name: "Choisir une source" }).click();
    }
    await expect(page.getByTestId("layout-dock")).toBeVisible();
    await expect(page.getByTestId("layout-count-1")).toBeVisible();
    await expect(page.getByTestId("layout-count-4")).toBeVisible();
    await expect(page.getByTestId("layout-mode-focus")).toBeVisible();
    await expect(page.getByTestId("tile-context-menu")).toBeVisible();
    await expect(page.getByRole("button", { name: "Activer l’audio" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Couper l’audio" })).toBeVisible();
    const menuDest = path.join(media, "newsroom-board-tile-menu.png");
    await page.screenshot({ path: menuDest, fullPage: false });
    expect(fs.existsSync(menuDest)).toBe(true);
  });

  test("IPTV channel overlay", async ({ page }) => {
    ensureDir();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Choisir une source" }).click();
    await expect(page.getByTestId("tile-context-menu")).toBeVisible({
      timeout: 10_000,
    });
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
    await expect(
      page.getByRole("heading", { name: "Actions et fonds" }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Rechercher une entreprise ou un fonds" })
      .fill("Cisco");
    await page.getByRole("button", { name: "Rechercher" }).click();
    await expect(page.getByText(/CISCO SYS/i).first()).toBeVisible();
    const financeDest = path.join(media, "newsroom-finance-admin.png");
    await page.screenshot({ path: financeDest, fullPage: false });
    expect(fs.existsSync(financeDest)).toBe(true);
    await page.getByRole("button", { name: "Television" }).click();
    await expect(
      page.getByRole("heading", { name: "Gestion des stations" }),
    ).toBeVisible();
    await expect(page.getByText("Listes du dépôt")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ajouter" }).first(),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Synchroniser maintenant" }),
    ).toBeVisible();
    await expect(page.locator(".tv-playlist-card").first()).toBeVisible();
    const admin = page.locator(".nr-admin");
    expect(
      await admin.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);
    await admin.evaluate((element) =>
      element.scrollTo(0, element.scrollHeight),
    );
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
      await admin.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);
    await admin.evaluate((element) =>
      element.scrollTo(0, element.scrollHeight),
    );
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
    await expect(
      page.getByRole("heading", { name: "Télécommande" }),
    ).toBeVisible();
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      "/apple-touch-icon.png",
    );
    expect(
      await page.evaluate(() =>
        fetch("/manifest.webmanifest").then((response) => response.json()),
      ),
    ).toMatchObject({ start_url: "/remote", display: "standalone" });
    await expect(
      page.getByRole("button", {
        name: /Mettre en veille|Réafficher NEWSROOM|Activer le Board/,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/Board synchronisé|État du Board indisponible/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Diminuer le volume" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Augmenter le volume" }),
    ).toBeVisible();
    await expect(page.getByText("SOUS-TITRES")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
    await expect(page.getByLabel("Chaîne de la source 1")).toBeVisible();
    await expect(page.locator(".remote-view-picker")).toContainText("Focus");
    await expect(page.getByRole("heading", { name: "Réglages" })).toBeVisible();
    await expect(page.getByLabel("Afficher le panneau")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Recharger l’écran/ }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nouvelles" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Audio actif|Écouter/ }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        fetch("/api/admin/control", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ muted: true }),
        }).then((response) => response.status),
      ),
    ).toBe(403);

    const audioSource = page.getByLabel("Source audio");
    const configuredAudioValue = await audioSource
      .locator("option")
      .nth(1)
      .getAttribute("value");
    expect(configuredAudioValue).toBeTruthy();
    await audioSource.selectOption(configuredAudioValue!);
    await expect
      .poll(() =>
        page.evaluate(() =>
          fetch("/api/admin/control")
            .then((response) => response.json())
            .then((control) => control.muted),
        ),
      )
      .toBe(false);
    await audioSource.selectOption("");
    await expect(audioSource).toHaveValue("");
    await expect
      .poll(() =>
        page.evaluate(() =>
          fetch("/api/admin/control")
            .then((response) => response.json())
            .then((control) => control.muted),
        ),
      )
      .toBe(true);

    const audio = page
      .locator(".remote-quick-action")
      .filter({ hasText: /Réactiver le son|Couper le son/ });
    const before = await audio.textContent();
    await audio.click();
    await expect(audio).not.toHaveText(before ?? "");

    const focusMode = page
      .locator(".remote-view-picker")
      .getByRole("button", { name: "Focus" });
    if (await focusMode.isDisabled()) {
      await page.locator(".remote-layout-picker").getByRole("button", { name: "2" }).click();
      await expect(focusMode).toBeEnabled();
    }
    await focusMode.click();
    if ((await audio.textContent())?.includes("Couper le son")) {
      await audio.click();
      await expect(audio).toContainText("Réactiver le son");
    }

    const dest = path.join(media, "newsroom-remote.png");
    await page.screenshot({ path: dest, fullPage: true });
    expect(fs.existsSync(dest)).toBe(true);
    await page.setViewportSize({ width: 390, height: 500 });
    const remote = page.locator(".remote-shell");
    expect(
      await remote.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);
    await remote.evaluate((element) =>
      element.scrollTo(0, element.scrollHeight),
    );
    await expect
      .poll(() => remote.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await remote.evaluate((element) => element.scrollTo(0, 0));
    const storyButton = page.locator(".remote-story-list button").first();
    await expect(storyButton).toBeVisible();
    const board = await page.context().newPage();
    await board.setViewportSize({ width: 1920, height: 1080 });
    await board.goto("/", { waitUntil: "domcontentloaded" });
    const videoBefore = await board.locator("video").first().elementHandle();
    const videoWasPlaying = videoBefore
      ? await videoBefore.evaluate((element) => {
          const video = element as HTMLVideoElement;
          return !video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
        })
      : false;
    await storyButton.click();
    await expect(board.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await expect(board.locator(".nr-story-modal-site")).toBeVisible();
    const videoAfter = await board.locator("video").first().elementHandle();
    if (videoWasPlaying && videoBefore && videoAfter) {
      expect(
        await videoBefore.evaluate((node, comparison) => node === comparison, videoAfter),
      ).toBe(true);
    }
    const modalDest = path.join(media, "newsroom-remote-story-modal.png");
    await board.screenshot({ path: modalDest, fullPage: false });
    expect(fs.existsSync(modalDest)).toBe(true);

    await page.getByRole("button", { name: "Fermer la nouvelle à l’écran" }).click();
    await expect(board.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
    const boardReloaded = board.waitForEvent("load");
    await page.getByRole("button", { name: /Recharger l’écran/ }).click();
    await boardReloaded;
    await expect(board.getByText("CENTRE DE NOUVELLES")).toBeVisible();
    await board.close();
  });
});
