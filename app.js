

// H1→M5 M5候補ペアランキング 20260607
function renderH1M5SelectedPairCard(h1m5) {
  const pair = selectedH1M5Pair || "USDJPY";
  const data = h1m5?.pairs?.[pair];
  if (!data) return "";

  return `
    <div class="series-pair-panel">
      <h3>${pair}（選択通貨）</h3>
      <div class="stats-grid">
        ${statCard("件数", data.summary?.sample_count ?? 0)}
        ${statCard("更新率", pct(data.summary?.update_rate))}
        ${statCard("Fib平均", pct(data.summary?.avg_fib_pct))}
        ${statCard("中央値比平均", ratio(data.summary?.avg_median_ratio))}
      </div>
    </div>
  `;
}

function renderH1M5M5PairRanking(h1m5) {
  const rankData = h1m5 && h1m5.m5_pair_rankings ? h1m5.m5_pair_rankings : null;
  if (!rankData || !rankData.groups) return "";

  const theme = selectedH1M5Theme || "JPY";
  const g = rankData.groups[theme];
  if (!g || !g.pairs || !g.pairs.length) return "";

  let pairs = g.pairs;
  if (selectedH1M5RelatedPairs && selectedH1M5RelatedPairs.length) {
    const allowed = new Set(selectedH1M5RelatedPairs.map(x => String(x).toUpperCase()));
    pairs = g.pairs.filter(p => allowed.has(String(p.pair || "").toUpperCase()));
  }

  const pairTabs = pairs.map((p, i) => {
    const pair = String(p.pair || "").toUpperCase();
    return `<button class="pair-tab ${pair === selectedH1M5Pair ? "active" : ""}" type="button" onclick="selectedH1M5Pair='${pair}'; selectedSeriesPair='${pair}'; renderTab('h1_m5');">${pair}</button>`;
  }).join("");

  const ranked = pairs.map(p => p.pair);

  return `
    <div class="pair-tabs-wrap">
      <h3>個別通貨ペア</h3>
      <div class="pair-tabs">${pairTabs}</div>

      <div class="pair-rank-wrap">
        <div class="pair-rank-title">中央値比平均ランキング</div>
        <div class="pair-rank-row">
          ${ranked.map((p, i) =>
            `<span class="pair-rank-item ${p === selectedH1M5Pair ? "active" : ""}" onclick="selectedH1M5Pair='${p}'; selectedSeriesPair='${p}'; renderTab('h1_m5');">${i + 1}. ${p}</span>`
          ).join("")}
        </div>
      </div>
    </div>
  `;
}


﻿let activeData = null;
let selectedSeriesPair = "USDJPY";
let selectedH1M5Theme = "JPY";
let selectedH1M5RelatedPairs = null;
let selectedH1M5Pair = "USDJPY";
let statsData = null;
let pendingCloseId = null;

const STATUS_LABELS = {
  watching: "押し待ち",
  ready: "READY",
  completed: "完了",
  invalidated: "無効",
  manually_closed: "手動終了"
};


const SERIES_CURRENCY_PAIRS = {
  JPY: ["USDJPY", "EURJPY", "GBPJPY", "AUDJPY"],
  USD: ["EURUSD", "GBPUSD", "AUDUSD", "USDJPY"],
  EUR: ["EURJPY", "EURUSD", "EURAUD"],
  GBP: ["GBPJPY", "GBPUSD", "GBPAUD"],
  AUD: ["AUDJPY", "AUDUSD", "EURAUD", "GBPAUD"]
};

const SOURCE_LABELS = {
  series: "通貨シリーズ",
  h1_m5: "H1→M5",
  h1_m15: "H1→M15",
  h4_m5: "H4→M5",
  h4_m15: "H4→M15"
};

function pct(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return "-";
  return `${n.toFixed(1).replace(".0", "")}%`;
}

function pip(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return "-";
  return `${n.toFixed(1).replace(".0", "")}p`;
}

function ratio(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return "-";
  return `${n.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}x`;
}

function timeHM(value) {
  if (!value) return "-";
  const m = String(value).match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : String(value);
}

async function loadJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} load failed: ${res.status}`);
  return await res.json();
}

async function init() {
  try {
    activeData = await loadJson("data/active_notifications.json");
    statsData = await loadJson("data/dashboard_stats.json");
    renderActiveNotifications();
    renderTab("series");
    setupTabs();
    setupModal();
  } catch (err) {
    document.getElementById("activeNotifications").innerHTML =
      `<div class="empty">JSON読み込みに失敗: ${err.message}</div>`;
  }
}


function renderRelatedRealtimeRanking(n) {
  const rows = Array.isArray(n?.related_realtime_ranking) ? n.related_realtime_ranking : [];
  if (!rows.length) return "";

  const body = rows.map((r, i) => {
    const rank = r.rank ?? (i + 1);
    const pair = r.pair || "-";
    const dir = r.direction || "-";
    const ratioText = ratio(r.m5_wave1_vs_recent_median);
    const fibValue = r.current_fib_display_pct ?? r.current_fib_pct;
    const fibText = pct(fibValue);
    const fibClass = Number(fibValue) < 0 ? " is-over100" : "";

    return `
      <div class="related-rank-item${fibClass}">
        <span>${rank}. ${pair} ${dir}</span>
        <strong>${ratioText} / Fib ${fibText}</strong>
      </div>
    `;
  }).join("");

  return `
    <div class="related-rank-box">
      <div class="related-rank-title">Related ranking / M5 same-time break</div>
      ${body}
    </div>
  `;
}


function renderActiveNotifications() {
  const box = document.getElementById("activeNotifications");
  const count = document.getElementById("notificationCount");
  const notifications = (activeData?.notifications || []).filter(n => n.status !== "manually_closed");

  count.textContent = `${notifications.length}件`;

  if (!notifications.length) {
    box.innerHTML = `<div class="empty">現在通知はありません。</div>`;
    return;
  }

  box.innerHTML = notifications.map(n => `
    <article class="mini-card compact ${String(n.direction || "").toLowerCase()}" data-notification-id="${n.id || ""}" data-notification-pair="${n.pair || ""}">
      <div class="compact-head">
        <strong class="mini-pair">${n.pair || "-"}</strong>
        <span class="mini-direction">${n.direction || "-"}</span>
        <span class="mini-stage ${String(n.stage || "").toLowerCase()}">${n.stage || "-"}</span><span class="mini-timebucket">${n.time_bucket || ""}</span><span class="mini-timebucket">${n.time_bucket || ""}</span>
        <span class="mini-source">${n.source || "-"}</span>
      </div>

      <div class="compact-grid">
        <div><span>&#x73FE;&#x5728;</span><strong>${pct(n.current_pullback_pct)}</strong></div>
        <div><span>M5&#x6CE2;</span><strong>${pip(n.m5_wave1_pips)}</strong></div>
        <div><span>READY&#x901A;&#x77E5;</span><strong>${timeHM(n.m5_notification_time || n.debug?.m5_notification_time || n.created_at_jst)}</strong></div>
        <div><span>&#x66F4;&#x65B0;&#x7387;</span><strong>${pct(statsData?.strategies?.h1_m5?.pairs?.[String(n.pair || "").toUpperCase()]?.summary?.update_rate)}</strong></div>
        <div><span>Fib&#x5E73;&#x5747;</span><strong>${pct(statsData?.strategies?.h1_m5?.pairs?.[String(n.pair || "").toUpperCase()]?.summary?.avg_fib_pct)}</strong></div>
        <div><span>&#x500D;&#x7387;</span><strong>${ratio(n.median_ratio ?? n.median_ratio_24h ?? n.m5_median_ratio_24h ?? n.debug?.m5_wave1_vs_recent_median ?? n.debug?.median_ratio_24h ?? n.debug?.m5_median_ratio_24h)}</strong></div>
      </div>

      ${renderRelatedRealtimeRanking(n)}

      <div class="compact-footer">
        <span class="status-${n.status}">${STATUS_LABELS[n.status] || n.status || "-"}</span>
        <button class="btn end-btn" data-close-id="${n.id}">終了</button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-close-id]").forEach(btn => {
    btn.addEventListener("click", (ev) => { ev.stopPropagation(); openCloseModal(btn.dataset.closeId); });
  });

  document.querySelectorAll("[data-notification-pair]").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.notificationId;
      const n = (activeData?.notifications || []).find(x => String(x.id || "") === String(id || ""));
      const src = String(n?.source || "");

      if (src.includes("H1") && src.includes("M5")) {
        openH1M5RelatedPairs(n);
        return;
      }

      const pair = card.dataset.notificationPair;
      if (pair) openSeriesPair(pair);
    });
  });
}


function currencyForPair(pair) {
  const p = String(pair || "").toUpperCase();

  if (["USDJPY", "EURJPY", "GBPJPY", "AUDJPY"].includes(p)) return "JPY";
  if (["EURUSD", "GBPUSD", "AUDUSD"].includes(p)) return "USD";
  if (["EURAUD", "GBPAUD"].includes(p)) return "AUD";

  for (const [currency, pairs] of Object.entries(SERIES_CURRENCY_PAIRS)) {
    if (pairs.includes(p)) return currency;
  }

  return "JPY";
}

function openH1M5RelatedPairs(n) {
  const rawTheme =
    n?.theme_currency ||
    n?.h1_theme_currency ||
    n?.m5_theme_currency ||
    n?.theme ||
    currencyForPair(n?.pair);

  selectedH1M5Theme = String(rawTheme || "JPY").toUpperCase();

  const rawRelated = n?.related_pairs || n?.relatedPairs || n?.m5_related_pairs || null;
  if (Array.isArray(rawRelated)) {
    selectedH1M5RelatedPairs = rawRelated.map(x => String(x).trim().toUpperCase()).filter(Boolean);
  } else if (rawRelated) {
    selectedH1M5RelatedPairs = String(rawRelated).split(",").map(x => x.trim().toUpperCase()).filter(Boolean);
  } else {
    selectedH1M5RelatedPairs = null;
  }

  const cardPair = String(n?.pair || "").toUpperCase();
  if (cardPair) {
    selectedSeriesPair = cardPair;
    selectedH1M5Pair = cardPair;
  }

  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  const h1m5Tab = document.querySelector(`[data-tab="h1_m5"]`);
  if (h1m5Tab) h1m5Tab.classList.add("active");

  renderTab("h1_m5");
}

function openSeriesPair(pair) {
  const p = String(pair || "").toUpperCase();
  const series = statsData?.strategies?.series;
  if (!series || !p) return;

  selectedSeriesPair = p;

  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  const seriesTab = document.querySelector(`[data-tab="series"]`);
  if (seriesTab) seriesTab.classList.add("active");

  renderTab("series");

  const currency = currencyForPair(p);

  const currencyBtn = document.querySelector(`[data-currency-tab="${currency}"]`);
  if (currencyBtn) currencyBtn.click();

  const pairBtn = document.querySelector(`[data-pair-tab="${p}"]`);
  if (pairBtn) pairBtn.click();

  const target = document.getElementById("tabPanel");
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}
function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderTab(btn.dataset.tab);
    });
  });
}


function statCard(label, value) {
  return `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`;
}

function rateCell(value) {
  return pct(value);
}

function renderDistTable(title, rows) {
  const body = (rows || []).map(r => `
    <tr>
      <td>${r.label || r.bucket || r.fib_bucket || "-"}</td>
      <td>${r.sample_count ?? r.count ?? '-'}</td>
      <td>${pct(r.update_rate)}</td>
      <td>${pct(r.reached_90pct_rate)}</td>
      <td>${r.buy_count ?? '-'}</td>
      <td>${pct(r.buy_update_rate)}</td>
      <td>${pct(r.buy_reached_90pct_rate)}</td>
      <td>${r.sell_count ?? '-'}</td>
      <td>${pct(r.sell_update_rate)}</td>
      <td>${pct(r.sell_reached_90pct_rate)}</td>
    </tr>
  `).join("");

  return `
    <div class="table-wrap">
      <div class="sub-title">${title}</div>
      <table class="stats-table">
        <thead>
          <tr>
            <th>帯</th>
            <th>全体件数</th><th>全体更新</th><th>90%到達</th>
            <th>買い件数</th><th>買い更新</th><th>90%到達</th>
            <th>売り件数</th><th>売り更新</th><th>90%到達</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}


function renderRankTable(rows) {
  const body = (rows || []).map(r => `
    <tr>
      <td>${r.rank || "-"}</td>
      <td>${r.sample_count ?? 0}</td>
      <td>${pct(r.update_rate)}</td><td>${pct(r.reached_90pct_rate)}</td>
      <td>${pct(r.origin_break_rate)}</td>
    </tr>
  `).join("");

  return `
    <div class="dist-block">
      <h3>ランク別</h3>
      <table class="stats-table">
        <thead><tr><th>ランク</th><th>件数</th><th>更新率</th><th>起点割れ</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}


function renderTpTable(title, rows, tone = "all") {
  const body = (rows || []).map(r => `
    <tr>
      <td class="tp-fib-cell">${r.fib || "-"}</td>
      <td>${r.count ?? "-"}</td>
      <td class="tp-rate-cell">${r.reach_161 ?? "-"}</td>
      <td class="tp-rate-cell">${r.reach_127 ?? "-"}</td>
      <td class="tp-rate-cell">${r.reach_100 ?? "-"}</td>
      <td class="tp-rate-cell">${r.reach_90 ?? "-"}</td>
      <td class="tp-rate-cell">${r.reach_80 ?? "-"}</td>
      <td class="tp-rate-cell">${r.reach_70 ?? "-"}</td>
      <td class="tp-rate-cell">${r.reach_60 ?? "-"}</td>
      <td class="tp-rate-cell">${r.reach_50 ?? "-"}</td>
      <td class="tp-rate-cell">${r.reach_40 ?? "-"}</td>
    </tr>
  `).join("");

  return `
    <div class="table-wrap">
      <div class="sub-title">${title}</div>
      <table class="stats-table tp-table tp-table-${tone}">
        <thead>
          <tr>
            <th>fib</th>
            <th>件数</th>
            <th>200-161<br>(&gt;161)</th>
            <th>161-127<br>(&gt;127)</th>
            <th>0-100<br>(&gt;100)</th>
            <th>0-10<br>(&gt;90)</th>
            <th>10-20<br>(&gt;80)</th>
            <th>20-30<br>(&gt;70)</th>
            <th>30-40<br>(&gt;60)</th>
            <th>40-50<br>(&gt;50)</th>
            <th>50-60<br>(&gt;40)</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function setupTpRowSelect() {
  document.querySelectorAll(".tp-fib-cell").forEach(cell => {
    cell.addEventListener("click", () => {
      const table = cell.closest(".tp-table");
      const row = cell.closest("tr");
      if (!table || !row) return;

      const wasSelected = row.classList.contains("tp-selected-row");

      table.querySelectorAll("tbody tr").forEach(r => {
        r.classList.remove("tp-selected-row");
        r.querySelectorAll(".tp-rate-cell").forEach(td => td.classList.remove("tp-hot"));
      });

      if (wasSelected) return;

      row.classList.add("tp-selected-row");

      row.querySelectorAll(".tp-rate-cell").forEach(td => {
        const v = parseFloat(String(td.textContent).replace("%", "").trim());
        if (!Number.isNaN(v) && v >= 70) {
          td.classList.add("tp-hot");
        }
      });
    });
  });
}

function renderPairTpTables(series, pair) {
  const allRows = series?.tp_by_pair?.[pair] || series?.tp_summary || [];
  const buyRows = series?.tp_by_pair_direction?.[pair]?.BUY || [];
  const sellRows = series?.tp_by_pair_direction?.[pair]?.SELL || [];

  return `
    ${renderTpTable(`TP到達分布 ${pair}`, allRows, "all")}
    ${renderTpTable(`TP到達分布 ${pair} BUY`, buyRows, "buy")}
    ${renderTpTable(`TP到達分布 ${pair} SELL`, sellRows, "sell")}
  `;
}

function renderSeriesTpSelectedPairCard(series) {
  const pair = selectedSeriesPair || "USDJPY";
  const data = series?.pairs?.[pair];
  if (!data) return "";

  return `
    <div class="series-pair-panel">
      <h3>${pair}（選択通貨）</h3>
      <div class="stats-grid">
        ${statCard("件数", data.summary?.sample_count ?? 0)}
        ${statCard("更新率", pct(data.summary?.update_rate))}
        ${statCard("Fib平均", pct(data.summary?.avg_fib_pct))}
        ${statCard("中央値比平均", ratio(data.summary?.avg_median_ratio))}
      </div>
    </div>
  `;
}


function renderSeriesTpPairNavView(series, currency = "JPY") {
  const pairs = series?.pairs || {};
  const allowed = SERIES_CURRENCY_PAIRS[currency] || Object.keys(pairs);
  const keys = allowed.filter(p => pairs[p]);
  if (!keys.length) return "";

  const ranked = keys.slice().sort(
    (a, b) => (pairs[b]?.summary?.avg_median_ratio ?? 0) - (pairs[a]?.summary?.avg_median_ratio ?? 0)
  );

  return `
    <div class="pair-tabs-wrap">
      <h3>個別通貨ペア</h3>
      <div class="pair-tabs">
        ${keys.map(p => `<span class="pair-tab ${p === selectedSeriesPair ? "active" : ""}" onclick="selectedSeriesPair=\'${p}\'; renderTab(\'series\');">${p}</span>`).join("")}
      </div>
      <div class="pair-rank-wrap">
        <div class="pair-rank-title">中央値比平均ランキング</div>
        <div class="pair-rank-row">
          ${ranked.map((p, i) => `<span class="pair-rank-item ${p === selectedSeriesPair ? "active" : ""}" onclick="selectedSeriesPair=\'${p}\'; renderTab(\'series\');">${i + 1}. ${p}</span>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderSeriesEtTpBlock(series) {
  return `
    <div class="series-et-tp-block">
      <div class="mini-tabs">
        <button class="mini-tab" data-series-mode="et">ET</button>
        <button class="mini-tab active" data-series-mode="tp">TP</button>
      </div>
      <div id="seriesEtTpPanel">
        ${renderSeriesTpSelectedPairCard(series)}
        ${renderSeriesTpPairNavView(series)}
        ${renderPairTpTables(series, selectedSeriesPair)}
      </div>
    </div>
  `;
}

function setupSeriesEtTpTabs(series) {
  document.querySelectorAll("[data-series-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-series-mode]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const mode = btn.dataset.seriesMode;
      const panel = document.getElementById("seriesEtTpPanel");
      if (!panel) return;

      if (mode === "tp") {
        panel.innerHTML = renderSeriesTpSelectedPairCard(series) + renderPairTpTables(series, selectedSeriesPair); setupTpRowSelect();
      } else {
        panel.innerHTML = renderDistTable("Fib別 更新率", series?.fib_buckets);
      }
    });
  });
}
function renderSeriesCurrencyTabs(series) {
  const currencies = series?.currencies || {};
  const keys = ["JPY", "USD", "EUR", "GBP", "AUD"].filter(k => currencies[k]);
  if (!keys.length) return "";

  const first = keys[0];
  const tabs = keys.map((c, i) =>
    `<button class="pair-tab ${i === 0 ? "active" : ""}" data-currency-tab="${c}">${c}</button>`
  ).join("");

  return `
    <div class="pair-tabs-wrap">
      <h3>通貨別</h3>
      <div class="pair-tabs">${tabs}</div>
      <div id="seriesCurrencyPanel">
        ${renderSeriesCurrencyPanel(first, currencies[first])}
      </div>
    </div>
  `;
}

function renderSeriesCurrencyPanel(currency, data) {
  if (!data) return `<div class="empty">通貨統計なし</div>`;

  return `
    <div class="series-pair-panel">
      <h3>${currency}</h3>
      <div class="stats-grid">
        ${statCard("件数", data.summary?.sample_count ?? 0)}
        ${statCard("更新率", pct(data.summary?.update_rate))}
        ${statCard("Fib平均", pct(data.summary?.avg_fib_pct))}
        ${statCard("中央値比平均", ratio(data.summary?.avg_median_ratio))}
      </div>
      ${renderDistTable("Fib別 更新率", data.fib_buckets)}
    </div>
  `;
}

function setupSeriesCurrencyTabs(series) {
  document.querySelectorAll("[data-currency-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-currency-tab]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const currency = btn.dataset.currencyTab;
      const panel = document.getElementById("seriesCurrencyPanel");
      if (panel) panel.innerHTML = renderSeriesCurrencyPanel(currency, series.currencies[currency]);

      const pairHost = document.getElementById("seriesPairTabsHost");
      if (pairHost) {
        pairHost.innerHTML = renderSeriesPairTabs(series, currency);

        const firstPairBtn = pairHost.querySelector("[data-pair-tab]");
        if (firstPairBtn) selectedSeriesPair = firstPairBtn.dataset.pairTab;

        const modeBtn = document.querySelector("[data-series-mode].active");
        const etTpPanel = document.getElementById("seriesEtTpPanel");
        if (modeBtn?.dataset.seriesMode === "tp" && etTpPanel) {
          etTpPanel.innerHTML = renderSeriesTpSelectedPairCard(series) + renderPairTpTables(series, selectedSeriesPair); setupTpRowSelect();
        }

        setupSeriesPairTabs(series);
      }
    });
  });
}




function renderPairMedianRatioRanking(series, currency = "JPY") {

  const pairs = series?.pairs || {};
  const allowed = SERIES_CURRENCY_PAIRS[currency] || [];

  const ranked = allowed
    .filter(p => pairs[p])
    .sort(
      (a, b) =>
        (pairs[b]?.summary?.avg_median_ratio ?? 0) -
        (pairs[a]?.summary?.avg_median_ratio ?? 0)
    );

  return `
    <div class="pair-rank-wrap">
      <div class="pair-rank-title">中央値比平均ランキング</div>
      <div class="pair-rank-row">
        ${ranked.map((p, i) =>
          `<span class="pair-rank-item ${p === selectedH1M5Pair ? "active" : ""}" onclick="selectedH1M5Pair='${p}'; selectedSeriesPair='${p}'; renderTab('h1_m5');">${i + 1}. ${p}</span>`
        ).join("")}
      </div>
    </div>
  `;
}



function renderSeriesPairTabs(series, currency = "JPY") {
  const pairs = series?.pairs || {};
  const allowed = SERIES_CURRENCY_PAIRS[currency] || Object.keys(pairs);
  const keys = allowed.filter(p => pairs[p]);
  if (!keys.length) return "";

  const first = keys[0];
  const tabs = keys.map((p, i) =>
    `<button class="pair-tab ${i === 0 ? "active" : ""}" data-pair-tab="${p}">${p}</button>`
  ).join("");

  return `
    <div class="pair-tabs-wrap">
      <h3>個別通貨ペア</h3>
      <div class="pair-tabs">${tabs}</div>
      ${renderPairMedianRatioRanking(series, currency)}

      <div id="seriesPairPanel">
        ${renderSeriesPairPanel(first, pairs[first])}
      </div>
    </div>
  `;
}



function renderSeriesPairPanel(pair, data) {
  if (!data) return `<div class="empty">ペア統計なし</div>`;

  return `
    <div class="series-pair-panel">
      <h3>${pair}</h3>
      <div class="stats-grid">
        ${statCard("件数", data.summary?.sample_count ?? 0)}
        ${statCard("更新率", pct(data.summary?.update_rate))}
        ${statCard("Fib平均", pct(data.summary?.avg_fib_pct))}
        ${statCard("中央値比平均", ratio(data.summary?.avg_median_ratio))}
      </div>
      ${renderDistTable("Fib別 更新率", data.fib_buckets)}
      
    </div>
  `;
}

function setupSeriesPairTabs(series) {
  document.querySelectorAll("[data-pair-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-pair-tab]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const pair = btn.dataset.pairTab;
      selectedSeriesPair = pair;

      const panel = document.getElementById("seriesPairPanel");
      if (panel) panel.innerHTML = renderSeriesPairPanel(pair, series.pairs[pair]);

      const modeBtn = document.querySelector("[data-series-mode].active");
      const etTpPanel = document.getElementById("seriesEtTpPanel");

      if (modeBtn?.dataset.seriesMode === "tp" && etTpPanel) {
        etTpPanel.innerHTML = renderSeriesTpSelectedPairCard(series) + renderPairTpTables(series, selectedSeriesPair); setupTpRowSelect();
      }
    });
  });
}

function renderSeriesTab(series) {
  return `
    <h2>${series.label || "通貨シリーズ"}</h2>

    <div class="stats-grid">
      ${statCard("件数", series.summary?.sample_count ?? 0)}
      ${statCard("更新率", pct(series.summary?.update_rate))}
      ${statCard("Fib平均", pct(series.summary?.avg_fib_pct))}
      ${statCard("中央値比平均", ratio(series.summary?.avg_median_ratio))}
    </div>

    ${renderSeriesEtTpBlock(series)}
    ${renderSeriesCurrencyTabs(series)}

    <div id="seriesPairTabsHost">${renderSeriesPairTabs(series, "JPY")}</div>

    <div class="placeholder">
      <h3>メモ</h3>
      <p>M5推進力は、現在のM5 ZigZag波サイズ ÷ 過去24hのM5 ZigZag波中央値。</p>
      <p>通知ロジックではなく、過去統計の確認用。</p>
    </div>
  `;
}

function renderTab(key) {
  const panel = document.getElementById("tabPanel");
  const s = statsData?.strategies?.[key];

  if (!s) {
    panel.innerHTML = `<div class="empty">統計データなし</div>`;
    return;
  }

  if (key === "series") {
    panel.innerHTML = renderSeriesTab(s);
    setupSeriesEtTpTabs(s);
    setupSeriesCurrencyTabs(s);
    setupSeriesPairTabs(s);
    return;
  }

  if (key === "h1_m5") {
    panel.innerHTML = `
      <h2>${s.label || "H1?M5"}</h2>

      <div class="stats-grid">
        ${statCard("件数", s.summary?.sample_count ?? 0)}
        ${statCard("更新率", pct(s.summary?.update_rate))}
        ${statCard("Fib平均", pct(s.summary?.avg_fib_pct))}
        ${statCard("中央値比平均", ratio(s.summary?.avg_median_ratio))}
      </div>

      ${renderH1M5M5PairRanking(s)}
      ${renderH1M5SelectedPairCard(s)}
      ${renderPairTpTables(s, selectedH1M5Pair)}
    `;
    setupTpRowSelect();
    return;
  }

  panel.innerHTML = `
    <h2>${s.label || SOURCE_LABELS[key] || key}</h2>
    <div class="stats-grid">
      <div class="stat"><span>件数</span><strong>${s.summary?.sample_count ?? 0}</strong></div>
      <div class="stat"><span>平均押し/戻し率</span><strong>${pct(s.summary?.avg_pullback_pct)}</strong></div>
      <div class="stat"><span>更新率</span><strong>${pct(s.summary?.update_rate)}</strong></div>
      <div class="stat"><span>起点割れ率</span><strong>${pct(s.summary?.origin_break_rate)}</strong></div>
    </div>

    <div class="placeholder">
      <h3>v1 下部タブ表示予定</h3>
      <p>ここに押し/戻し分布、更新率、起点割れ率、セッション別、ペア別、月別を表示する。</p>
      <p>詳細ボタンは作らない。現在通知カードの確認はこの右側タブで行う。</p>
    </div>
  `;
}

function setupModal() {
  const cancel = document.getElementById("cancelCloseBtn");
  const confirm = document.getElementById("confirmCloseBtn");
  if (cancel) cancel.addEventListener("click", closeModal);
  if (confirm) confirm.addEventListener("click", confirmManualClose);
}

function openCloseModal(id) {
  pendingCloseId = id;
  const n = (activeData.notifications || []).find(x => x.id === id);
  document.getElementById("modalSummary").innerHTML = `
    <div>${n?.pair || "-"}</div>
    <div>${n?.direction || "-"}</div>
    <div>${n?.stage || "-"}</div>
  `;
  document.getElementById("confirmModal").classList.remove("hidden");
}

function closeModal() {
  pendingCloseId = null;
  document.getElementById("confirmModal").classList.add("hidden");
}

function confirmManualClose() {
  if (!pendingCloseId) return;
  const n = (activeData.notifications || []).find(x => x.id === pendingCloseId);
  if (n) n.status = "manually_closed";
  closeModal();
  renderActiveNotifications();
}

init();




























