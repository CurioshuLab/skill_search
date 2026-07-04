const targetCountDefault = 1000;
const perPage = 100;

export const defaultQueries = [
  "ai skills",
  "agent skills",
  "claude skills",
  "codex skills",
  "cursor rules ai",
  "prompt skills ai",
  "mcp skills",
  "chatgpt prompts skills"
];

export async function fetchCatalogDataset({
  targetCount = Number(process.env.SKILL_PACK_TARGET || targetCountDefault),
  token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "",
  queries = defaultQueries
} = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "skill-search-ai-skill-catalog",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const seen = new Set();
  const records = [];
  const sourceQueries = [];

  for (const query of queries) {
    for (let page = 1; page <= 10 && records.length < targetCount; page += 1) {
      const url = new URL("https://api.github.com/search/repositories");
      url.searchParams.set("q", query);
      url.searchParams.set("sort", "stars");
      url.searchParams.set("order", "desc");
      url.searchParams.set("per_page", String(perPage));
      url.searchParams.set("page", String(page));

      const response = await fetch(url, { headers });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`GitHub API ${response.status} for ${url}: ${body}`);
      }

      const payload = await response.json();
      sourceQueries.push({
        query,
        page,
        total_count: payload.total_count,
        fetched: payload.items?.length ?? 0,
        url: url.toString()
      });

      for (const item of payload.items ?? []) {
        if (seen.has(item.full_name)) continue;
        seen.add(item.full_name);
        records.push(toCatalogRecord(item, query));
        if (records.length >= targetCount) break;
      }

      if (!payload.items?.length) break;
    }

    if (records.length >= targetCount) break;
  }

  if (records.length < targetCount) {
    throw new Error(`Only collected ${records.length} records; target was ${targetCount}.`);
  }

  return createDataset({ records: records.slice(0, targetCount), targetCount, sourceQueries });
}

export function createDataset({ records, targetCount = records.length, sourceQueries = [] }) {
  return {
    generatedAt: new Date().toISOString(),
    checkedDate: new Date().toISOString().slice(0, 10),
    source: "GitHub REST Search API",
    sourceDocs: "https://docs.github.com/rest/search/search#search-repositories",
    targetCount,
    count: records.length,
    storage: "SQLite database",
    assumptions: [
      "The catalog is a GitHub-derived discovery base, not a manual endorsement list.",
      "Capability text is summarized from public repository description, topics, language, and metadata.",
      "Scripts included is a repository-metadata heuristic unless a future authenticated tree check is added.",
      "Duplicate repositories across queries are removed by owner/name."
    ],
    sourceQueries,
    records
  };
}

export function toCatalogRecord(item, matchedQuery) {
  const description = normalize(item.description) || "GitHub上のAI/スキル関連リポジトリ。詳細はURL先で確認してください。";
  const topics = Array.isArray(item.topics) ? item.topics : [];
  const language = item.language || "Unknown";
  const scriptSignal = inferScripts({ name: item.full_name, description, topics, language });

  return {
    id: item.id,
    skillName: item.name,
    fullName: item.full_name,
    capability: summarizeCapability({ description, topics, language }),
    scriptsIncluded: scriptSignal.included,
    scriptsLabel: scriptSignal.label,
    scriptsReason: scriptSignal.reason,
    creator: item.owner?.login ?? "unknown",
    url: item.html_url,
    description,
    language,
    topics: topics.slice(0, 8),
    stars: item.stargazers_count ?? 0,
    forks: item.forks_count ?? 0,
    updatedAt: item.updated_at,
    license: item.license?.spdx_id ?? "NOASSERTION",
    matchedQuery
  };
}

function normalize(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeCapability({ description, topics, language }) {
  const topicText = topics.length ? ` / topics: ${topics.slice(0, 4).join(", ")}` : "";
  const languageText = language && language !== "Unknown" ? ` / ${language}` : "";
  return `${description}${topicText}${languageText}`.slice(0, 220);
}

function inferScripts({ name, description, topics, language }) {
  const text = `${name} ${description} ${topics.join(" ")} ${language}`.toLowerCase();
  const positive = [
    "script",
    "cli",
    "automation",
    "workflow",
    "toolkit",
    "agent",
    "python",
    "javascript",
    "typescript",
    "shell",
    "powershell",
    "node"
  ];

  const scriptLanguages = new Set([
    "python",
    "javascript",
    "typescript",
    "shell",
    "powershell",
    "ruby",
    "lua",
    "go",
    "rust"
  ]);

  if (scriptLanguages.has(String(language).toLowerCase())) {
    return {
      included: true,
      label: "推定あり",
      reason: `primary language: ${language}`
    };
  }

  const matched = positive.find((keyword) => text.includes(keyword));
  if (matched) {
    return {
      included: true,
      label: "推定あり",
      reason: `metadata keyword: ${matched}`
    };
  }

  return {
    included: false,
    label: "推定なし",
    reason: "repository metadata has no script signal"
  };
}
