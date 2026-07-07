/* Threads Poster — フロントエンド */
"use strict";

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const yen = (n) => (Number(n) > 0 ? `${Number(n).toLocaleString("ja-JP")}円` : "—");
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

let toastTimer;
function toast(msg, ms = 3200) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), ms);
}

/* ---------- タブ ---------- */
$$(".tab").forEach((btn) => btn.addEventListener("click", () => showTab(btn.dataset.tab)));
function showTab(name) {
  $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  $$(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.id !== `tab-${name}`));
  if (name === "sheet") loadPosts();
  if (name === "sales") loadSales();
}

/* ---------- Threadsアカウント（最大10個） ---------- */
let accountsCache = [];
async function loadAccounts() {
  const s = await api("/api/settings");
  accountsCache = s.threadsAccounts || [];
  return accountsCache;
}
const accountName = (id) => accountsCache.find((a) => a.id === id)?.name || "";

/* ---------- 予約シート ---------- */
const STATUS_LABEL = { scheduled: "予約中", posting: "投稿中…", posted: "投稿済み", skipped: "スキップ", error: "エラー" };

async function loadPosts() {
  const posts = await api("/api/posts");
  const el = $("#sheetBody");
  if (!posts.length) {
    el.innerHTML = `<div class="empty">— 予約はまだありません。「＋ 新規投稿」から作成 —</div>`;
    return;
  }
  el.innerHTML = posts.map((p) => {
    const prods = (p.tree || []).filter((n) => n.product).map((n) => {
      const oos = Number(n.product.availability) === 0;
      return `<span class="prod-chip">
        ${n.product.imageUrl ? `<img src="${esc(n.product.imageUrl)}" alt="">` : ""}
        <span>${esc(n.product.itemName).slice(0, 30)}…</span>
        <span class="price">${yen(n.product.itemPrice)}</span>
        ${oos ? `<span class="oos">在庫切れ</span>` : ""}
      </span>`;
    }).join("");
    const canPublish = p.status !== "posting";
    return `<div class="post-card" data-id="${esc(p.id)}">
      <div class="head">
        <span class="chip ${esc(p.status)}">${STATUS_LABEL[p.status] || esc(p.status)}</span>
        <span class="when">${fmtDate(p.scheduledAt)}</span>
        <span class="title">${esc(p.title || "（無題）")}</span>
        ${accountName(p.accountId) ? `<span class="chip">👤 ${esc(accountName(p.accountId))}</span>` : ""}
        <span class="chip">🧵 ${p.tree?.length || 0}ツリー</span>
      </div>
      ${prods ? `<div class="products">${prods}</div>` : ""}
      <div class="actions">
        <button class="mini-btn" data-act="edit">✏️ 編集</button>
        ${canPublish ? `<button class="mini-btn" data-act="publish">⚽ 今すぐ投稿</button>` : ""}
        ${p.log?.length ? `<button class="mini-btn" data-act="log">📜 ログ</button>` : ""}
        <button class="mini-btn danger" data-act="delete">🗑 削除</button>
      </div>
      <div class="log hidden">${esc((p.log || []).join("\n"))}</div>
    </div>`;
  }).join("");

  $$(".post-card", el).forEach((card) => {
    const id = card.dataset.id;
    const post = posts.find((p) => p.id === id);
    card.addEventListener("click", async (e) => {
      const act = e.target.dataset?.act;
      if (!act) return;
      if (act === "edit") openEditor(post);
      if (act === "log") $(".log", card).classList.toggle("hidden");
      if (act === "delete") {
        if (!confirm("この予約を削除しますか？")) return;
        await api(`/api/posts/${id}`, { method: "DELETE" });
        loadPosts();
      }
      if (act === "publish") {
        if (!confirm("今すぐ投稿しますか？")) return;
        await api(`/api/posts/${id}/publish`, { method: "POST" });
        toast("投稿を開始しました…（結果はログとマスコットでお知らせ）");
        setTimeout(loadPosts, 2500);
      }
    });
  });
}

$("#refreshProductsBtn").addEventListener("click", async () => {
  toast("価格・在庫を再チェック中…");
  await api("/api/rakuten/refresh", { method: "POST" });
  toast("✅ 価格・在庫の再チェックが完了しました");
  loadPosts();
});

/* ---------- エディタ ---------- */
let editing = null; // {id?, title, scheduledAt, tree:[...]}

function blankNode() {
  return { text: "", imageUrl: "", useProductImage: true, product: null, outOfStockMode: "skip", replaceKeyword: "" };
}

// 楽天ランキングの主要ジャンル（「いま売れてる商品」用）
const GENRES = [
  { id: "", name: "🏆 総合ランキング" },
  { id: "100371", name: "レディースファッション" },
  { id: "551177", name: "メンズファッション" },
  { id: "100227", name: "食品" },
  { id: "551167", name: "スイーツ・お菓子" },
  { id: "562637", name: "家電" },
  { id: "100939", name: "コスメ・香水" },
  { id: "100938", name: "ダイエット・健康" },
  { id: "558944", name: "キッチン用品" },
  { id: "100804", name: "インテリア・寝具" },
  { id: "566382", name: "おもちゃ" },
];

async function openEditor(post) {
  editing = post
    ? JSON.parse(JSON.stringify(post))
    : { title: "", scheduledAt: "", accountId: "", tree: [blankNode()] };
  $("#editorTitle").textContent = post ? "投稿を編集" : "投稿を作成";
  $("#postTitle").value = editing.title || "";
  const dt = editing.scheduledAt ? new Date(editing.scheduledAt) : new Date(Date.now() + 3600000);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  $("#postAt").value = dt.toISOString().slice(0, 16);
  if (!accountsCache.length) await loadAccounts().catch(() => {});
  $("#postAccount").innerHTML = accountsCache.length
    ? accountsCache.map((a) => `<option value="${esc(a.id)}" ${a.id === editing.accountId ? "selected" : ""}>${esc(a.name)}</option>`).join("")
    : `<option value="">（未登録: デモ投稿）</option>`;
  renderTree();
  showTab("editor");
}

$("#newPostBtn").addEventListener("click", () => openEditor(null));
$("#cancelEditBtn").addEventListener("click", () => showTab("sheet"));
$("#addNodeBtn").addEventListener("click", () => { editing.tree.push(blankNode()); renderTree(); });

function renderTree() {
  const el = $("#treeList");
  el.innerHTML = editing.tree.map((node, i) => `
    ${i > 0 ? `<div class="node-connector"></div>` : ""}
    <div class="node-card" data-idx="${i}">
      <div class="node-head">
        <span class="node-no">${i === 0 ? "① メイン投稿" : `${"①②③④⑤⑥⑦⑧⑨⑩"[i] || i + 1} ツリー（ぶら下げ）`}</span>
        <span class="row-gap">
          ${i > 0 ? `<button class="mini-btn" data-nact="up">↑</button>` : ""}
          ${editing.tree.length > 1 ? `<button class="mini-btn danger" data-nact="remove">✕</button>` : ""}
        </span>
      </div>
      <div class="node-grid">
        <label>本文（{商品名} {価格} {URL} が使えます）
          <textarea data-field="text" placeholder="🔥楽天で見つけた神アイテム&#10;{商品名}&#10;今なら {価格} ！&#10;👉 {URL}">${esc(node.text)}</textarea>
        </label>
        ${node.product ? `
          <div class="attached-product">
            ${node.product.imageUrl ? `<img src="${esc(node.product.imageUrl)}" alt="">` : ""}
            <span class="p-name">${esc(node.product.itemName)}</span>
            <span class="p-price">${yen(node.product.itemPrice)}${Number(node.product.availability) === 0 ? " ⚠️在庫切れ" : ""}</span>
            <button class="mini-btn danger" data-nact="detach">解除</button>
          </div>` : `
          <div class="inline-search">
            <div class="search-row">
              <input type="text" data-field="searchKeyword" placeholder="🛒 楽天から商品を検索して添付（例: ワイヤレスイヤホン）">
              <button class="mini-btn" data-nact="search">検索</button>
            </div>
            <div class="search-row" style="margin-top:8px">
              <select data-field="rankGenre" style="flex:1">${GENRES.map((g) => `<option value="${g.id}">${g.name}</option>`).join("")}</select>
              <button class="mini-btn" data-nact="ranking" title="楽天ランキングから、いま売れている商品を取得">🔥 いま売れてる商品</button>
            </div>
            <div class="result-list" data-results></div>
          </div>`}
        <div class="node-row">
          <label>画像URL（空欄なら下のチェックで商品画像を使用）
            <input type="text" data-field="imageUrl" value="${esc(node.imageUrl)}" placeholder="https://...jpg">
          </label>
          <div class="node-opts">
            <label class="inline"><input type="checkbox" data-field="useProductImage" ${node.useProductImage ? "checked" : ""}>商品画像を添付</label>
            <label>在庫切れ時
              <select data-field="outOfStockMode">
                <option value="skip" ${node.outOfStockMode !== "replace" ? "selected" : ""}>この投稿をスキップ</option>
                <option value="replace" ${node.outOfStockMode === "replace" ? "selected" : ""}>代替商品に差し替え</option>
              </select>
            </label>
            ${node.outOfStockMode === "replace" ? `
            <label>代替検索キーワード
              <input type="text" data-field="replaceKeyword" value="${esc(node.replaceKeyword)}" placeholder="空欄なら商品名で検索">
            </label>` : ""}
          </div>
        </div>
      </div>
    </div>`).join("");

  $$(".node-card", el).forEach((card) => {
    const idx = Number(card.dataset.idx);
    const node = editing.tree[idx];
    card.addEventListener("input", (e) => {
      const f = e.target.dataset?.field;
      if (!f) return;
      node[f] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    });
    card.addEventListener("change", (e) => {
      if (e.target.dataset?.field === "outOfStockMode") renderTree();
    });
    card.addEventListener("click", async (e) => {
      const act = e.target.dataset?.nact;
      if (act === "remove") { editing.tree.splice(idx, 1); renderTree(); }
      if (act === "up" && idx > 0) {
        [editing.tree[idx - 1], editing.tree[idx]] = [editing.tree[idx], editing.tree[idx - 1]];
        renderTree();
      }
      if (act === "detach") { node.product = null; renderTree(); }
      if (act === "search") await runSearch(card, node);
      if (act === "ranking") await runRanking(card);
      if (e.target.closest?.("[data-attach]")) {
        node.product = JSON.parse(decodeURIComponent(e.target.closest("[data-attach]").dataset.attach));
        if (!node.text.trim()) node.text = "✨ {商品名}\n\n今なら {価格}\n👉 {URL}";
        renderTree();
      }
    });
    card.addEventListener("keydown", (e) => {
      if (e.target.dataset?.field === "searchKeyword" && e.key === "Enter") {
        e.preventDefault();
        runSearch(card, node);
      }
    });
  });
}

function renderResults(box, items, demo, note = "") {
  if (!items.length) { box.innerHTML = `<div class="hint">見つかりませんでした</div>`; return; }
  box.innerHTML = (demo ? `<div class="hint">※楽天アプリID未設定のためデモ商品を表示中（⚙️設定から登録）</div>` : "") +
    (note ? `<div class="hint">${note}</div>` : "") +
    items.map((it) => `
    <div class="result-item">
      ${it.imageUrl ? `<img src="${esc(it.imageUrl)}" alt="">` : `<img alt="">`}
      <span class="r-name">${esc(it.itemName).slice(0, 60)}</span>
      <span class="r-meta"><span class="price">${yen(it.itemPrice)}</span>${esc(it.shopName)}${Number(it.availability) === 0 ? " ⚠️在庫切れ" : ""}</span>
      <button class="mini-btn" data-attach="${encodeURIComponent(JSON.stringify(it))}">添付</button>
    </div>`).join("");
}

async function runSearch(card, node) {
  const keyword = $('[data-field="searchKeyword"]', card)?.value?.trim();
  const box = $("[data-results]", card);
  if (!keyword) { toast("検索キーワードを入力してください"); return; }
  if (keyword.length < 2) { toast("キーワードは2文字以上で入力してください（楽天APIの仕様）"); return; }
  box.innerHTML = `<div class="hint">検索中…</div>`;
  try {
    const { items, demo } = await api(`/api/rakuten/search?keyword=${encodeURIComponent(keyword)}`);
    renderResults(box, items, demo);
  } catch (e) {
    box.innerHTML = `<div class="hint">エラー: ${esc(e.message)}</div>`;
  }
}

// いま売れている商品（楽天ランキング）
async function runRanking(card) {
  const sel = $('[data-field="rankGenre"]', card);
  const genre = GENRES.find((g) => g.id === sel?.value) || GENRES[0];
  const box = $("[data-results]", card);
  box.innerHTML = `<div class="hint">ランキング取得中…</div>`;
  try {
    const { items, demo } = await api(`/api/rakuten/ranking?genreId=${encodeURIComponent(genre.id)}&genreName=${encodeURIComponent(genre.name)}`);
    renderResults(box, items, demo, `🔥 ${esc(genre.name)}で、いま売れている商品（楽天ランキング）`);
  } catch (e) {
    box.innerHTML = `<div class="hint">エラー: ${esc(e.message)}</div>`;
  }
}

$("#savePostBtn").addEventListener("click", async () => {
  editing.title = $("#postTitle").value.trim();
  const at = $("#postAt").value;
  if (!at) { toast("投稿日時を指定してください"); return; }
  if (editing.tree.every((n) => !n.text.trim() && !n.product)) { toast("本文が空です"); return; }
  try {
    await api("/api/posts", {
      method: "POST",
      body: {
        id: editing.id, title: editing.title, scheduledAt: new Date(at).toISOString(),
        accountId: $("#postAccount").value || "", tree: editing.tree,
      },
    });
    toast("💾 予約を保存しました");
    showTab("sheet");
  } catch (e) {
    toast(`保存エラー: ${e.message}`);
  }
});

/* ---------- セールカレンダー ---------- */
async function loadSales() {
  const { calendar, next, autoGenerate } = await api("/api/sales");
  $("#saleAutoGen").checked = !!autoGenerate;
  $("#saleList").innerHTML = calendar.map((ev) => {
    const live = next && ev.id === next.id && next.started;
    const days = Math.max(0, Math.ceil((new Date(ev.startAt) - Date.now()) / 86400000));
    return `<div class="sale-item ${live ? "live" : ""}">
      <span class="s-name">${ev.type === "super_sale" ? "🔥" : ev.type === "custom" ? "📌" : "🏃"} ${esc(ev.name)}</span>
      <span class="s-date">${fmtDate(ev.startAt)} 〜 ${fmtDate(ev.endAt)}${ev.estimated ? "（推定）" : ""}</span>
      <span class="s-count">${live ? "開催中！" : `あと${days}日`}</span>
    </div>`;
  }).join("");
}
$("#saleAutoGen").addEventListener("change", async (e) => {
  await api("/api/settings", { method: "POST", body: { saleAutoGenerate: e.target.checked } });
  toast(e.target.checked ? "✅ セール開始日の自動投稿生成をONにしました" : "自動生成をOFFにしました");
});

/* ---------- 設定 ---------- */
$("#settingsBtn").addEventListener("click", openSettings);
$("#closeSettingsBtn").addEventListener("click", () => $("#settingsModal").classList.add("hidden"));

let customEvents = [];
let editAccounts = [];
async function openSettings() {
  const s = await api("/api/settings");
  $("#setRakutenAppId").value = s.rakutenAppId || "";
  $("#setRakutenAccessKey").value = s.rakutenAccessKey || "";
  $("#setRakutenAppUrl").value = s.rakutenAppUrl || "";
  $("#setRakutenAffId").value = s.rakutenAffiliateId || "";
  editAccounts = (s.threadsAccounts || []).map((a) => ({ ...a }));
  renderAccounts();
  customEvents = s.customSaleEvents || [];
  renderCustomEvents();
  $("#settingsModal").classList.remove("hidden");
}

function renderAccounts() {
  $("#accountList").innerHTML = editAccounts.map((a, i) => `
    <div class="account-row" data-i="${i}">
      <span class="acc-no">アカウント ${i + 1} / 10</span>
      <input type="text" data-f="name" value="${esc(a.name || "")}" placeholder="表示名">
      <input type="text" data-f="userId" value="${esc(a.userId || "")}" placeholder="ThreadsユーザーID">
      <input type="password" data-f="accessToken" value="${esc(a.accessToken || "")}" placeholder="アクセストークン">
      <button class="mini-btn danger" data-f="del" title="削除">✕</button>
    </div>`).join("");
  $("#addAccountBtn").disabled = editAccounts.length >= 10;
  $("#addAccountBtn").textContent = editAccounts.length >= 10 ? "上限（10個）に達しました" : "＋ アカウントを追加";
  $$(".account-row").forEach((row) => {
    const i = Number(row.dataset.i);
    row.addEventListener("input", (e) => {
      const f = e.target.dataset.f;
      if (f && f !== "del") editAccounts[i][f] = e.target.value;
    });
    $('[data-f="del"]', row).addEventListener("click", () => {
      if (!confirm(`アカウント「${editAccounts[i].name || i + 1}」を削除しますか？`)) return;
      editAccounts.splice(i, 1);
      renderAccounts();
    });
  });
}
$("#addAccountBtn").addEventListener("click", () => {
  if (editAccounts.length >= 10) return;
  editAccounts.push({ id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: `アカウント${editAccounts.length + 1}`, userId: "", accessToken: "" });
  renderAccounts();
});
function renderCustomEvents() {
  $("#customEventList").innerHTML = customEvents.map((ev, i) => `
    <div class="custom-event-row" data-i="${i}">
      <input type="text" data-f="name" value="${esc(ev.name || "")}" placeholder="イベント名">
      <input type="text" data-f="startAt" value="${esc((ev.startAt || "").slice(0, 16))}" placeholder="2026-09-04T20:00">
      <input type="text" data-f="endAt" value="${esc((ev.endAt || "").slice(0, 16))}" placeholder="2026-09-11T01:59">
      <button class="mini-btn danger" data-f="del">✕</button>
    </div>`).join("");
  $$(".custom-event-row").forEach((row) => {
    const i = Number(row.dataset.i);
    row.addEventListener("input", (e) => {
      const f = e.target.dataset.f;
      if (f && f !== "del") customEvents[i][f] = e.target.value;
    });
    $('[data-f="del"]', row).addEventListener("click", () => { customEvents.splice(i, 1); renderCustomEvents(); });
  });
}
$("#addCustomEventBtn").addEventListener("click", () => {
  customEvents.push({ id: `custom-${Date.now()}`, name: "", startAt: "", endAt: "" });
  renderCustomEvents();
});
// 楽天API接続テスト（入力中の値を一旦保存してからテスト）
$("#testRakutenBtn").addEventListener("click", async () => {
  const out = $("#testRakutenResult");
  out.textContent = "テスト中…";
  try {
    await api("/api/settings", {
      method: "POST",
      body: {
        rakutenAppId: $("#setRakutenAppId").value,
        rakutenAccessKey: $("#setRakutenAccessKey").value,
        rakutenAppUrl: $("#setRakutenAppUrl").value,
        rakutenAffiliateId: $("#setRakutenAffId").value,
      },
    });
    const s = await api("/api/settings"); // 自動補正後の値を反映
    $("#setRakutenAppId").value = s.rakutenAppId || "";
    $("#setRakutenAccessKey").value = s.rakutenAccessKey || "";
    $("#setRakutenAppUrl").value = s.rakutenAppUrl || "";
    $("#setRakutenAffId").value = s.rakutenAffiliateId || "";
    const r = await api("/api/rakuten/test", { method: "POST" });
    out.textContent = r.message;
    out.style.color = r.ok ? "var(--green)" : "var(--red)";
  } catch (e) {
    out.textContent = `テスト失敗: ${e.message}`;
    out.style.color = "var(--red)";
  }
});

$("#saveSettingsBtn").addEventListener("click", async () => {
  await api("/api/settings", {
    method: "POST",
    body: {
      threadsAccounts: editAccounts.filter((a) => a.name || a.userId || a.accessToken),
      rakutenAppId: $("#setRakutenAppId").value.trim(),
      rakutenAccessKey: $("#setRakutenAccessKey").value.trim(),
      rakutenAppUrl: $("#setRakutenAppUrl").value.trim(),
      rakutenAffiliateId: $("#setRakutenAffId").value.trim(),
      customSaleEvents: customEvents
        .filter((ev) => ev.name && ev.startAt)
        .map((ev) => ({ ...ev, startAt: new Date(ev.startAt).toISOString(), endAt: ev.endAt ? new Date(ev.endAt).toISOString() : "" })),
    },
  });
  $("#settingsModal").classList.add("hidden");
  toast("✅ 設定を保存しました");
  await loadAccounts().catch(() => {});
  loadStatus();
  loadPosts();
});

/* ---------- ステータス & セールバナー ---------- */
async function loadStatus() {
  const s = await api("/api/status");
  $("#demoBadge").classList.toggle("hidden", !(s.demoThreads || s.demoRakuten));
  const { next } = await api("/api/sales");
  const banner = $("#saleBanner");
  if (next && (next.started || next.daysUntil <= 7)) {
    banner.innerHTML = next.started
      ? `🔥 <b>${esc(next.name)}</b> 開催中！（〜${fmtDate(next.endAt)}${next.estimated ? "・推定" : ""}）投稿チャンスです`
      : `📅 <b>${esc(next.name)}</b> まであと <b>${next.daysUntil}日</b>（${fmtDate(next.startAt)} 開始${next.estimated ? "・推定" : ""}）— 今のうちに投稿を仕込みましょう`;
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
}

/* ---------- マスコット（リフティング / キック） ---------- */
const mascot = $("#mascot");
mascot.classList.add("juggling");

function speak(text, ms = 3000) {
  const el = $("#mascotSpeech");
  el.textContent = text;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), ms);
}

let kicking = false;
function kick(message = "⚽ ゴーーール！投稿完了！") {
  if (kicking) return;
  kicking = true;
  mascot.classList.remove("juggling");
  mascot.classList.add("kick");
  speak(message);
  setTimeout(() => {
    mascot.classList.remove("kick");
    mascot.classList.add("juggling");
    kicking = false;
  }, 1900);
}

/* ---------- イベントポーリング ---------- */
let lastEventId = 0;
let firstPoll = true;
async function pollEvents() {
  try {
    const events = await api(`/api/events?since=${lastEventId}`);
    for (const ev of events) {
      lastEventId = Math.max(lastEventId, ev.id);
      if (firstPoll) continue; // 起動前の過去イベントは無視
      if (ev.type === "posted") { kick(); toast(ev.message); loadPosts(); }
      else if (ev.type === "error") { speak("💦 エラー…"); toast(`❌ ${ev.message}`, 5000); loadPosts(); }
      else if (ev.type === "price_change") toast(`💴 ${ev.message}`, 5000);
      else if (ev.type === "stock_alert" || ev.type === "stock_skip" || ev.type === "stock_replace") toast(ev.message, 5000);
      else if (ev.type === "sale_start" || ev.type === "sale_alert") { toast(ev.message, 6000); loadStatus(); }
    }
    firstPoll = false;
  } catch { /* サーバー再起動中など */ }
}

/* ---------- 起動 ---------- */
loadStatus();
loadAccounts().then(loadPosts).catch(loadPosts);
pollEvents();
setInterval(pollEvents, 5000);
setInterval(loadStatus, 5 * 60000);
