import seedCatalog from "./data/ai-skill-packs.json";
import logoUrl from "./assets/curioshulab-logo-cropped.png";
import catalogIcon from "./assets/catalog-icons/catalog.png";
import favoriteIcon from "./assets/catalog-icons/favorite.png";
import collectionIcon from "./assets/catalog-icons/collection.png";
import compareIcon from "./assets/catalog-icons/compare.png";
import historyIcon from "./assets/catalog-icons/history.png";
import importIcon from "./assets/catalog-icons/import.png";
import settingsIcon from "./assets/catalog-icons/settings.png";
import scriptsIcon from "./assets/catalog-icons/scripts.png";
import creatorsIcon from "./assets/catalog-icons/creators.png";
import opensourceIcon from "./assets/catalog-icons/opensource.png";
import agentIcon from "./assets/catalog-icons/agent.png";
import chartIcon from "./assets/catalog-icons/chart.png";
import searchIcon from "./assets/catalog-icons/search.png";
import filterIcon from "./assets/catalog-icons/filter.png";
import refreshIcon from "./assets/catalog-icons/refresh.png";
import resetIcon from "./assets/catalog-icons/reset.png";
import closeIcon from "./assets/catalog-icons/close.png";
import chevronLeftIcon from "./assets/catalog-icons/chevron-left.png";
import chevronRightIcon from "./assets/catalog-icons/chevron-right.png";
import externalIcon from "./assets/catalog-icons/external.png";
import workbenchUrl from "./assets/agent-workbench.png";
import "./styles.css";

const categoryRules = [
  ["開発支援", ["coding", "developer", "dev", "cli", "workflow", "tool", "sdlc"]],
  ["IDE拡張", ["vscode", "cursor", "ide", "editor", "extension"]],
  ["生成補助", ["prompt", "llm", "chatgpt", "claude", "copilot", "agent"]],
  ["データ分析", ["data", "analysis", "analytics", "python", "notebook"]],
  ["セキュリティ", ["security", "audit", "scan", "static-analysis"]],
  ["コンテンツ", ["content", "writing", "media", "marketing"]]
];

const agentRules = [
  ["Claude", ["claude", "anthropic"]],
  ["GitHub Copilot", ["copilot", "github"]],
  ["Codex", ["codex", "openai"]],
  ["Cursor", ["cursor"]],
  ["MCP", ["mcp"]],
  ["汎用LLM", ["agent", "llm", "chatgpt", "ai"]]
];

let catalog = await loadCatalogDataset();
let records = buildRecords(catalog.records);

const state = {
  search: "",
  category: "all",
  agent: "all",
  safety: "all",
  readiness: "all",
  bundle: "all",
  trend: "all",
  scriptFilter: "all",
  license: "all",
  stars: "all",
  sort: "stars",
  page: 1,
  pageSize: 20,
  selectedId: records[0]?.id ?? null,
  view: "catalog",
  theme: "light",
  history: [],
  density: localStorage.getItem("skillCatalogDensity") || "comfortable",
  statusMessage: ""
};

const favorites = new Set();
const collection = new Set();
const compare = new Set();
const app = document.querySelector("#app");

let categories = unique(records.map((record) => record.category));
let agents = unique(records.map((record) => record.agent));
let languages = unique(records.map((record) => record.language).filter(Boolean)).slice(0, 80);
let licenses = unique(records.map((record) => record.license).filter(Boolean)).slice(0, 50);

app.innerHTML = `
  <aside class="sidebar" aria-label="メインナビゲーション">
    <a class="brand" href="#top" aria-label="CurioshuLab catalog top">
      <img class="brand-logo" src="${logoUrl}" alt="CurioshuLab" />
    </a>
    <nav class="side-nav">
      ${navButton("catalog", "catalog", "カタログ")}
      ${navButton("agent-fit", "agent", "Agent Fit")}
      ${navButton("risk", "shield", "Risk")}
      ${navButton("pipelines", "code", "Pipelines")}
      ${navButton("signals", "chart", "Signals")}
      ${navButton("compare", "scale", "比較")}
      ${navButton("settings", "gear", "設定")}
    </nav>
    <div class="sidebar-footer">
      <div>
        <strong>CurioshuLab</strong>
        <small>Turning Curiosity into Creation</small>
      </div>
      <div class="theme-toggle" role="group" aria-label="Theme">
        <button class="is-active" type="button" data-theme="light">ライト</button>
        <button type="button" data-theme="dark">ダーク</button>
      </div>
    </div>
  </aside>

  <main class="main-area" id="top">
    <header class="topbar">
      <div>
        <div class="title-line">
          <h1>AI Agent Skill Platform</h1>
          <span class="badge">GitHub由来 / 推定評価</span>
        </div>
        <p>AI Agentがスキル、ツール、プロンプト、フック、データパックを安全に選び、導入判断できる運用カタログです。</p>
      </div>
      <div class="top-actions">
        <span class="updated" id="updatedAt">最終更新: ${formatDateTime(catalog.generatedAt)}</span>
        <button class="ghost-button" type="button" id="refreshData"><img class="action-icon" src="${refreshIcon}" alt="" aria-hidden="true" />ローカルDB更新</button>
        <div class="hero-count">
          <strong>${formatNumber(records.length)}</strong>
          <span>件のスキルパック</span>
          <small>1000+ 件の公開リポジトリを収録</small>
        </div>
      </div>
    </header>

    <section class="search-card" aria-label="検索とフィルター">
      <div class="search-row">
        <label class="search-field" for="catalogSearch">
          <img class="field-icon" src="${searchIcon}" alt="" aria-hidden="true" />
          <input id="catalogSearch" data-testid="catalog-search" type="search" placeholder="スキル名、機能、説明、キーワードで検索..." autocomplete="off" />
        </label>
        <button class="search-button" type="button" id="searchButton" data-testid="search-button">検索</button>
        <button class="filter-button" type="button" id="filterButton"><img class="action-icon" src="${filterIcon}" alt="" aria-hidden="true" />フィルター</button>
      </div>
      <div class="filter-row">
      ${selectControl("カテゴリ", "categoryFilter", "category", categories)}
      ${selectControl("対応エージェント", "agentFilter", "agent", agents)}
      ${selectControl("Safety", "safetyFilter", "safety", ["Low review", "Needs review", "High review"], true)}
      ${selectControl("Readiness", "readinessFilter", "readiness", ["Ready", "Review", "Triage"], true)}
      ${selectControl("Bundle", "bundleFilter", "bundle", ["skill", "tool", "prompt", "hook", "instruction", "workflow", "data-pack", "mcp-server"])}
      ${selectControl("Trend", "trendFilter", "trend", ["Last 30 days", ...trendCategories()], true)}
      ${selectControl("Scripts", "scriptFilter", "scriptFilter", ["推定あり", "推定なし"], true)}
      ${selectControl("ライセンス", "licenseFilter", "license", licenses)}
      ${selectControl("スター数", "starsFilter", "stars", ["1万以上", "1000以上", "100以上"], true)}
      <button class="reset-button" type="button" id="resetFilters" data-testid="reset-filters"><img class="action-icon" src="${resetIcon}" alt="" aria-hidden="true" />リセット</button>
      </div>
    </section>

    <section class="stats-row" aria-label="カタログ指標">
      ${statCard("cube", formatNumber(records.length), "総スキルパック数", "1000+ 件のリポジトリ")}
      ${statCard("agent", formatNumber(agentReadyCount()), "Agent Fit強", "互換性スコア75+")}
      ${statCard("shield", `${safeReviewRate()}%`, "Low review", "軽量安全性スコア")}
      ${statCard("code", formatNumber(bundleCount("mcp-server")), "MCP候補", "tool registry向け")}
      ${statCard("chart", formatNumber(last30DaysCount()), "30日内更新", "最新トレンド信号")}
    </section>

    <section class="mode-panel" id="modePanel" data-testid="mode-panel" aria-live="polite"></section>
    <section class="trend-radar" aria-label="Last 30 days trend radar">
      <div>
        <h2>Last 30 days trend radar</h2>
        <p>MCP tools、agent skills、computer-use workflows、safety gates、multimodal assets をGitHub公開メタデータから推定しています。</p>
      </div>
      <img src="${workbenchUrl}" alt="" aria-hidden="true" />
      <div class="radar-chips" id="trendRadar"></div>
    </section>

    <section class="content-grid" aria-label="検索結果と詳細">
      <div class="table-card">
        <div class="table-scroll" role="region" aria-label="AI skill pack table" tabindex="0">
          <table>
            <thead>
              <tr>
                <th class="check-col">-</th>
                <th class="num-col">#</th>
                <th>Skill</th>
                <th>Agent Fit</th>
                <th>Data / Tool Type</th>
                <th>Safety</th>
                <th>Stars</th>
                <th>更新日</th>
                <th>License</th>
                <th>URL</th>
              </tr>
            </thead>
            <tbody id="catalogRows" data-testid="catalog-rows"></tbody>
          </table>
        </div>
        <div class="table-footer">
          <span id="resultCount">0件中 0件を表示</span>
          <div class="pager">
            <button type="button" id="prevPage" data-testid="prev-page" aria-label="前のページ"><img class="pager-icon" src="${chevronLeftIcon}" alt="" aria-hidden="true" /></button>
            <span id="pageInfo">1</span>
            <button type="button" id="nextPage" data-testid="next-page" aria-label="次のページ"><img class="pager-icon" src="${chevronRightIcon}" alt="" aria-hidden="true" /></button>
          </div>
          <label class="page-size">表示件数
            <select id="pageSize" data-testid="page-size">
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
      </div>
      <aside class="detail-card" aria-label="スキル詳細">
        <div class="detail-title">
          <strong>スキル詳細</strong>
          <button type="button" id="closeDetail" aria-label="詳細を閉じる"><img class="action-icon" src="${closeIcon}" alt="" aria-hidden="true" /></button>
        </div>
        <div id="detailContent" data-testid="detail-panel"></div>
      </aside>
    </section>

    <footer class="data-footer">
      <span>本カタログはGitHubの公開情報を基に作成しています。内容の正確性は各リポジトリでご確認ください。</span>
      <span>データソース: GitHub REST Search API / 公式APIのrate limitと検索上限を順守</span>
      <a href="${safeUrl(catalog.sourceDocs)}" target="_blank" rel="noopener noreferrer">このページについて</a>
    </footer>
  </main>
`;

const elements = {
  search: document.querySelector("#catalogSearch"),
  category: document.querySelector("#categoryFilter"),
  agent: document.querySelector("#agentFilter"),
  safety: document.querySelector("#safetyFilter"),
  readiness: document.querySelector("#readinessFilter"),
  bundle: document.querySelector("#bundleFilter"),
  trend: document.querySelector("#trendFilter"),
  scriptFilter: document.querySelector("#scriptFilter"),
  license: document.querySelector("#licenseFilter"),
  stars: document.querySelector("#starsFilter"),
  pageSize: document.querySelector("#pageSize"),
  rows: document.querySelector("#catalogRows"),
  resultCount: document.querySelector("#resultCount"),
  pageInfo: document.querySelector("#pageInfo"),
  prevPage: document.querySelector("#prevPage"),
  nextPage: document.querySelector("#nextPage"),
  detail: document.querySelector("#detailContent"),
  detailCard: document.querySelector(".detail-card"),
  refresh: document.querySelector("#refreshData"),
  modePanel: document.querySelector("#modePanel"),
  trendRadar: document.querySelector("#trendRadar")
};

document.body.dataset.density = state.density;

window.__AI_SKILL_CATALOG__ = {
  count: () => records.length,
  visibleCount: () => getFilteredRecords().length,
  selected: () => records.find((record) => record.id === state.selectedId),
  favorites: () => favorites.size,
  collection: () => collection.size,
  compare: () => compare.size,
  search: (value) => {
    elements.search.value = value;
    state.search = value;
    state.page = 1;
    render();
  }
};

elements.search.addEventListener("input", (event) => {
  state.search = event.target.value;
  state.page = 1;
  render();
});

document.querySelector("#searchButton").addEventListener("click", () => {
  state.search = elements.search.value;
  state.page = 1;
  render();
});

document.querySelector("#filterButton").addEventListener("click", () => {
  document.querySelector(".filter-row").classList.toggle("is-focused");
});

for (const key of ["category", "agent", "safety", "readiness", "bundle", "trend", "scriptFilter", "license", "stars"]) {
  elements[key].addEventListener("change", (event) => {
    state[key] = event.target.value;
    state.page = 1;
    render();
  });
}

elements.pageSize.addEventListener("change", (event) => {
  state.pageSize = Number(event.target.value);
  state.page = 1;
  render();
});

elements.prevPage.addEventListener("click", () => {
  state.page = Math.max(1, state.page - 1);
  render();
});

elements.nextPage.addEventListener("click", () => {
  const pageCount = Math.max(1, Math.ceil(getFilteredRecords().length / state.pageSize));
  state.page = Math.min(pageCount, state.page + 1);
  render();
});

document.querySelector("#resetFilters").addEventListener("click", () => {
  Object.assign(state, {
    search: "",
    category: "all",
    agent: "all",
    safety: "all",
    readiness: "all",
    bundle: "all",
    trend: "all",
    scriptFilter: "all",
    license: "all",
    stars: "all",
    page: 1,
    view: "catalog"
  });
  elements.search.value = "";
  for (const key of ["category", "agent", "safety", "readiness", "bundle", "trend", "scriptFilter", "license", "stars"]) elements[key].value = "all";
  setActiveNav("catalog");
  render();
});

document.querySelector("#closeDetail").addEventListener("click", () => {
  elements.detailCard.classList.toggle("is-collapsed");
});

elements.refresh.addEventListener("click", async () => {
  elements.refresh.disabled = true;
  elements.refresh.textContent = "DB更新中";
  elements.refresh.classList.add("is-confirmed");
  state.statusMessage = "GitHubから取得してDBを更新しています。";
  render();

  try {
    const response = await fetch("/api/refresh", { method: "POST", headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `refresh failed: ${response.status}`);
    }
    applyCatalogDataset(payload.dataset);
    state.statusMessage = `DBを更新しました: ${formatDateTime(payload.dataset.generatedAt)}`;
  } catch (error) {
    state.statusMessage = `DB更新に失敗しました: ${String(error.message || error)}。本番環境ではメンテナンス用APIとして無効化されています。`;
  } finally {
    elements.refresh.disabled = false;
    elements.refresh.innerHTML = `<img class="action-icon" src="${refreshIcon}" alt="" aria-hidden="true" />ローカルDB更新`;
    elements.refresh.classList.remove("is-confirmed");
    render();
  }
});
document.querySelectorAll("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.nav;
    state.page = 1;
    setActiveNav(state.view);
    render();
  });
});

document.querySelectorAll("[data-theme]").forEach((button) => {
  button.addEventListener("click", () => {
    state.theme = button.dataset.theme;
    document.body.dataset.theme = state.theme;
    document.querySelectorAll("[data-theme]").forEach((item) => item.classList.toggle("is-active", item === button));
  });
});

function render() {
  renderModePanel();
  renderTrendRadar();
  const filtered = getFilteredRecords();
  const pageCount = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRecords = filtered.slice(start, start + state.pageSize);

  if (!filtered.some((record) => record.id === state.selectedId)) {
    state.selectedId = pageRecords[0]?.id ?? filtered[0]?.id ?? null;
  }

  elements.resultCount.textContent = `${formatNumber(filtered.length)} 件中 ${filtered.length ? start + 1 : 0} - ${Math.min(start + state.pageSize, filtered.length)} 件を表示`;
  elements.pageInfo.textContent = `${state.page} / ${pageCount}`;
  elements.prevPage.disabled = state.page === 1;
  elements.nextPage.disabled = state.page === pageCount;
  elements.rows.innerHTML = pageRecords.map(rowTemplate).join("");

  elements.rows.querySelectorAll("button[data-select]").forEach((button) => {
    button.addEventListener("click", () => selectRecord(Number(button.dataset.select)));
  });
  elements.rows.querySelectorAll("button[data-favorite]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSet(favorites, Number(button.dataset.favorite));
      render();
    });
  });
  elements.rows.querySelectorAll("input[data-compare]").forEach((input) => {
    input.addEventListener("change", (event) => {
      event.stopPropagation();
      toggleSet(compare, Number(input.dataset.compare), input.checked);
      render();
    });
  });

  renderDetail(records.find((record) => record.id === state.selectedId) ?? filtered[0]);
}

function renderModePanel() {
  const panels = {
    catalog: "",
    "agent-fit": summaryPanel("Agent Fit", `Codex / Claude Code / Cursor / MCP との推定互換性で候補を絞り込めます。現在の強一致は ${formatNumber(agentReadyCount())} 件です。`),
    risk: summaryPanel("Risk", `安全性はGitHub公開メタデータ由来の軽量推定です。実行前にREADME、license、script、権限要求を確認してください。`),
    pipelines: summaryPanel("Pipelines", `prompt / hook / tool / instruction / workflow / data-pack を組み合わせて、Agent投入前の導入手順を確認できます。`),
    signals: summaryPanel("Signals", `直近30日更新、MCP、safety gates、multimodal assets などのトレンド信号を表示しています。`),
    compare: summaryPanel("比較", `${compare.size}件を選択中です。チェックボックスまたは詳細パネルから切り替えできます。`),
    settings: settingsPanel()
  };
  elements.modePanel.innerHTML = [state.statusMessage ? `<div class="status-message">${escapeHtml(state.statusMessage)}</div>` : "", panels[state.view] ?? ""].join("");
  elements.modePanel.hidden = !elements.modePanel.innerHTML.trim();

  elements.modePanel.querySelector("[data-sample-import]")?.addEventListener("click", () => {
    const first = records[0]?.id;
    const second = records[1]?.id;
    if (first) {
      favorites.add(first);
      collection.add(first);
      compare.add(first);
      state.selectedId = first;
    }
    if (second) {
      state.history = [second, first].filter(Boolean);
    }
    state.view = "catalog";
    state.statusMessage = "サンプルの選択状態を取り込みました。";
    setActiveNav("catalog");
    render();
  });

  elements.modePanel.querySelector("[data-export-state]")?.addEventListener("click", () => {
    const payload = JSON.stringify({ favorites: [...favorites], collection: [...collection], compare: [...compare], history: state.history }, null, 2);
    downloadText("skill-catalog-state.json", payload, "application/json");
    state.statusMessage = "現在の選択状態を書き出しました。";
    render();
  });

  elements.modePanel.querySelectorAll("[data-density]").forEach((button) => {
    button.addEventListener("click", () => {
      state.density = button.dataset.density;
      document.body.dataset.density = state.density;
      localStorage.setItem("skillCatalogDensity", state.density);
      state.statusMessage = `表示密度を${state.density === "compact" ? "コンパクト" : "標準"}にしました。`;
      render();
    });
  });

  elements.modePanel.querySelector("[data-save-settings]")?.addEventListener("click", () => {
    localStorage.setItem("skillCatalogTheme", state.theme);
    localStorage.setItem("skillCatalogDensity", state.density);
    state.statusMessage = "設定を保存しました。";
    render();
  });
}

function summaryPanel(title, text) {
  return `<div class="utility-card"><strong>${title}</strong><span>${text}</span></div>`;
}

function importPanel() {
  return `<div class="utility-card"><strong>インポート</strong><span>ローカル確認用のサンプルスキルを取り込み、状態JSONを書き出せます。</span><div class="utility-actions"><button type="button" data-sample-import>サンプルを取り込む</button><button type="button" data-export-state>状態を書き出す</button></div></div>`;
}

function settingsPanel() {
  return `<div class="utility-card"><strong>設定</strong><span>テーマと表示密度はブラウザに保存できます。</span><div class="utility-actions"><button type="button" data-density="comfortable">標準表示</button><button type="button" data-density="compact">コンパクト表示</button><button type="button" data-save-settings>設定を保存</button></div></div>`;
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getFilteredRecords() {
  const needle = state.search.trim().toLowerCase();
  return records
    .filter((record) => {
      if (state.view === "compare" && !compare.has(record.id)) return false;
      if (state.view === "agent-fit" && record.agentCompatibility.score < 75) return false;
      if (state.view === "risk" && record.safetySignals.level === "low-review") return false;
      if (state.view === "pipelines" && !record.bundleSignals.types.some((type) => ["prompt", "hook", "tool", "workflow", "mcp-server"].includes(type))) return false;
      if (state.view === "signals" && !record.trendSignals.recent30d) return false;
      if (state.category !== "all" && record.category !== state.category) return false;
      if (state.agent !== "all" && !record.agentCompatibility.agents.some((agent) => agent.name === state.agent && agent.score >= 55)) return false;
      if (state.safety !== "all" && record.safetySignals.level !== state.safety) return false;
      if (state.readiness !== "all" && record.installReadiness.level !== state.readiness) return false;
      if (state.bundle !== "all" && !record.bundleSignals.types.includes(state.bundle)) return false;
      if (state.trend === "last30" && !record.trendSignals.recent30d) return false;
      if (state.trend !== "all" && state.trend !== "last30" && !record.trendSignals.categories.includes(state.trend)) return false;
      if (state.scriptFilter === "yes" && !record.scriptsIncluded) return false;
      if (state.scriptFilter === "no" && record.scriptsIncluded) return false;
      if (state.license !== "all" && record.license !== state.license) return false;
      if (state.stars === "10000" && record.stars < 10000) return false;
      if (state.stars === "1000" && record.stars < 1000) return false;
      if (state.stars === "100" && record.stars < 100) return false;
      if (!needle) return true;
      return [
        record.skillName,
        record.fullName,
        record.capability,
        record.creator,
        record.category,
        record.agent,
        record.language,
        record.agentCompatibility.primary,
        record.bundleSignals.types.join(" "),
        record.trendSignals.categories.join(" "),
        record.safetySignals.permissions.join(" "),
        record.topics.join(" ")
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => b.stars - a.stars);
}

function rowTemplate(record) {
  const isSelected = record.id === state.selectedId;
  const types = record.bundleSignals.types.slice(0, 3).map((type) => `<span>${escapeHtml(type)}</span>`).join("");
  const fit = record.agentCompatibility;
  const safety = record.safetySignals;
  return `
    <tr class="${isSelected ? "is-selected" : ""}" data-row="${record.id}">
      <td class="check-col"><input type="checkbox" data-compare="${record.id}" ${compare.has(record.id) ? "checked" : ""} aria-label="比較に追加" /></td>
      <td class="num-col">${record.rank}</td>
      <td>
        <button class="skill-cell" type="button" data-select="${record.id}">
          <img class="skill-icon" src="${assetForCategory(record.category)}" alt="" aria-hidden="true" />
          <span><strong>${escapeHtml(record.skillName)}</strong><small>${escapeHtml(record.fullName)}</small></span>
        </button>
      </td>
      <td><span class="fit-meter"><strong>${escapeHtml(fit.primary)}</strong><small>${fit.score}</small></span><p class="summary">${escapeHtml(fit.evidence.slice(0, 2).join(" / "))}</p></td>
      <td><div class="tag-line">${types}</div><small class="row-note">${escapeHtml(record.installReadiness.level)} / ${escapeHtml(record.installReadiness.recipe)}</small></td>
      <td><span class="risk-pill ${escapeHtml(safety.level)}">${escapeHtml(safety.label)}</span><small class="row-note">${escapeHtml(safety.permissions.slice(0, 2).join(", "))}</small></td>
      <td><button class="star-button ${favorites.has(record.id) ? "is-saved" : ""}" type="button" data-favorite="${record.id}" aria-label="お気に入り切り替え"><img src="${favoriteIcon}" alt="" aria-hidden="true" /></button> ${formatCompact(record.stars)}</td>
      <td>${formatDate(record.updatedAt)}</td>
      <td>${escapeHtml(record.license)}</td>
      <td><a class="github-link" href="${safeUrl(record.url)}" target="_blank" rel="noopener noreferrer" aria-label="GitHubで開く"><img class="row-action-icon" src="${externalIcon}" alt="" aria-hidden="true" />GitHub</a></td>
    </tr>
  `;
}

function renderDetail(record) {
  if (!record) {
    elements.detail.innerHTML = emptyState();
    return;
  }

  const topics = record.topics.slice(0, 8).map((topic) => `<span>${escapeHtml(topic)}</span>`).join("");
  const agentFits = record.agentCompatibility.agents
    .slice(0, 5)
    .map((agent) => `<span>${escapeHtml(agent.name)} ${agent.score}</span>`)
    .join("");
  const bundleTypes = record.bundleSignals.types.map((type) => `<span>${escapeHtml(type)}</span>`).join("");
  const checks = record.installReadiness.checks.map((check) => `<li>${escapeHtml(check)}</li>`).join("");
  const concerns = record.safetySignals.concerns.map((concern) => `<li>${escapeHtml(concern)}</li>`).join("");
  const permissions = record.safetySignals.permissions.map((permission) => `<span>${escapeHtml(permission)}</span>`).join("");
  elements.detail.innerHTML = `
    <div class="detail-profile">
      <img class="detail-icon" src="${assetForCategory(record.category)}" alt="" aria-hidden="true" />
      <h2>${escapeHtml(record.skillName)}</h2>
      <small>${escapeHtml(record.creator)}</small>
      <div class="detail-signals">
        <span>☆ ${formatCompact(record.stars)}</span>
        <span>Fork ${formatCompact(record.forks)}</span>
        <span>Watch ${formatCompact(Math.max(1, Math.round(record.stars / 20)))}</span>
      </div>
    </div>
    <section class="detail-section"><h3>概要</h3><p>${escapeHtml(record.description)}</p></section>
    <section class="detail-section"><h3>Agent Fit</h3><div class="tag-line">${agentFits}</div><p>${escapeHtml(record.agentCompatibility.evidence.join(" / "))}</p></section>
    <section class="detail-section"><h3>Bundle</h3><div class="tag-line">${bundleTypes}${topics}</div></section>
    <section class="detail-section"><h3>Install recipe</h3><p>${escapeHtml(record.installReadiness.recipe)}</p><ul class="signal-list">${checks || "<li>READMEとlicenseの確認が必要です。</li>"}</ul></section>
    <section class="detail-section"><h3>Required permissions / risk</h3><div class="tag-line">${permissions}</div><ul class="signal-list">${concerns || "<li>公開メタデータ上の強い懸念は未検出です。</li>"}</ul></section>
    <section class="detail-section"><h3>Prompts / hooks / tools</h3><p>${escapeHtml(bundleSummary(record.bundleSignals))}</p></section>
    <section class="detail-section"><h3>Source compliance</h3><p>${escapeHtml(record.sourceCompliance.rateLimitNote)} ${escapeHtml(record.sourceCompliance.termsNote)}</p></section>
    <dl class="detail-list">
      <div><dt>Scripts</dt><dd><span class="script-pill ${record.scriptsIncluded ? "yes" : "no"}">${record.scriptsIncluded ? "含む (Yes)" : "なし (No)"}</span></dd></div>
      <div><dt>ライセンス</dt><dd>${escapeHtml(record.license)}</dd></div>
      <div><dt>言語</dt><dd>${escapeHtml(record.language)}</dd></div>
      <div><dt>Safety</dt><dd>${escapeHtml(record.safetySignals.label)} / ${record.safetySignals.score}</dd></div>
      <div><dt>Trend</dt><dd>${escapeHtml(record.trendSignals.categories.join(", "))}</dd></div>
      <div><dt>最終更新</dt><dd>${formatDate(record.updatedAt)}</dd></div>
    </dl>
    <a class="primary-link" href="${safeUrl(record.url)}" target="_blank" rel="noopener noreferrer">GitHubで見る<img class="primary-link-icon" src="${externalIcon}" alt="" aria-hidden="true" /></a>
    <div class="detail-actions">
      <button type="button" data-collection="${record.id}">${collection.has(record.id) ? "コレクション済み" : "コレクションに追加"}</button>
      <button type="button" data-detail-compare="${record.id}">${compare.has(record.id) ? "比較から外す" : "比較に追加"}</button>
    </div>
  `;
  elements.detail.querySelector("[data-collection]").addEventListener("click", (event) => {
    toggleSet(collection, Number(event.currentTarget.dataset.collection));
    render();
  });
  elements.detail.querySelector("[data-detail-compare]").addEventListener("click", (event) => {
    toggleSet(compare, Number(event.currentTarget.dataset.detailCompare));
    render();
  });
}

function selectRecord(id) {
  state.selectedId = id;
  state.history = [id, ...state.history.filter((item) => item !== id)].slice(0, 50);
  elements.detailCard.classList.remove("is-collapsed");
  render();
}

function toggleSet(set, id, force) {
  const shouldAdd = force ?? !set.has(id);
  if (shouldAdd) set.add(id);
  else set.delete(id);
}

function setActiveNav(view) {
  document.querySelectorAll("[data-nav]").forEach((button) => button.classList.toggle("is-active", button.dataset.nav === view));
}

function emptyState() {
  const label = {
    favorites: "お気に入りはまだありません。",
    collection: "コレクションはまだありません。",
    compare: "比較対象はまだありません。",
    history: "履歴はまだありません。"
  }[state.view] ?? "一致する候補がありません。";
  return `<p class="empty-state">${label}</p>`;
}

function selectControl(label, id, key, values, customValues = false) {
  const options = values
    .map((value) => {
      const optionValue = customValues ? optionValueFor(value) : value;
      return `<option value="${escapeHtml(optionValue)}">${escapeHtml(value)}</option>`;
    })
    .join("");
  return `<label class="select-box"><span>${label}</span><select id="${id}" data-state="${key}"><option value="all">すべて</option>${options}</select></label>`;
}

function navButton(view, icon, label) {
  return `<button class="nav-item ${view === "catalog" ? "is-active" : ""}" type="button" data-nav="${view}"><img class="nav-icon" src="${assetForIcon(icon)}" alt="" aria-hidden="true" />${label}</button>`;
}

function statCard(icon, value, label, note) {
  return `<article class="stat-card"><img class="stat-icon" src="${assetForIcon(icon)}" alt="" aria-hidden="true" /><div><strong>${value}</strong><span>${label}</span><small>${note}</small></div></article>`;
}

function matchRule(text, rules, fallback) {
  return rules.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0] ?? fallback;
}

function optionValueFor(label) {
  if (label === "推定あり") return "yes";
  if (label === "推定なし") return "no";
  if (label === "Low review") return "low-review";
  if (label === "Needs review") return "needs-review";
  if (label === "High review") return "high-review";
  if (label === "Ready") return "ready";
  if (label === "Review") return "review";
  if (label === "Triage") return "triage";
  if (label === "Last 30 days") return "last30";
  if (label === "MCP tools") return "MCP tools";
  if (label === "agent skills") return "agent skills";
  if (label === "safety gates") return "safety gates";
  if (label === "1万以上") return "10000";
  if (label === "1000以上") return "1000";
  if (label === "100以上") return "100";
  return label;
}

async function loadCatalogDataset() {
  try {
    const response = await fetch("/api/catalog", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`catalog API ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new Error(`catalog API returned ${contentType || "unknown content type"}`);
    }
    return await response.json();
  } catch {
    return seedCatalog;
  }
}

function buildRecords(rawRecords) {
  return rawRecords.map((record, index) => {
    const text = [record.skillName, record.fullName, record.description, record.capability, record.language, record.topics.join(" ")]
      .join(" ")
      .toLowerCase();
    const enriched = normalizeInsights(record);
    return {
      ...enriched,
      rank: index + 1,
      category: matchRule(text, categoryRules, "その他"),
      agent: enriched.agentCompatibility.primary || matchRule(text, agentRules, "汎用LLM"),
      isOpenSource: record.license && record.license !== "NOASSERTION",
      selected: false
    };
  });
}

function renderTrendRadar() {
  if (!elements.trendRadar) return;
  const categories = trendCategories();
  elements.trendRadar.innerHTML = categories
    .map((category) => {
      const count = records.filter((record) => record.trendSignals.categories.includes(category)).length;
      return `<button type="button" data-trend-chip="${escapeHtml(category)}"><strong>${formatNumber(count)}</strong><span>${escapeHtml(category)}</span></button>`;
    })
    .join("");
  elements.trendRadar.querySelectorAll("[data-trend-chip]").forEach((button) => {
    button.addEventListener("click", () => {
      state.trend = button.dataset.trendChip;
      elements.trend.value = state.trend;
      state.view = "signals";
      state.page = 1;
      setActiveNav("signals");
      render();
    });
  });
}

function normalizeInsights(record) {
  const topics = Array.isArray(record.topics) ? record.topics : [];
  const text = [record.skillName, record.fullName, record.description, record.capability, record.language, topics.join(" ")]
    .join(" ")
    .toLowerCase();
  const primary = record.agentCompatibility?.primary || matchRule(text, agentRules, "汎用LLM");
  const agents = record.agentCompatibility?.agents?.length
    ? record.agentCompatibility.agents
    : ["Codex", "Claude Code", "Cursor", "MCP", "GitHub Copilot", "汎用LLM"].map((name) => ({
        name,
        score: name === primary ? 78 : 42,
        level: name === primary ? "strong" : "weak",
        reasons: [`metadata fallback: ${name}`]
      }));
  const bundleTypes = record.bundleSignals?.types?.length ? record.bundleSignals.types : inferBundleTypes(text);
  const safetyScore = record.safetySignals?.score ?? (record.license && record.license !== "NOASSERTION" ? 76 : 58);
  return {
    ...record,
    agentCompatibility: {
      primary,
      score: record.agentCompatibility?.score ?? agents[0]?.score ?? 60,
      agents,
      evidence: record.agentCompatibility?.evidence ?? [`metadata primary: ${primary}`],
      inferred: true
    },
    installReadiness: {
      score: record.installReadiness?.score ?? (record.stars >= 10000 ? 82 : 64),
      level: record.installReadiness?.level ?? (record.stars >= 10000 ? "ready" : "review"),
      recipe: record.installReadiness?.recipe ?? `Review ${record.fullName}, verify license and README, then install only inside a sandbox.`,
      checks: record.installReadiness?.checks ?? [record.scriptsReason || "metadata reviewed"],
      blockers: record.installReadiness?.blockers ?? [],
      inferred: true
    },
    safetySignals: {
      score: safetyScore,
      level: record.safetySignals?.level ?? (safetyScore >= 78 ? "low-review" : "needs-review"),
      label: record.safetySignals?.label ?? (safetyScore >= 78 ? "Low review" : "Needs review"),
      badges: record.safetySignals?.badges ?? [],
      concerns: record.safetySignals?.concerns ?? (record.scriptsIncluded ? ["script or runtime execution should be sandboxed"] : []),
      permissions: record.safetySignals?.permissions ?? (record.scriptsIncluded ? ["runtime execution"] : ["read-only metadata review"]),
      inferred: true
    },
    bundleSignals: {
      types: bundleTypes,
      promptSignals: record.bundleSignals?.promptSignals ?? [],
      hookSignals: record.bundleSignals?.hookSignals ?? [],
      toolSignals: record.bundleSignals?.toolSignals ?? [],
      dataSignals: record.bundleSignals?.dataSignals ?? [],
      installTargets: record.bundleSignals?.installTargets ?? ["Markdown instructions"],
      topics,
      inferred: true
    },
    trendSignals: {
      recent30d: record.trendSignals?.recent30d ?? isRecent(record.updatedAt, 30),
      categories: record.trendSignals?.categories ?? inferTrendCategories(text),
      radarWeight: record.trendSignals?.radarWeight ?? 50,
      latestMovement: record.trendSignals?.latestMovement ?? (isRecent(record.updatedAt, 30) ? "last-30-days" : "catalog-baseline"),
      bundleTypes,
      inferred: true
    },
    sourceCompliance: {
      source: record.sourceCompliance?.source ?? "GitHub REST Search API",
      sourceDocs: record.sourceCompliance?.sourceDocs ?? "https://docs.github.com/rest/search/search#search-repositories",
      allowedUse: record.sourceCompliance?.allowedUse ?? "Public repository metadata only",
      rateLimitNote:
        record.sourceCompliance?.rateLimitNote ??
        "GitHub REST Search API rate limits and the 1,000-result search window are respected by paged official API calls.",
      termsNote:
        record.sourceCompliance?.termsNote ??
        "Repository contents, licenses, and third-party terms must be checked before installing or executing any skill.",
      inferred: false
    }
  };
}

function applyCatalogDataset(nextCatalog) {
  catalog = nextCatalog;
  records = buildRecords(catalog.records);
  categories = unique(records.map((record) => record.category));
  agents = unique(records.map((record) => record.agent));
  languages = unique(records.map((record) => record.language).filter(Boolean)).slice(0, 80);
  licenses = unique(records.map((record) => record.license).filter(Boolean)).slice(0, 50);
  Object.assign(state, {
    search: "",
    category: "all",
    agent: "all",
    safety: "all",
    readiness: "all",
    bundle: "all",
    trend: "all",
    scriptFilter: "all",
    stars: "all",
    page: 1,
    selectedId: records[0]?.id ?? null,
    view: "catalog"
  });
  elements.search.value = "";
  refreshSelectOptions();
  setActiveNav("catalog");
  document.querySelector("#updatedAt").textContent = `最終更新: ${formatDateTime(catalog.generatedAt)}`;
  document.querySelector(".hero-count strong").textContent = formatNumber(records.length);
}

function refreshSelectOptions() {
  replaceOptions(elements.category, categories);
  replaceOptions(elements.agent, agents);
  replaceOptions(elements.safety, ["Low review", "Needs review", "High review"], true);
  replaceOptions(elements.readiness, ["Ready", "Review", "Triage"], true);
  replaceOptions(elements.bundle, ["skill", "tool", "prompt", "hook", "instruction", "workflow", "data-pack", "mcp-server"]);
  replaceOptions(elements.trend, ["Last 30 days", ...trendCategories()], true);
  replaceOptions(elements.scriptFilter, ["推定あり", "推定なし"], true);
  replaceOptions(elements.license, licenses);
  replaceOptions(elements.stars, ["1万以上", "1000以上", "100以上"], true);
}

function replaceOptions(select, values, special = false) {
  const selected = select.value;
  select.innerHTML = `<option value="all">すべて</option>${values
    .map((value) => `<option value="${special ? optionValueFor(value) : escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("")}`;
  select.value = [...select.options].some((option) => option.value === selected) ? selected : "all";
}
function unique(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), "ja"));
}

function scriptCount() {
  return records.filter((record) => record.scriptsIncluded).length;
}

function totalStars() {
  return records.reduce((sum, record) => sum + Number(record.stars || 0), 0);
}

function openSourceRate() {
  return ((records.filter((record) => record.isOpenSource).length / records.length) * 100).toFixed(1);
}

function agentReadyCount() {
  return records.filter((record) => record.agentCompatibility.score >= 75).length;
}

function safeReviewRate() {
  return ((records.filter((record) => record.safetySignals.level === "low-review").length / records.length) * 100).toFixed(1);
}

function bundleCount(type) {
  return records.filter((record) => record.bundleSignals.types.includes(type)).length;
}

function last30DaysCount() {
  return records.filter((record) => record.trendSignals.recent30d).length;
}

function trendCategories() {
  return ["MCP tools", "agent skills", "computer-use workflows", "safety gates", "multimodal assets"];
}

function bundleSummary(bundleSignals) {
  const parts = [
    bundleSignals.promptSignals.length ? `prompts: ${bundleSignals.promptSignals.join(", ")}` : "",
    bundleSignals.hookSignals.length ? `hooks: ${bundleSignals.hookSignals.join(", ")}` : "",
    bundleSignals.toolSignals.length ? `tools: ${bundleSignals.toolSignals.join(", ")}` : "",
    bundleSignals.dataSignals.length ? `data: ${bundleSignals.dataSignals.join(", ")}` : ""
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "公開メタデータ上では明確なprompt/hook/tool構成を推定できません。README確認が必要です。";
}

function inferBundleTypes(text) {
  const types = [];
  if (text.includes("mcp")) types.push("mcp-server");
  if (text.includes("tool") || text.includes("api") || text.includes("cli")) types.push("tool");
  if (text.includes("prompt")) types.push("prompt");
  if (text.includes("hook") || text.includes("webhook")) types.push("hook");
  if (text.includes("instruction") || text.includes("rules")) types.push("instruction");
  if (text.includes("workflow") || text.includes("automation")) types.push("workflow");
  if (text.includes("data") || text.includes("rag") || text.includes("graph")) types.push("data-pack");
  if (text.includes("skill") || !types.length) types.push("skill");
  return [...new Set(types)];
}

function inferTrendCategories(text) {
  const categories = [];
  if (text.includes("mcp") || text.includes("tool")) categories.push("MCP tools");
  if (text.includes("agent") || text.includes("skill") || text.includes("codex") || text.includes("claude")) categories.push("agent skills");
  if (text.includes("browser") || text.includes("automation") || text.includes("computer")) categories.push("computer-use workflows");
  if (text.includes("security") || text.includes("audit") || text.includes("sandbox") || text.includes("policy")) categories.push("safety gates");
  if (text.includes("image") || text.includes("video") || text.includes("audio") || text.includes("vision")) categories.push("multimodal assets");
  return categories.length ? categories : ["agent skills"];
}

function isRecent(value, days) {
  return Date.now() - new Date(value).getTime() <= days * 86400000;
}

function assetForIcon(icon) {
  return {
    catalog: catalogIcon,
    star: favoriteIcon,
    layers: collectionIcon,
    scale: compareIcon,
    clock: historyIcon,
    download: importIcon,
    gear: settingsIcon,
    cube: catalogIcon,
    users: creatorsIcon,
    code: scriptsIcon,
    shield: opensourceIcon,
    agent: agentIcon,
    chart: chartIcon
  }[icon] ?? catalogIcon;
}

function assetForCategory(category) {
  return {
    開発支援: agentIcon,
    IDE拡張: catalogIcon,
    生成補助: scriptsIcon,
    データ分析: chartIcon,
    セキュリティ: opensourceIcon,
    コンテンツ: favoriteIcon
  }[category] ?? catalogIcon;
}

function safeUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:") return "https://github.com/search?q=ai+skills&type=repositories";
    if (url.hostname === "github.com" || url.hostname === "docs.github.com") return url.toString();
  } catch {
    return "https://github.com/search?q=ai+skills&type=repositories";
  }
  return "https://github.com/search?q=ai+skills&type=repositories";
}

function formatNumber(value) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function formatCompact(value) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();







