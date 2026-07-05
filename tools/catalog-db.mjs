import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createDataset, fetchCatalogDataset } from "./catalog-source.mjs";

const root = resolve(import.meta.dirname, "..");
export const databasePath = resolve(root, process.env.SKILL_SEARCH_DB_PATH || "data/catalog.sqlite");
const seedPath = resolve(root, "src/data/ai-skill-packs.json");
const insightColumns = [
  ["agent_compatibility_json", "{}"],
  ["install_readiness_json", "{}"],
  ["safety_signals_json", "{}"],
  ["bundle_signals_json", "{}"],
  ["trend_signals_json", "{}"],
  ["source_compliance_json", "{}"]
];

export async function readCatalogDataset({ readOnly = false } = {}) {
  const db = await openCatalogDatabase({ readOnly });
  const recordCount = db.prepare("SELECT COUNT(*) AS count FROM skill_records").get().count;
  if (!recordCount && !readOnly) {
    await seedCatalogDatabase(db);
  }
  if (recordCount && !readOnly && hasMissingInsights(db)) {
    await seedCatalogDatabase(db);
  }
  if (!recordCount && readOnly) {
    throw new Error("Catalog database is empty");
  }
  return exportDataset(db);
}

export async function refreshCatalogDatabase({ mock = false } = {}) {
  const db = await openCatalogDatabase();
  if (mock) {
    const current = exportDataset(db);
    current.generatedAt = new Date().toISOString();
    current.checkedDate = current.generatedAt.slice(0, 10);
    current.storage = "SQLite database";
    replaceCatalogDataset(db, current);
    return exportDataset(db);
  }

  const dataset = await fetchCatalogDataset();
  replaceCatalogDataset(db, dataset);
  await writeFile(seedPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
  return exportDataset(db);
}

export async function openCatalogDatabase({ readOnly = false } = {}) {
  if (!readOnly) {
    mkdirSync(dirname(databasePath), { recursive: true });
  }
  const db = new DatabaseSync(databasePath, readOnly ? { readOnly: true } : {});
  if (readOnly) return db;

  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS skill_records (
      id INTEGER PRIMARY KEY,
      skill_name TEXT NOT NULL,
      full_name TEXT NOT NULL UNIQUE,
      capability TEXT NOT NULL,
      scripts_included INTEGER NOT NULL,
      scripts_label TEXT NOT NULL,
      scripts_reason TEXT NOT NULL,
      creator TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT NOT NULL,
      language TEXT NOT NULL,
      topics_json TEXT NOT NULL,
      stars INTEGER NOT NULL,
      forks INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      license TEXT NOT NULL,
      matched_query TEXT NOT NULL,
      agent_compatibility_json TEXT NOT NULL DEFAULT '{}',
      install_readiness_json TEXT NOT NULL DEFAULT '{}',
      safety_signals_json TEXT NOT NULL DEFAULT '{}',
      bundle_signals_json TEXT NOT NULL DEFAULT '{}',
      trend_signals_json TEXT NOT NULL DEFAULT '{}',
      source_compliance_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS source_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      page INTEGER NOT NULL,
      total_count INTEGER,
      fetched INTEGER NOT NULL,
      url TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_skill_records_stars ON skill_records(stars DESC);
    CREATE INDEX IF NOT EXISTS idx_skill_records_creator ON skill_records(creator);
    CREATE INDEX IF NOT EXISTS idx_skill_records_language ON skill_records(language);
  `);
  ensureInsightColumns(db);
  return db;
}

async function seedCatalogDatabase(db) {
  if (!existsSync(seedPath)) {
    throw new Error(`Seed catalog missing: ${seedPath}`);
  }
  const dataset = JSON.parse(await readFile(seedPath, "utf8"));
  replaceCatalogDataset(db, dataset);
}

export function replaceCatalogDataset(db, dataset) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("DELETE FROM catalog_meta; DELETE FROM skill_records; DELETE FROM source_queries;");

    const meta = {
      generatedAt: dataset.generatedAt,
      checkedDate: dataset.checkedDate,
      source: dataset.source,
      sourceDocs: dataset.sourceDocs,
      targetCount: String(dataset.targetCount ?? dataset.records.length),
      assumptions: JSON.stringify(dataset.assumptions ?? []),
      storage: "SQLite database"
    };
    const insertMeta = db.prepare("INSERT INTO catalog_meta (key, value) VALUES (?, ?)");
    for (const [key, value] of Object.entries(meta)) {
      insertMeta.run(key, String(value ?? ""));
    }

    const insertRecord = db.prepare(`
      INSERT INTO skill_records (
        id, skill_name, full_name, capability, scripts_included, scripts_label, scripts_reason,
        creator, url, description, language, topics_json, stars, forks, updated_at, license, matched_query,
        agent_compatibility_json, install_readiness_json, safety_signals_json, bundle_signals_json,
        trend_signals_json, source_compliance_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const record of dataset.records ?? []) {
      insertRecord.run(
        record.id,
        record.skillName,
        record.fullName,
        record.capability,
        record.scriptsIncluded ? 1 : 0,
        record.scriptsLabel || (record.scriptsIncluded ? "推定あり" : "推定なし"),
        record.scriptsReason || "repository metadata heuristic",
        record.creator,
        record.url,
        record.description,
        record.language || "Unknown",
        JSON.stringify(record.topics ?? []),
        record.stars ?? 0,
        record.forks ?? 0,
        record.updatedAt || "",
        record.license || "NOASSERTION",
        record.matchedQuery || "",
        stringifyJson(record.agentCompatibility),
        stringifyJson(record.installReadiness),
        stringifyJson(record.safetySignals),
        stringifyJson(record.bundleSignals),
        stringifyJson(record.trendSignals),
        stringifyJson(record.sourceCompliance)
      );
    }

    const insertSource = db.prepare("INSERT INTO source_queries (query, page, total_count, fetched, url) VALUES (?, ?, ?, ?, ?)");
    for (const entry of dataset.sourceQueries ?? []) {
      insertSource.run(entry.query, entry.page, entry.total_count ?? null, entry.fetched ?? 0, entry.url ?? "");
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function ensureInsightColumns(db) {
  const existing = new Set(db.prepare("PRAGMA table_info(skill_records)").all().map((column) => column.name));
  for (const [name, defaultJson] of insightColumns) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE skill_records ADD COLUMN ${name} TEXT NOT NULL DEFAULT '${defaultJson}'`);
    }
  }
}

function hasMissingInsights(db) {
  const row = db.prepare("SELECT agent_compatibility_json, install_readiness_json, safety_signals_json FROM skill_records ORDER BY stars DESC, id ASC LIMIT 1").get();
  return !row?.agent_compatibility_json || row.agent_compatibility_json === "{}" || !row.install_readiness_json || row.install_readiness_json === "{}" || !row.safety_signals_json || row.safety_signals_json === "{}";
}

function stringifyJson(value) {
  return JSON.stringify(value ?? {});
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function exportDataset(db) {
  const metaRows = db.prepare("SELECT key, value FROM catalog_meta").all();
  const meta = Object.fromEntries(metaRows.map((row) => [row.key, row.value]));
  const records = db.prepare("SELECT * FROM skill_records ORDER BY stars DESC, id ASC").all().map(fromDbRecord);
  const sourceQueries = db.prepare("SELECT query, page, total_count, fetched, url FROM source_queries ORDER BY id ASC").all();
  const dataset = createDataset({
    records,
    targetCount: Number(meta.targetCount || records.length),
    sourceQueries
  });
  dataset.generatedAt = meta.generatedAt || dataset.generatedAt;
  dataset.checkedDate = meta.checkedDate || dataset.checkedDate;
  dataset.source = meta.source || dataset.source;
  dataset.sourceDocs = meta.sourceDocs || dataset.sourceDocs;
  dataset.storage = meta.storage || "SQLite database";
  dataset.assumptions = JSON.parse(meta.assumptions || "[]");
  return dataset;
}

function fromDbRecord(row) {
  return {
    id: row.id,
    skillName: row.skill_name,
    fullName: row.full_name,
    capability: row.capability,
    scriptsIncluded: Boolean(row.scripts_included),
    scriptsLabel: row.scripts_label,
    scriptsReason: row.scripts_reason,
    creator: row.creator,
    url: row.url,
    description: row.description,
    language: row.language,
    topics: JSON.parse(row.topics_json || "[]"),
    stars: row.stars,
    forks: row.forks,
    updatedAt: row.updated_at,
    license: row.license,
    matchedQuery: row.matched_query,
    agentCompatibility: parseJson(row.agent_compatibility_json, {}),
    installReadiness: parseJson(row.install_readiness_json, {}),
    safetySignals: parseJson(row.safety_signals_json, {}),
    bundleSignals: parseJson(row.bundle_signals_json, {}),
    trendSignals: parseJson(row.trend_signals_json, {}),
    sourceCompliance: parseJson(row.source_compliance_json, {})
  };
}

