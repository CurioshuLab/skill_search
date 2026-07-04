import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fetchCatalogDataset } from "./catalog-source.mjs";
import { openCatalogDatabase, replaceCatalogDataset } from "./catalog-db.mjs";

const outputPath = resolve("src/data/ai-skill-packs.json");
const dataset = await fetchCatalogDataset();

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

const db = await openCatalogDatabase();
replaceCatalogDataset(db, dataset);

console.log(`Wrote ${dataset.count} records to ${outputPath}`);
console.log("Updated data/catalog.sqlite");
console.log(`Sources: ${dataset.sourceQueries.map((entry) => `${entry.query} p${entry.page}`).join(", ")}`);
