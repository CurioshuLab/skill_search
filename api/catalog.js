import { readCatalogDataset } from "../tools/catalog-db.mjs";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const dataset = await readCatalogDataset({ readOnly: true });
    response.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
    sendJson(response, 200, dataset);
  } catch (error) {
    sendJson(response, 500, { error: String(error?.message || error) });
  }
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(payload)}\n`);
}
