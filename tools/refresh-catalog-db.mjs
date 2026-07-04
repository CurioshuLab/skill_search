import { refreshCatalogDatabase } from "./catalog-db.mjs";

const dataset = await refreshCatalogDatabase();
console.log(`Catalog DB refreshed: ${dataset.count} records`);
console.log(`Generated at: ${dataset.generatedAt}`);
