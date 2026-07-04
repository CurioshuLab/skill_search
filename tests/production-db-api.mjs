import assert from "node:assert/strict";
import catalogHandler from "../api/catalog.js";
import refreshHandler from "../api/refresh.js";

const catalogResponse = await invoke(catalogHandler, { method: "GET" });
assert.equal(catalogResponse.statusCode, 200, "catalog API should return OK");
assert.match(catalogResponse.headers["content-type"], /^application\/json\b/, "catalog API should return JSON");
assert.match(catalogResponse.headers["cache-control"], /\bs-maxage=300\b/, "catalog API should set shared cache headers");

const dataset = JSON.parse(catalogResponse.body);
assert.equal(dataset.storage, "SQLite database", "catalog API should expose SQLite-backed storage metadata");
assert.equal(dataset.count, 1000, "catalog API should return the full catalog");
assert.equal(dataset.records.length, 1000, "catalog API should return all records");
assert(dataset.records[0].skillName, "catalog API should return skill records");

const methodResponse = await invoke(catalogHandler, { method: "POST" });
assert.equal(methodResponse.statusCode, 405, "catalog API should reject unsupported methods");
assert.equal(methodResponse.headers.allow, "GET", "catalog API should expose allowed methods");
assert.match(methodResponse.headers["content-type"], /^application\/json\b/, "method error should return JSON");

const refreshResponse = await invoke(refreshHandler, { method: "POST" });
assert.equal(refreshResponse.statusCode, 501, "production refresh should be an explicit maintenance-only response");
assert.match(refreshResponse.headers["content-type"], /^application\/json\b/, "refresh response should return JSON");
assert.equal(JSON.parse(refreshResponse.body).ok, false, "refresh response should expose failed status");

console.log("ok - production SQLite API validation passed");

async function invoke(handler, request) {
  const response = createMockResponse();
  await handler(request, response);
  return response;
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    end(value = "") {
      this.body += String(value);
    }
  };
}
