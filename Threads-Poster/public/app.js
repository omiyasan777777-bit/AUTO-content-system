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
  if (name === "links") loadLinks();
}

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

function openEditor(post) {
  editing = post
    ? JSON.parse(JSON.stringify(post))
    : { title: "", scheduledAt: "", tree: [blankNode()] };
  $("#editorTitle").textContent = post ? "投稿を編集" : "投稿を作成";
  $("#postTitle").value = editing.title || "";
  const dt = editing.scheduledAt ? new Date(editing.scheduledAt) : new Date(Date.now() + 3600000);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  $("#postAt").value = dt.toISOString().slice(0, 16);
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

async function runSearch(card, node) {
  const keyword = $('[data-field="searchKeyword"]', card)?.value?.trim();
  const box = $("[data-results]", card);
  if (!keyword) { toast("検索キーワードを入力してください"); return; }
  box.innerHTML = `<div class="hint">検索中…</div>`;
  try {
    const { items, demo } = await api(`/api/rakuten/search?keyword=${encodeURIComponent(keyword)}`);
    if (!items.length) { box.innerHTML = `<div class="hint">見つかりませんでした</div>`; return; }
    box.innerHTML = (demo ? `<div class="hint">※楽天アプリID未設定のためデモ商品を表示中（⚙️設定から登録）</div>` : "") +
      items.map((it) => `
      <div class="result-item">
        ${it.imageUrl ? `<img src="${esc(it.imageUrl)}" alt="">` : `<img alt="">`}
        <span class="r-name">${esc(it.itemName).slice(0, 60)}</span>
        <span class="r-meta"><span class="price">${yen(it.itemPrice)}</span>${esc(it.shopName)}${Number(it.availability) === 0 ? " ⚠️在庫切れ" : ""}</span>
        <button class="mini-btn" data-attach="${encodeURIComponent(JSON.stringify(it))}">添付</button>
      </div>`).join("");
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
      body: { id: editing.id, title: editing.title, scheduledAt: new Date(at).toISOString(), tree: editing.tree },
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

/* ---------- 短縮URL ---------- */
async function loadLinks() {
  const links = await api("/api/links");
  $("#linkList").innerHTML = links.length ? links.map((l) => `
    <div class="link-item">
      <span class="short">${esc(l.shortUrl)}</span>
      <span class="dest">→ ${esc(l.url)}</span>
      <span class="hits">${l.hits || 0} クリック</span>
      <button class="mini-btn" data-copy="${esc(l.shortUrl)}">コピー</button>
    </div>`).join("") : `<div class="empty">— まだURLがありません —</div>`;
  $$("[data-copy]").forEach((b) => b.addEventListener("click", () => {
    navigator.clipboard.writeText(b.dataset.copy);
    toast("📋 コピーしました");
  }));
}
$("#makeLinkBtn").addEventListener("click", async () => {
  const url = $("#manualLinkUrl").value.trim();
  if (!url) return;
  await api("/api/links", { method: "POST", body: { url } });
  $("#manualLinkUrl").value = "";
  loadLinks();
});

/* ---------- 設定 ---------- */
$("#settingsBtn").addEventListener("click", openSettings);
$("#closeSettingsBtn").addEventListener("click", () => $("#settingsModal").classList.add("hidden"));

let customEvents = [];
async function openSettings() {
  const s = await api("/api/settings");
  $("#setThreadsToken").value = s.threadsAccessToken || "";
  $("#setThreadsUserId").value = s.threadsUserId || "";
  $("#setRakutenAppId").value = s.rakutenAppId || "";
  $("#setRakutenAffId").value = s.rakutenAffiliateId || "";
  $("#setShortBase").value = s.shortBaseUrl || "";
  customEvents = s.customSaleEvents || [];
  renderCustomEvents();
  $("#settingsModal").classList.remove("hidden");
}
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
$("#saveSettingsBtn").addEventListener("click", async () => {
  await api("/api/settings", {
    method: "POST",
    body: {
      threadsAccessToken: $("#setThreadsToken").value.trim(),
      threadsUserId: $("#setThreadsUserId").value.trim(),
      rakutenAppId: $("#setRakutenAppId").value.trim(),
      rakutenAffiliateId: $("#setRakutenAffId").value.trim(),
      shortBaseUrl: $("#setShortBase").value.trim(),
      customSaleEvents: customEvents
        .filter((ev) => ev.name && ev.startAt)
        .map((ev) => ({ ...ev, startAt: new Date(ev.startAt).toISOString(), endAt: ev.endAt ? new Date(ev.endAt).toISOString() : "" })),
    },
  });
  $("#settingsModal").classList.add("hidden");
  toast("✅ 設定を保存しました");
  loadStatus();
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
loadPosts();
pollEvents();
setInterval(pollEvents, 5000);
setInterval(loadStatus, 5 * 60000);
