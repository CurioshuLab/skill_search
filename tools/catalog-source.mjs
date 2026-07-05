const targetCountDefault = 1000;
const perPage = 100;

export const defaultQueries = [
  "ai skills",
  "agent skills",
  "claude skills",
  "codex skills",
  "ai agent hooks",
  "mcp tools ai agents",
  "agent workflow automation",
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
  const enrichedRecords = records.map(enrichCatalogRecord);
  return {
    generatedAt: new Date().toISOString(),
    checkedDate: new Date().toISOString().slice(0, 10),
    source: "GitHub REST Search API",
    sourceDocs: "https://docs.github.com/rest/search/search#search-repositories",
    targetCount,
    count: enrichedRecords.length,
    storage: "SQLite database",
    assumptions: [
      "The catalog is a GitHub-derived discovery base, not a manual endorsement list.",
      "Capability text is summarized from public repository description, topics, language, and metadata.",
      "Scripts included is a repository-metadata heuristic unless a future authenticated tree check is added.",
      "Agent fit, readiness, bundle type, and safety signals are inferred from public repository metadata.",
      "Safety scores are triage hints only; they are not a security audit or endorsement.",
      "Duplicate repositories across queries are removed by owner/name."
    ],
    sourceQueries,
    records: enrichedRecords
  };
}

export function toCatalogRecord(item, matchedQuery) {
  const description = normalize(item.description) || "GitHub上のAI/スキル関連リポジトリ。詳細はURL先で確認してください。";
  const topics = Array.isArray(item.topics) ? item.topics : [];
  const language = item.language || "Unknown";
  const scriptSignal = inferScripts({ name: item.full_name, description, topics, language });

  return enrichCatalogRecord({
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
  });
}

export function enrichCatalogRecord(record) {
  const topics = Array.isArray(record.topics) ? record.topics : [];
  const text = buildSearchText(record, topics);
  const updatedAt = record.updatedAt || new Date(0).toISOString();
  const daysSinceUpdate = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);
  const bundleSignals = record.bundleSignals ?? inferBundleSignals({ text, topics, language: record.language });
  const agentCompatibility = record.agentCompatibility ?? inferAgentCompatibility({ text, topics, matchedQuery: record.matchedQuery });
  const installReadiness = record.installReadiness ?? inferInstallReadiness({ record, bundleSignals, daysSinceUpdate });
  const safetySignals = record.safetySignals ?? inferSafetySignals({ record, text, daysSinceUpdate });
  const trendSignals = record.trendSignals ?? inferTrendSignals({ text, topics, daysSinceUpdate, bundleSignals });

  return {
    ...record,
    agentCompatibility,
    installReadiness,
    safetySignals,
    bundleSignals,
    trendSignals,
    sourceCompliance: record.sourceCompliance ?? {
      source: "GitHub REST Search API",
      sourceDocs: "https://docs.github.com/rest/search/search#search-repositories",
      allowedUse: "Public repository metadata only",
      rateLimitNote: "GitHub REST Search API rate limits and the 1,000-result search window are respected by paged official API calls.",
      termsNote: "Repository contents, licenses, and third-party terms must be checked before installing or executing any skill.",
      inferred: false
    }
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

function buildSearchText(record, topics) {
  return [
    record.skillName,
    record.fullName,
    record.description,
    record.capability,
    record.language,
    record.license,
    record.matchedQuery,
    topics.join(" ")
  ]
    .join(" ")
    .toLowerCase();
}

function inferAgentCompatibility({ text, matchedQuery }) {
  const agents = [
    agentFit("Codex", text, ["codex", "openai", "cli", "terminal", "repo", "github", "coding"]),
    agentFit("Claude Code", text, ["claude", "anthropic", "claude-code", "skill", "hooks"]),
    agentFit("Cursor", text, ["cursor", "rules", ".cursorrules", "ide", "editor"]),
    agentFit("MCP", text, ["mcp", "model context protocol", "server", "tool"]),
    agentFit("GitHub Copilot", text, ["copilot", "github", "pull request", "coding agent"]),
    agentFit("汎用LLM", text, ["prompt", "chatgpt", "llm", "agent", "workflow", "instruction"])
  ].sort((a, b) => b.score - a.score);
  const primary = agents[0]?.name ?? "汎用LLM";
  return {
    primary,
    score: agents[0]?.score ?? 40,
    agents,
    evidence: [`matched query: ${matchedQuery || "unknown"}`, ...agents[0]?.reasons ?? []].slice(0, 4),
    inferred: true
  };
}

function agentFit(name, text, keywords) {
  const matched = keywords.filter((keyword) => text.includes(keyword));
  const score = Math.min(96, 35 + matched.length * 14);
  return {
    name,
    score,
    level: score >= 75 ? "strong" : score >= 55 ? "likely" : "weak",
    reasons: matched.slice(0, 4).map((keyword) => `metadata keyword: ${keyword}`)
  };
}

function inferBundleSignals({ text, topics, language }) {
  const typeRules = [
    ["mcp-server", ["mcp", "model context protocol"]],
    ["tool", ["tool", "toolkit", "api", "server", "sdk"]],
    ["prompt", ["prompt", "prompts", "prompt-engineering"]],
    ["hook", ["hook", "hooks", "webhook", "git hook"]],
    ["instruction", ["instruction", "instructions", "rules", "guide"]],
    ["workflow", ["workflow", "automation", "pipeline", "orchestration"]],
    ["data-pack", ["dataset", "data", "knowledge", "rag", "graph"]],
    ["skill", ["skill", "skills", "agent-skills", "claude-skills"]]
  ];
  const types = typeRules.filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword))).map(([type]) => type);
  if (!types.length) types.push("skill");
  const normalizedTopics = topics.slice(0, 8);
  return {
    types: [...new Set(types)],
    promptSignals: findSignals(text, ["prompt", "instruction", "system prompt", "few-shot"]),
    hookSignals: findSignals(text, ["hook", "webhook", "pre-commit", "post-task"]),
    toolSignals: findSignals(text, ["tool", "cli", "api", "mcp", "server", "sdk"]),
    dataSignals: findSignals(text, ["dataset", "rag", "knowledge graph", "database", "notebook"]),
    installTargets: inferInstallTargets(text, language),
    topics: normalizedTopics,
    inferred: true
  };
}

function inferInstallTargets(text, language) {
  const targets = [];
  if (text.includes("mcp")) targets.push("MCP server config");
  if (text.includes("claude")) targets.push("Claude skill directory");
  if (text.includes("cursor")) targets.push("Cursor rules/workspace");
  if (text.includes("codex") || text.includes("openai")) targets.push("Codex skill workspace");
  if (["Python", "JavaScript", "TypeScript", "Shell", "PowerShell"].includes(language)) targets.push(`${language} runtime`);
  return targets.length ? targets : ["Markdown instructions"];
}

function inferInstallReadiness({ record, bundleSignals, daysSinceUpdate }) {
  let score = 35;
  const checks = [];
  const blockers = [];
  if (record.stars >= 10000) {
    score += 22;
    checks.push("10k+ stars");
  } else if (record.stars >= 1000) {
    score += 14;
    checks.push("1k+ stars");
  }
  if (record.license && record.license !== "NOASSERTION") {
    score += 15;
    checks.push(`license: ${record.license}`);
  } else {
    blockers.push("license not asserted");
  }
  if (daysSinceUpdate <= 30) {
    score += 14;
    checks.push("updated in last 30 days");
  } else if (daysSinceUpdate <= 180) {
    score += 8;
    checks.push("updated in last 180 days");
  }
  if (record.scriptsIncluded) {
    score += 8;
    checks.push(record.scriptsReason || "script signal");
  }
  if (bundleSignals.types.includes("mcp-server")) {
    score += 6;
    checks.push("MCP integration signal");
  }
  score = Math.min(98, score);
  return {
    score,
    level: score >= 80 ? "ready" : score >= 60 ? "review" : "triage",
    recipe: inferInstallRecipe(record, bundleSignals),
    checks,
    blockers,
    inferred: true
  };
}

function inferInstallRecipe(record, bundleSignals) {
  const targets = bundleSignals.installTargets.join(", ");
  return `Review ${record.fullName}, verify license and README, then map bundle to ${targets}. Run only inside a sandbox until hooks/tools are inspected.`;
}

function inferSafetySignals({ record, text, daysSinceUpdate }) {
  let score = 72;
  const badges = [];
  const concerns = [];
  const permissions = [];
  if (!record.license || record.license === "NOASSERTION") {
    score -= 15;
    concerns.push("license not asserted");
  } else {
    score += 8;
    badges.push("license visible");
  }
  if (record.stars >= 10000) {
    score += 8;
    badges.push("high community signal");
  }
  if (daysSinceUpdate <= 30) {
    score += 6;
    badges.push("recently maintained");
  }
  for (const [keyword, label] of [
    ["shell", "shell execution"],
    ["powershell", "PowerShell execution"],
    ["docker", "container runtime"],
    ["token", "token handling"],
    ["credential", "credential handling"],
    ["browser", "browser/computer use"],
    ["filesystem", "filesystem access"],
    ["webhook", "network callbacks"]
  ]) {
    if (text.includes(keyword)) {
      permissions.push(label);
      score -= keyword === "token" || keyword === "credential" ? 10 : 4;
    }
  }
  if (record.scriptsIncluded) concerns.push("script or runtime execution should be sandboxed");
  score = Math.max(20, Math.min(96, score));
  return {
    score,
    level: score >= 78 ? "low-review" : score >= 55 ? "needs-review" : "high-review",
    label: score >= 78 ? "Low review" : score >= 55 ? "Needs review" : "High review",
    badges,
    concerns,
    permissions: permissions.length ? [...new Set(permissions)] : ["read-only metadata review"],
    inferred: true
  };
}

function inferTrendSignals({ text, topics, daysSinceUpdate, bundleSignals }) {
  const categories = [
    trendCategory("MCP tools", text, ["mcp", "model context protocol", "tool"]),
    trendCategory("agent skills", text, ["agent", "skill", "claude-code", "codex"]),
    trendCategory("computer-use workflows", text, ["browser", "computer use", "desktop", "automation"]),
    trendCategory("safety gates", text, ["security", "audit", "sandbox", "permission", "policy"]),
    trendCategory("multimodal assets", text, ["image", "video", "audio", "multimodal", "vision"])
  ].filter(Boolean);
  if (!categories.length) categories.push("agent skills");
  return {
    recent30d: daysSinceUpdate <= 30,
    categories,
    radarWeight: Math.min(100, 35 + categories.length * 13 + (daysSinceUpdate <= 30 ? 20 : 0) + Math.min(20, topics.length * 2)),
    latestMovement: daysSinceUpdate <= 30 ? "last-30-days" : "catalog-baseline",
    bundleTypes: bundleSignals.types,
    inferred: true
  };
}

function trendCategory(label, text, keywords) {
  return keywords.some((keyword) => text.includes(keyword)) ? label : "";
}

function findSignals(text, keywords) {
  return keywords.filter((keyword) => text.includes(keyword)).slice(0, 5);
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
