import assert from "node:assert/strict";
import { mkdir, readdir, access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const artifactDir = resolve(root, "output", "playwright");
const port = Number(process.env.PORT || 50577);
const host = "127.0.0.1";
const serverUrl = `http://${host}:${port}`;

await mkdir(artifactDir, { recursive: true });

const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", host, "--port", String(port), "--strictPort"],
  {
    cwd: root,
    env: { ...process.env, SKILL_SEARCH_REFRESH_MODE: "mock" },
    stdio: "pipe",
    windowsHide: true
  }
);

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForServer(serverUrl);
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1280, height: 768 } });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(serverUrl, { waitUntil: "networkidle" });
  await expectCatalogReady(page);

  const initialCount = await page.evaluate(() => window.__AI_SKILL_CATALOG__?.count());
  assert.equal(initialCount, 1000, "catalog should expose 1000 GitHub-derived records");

  assert.equal(await page.getByTestId("prev-page").isDisabled(), true, "previous page should be disabled on the first page");

  await page.locator("#filterButton").click();
  assert.equal(await page.locator(".filter-row").evaluate((node) => node.classList.contains("is-focused")), true, "filter button should toggle focused filter state");

  for (const selector of ["#categoryFilter", "#agentFilter", "#languageFilter", "#licenseFilter", "#starsFilter"]) {
    await selectFirstNonAll(page, selector);
    await page.waitForFunction(() => window.__AI_SKILL_CATALOG__?.visibleCount() >= 0);
    assert.equal(await page.locator(selector).inputValue().then((value) => value !== "all"), true, `${selector} should accept a non-default value`);
    await page.getByTestId("reset-filters").click();
    await page.waitForFunction(() => window.__AI_SKILL_CATALOG__?.visibleCount() === 1000);
  }

  await page.getByTestId("catalog-search").fill("zzzz-no-match-skill-pack");
  await page.getByTestId("search-button").click();
  await page.waitForFunction(() => window.__AI_SKILL_CATALOG__?.visibleCount() === 0);
  assert((await page.getByTestId("detail-panel").innerText()).includes("一致する候補がありません"), "zero-result state should be visible");
  await page.getByTestId("reset-filters").click();
  await page.waitForFunction(() => window.__AI_SKILL_CATALOG__?.visibleCount() === 1000);
  assert.equal(await page.getByTestId("catalog-search").inputValue(), "", "reset should clear search text");

  await page.getByTestId("catalog-search").fill("agent");
  await page.getByTestId("search-button").click();
  await page.waitForFunction(() => window.__AI_SKILL_CATALOG__?.visibleCount() > 0);
  const searchCount = await page.evaluate(() => window.__AI_SKILL_CATALOG__.visibleCount());
  assert(searchCount > 0 && searchCount <= 1000, "search should narrow or preserve matching records");

  await page.locator("#scriptFilter").selectOption("yes");
  await page.waitForFunction(() => window.__AI_SKILL_CATALOG__?.visibleCount() > 0);
  const selected = await page.evaluate(() => window.__AI_SKILL_CATALOG__.selected());
  assert.equal(selected.scriptsIncluded, true, "script filter should select likely script records");

  await page.locator("button[data-favorite]").first().click();
  assert.equal(await page.evaluate(() => window.__AI_SKILL_CATALOG__.favorites()), 1, "favorite toggle should update state");
  await page.locator("button[data-favorite]").first().click();
  assert.equal(await page.evaluate(() => window.__AI_SKILL_CATALOG__.favorites()), 0, "favorite toggle should remove saved state");
  await page.locator("button[data-favorite]").first().click();

  await page.locator("input[data-compare]").first().check();
  assert.equal(await page.evaluate(() => window.__AI_SKILL_CATALOG__.compare()), 1, "compare checkbox should update state");

  const detailText = await page.getByTestId("detail-panel").innerText();
  const selectedAfterActions = await page.evaluate(() => window.__AI_SKILL_CATALOG__.selected());
  assert(detailText.includes(selectedAfterActions.creator), "detail panel should show creator metadata");
  assert(detailText.includes("GitHubで見る"), "detail panel should expose GitHub action");

  await page.locator("button[data-collection]").click();
  assert.equal(await page.evaluate(() => window.__AI_SKILL_CATALOG__.collection()), 1, "collection detail action should update state");
  await page.locator("button[data-collection]").click();
  assert.equal(await page.evaluate(() => window.__AI_SKILL_CATALOG__.collection()), 0, "collection detail action should remove state");
  await page.locator("button[data-collection]").click();

  await page.locator("button[data-detail-compare]").click();
  assert.equal(await page.evaluate(() => window.__AI_SKILL_CATALOG__.compare()), 0, "detail compare action should remove compare state");
  await page.locator("button[data-detail-compare]").click();
  assert.equal(await page.evaluate(() => window.__AI_SKILL_CATALOG__.compare()), 1, "detail compare action should add compare state");

  await page.locator("#closeDetail").click();
  await page.waitForFunction(() => document.querySelector(".detail-card")?.classList.contains("is-collapsed"));
  await page.locator("button[data-select]").nth(1).click();
  await page.waitForFunction(() => !document.querySelector(".detail-card")?.classList.contains("is-collapsed"));

  await page.locator("button[data-nav='favorites']").click();
  assert((await page.getByTestId("mode-panel").innerText()).includes("お気に入り"), "favorites view should show status panel");
  await page.locator("button[data-nav='collection']").click();
  assert((await page.getByTestId("mode-panel").innerText()).includes("コレクション"), "collection view should show status panel");
  await page.locator("button[data-nav='compare']").click();
  assert((await page.getByTestId("mode-panel").innerText()).includes("比較"), "compare view should show status panel");
  await page.locator("button[data-nav='history']").click();
  assert((await page.getByTestId("mode-panel").innerText()).includes("履歴"), "history view should show status panel");

  await page.locator("button[data-nav='import']").click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("button[data-export-state]").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "skill-catalog-state.json", "state export should download a JSON file");
  await page.locator("button[data-sample-import]").click();
  assert.equal(await page.evaluate(() => window.__AI_SKILL_CATALOG__.favorites() > 0), true, "import sample should populate saved state");

  await page.locator("button[data-nav='settings']").click();
  await page.locator("button[data-density='compact']").click();
  assert.equal(await page.evaluate(() => document.body.dataset.density), "compact", "density setting should update body state");
  await page.locator("button[data-save-settings]").click();
  assert((await page.getByTestId("mode-panel").innerText()).includes("設定を保存しました"), "settings save should report success");

  await page.locator("button[data-theme='dark']").click();
  assert.equal(await page.evaluate(() => document.body.dataset.theme), "dark", "dark theme button should update body state");
  await page.locator("button[data-theme='light']").click();
  assert.equal(await page.evaluate(() => document.body.dataset.theme), "light", "light theme button should update body state");

  await page.locator("#refreshData").click();
  await page.waitForFunction(() => document.querySelector("[data-testid=mode-panel]")?.textContent?.includes("DBを更新しました"));
  assert((await page.getByTestId("mode-panel").innerText()).includes("DBを更新しました"), "refresh button should update the database through the API");

  await page.locator("#pageSize").selectOption("50");
  assert((await page.locator("#resultCount").innerText()).includes("1 - 50"), "page size should update visible range");
  await page.getByTestId("next-page").click();
  assert((await page.locator("#pageInfo").innerText()).startsWith("2 /"), "next page should advance pagination");
  await page.locator("#pageSize").selectOption("100");
  for (let index = 0; index < 20; index += 1) {
    if (await page.getByTestId("next-page").isDisabled()) break;
    await page.getByTestId("next-page").click();
  }
  assert.equal(await page.getByTestId("next-page").isDisabled(), true, "next page should disable on final page");

  const firstExternalHref = await page.locator("a.github-link").first().getAttribute("href");
  assert(firstExternalHref?.startsWith("https://github.com/"), "table GitHub link should point to GitHub");
  assert.equal(await page.locator("a.github-link").first().getAttribute("target"), "_blank", "table GitHub link should open a new tab");
  assert.equal(await page.locator("a.github-link").first().getAttribute("rel"), "noopener noreferrer", "table GitHub link should avoid referrer leakage");
  const detailHref = await page.locator("a.primary-link").getAttribute("href");
  assert(detailHref?.startsWith("https://github.com/"), "detail GitHub link should point to GitHub");
  assert.equal(await page.locator("a.primary-link").getAttribute("target"), "_blank", "detail GitHub link should open a new tab");
  assert.equal(await page.locator("a.primary-link").getAttribute("rel"), "noopener noreferrer", "detail GitHub link should avoid referrer leakage");
  const footerHref = await page.locator(".data-footer a").getAttribute("href");
  assert(footerHref?.includes("docs.github.com"), "footer source link should point to GitHub API docs");

  await page.getByTestId("reset-filters").click();
  await page.waitForFunction(() => window.__AI_SKILL_CATALOG__?.visibleCount() === 1000);
  await page.screenshot({ path: resolve(artifactDir, "ai-skill-catalog-smoke.png"), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await mobile.goto(serverUrl, { waitUntil: "networkidle" });
  await expectCatalogReady(mobile);
  const mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 4);
  assert.equal(mobileOverflow, false, "mobile layout should not create page-level horizontal overflow");
  await mobile.screenshot({ path: resolve(artifactDir, "ai-skill-catalog-mobile.png"), fullPage: true });

  await mobile.close();
  await browser.close();
  assert.deepEqual(consoleErrors, []);
  console.log(`ok - AI skill catalog verified ${serverUrl}`);
  console.log("ok - screenshots output/playwright/ai-skill-catalog-smoke.png and ai-skill-catalog-mobile.png");
} finally {
  server.kill();
}

async function launchChromium() {
  try {
    return await chromium.launch();
  } catch (error) {
    const fallback = await findCachedChromium();
    if (!fallback) throw error;
    return chromium.launch({ executablePath: fallback });
  }
}

async function findCachedChromium() {
  const root = "C:/Users/cxoxj/AppData/Local/ms-playwright";
  let entries = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return "";
  }
  const candidates = entries
    .filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const name of candidates) {
    const executable = `${root}/${name}/chrome-win64/chrome.exe`;
    try {
      await access(executable);
      return executable;
    } catch {
      // keep looking
    }
  }
  return "";
}

async function expectCatalogReady(page) {
  await page.getByRole("heading", { name: "AI Skill Pack Catalog" }).waitFor();
  await page.getByTestId("catalog-rows").waitFor();
  await page.waitForFunction(() => window.__AI_SKILL_CATALOG__?.count() === 1000);
}

async function waitForServer(url) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (server.exitCode !== null) {
      throw new Error(`Vite server exited early.\n${serverOutput}`);
    }
    if (await canConnect(url)) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Timed out waiting for ${url}.\n${serverOutput}`);
}

async function selectFirstNonAll(page, selector) {
  const value = await page.locator(selector).evaluate((select) => [...select.options].find((option) => option.value !== "all")?.value || "all");
  await page.locator(selector).selectOption(value);
}

function canConnect(url) {
  return new Promise((resolveConnect) => {
    fetch(url, { method: "HEAD" })
      .then((response) => resolveConnect(response.ok || response.status < 500))
      .catch(() => resolveConnect(false));
  });
}





