import catalogUrl from "./data/ai-skill-packs.json?url";
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
import "./styles.css";

const app = document.querySelector("#app");
app.innerHTML = `<div class="loading-screen" role="status">AI Skill Pack Catalog を読み込んでいます。</div>`;
const catalog = await loadCatalog();
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

const records = catalog.records.map((record, index) => {
  const text = [record.skillName, record.fullName, record.description, record.capability, record.language, record.topics.join(" ")]
    .join(" ")
    .toLowerCase();
  return {
    ...record,
    rank: index + 1,
    category: matchRule(text, categoryRules, "その他"),
    agent: matchRule(text, agentRules, "汎用LLM"),
    isOpenSource: record.license && record.license !== "NOASSERTION",
    selected: false
  };
});

const state = {
  search: "",
  category: "all",
  agent: "all",
  scriptFilter: "all",
  language: "all",
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

const categories = unique(records.map((record) => record.category));
const agents = unique(records.map((record) => record.agent));
const languages = unique(records.map((record) => record.language).filter(Boolean)).slice(0, 80);
const licenses = unique(records.map((record) => record.license).filter(Boolean)).slice(0, 50);

app.innerHTML = `
  <aside class="sidebar" aria-label="メインナビゲーション">
    <a class="brand" href="#top" aria-label="CurioshuLab catalog top">
      <img class="brand-logo" src="${logoUrl}" alt="CurioshuLab" />
    </a>
    <nav class="side-nav">
      ${navButton("catalog", "catalog", "カタログ")}
      ${navButton("favorites", "star", "お気に入り")}
      ${navButton("collection", "layers", "コレクション")}
      ${navButton("compare", "scale", "比較")}
      ${navButton("history", "clock", "履歴")}
      ${navButton("import", "download", "インポート")}
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
          <h1>AI Skill Pack Catalog</h1>
          <span class="badge">GitHub由来</span>
        </div>
        <p>GitHubから収集したAIスキルパックを検索・比較・活用できるカタログです。</p>
      </div>
      <div class="top-actions">
        <span class="updated">最終更新: ${formatDateTime(catalog.generatedAt)}</span>
        <button class="ghost-button" type="button" id="refreshData"><img class="action-icon" src="${refreshIcon}" alt="" aria-hidden="true" />データを更新</button>
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
        ${selectControl("Scripts", "scriptFilter", "scriptFilter", ["推定あり", "推定なし"], true)}
        ${selectControl("言語", "languageFilter", "language", languages)}
        ${selectControl("ライセンス", "licenseFilter", "license", licenses)}
        ${selectControl("スター数", "starsFilter", "stars", ["1万以上", "1000以上", "100以上"], true)}
        <button class="reset-button" type="button" id="resetFilters" data-testid="reset-filters"><img class="action-icon" src="${resetIcon}" alt="" aria-hidden="true" />リセット</button>
      </div>
    </section>

    <section class="stats-row" aria-label="カタログ指標">
      ${statCard("cube", formatNumber(records.length), "総スキルパック数", "1000+ 件のリポジトリ")}
      ${statCard("star", formatCompact(totalStars()), "総スター数", "全リポジトリ合計")}
      ${statCard("users", formatNumber(unique(records.map((record) => record.creator)).length), "ユニーク作成者数", "個人・組織の作成者")}
      ${statCard("code", formatNumber(scriptCount()), "Scripts含む", `${Math.round((scriptCount() / records.length) * 100)}% 推定あり`)}
      ${statCard("shield", `${openSourceRate()}%`, "オープンソース率", "MIT/Apache/GPLなど")}
    </section>

    <section class="mode-panel" id="modePanel" data-testid="mode-panel" aria-live="polite"></section>

    <section class="content-grid" aria-label="検索結果と詳細">
      <div class="table-card">
        <div class="table-scroll" role="region" aria-label="AI skill pack table" tabindex="0">
          <table>
            <thead>
              <tr>
                <th class="check-col">-</th>
                <th class="num-col">#</th>
                <th>スキル名</th>
                <th>概要 / できること</th>
                <th>Scripts</th>
                <th>Creator</th>
                <th>Stars</th>
                <th>更新日</th>
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
      <span>データソース: GitHub Search API</span>
      <a href="${safeUrl(catalog.sourceDocs)}" target="_blank" rel="noopener noreferrer">このページについて</a>
    </footer>
  </main>
`;

const elements = {
  search: document.querySelector("#catalogSearch"),
  category: document.querySelector("#categoryFilter"),
  agent: document.querySelector("#agentFilter"),
  scriptFilter: document.querySelector("#scriptFilter"),
  language: document.querySelector("#languageFilter"),
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
  modePanel: document.querySelector("#modePanel")
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

for (const key of ["category", "agent", "scriptFilter", "language", "license", "stars"]) {
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
    scriptFilter: "all",
    language: "all",
    license: "all",
    stars: "all",
    page: 1,
    view: "catalog"
  });
  elements.search.value = "";
  for (const key of ["category", "agent", "scriptFilter", "language", "license", "stars"]) elements[key].value = "all";
  setActiveNav("catalog");
  render();
});

document.querySelector("#closeDetail").addEventListener("click", () => {
  elements.detailCard.classList.toggle("is-collapsed");
});

elements.refresh.addEventListener("click", () => {
  state.statusMessage = `データ表示を更新しました: ${formatDateTime(new Date().toISOString())}`;
  elements.refresh.textContent = "更新済み";
  elements.refresh.classList.add("is-confirmed");
  render();
  setTimeout(() => {
    elements.refresh.innerHTML = `<img class="action-icon" src="${refreshIcon}" alt="" aria-hidden="true" />データを更新`;
    elements.refresh.classList.remove("is-confirmed");
  }, 1400);
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
    favorites: summaryPanel("お気に入り", `${favorites.size}件を保存中です。星ボタンで追加・解除できます。`),
    collection: summaryPanel("コレクション", `${collection.size}件を保存中です。詳細パネルのボタンで追加・解除できます。`),
    compare: summaryPanel("比較", `${compare.size}件を選択中です。チェックボックスまたは詳細パネルから切り替えできます。`),
    history: summaryPanel("履歴", `${state.history.length}件の閲覧履歴があります。スキル行を開くと履歴に入ります。`),
    import: importPanel(),
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
      if (state.view === "favorites" && !favorites.has(record.id)) return false;
      if (state.view === "collection" && !collection.has(record.id)) return false;
      if (state.view === "compare" && !compare.has(record.id)) return false;
      if (state.view === "history" && !state.history.includes(record.id)) return false;
      if (state.category !== "all" && record.category !== state.category) return false;
      if (state.agent !== "all" && record.agent !== state.agent) return false;
      if (state.scriptFilter === "yes" && !record.scriptsIncluded) return false;
      if (state.scriptFilter === "no" && record.scriptsIncluded) return false;
      if (state.language !== "all" && record.language !== state.language) return false;
      if (state.license !== "all" && record.license !== state.license) return false;
      if (state.stars === "10000" && record.stars < 10000) return false;
      if (state.stars === "1000" && record.stars < 1000) return false;
      if (state.stars === "100" && record.stars < 100) return false;
      if (!needle) return true;
      return [record.skillName, record.fullName, record.capability, record.creator, record.category, record.agent, record.language, record.topics.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => b.stars - a.stars);
}

function rowTemplate(record) {
  const isSelected = record.id === state.selectedId;
  const topics = record.topics.slice(0, 3).map((topic) => `<span>${escapeHtml(topic)}</span>`).join("");
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
      <td><p class="summary">${escapeHtml(record.description)}</p><div class="tag-line">${topics}</div></td>
      <td><span class="script-pill ${record.scriptsIncluded ? "yes" : "no"}">${record.scriptsIncluded ? "Yes" : "No"}</span></td>
      <td><span class="creator"><span class="avatar">${escapeHtml(record.creator.slice(0, 1).toUpperCase())}</span>${escapeHtml(record.creator)}</span></td>
      <td><button class="star-button ${favorites.has(record.id) ? "is-saved" : ""}" type="button" data-favorite="${record.id}" aria-label="お気に入り切り替え"><img src="${favoriteIcon}" alt="" aria-hidden="true" /></button> ${formatCompact(record.stars)}</td>
      <td>${formatDate(record.updatedAt)}</td>
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
    <section class="detail-section"><h3>対応エージェント</h3><div class="tag-line"><span>${escapeHtml(record.agent)}</span></div></section>
    <section class="detail-section"><h3>カテゴリ</h3><div class="tag-line"><span>${escapeHtml(record.category)}</span>${topics}</div></section>
    <dl class="detail-list">
      <div><dt>Scripts</dt><dd><span class="script-pill ${record.scriptsIncluded ? "yes" : "no"}">${record.scriptsIncluded ? "含む (Yes)" : "なし (No)"}</span></dd></div>
      <div><dt>ライセンス</dt><dd>${escapeHtml(record.license)}</dd></div>
      <div><dt>言語</dt><dd>${escapeHtml(record.language)}</dd></div>
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
  if (label === "1万以上") return "10000";
  if (label === "1000以上") return "1000";
  if (label === "100以上") return "100";
  return label;
}

async function loadCatalog() {
  const response = await fetch(catalogUrl);
  if (!response.ok) {
    throw new Error(`Failed to load catalog data: ${response.status}`);
  }
  return response.json();
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




