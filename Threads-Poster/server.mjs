// Threads Poster — Threads予約投稿ツール（楽天アフィリエイト連携）
// 依存ゼロ: node server.mjs で起動 → http://127.0.0.1:4310
import http from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolvePlaceholders, makeSlug, buildSaleCalendar, nextSaleEvent,
  decidePrePublishAction, applyPriceUpdate, normalizeRakutenItem, formatPrice,
} from "./lib/core.mjs";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const dataDir = fileURLToPath(new URL("./data/", import.meta.url));
const port = Number(process.env.PORT || 4310);
const appVersion = "1.0.0";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

// ---------- JSON ストレージ ----------
const store = {
  settings: {
    threadsAccessToken: "",
    threadsUserId: "",
    rakutenAppId: "",
    rakutenAffiliateId: "",
    shortBaseUrl: `http://127.0.0.1:${port}`,
    saleAutoGenerate: false,
    customSaleEvents: [],
  },
  posts: [],   // {id, title, scheduledAt, status, tree:[{text,imageUrl,product,outOfStockMode,replaceKeyword}], log:[]}
  links: {},   // slug -> {url, itemCode, createdAt, hits}
  events: [],  // {id, at, type, message} 直近200件（マスコット演出・アラート用）
};

async function loadStore() {
  await mkdir(dataDir, { recursive: true });
  for (const key of ["settings", "posts", "links", "events"]) {
    try {
      const raw = await readFile(join(dataDir, `${key}.json`), "utf8");
      const parsed = JSON.parse(raw);
      if (key === "settings") store.settings = { ...store.settings, ...parsed };
      else store[key] = parsed;
    } catch { /* 初回起動時はファイルなし */ }
  }
}

async function saveStore(key) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, `${key}.json`), JSON.stringify(store[key], null, 2), "utf8");
}

let eventSeq = Date.now();
function pushEvent(type, message, extra = {}) {
  store.events.push({ id: ++eventSeq, at: new Date().toISOString(), type, message, ...extra });
  if (store.events.length > 200) store.events = store.events.slice(-200);
  saveStore("events").catch(() => {});
}

// ---------- 楽天API ----------
const RAKUTEN_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601";

function mockItems(keyword) {
  const seeds = [
    ["【ふるさと納税でも人気】", 12800], ["レビュー1万件超え！", 4980],
    ["ランキング1位獲得", 8900], ["ポイント10倍対象", 2980], ["送料無料", 6480],
  ];
  return seeds.map(([prefix, price], i) => normalizeRakutenItem({
    itemCode: `demo:${encodeURIComponent(keyword)}-${i + 1}`,
    itemName: `${prefix} ${keyword} デモ商品${i + 1}`,
    itemPrice: price,
    itemUrl: `https://item.rakuten.co.jp/demo/${i + 1}/`,
    affiliateUrl: `https://hb.afl.rakuten.co.jp/demo/${i + 1}/`,
    mediumImageUrls: [{ imageUrl: "" }],
    shopName: "デモショップ",
    availability: i === 3 ? 0 : 1,
    reviewAverage: 4.2 + i * 0.1,
  }));
}

async function rakutenSearch({ keyword = "", itemCode = "", hits = 10 }) {
  const { rakutenAppId, rakutenAffiliateId } = store.settings;
  if (!rakutenAppId) {
    // APIキー未設定 → デモデータ（UI動作確認用）
    return { demo: true, items: keyword ? mockItems(keyword) : [] };
  }
  const params = new URLSearchParams({
    applicationId: rakutenAppId,
    format: "json",
    hits: String(Math.min(30, hits)),
    formatVersion: "2",
  });
  if (rakutenAffiliateId) params.set("affiliateId", rakutenAffiliateId);
  if (itemCode) params.set("itemCode", itemCode);
  else params.set("keyword", keyword);
  const res = await fetch(`${RAKUTEN_ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`楽天API エラー: HTTP ${res.status}`);
  const data = await res.json();
  const items = (data.Items || []).map(normalizeRakutenItem);
  return { demo: false, items };
}

/** 商品の最新情報を1件取得（価格・在庫チェック用） */
async function refreshProduct(product) {
  if (!product?.itemCode) return null;
  if (product.itemCode.startsWith("demo:")) return { ...product, checkedAt: new Date().toISOString() };
  try {
    const { items } = await rakutenSearch({ itemCode: product.itemCode, hits: 1 });
    return items[0] || null;
  } catch {
    return null;
  }
}

// ---------- 短縮URL（楽天っぽいオリジナルURL） ----------
function createShortLink(url, itemCode = "") {
  const existing = new Set(Object.keys(store.links));
  for (const [slug, link] of Object.entries(store.links)) {
    if (link.url === url) return slug; // 同一URLは再利用
  }
  const slug = makeSlug(existing);
  store.links[slug] = { url, itemCode, createdAt: new Date().toISOString(), hits: 0 };
  saveStore("links").catch(() => {});
  return slug;
}

function shortUrlFor(slug) {
  const base = (store.settings.shortBaseUrl || `http://127.0.0.1:${port}`).replace(/\/$/, "");
  return `${base}/r/${slug}`;
}

// ---------- Threads API ----------
const THREADS_BASE = "https://graph.threads.net/v1.0";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function threadsCreateAndPublish({ text, imageUrl, replyToId }) {
  const { threadsAccessToken: token, threadsUserId: userId } = store.settings;
  if (!token || !userId) {
    // デモモード: 実投稿せず成功扱い
    await sleep(300);
    return { id: `demo-${Date.now()}`, demo: true };
  }
  const params = new URLSearchParams({ access_token: token });
  if (imageUrl) {
    params.set("media_type", "IMAGE");
    params.set("image_url", imageUrl);
    if (text) params.set("text", text);
  } else {
    params.set("media_type", "TEXT");
    params.set("text", text || "");
  }
  if (replyToId) params.set("reply_to_id", replyToId);
  const createRes = await fetch(`${THREADS_BASE}/${userId}/threads`, { method: "POST", body: params });
  const created = await createRes.json();
  if (!createRes.ok || !created.id) {
    throw new Error(`Threads作成エラー: ${created.error?.message || createRes.status}`);
  }
  if (imageUrl) await sleep(15000); // 画像はサーバー側処理を待つ（公式推奨は30秒だが実用上短縮）
  const pubParams = new URLSearchParams({ access_token: token, creation_id: created.id });
  const pubRes = await fetch(`${THREADS_BASE}/${userId}/threads_publish`, { method: "POST", body: pubParams });
  const published = await pubRes.json();
  if (!pubRes.ok || !published.id) {
    throw new Error(`Threads公開エラー: ${published.error?.message || pubRes.status}`);
  }
  return { id: published.id, demo: false };
}

// ---------- 投稿の実行 ----------
async function publishPost(post) {
  post.status = "posting";
  post.log = post.log || [];
  const logAdd = (msg) => post.log.push(`[${new Date().toLocaleString("ja-JP")}] ${msg}`);
  let replyToId = null;
  let postedCount = 0;

  for (let i = 0; i < post.tree.length; i++) {
    const node = post.tree[i];
    let product = node.product || null;

    // 投稿直前チェック: 在庫・価格の最新化
    if (product?.itemCode) {
      const latest = await refreshProduct(product);
      const { product: updated, change } = applyPriceUpdate(product, latest);
      if (change) {
        logAdd(`💴 価格変動を検知: ${change.oldPrice}円 → ${change.newPrice}円（自動差し替え）`);
        pushEvent("price_change", `「${change.itemName}」 ${formatPrice(change.oldPrice)} → ${formatPrice(change.newPrice)}`, change);
      }
      node.product = product = updated;

      const decision = decidePrePublishAction(node, latest || product);
      if (decision.action === "skip") {
        logAdd(`⏭ ツリー${i + 1}: ${decision.reason}`);
        pushEvent("stock_skip", `在庫切れのためスキップ: ${product.itemName}`);
        continue;
      }
      if (decision.action === "replace") {
        const keyword = node.replaceKeyword || product.itemName.slice(0, 20);
        try {
          const { items } = await rakutenSearch({ keyword, hits: 5 });
          const alt = items.find((it) => Number(it.availability) !== 0 && it.itemCode !== product.itemCode);
          if (alt) {
            logAdd(`🔁 ツリー${i + 1}: 在庫切れ→「${alt.itemName}」に差し替え`);
            pushEvent("stock_replace", `代替商品に差し替え: ${alt.itemName}`);
            node.product = product = alt;
          } else {
            logAdd(`⏭ ツリー${i + 1}: 代替商品が見つからずスキップ`);
            continue;
          }
        } catch (e) {
          logAdd(`⏭ ツリー${i + 1}: 代替検索エラー（${e.message}）→スキップ`);
          continue;
        }
      }
    }

    // 楽天っぽい短縮URL生成 & プレースホルダ解決
    let shortUrl = "";
    if (product?.affiliateUrl || product?.itemUrl) {
      shortUrl = shortUrlFor(createShortLink(product.affiliateUrl || product.itemUrl, product.itemCode));
    }
    const text = resolvePlaceholders(node.text, product, shortUrl);
    const imageUrl = node.imageUrl || (node.useProductImage && product?.imageUrl) || "";

    try {
      const result = await threadsCreateAndPublish({ text, imageUrl, replyToId });
      replyToId = result.id;
      postedCount++;
      logAdd(`✅ ツリー${i + 1}を投稿${result.demo ? "（デモ）" : ""}: ${result.id}`);
    } catch (e) {
      logAdd(`❌ ツリー${i + 1}の投稿失敗: ${e.message}`);
      post.status = "error";
      await saveStore("posts");
      pushEvent("error", `投稿エラー: ${post.title || post.id} — ${e.message}`);
      return;
    }
    if (i < post.tree.length - 1) await sleep(2000);
  }

  post.status = postedCount > 0 ? "posted" : "skipped";
  post.postedAt = new Date().toISOString();
  await saveStore("posts");
  pushEvent(postedCount > 0 ? "posted" : "skipped",
    postedCount > 0 ? `⚽ 投稿完了: ${post.title || "無題"}（${postedCount}ツリー）` : `全ツリーがスキップされました: ${post.title || "無題"}`,
    { postId: post.id });
}

// ---------- スケジューラ ----------
let schedulerBusy = false;
async function schedulerTick() {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    const now = Date.now();
    for (const post of store.posts) {
      if (post.status === "scheduled" && new Date(post.scheduledAt).getTime() <= now) {
        await publishPost(post);
      }
    }
    // セール自動生成
    if (store.settings.saleAutoGenerate) await maybeGenerateSalePosts();
  } catch (e) {
    pushEvent("error", `スケジューラエラー: ${e.message}`);
  } finally {
    schedulerBusy = false;
  }
}

// 価格・在庫の定期ウォッチ（30分ごと）: 予約中の投稿の商品を最新化
async function priceWatchTick() {
  let changed = false;
  for (const post of store.posts) {
    if (post.status !== "scheduled") continue;
    for (const node of post.tree || []) {
      if (!node.product?.itemCode) continue;
      const latest = await refreshProduct(node.product);
      const { product, change } = applyPriceUpdate(node.product, latest);
      node.product = product;
      changed = true;
      if (change) {
        pushEvent("price_change",
          `「${change.itemName}」の価格が${change.direction === "down" ? "値下がり📉" : "値上がり📈"}: ${formatPrice(change.oldPrice)} → ${formatPrice(change.newPrice)}`,
          change);
      }
      if (latest && Number(latest.availability) === 0) {
        pushEvent("stock_alert", `⚠️ 在庫切れ検知: ${node.product.itemName}（投稿時に${node.outOfStockMode === "replace" ? "代替差し替え" : "スキップ"}されます）`);
      }
    }
  }
  if (changed) await saveStore("posts");
}

// セール開始日に投稿を自動生成（1イベントにつき1回）
const generatedSaleIds = new Set();
async function maybeGenerateSalePosts() {
  const ev = nextSaleEvent(new Date(), store.settings.customSaleEvents);
  if (!ev || !ev.started || generatedSaleIds.has(ev.id)) return;
  if (store.posts.some((p) => p.saleEventId === ev.id)) { generatedSaleIds.add(ev.id); return; }
  generatedSaleIds.add(ev.id);
  const post = {
    id: `post-${Date.now()}`,
    title: `【自動生成】${ev.name}開始のお知らせ`,
    scheduledAt: new Date(Date.now() + 60000).toISOString(),
    status: "scheduled",
    saleEventId: ev.id,
    tree: [{
      text: `🔥 ${ev.name}がスタート！\nお得な商品を随時紹介していきます👇\n#楽天 #${ev.name.replace(/\s/g, "")}`,
      imageUrl: "", product: null, outOfStockMode: "skip",
    }],
    log: [],
    createdAt: new Date().toISOString(),
  };
  store.posts.push(post);
  await saveStore("posts");
  pushEvent("sale_start", `🎉 ${ev.name}開始！告知投稿を自動生成しました`);
}

// セールアラート（1日1回チェック）
let lastSaleAlertDay = "";
function saleAlertTick() {
  const today = new Date().toISOString().slice(0, 10);
  if (lastSaleAlertDay === today) return;
  lastSaleAlertDay = today;
  const ev = nextSaleEvent(new Date(), store.settings.customSaleEvents);
  if (!ev) return;
  if (ev.started) pushEvent("sale_alert", `🔥 ${ev.name}は開催中です！（〜${new Date(ev.endAt).toLocaleString("ja-JP")}）`);
  else if (ev.daysUntil <= 3) pushEvent("sale_alert", `📅 ${ev.name}まであと${ev.daysUntil}日（${new Date(ev.startAt).toLocaleString("ja-JP")}開始予定）`);
}

// ---------- HTTP ----------
const json = (res, code, data) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
};

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { return {}; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const path = url.pathname;

  try {
    // 短縮URLリダイレクト
    if (path.startsWith("/r/")) {
      const slug = path.slice(3);
      const link = store.links[slug];
      if (link) {
        link.hits = (link.hits || 0) + 1;
        saveStore("links").catch(() => {});
        res.writeHead(302, { location: link.url });
        return res.end();
      }
      res.writeHead(404); return res.end("link not found");
    }

    // ---- API ----
    if (path === "/api/settings" && req.method === "GET") {
      const s = { ...store.settings };
      s.threadsAccessToken = s.threadsAccessToken ? "●●●（設定済み）" : "";
      return json(res, 200, s);
    }
    if (path === "/api/settings" && req.method === "POST") {
      const body = await readBody(req);
      for (const key of ["threadsAccessToken", "threadsUserId", "rakutenAppId", "rakutenAffiliateId", "shortBaseUrl"]) {
        if (typeof body[key] === "string" && !body[key].startsWith("●")) store.settings[key] = body[key].trim();
      }
      if (typeof body.saleAutoGenerate === "boolean") store.settings.saleAutoGenerate = body.saleAutoGenerate;
      if (Array.isArray(body.customSaleEvents)) store.settings.customSaleEvents = body.customSaleEvents;
      await saveStore("settings");
      return json(res, 200, { ok: true });
    }

    if (path === "/api/posts" && req.method === "GET") {
      return json(res, 200, [...store.posts].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)));
    }
    if (path === "/api/posts" && req.method === "POST") {
      const body = await readBody(req);
      if (!Array.isArray(body.tree) || !body.tree.length) return json(res, 400, { error: "ツリーが空です" });
      if (!body.scheduledAt) return json(res, 400, { error: "投稿日時を指定してください" });
      const existing = body.id && store.posts.find((p) => p.id === body.id);
      const post = existing || { id: `post-${Date.now()}`, createdAt: new Date().toISOString(), log: [] };
      post.title = body.title || "";
      post.scheduledAt = body.scheduledAt;
      post.tree = body.tree;
      if (!existing || existing.status !== "posted") post.status = "scheduled";
      if (!existing) store.posts.push(post);
      await saveStore("posts");
      return json(res, 200, post);
    }
    const postAction = path.match(/^\/api\/posts\/([^/]+)(?:\/(publish|duplicate))?$/);
    if (postAction) {
      const post = store.posts.find((p) => p.id === postAction[1]);
      if (!post) return json(res, 404, { error: "not found" });
      if (req.method === "DELETE") {
        store.posts = store.posts.filter((p) => p.id !== post.id);
        await saveStore("posts");
        return json(res, 200, { ok: true });
      }
      if (req.method === "POST" && postAction[2] === "publish") {
        publishPost(post); // 非同期実行（結果はイベント/ログで通知）
        return json(res, 200, { ok: true, message: "投稿を開始しました" });
      }
    }

    if (path === "/api/rakuten/search" && req.method === "GET") {
      const keyword = url.searchParams.get("keyword") || "";
      if (!keyword.trim()) return json(res, 400, { error: "キーワードを入力してください" });
      const result = await rakutenSearch({ keyword, hits: Number(url.searchParams.get("hits")) || 10 });
      return json(res, 200, result);
    }
    if (path === "/api/rakuten/refresh" && req.method === "POST") {
      await priceWatchTick();
      return json(res, 200, { ok: true });
    }

    if (path === "/api/sales" && req.method === "GET") {
      const calendar = buildSaleCalendar(new Date(), store.settings.customSaleEvents).slice(0, 8);
      const next = nextSaleEvent(new Date(), store.settings.customSaleEvents);
      return json(res, 200, { calendar, next, autoGenerate: store.settings.saleAutoGenerate });
    }

    if (path === "/api/links" && req.method === "GET") {
      const list = Object.entries(store.links).map(([slug, l]) => ({ slug, shortUrl: shortUrlFor(slug), ...l }));
      return json(res, 200, list);
    }
    if (path === "/api/links" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.url) return json(res, 400, { error: "URLを指定してください" });
      const slug = createShortLink(body.url, body.itemCode || "");
      return json(res, 200, { slug, shortUrl: shortUrlFor(slug) });
    }

    if (path === "/api/events" && req.method === "GET") {
      const since = Number(url.searchParams.get("since")) || 0;
      return json(res, 200, store.events.filter((e) => e.id > since).slice(-50));
    }

    if (path === "/api/status") {
      return json(res, 200, {
        version: appVersion,
        demoThreads: !store.settings.threadsAccessToken || !store.settings.threadsUserId,
        demoRakuten: !store.settings.rakutenAppId,
        scheduled: store.posts.filter((p) => p.status === "scheduled").length,
        posted: store.posts.filter((p) => p.status === "posted").length,
      });
    }

    // ---- 静的ファイル ----
    let filePath = normalize(join(root, path === "/" ? "index.html" : path.slice(1)));
    if (!filePath.startsWith(root)) { res.writeHead(403); return res.end(); }
    try {
      await stat(filePath);
    } catch {
      res.writeHead(404); return res.end("not found");
    }
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": types[extname(filePath)] || "application/octet-stream" });
    return res.end(body);
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
});

await loadStore();
setInterval(schedulerTick, 20000);
setInterval(priceWatchTick, 30 * 60000);
setInterval(saleAlertTick, 60000);
saleAlertTick();

server.listen(port, "127.0.0.1", () => {
  console.log(`\n⚽ Threads Poster v${appVersion}`);
  console.log(`   http://127.0.0.1:${port} をブラウザで開いてください\n`);
});
