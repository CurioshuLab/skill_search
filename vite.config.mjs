import { defineConfig } from "vite";
import { readCatalogDataset, refreshCatalogDatabase } from "./tools/catalog-db.mjs";

export default defineConfig({
  server: {
    host: "127.0.0.1"
  },
  plugins: [catalogApiPlugin()]
});

function catalogApiPlugin() {
  return {
    name: "skill-search-catalog-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
        if (requestUrl.pathname === "/api/catalog" && req.method === "GET") {
          try {
            const dataset = await readCatalogDataset();
            sendJson(res, 200, dataset);
          } catch (error) {
            sendJson(res, 500, { error: String(error?.message || error) });
          }
          return;
        }

        if (requestUrl.pathname === "/api/refresh" && req.method === "POST") {
          try {
            const dataset = await refreshCatalogDatabase({ mock: process.env.SKILL_SEARCH_REFRESH_MODE === "mock" });
            sendJson(res, 200, { ok: true, dataset });
          } catch (error) {
            sendJson(res, 502, { ok: false, error: String(error?.message || error) });
          }
          return;
        }

        next();
      });
    }
  };
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(payload)}\n`);
}
