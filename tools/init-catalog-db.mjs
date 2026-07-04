import { readCatalogDataset } from "./catalog-db.mjs";

const dataset = await readCatalogDataset();
console.log(`Catalog DB ready: ${dataset.count} records`);
