import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataset = JSON.parse(await readFile(resolve(root, "src/data/ai-skill-packs.json"), "utf8"));
const source = await readFile(resolve(root, "src/main.js"), "utf8");
const styles = await readFile(resolve(root, "src/styles.css"), "utf8");
const html = await readFile(resolve(root, "index.html"), "utf8");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const vercel = JSON.parse(await readFile(resolve(root, "vercel.json"), "utf8"));
const vercelIgnore = await readFile(resolve(root, ".vercelignore"), "utf8");
const viteConfig = await readFile(resolve(root, "vite.config.mjs"), "utf8");
const catalogDb = await readFile(resolve(root, "tools/catalog-db.mjs"), "utf8");

assert.equal(dataset.count, 1000, "dataset count must stay at 1000");
assert.equal(dataset.records.length, 1000, "dataset records length must stay at 1000");
assert.equal(dataset.source, "GitHub REST Search API", "dataset source must be explicit");
assert(dataset.sourceDocs.startsWith("https://docs.github.com/"), "sourceDocs must be official GitHub docs");

for (const [index, record] of dataset.records.entries()) {
  assert(record.skillName, `record ${index} missing skillName`);
  assert(record.capability, `record ${index} missing capability`);
  assert(typeof record.scriptsIncluded === "boolean", `record ${index} missing scriptsIncluded boolean`);
  assert(record.creator, `record ${index} missing creator`);
  assert(/^https:\/\/github\.com\//.test(record.url), `record ${index} URL must be https://github.com/...`);
}

assert(source.includes("function safeUrl"), "main.js must keep URL allowlist function");
assert(!source.includes("rel=\"noreferrer\""), "external links must use noopener noreferrer");
assert(source.includes("rel=\"noopener noreferrer\""), "external links must include noopener noreferrer");
assert(!/href=\"\$\{record\.url\}\"/.test(source), "record.url must not be written directly into href");
assert(source.includes("/api/catalog"), "main.js must load catalog records from the database API");
assert(source.includes("/api/refresh"), "main.js must refresh catalog records through the database API");
assert(source.includes("seedCatalog"), "main.js must keep the static JSON as a fallback seed");
const unfinishedMarkers = ["TO" + "DO", "未" + "実装"];
for (const marker of unfinishedMarkers) {
  assert(!source.includes(marker), `main.js must not contain unfinished marker: ${marker}`);
  assert(!styles.includes(marker), `styles.css must not contain unfinished marker: ${marker}`);
}


for (const asset of [
  "curioshulab-logo-cropped.png",
  "catalog-icons/catalog.png",
  "catalog-icons/favorite.png",
  "catalog-icons/collection.png",
  "catalog-icons/compare.png",
  "catalog-icons/history.png",
  "catalog-icons/import.png",
  "catalog-icons/settings.png",
  "catalog-icons/search.png",
  "catalog-icons/filter.png",
  "catalog-icons/refresh.png",
  "catalog-icons/reset.png",
  "catalog-icons/close.png",
  "catalog-icons/external.png"
]) {
  await access(resolve(root, "src/assets", asset));
}

const rootEntries = new Set((await readdir(root, { withFileTypes: true })).map((entry) => entry.name));
for (const forbidden of [".expo", ".logs", "automation_outputs", "outputf", "generated_assets"]) {
  assert(!rootEntries.has(forbidden), `forbidden migration artifact present: ${forbidden}`);
}

assert(html.includes('AI Skill Pack Catalog'), "index.html must expose the current catalog shell");

assert(html.includes('/src/main.js'), "index.html must keep the Vite module entry");
assert.equal(pkg.scripts.build, "npm run web:build", "package must expose a standard build script for Vercel and local tooling");
assert.equal(pkg.scripts["db:init"], "node tools/init-catalog-db.mjs", "package must expose DB initialization script");
assert.equal(pkg.scripts["db:refresh"], "node tools/refresh-catalog-db.mjs", "package must expose DB refresh script");
assert.equal(pkg.private, true, "package must remain private unless publication is explicitly intended");
assert(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, "runtime dependencies should remain empty for this static app");
assert.equal(pkg.devDependencies.playwright, "1.60.0", "Playwright is pinned to verified local browser fallback behavior");
assert.equal(pkg.devDependencies.vite, "7.3.6", "Vite is pinned for reproducible builds");
assert(viteConfig.includes("/api/catalog") && viteConfig.includes("/api/refresh"), "Vite config must expose catalog API and refresh API");
assert(catalogDb.includes("data/catalog.sqlite"), "catalog DB must use local SQLite storage");

assert.equal(vercel.framework, "vite", "Vercel framework must be fixed to Vite");
assert.equal(vercel.installCommand, "npm ci --ignore-scripts", "Vercel install must avoid lifecycle scripts");
assert.equal(vercel.buildCommand, "npm run web:build", "Vercel build command must match production build");
assert.equal(vercel.outputDirectory, "dist", "Vercel output directory must be dist");
assert.deepEqual(vercel.rewrites, [{ source: "/(.*)", destination: "/index.html" }], "Vercel SPA rewrite must serve index.html");

const allHeaders = vercel.headers?.flatMap((entry) => entry.headers ?? []) ?? [];
const headerKeys = new Set(allHeaders.map((header) => header.key));
for (const requiredHeader of [
  "Content-Security-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "Permissions-Policy",
  "Cache-Control"
]) {
  assert(headerKeys.has(requiredHeader), `Vercel missing production header: ${requiredHeader}`);
}
assert(!allHeaders.find((header) => header.key === "Content-Security-Policy")?.value.includes("unsafe-inline"), "CSP must not allow unsafe-inline");

for (const ignored of ["node_modules", "dist", "output", ".env", ".env.*", ".git", ".github", "tests", "data/*.sqlite", "data/*.sqlite-shm", "data/*.sqlite-wal"]) {
  assert(vercelIgnore.split(/\r?\n/).includes(ignored), `.vercelignore must exclude ${ignored}`);
}

console.log("ok - static production validation passed");








