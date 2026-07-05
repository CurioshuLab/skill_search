import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { openCatalogDatabase, replaceCatalogDataset, readCatalogDataset } from "./catalog-db.mjs";

const seedPath = resolve("src/data/ai-skill-packs.json");
const seedDataset = JSON.parse(await readFile(seedPath, "utf8"));
const db = await openCatalogDatabase();
replaceCatalogDataset(db, seedDataset);
const dataset = await readCatalogDataset();
console.log(`Catalog DB ready: ${dataset.count} records`);
