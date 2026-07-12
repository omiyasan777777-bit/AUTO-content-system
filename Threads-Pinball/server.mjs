// Threads Pinball Scheduler — ピンボールで遊べる Threads 予約投稿ツール
// 依存パッケージなし（Node 18+ の標準機能のみ）。起動: node server.mjs
import http from "node:http";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = fileURLToPath(new URL("./public/", import.meta.url));
const dataFile = fileURLToPath(new URL("./data.json", import.meta.url));
const port = Number(process.env.PORT || 9696);
const THREADS_API = "https://graph.threads.net/v1.0";
const MAX_ACCOUNTS = 3;
const SCHEDULER_INTERVAL_MS = 30 * 1000;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// ---------- データ永続化（data.json / トークンを含むため git 管理外） ----------

function defaultData() {
  return {
    slug: `pb-${crypto.randomBytes(4).toString("hex")}`,
    theme: "#7c5cff",
    accounts: [],
    posts: [],
  };
}

function loadData() {
  if (!existsSync(dataFile)) {
    const data = defaultData();
    saveData(data);
    return data;
  }
  const data = { ...defaultData(), ...JSON.parse(readFileSync(dataFile, "utf-8")) };
  return data;
}

function saveData(data) {
  writeFileSync(dataFile, JSON.stringify(data, null, 2), "utf-8");
}

const db = loadData();

// ---------- Threads Graph API ----------

async function threadsGet(path, params) {
  const url = new URL(`${THREADS_API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Threads API error (${res.status})`);
  return body;
}

async function threadsPost(path, params) {
  const url = new URL(`${THREADS_API}${path}`);
  const form = new URLSearchParams(params);
  const res = await fetch(url, { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Threads API error (${res.status})`);
  return body;
}

async function verifyAccount(accessToken) {
  return threadsGet("/me", {
    fields: "id,username,threads_profile_picture_url",
    access_token: accessToken,
  });
}

async function publishText(account, text) {
  const container = await threadsPost(`/${account.threadsUserId || "me"}/threads`, {
    media_type: "TEXT",
    text,
    access_token: account.accessToken,
  });
  const published = await threadsPost(`/${account.threadsUserId || "me"}/threads_publish`, {
    creation_id: container.id,
    access_token: account.accessToken,
  });
  return published.id;
}

// ---------- スケジューラ（30秒ごとに期限が来た予約を投稿） ----------

let ticking = false;
async function schedulerTick() {
  if (ticking) return;
  ticking = true;
  try {
    const now = Date.now();
    const due = db.posts.filter((p) => p.status === "scheduled" && p.scheduledAt <= now);
    for (const post of due) {
      const account = db.accounts.find((a) => a.id === post.accountId);
      if (!account) {
        post.status = "error";
        post.error = "アカウントが削除されています";
        continue;
      }
      try {
        post.threadsPostId = await publishText(account, post.text);
        post.status = "posted";
        post.postedAt = Date.now();
        post.error = "";
        console.log(`[posted] @${account.username || account.label}: ${post.text.slice(0, 30)}…`);
      } catch (err) {
        post.status = "error";
        post.error = String(err.message || err);
        console.error(`[error] @${account.username || account.label}: ${post.error}`);
      }
    }
    if (due.length) saveData(db);
  } finally {
    ticking = false;
  }
}
setInterval(schedulerTick, SCHEDULER_INTERVAL_MS);

// ---------- API ----------

function publicState() {
  return {
    slug: db.slug,
    theme: db.theme,
    maxAccounts: MAX_ACCOUNTS,
    serverNow: Date.now(),
    accounts: db.accounts.map((a) => ({
      id: a.id,
      label: a.label,
      username: a.username,
      avatar: a.avatar,
      verified: a.verified,
      tokenPreview: a.accessToken ? `••••${a.accessToken.slice(-4)}` : "",
    })),
    posts: db.posts
      .slice()
      .sort((a, b) => a.scheduledAt - b.scheduledAt)
      .map((p) => ({ ...p })),
  };
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 256) reject(new Error("body too large"));
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res, path) {
  const parts = path.split("/").filter(Boolean); // ["api", ...]
  try {
    // GET /api/state
    if (req.method === "GET" && path === "/api/state") {
      return json(res, 200, publicState());
    }

    // POST /api/theme { color }
    if (req.method === "POST" && path === "/api/theme") {
      const { color } = await readBody(req);
      if (!/^#[0-9a-fA-F]{6}$/.test(color || "")) return json(res, 400, { error: "カラーコードが不正です" });
      db.theme = color;
      saveData(db);
      return json(res, 200, { ok: true, theme: db.theme });
    }

    // POST /api/accounts { label, accessToken, threadsUserId? }
    if (req.method === "POST" && path === "/api/accounts") {
      if (db.accounts.length >= MAX_ACCOUNTS) {
        return json(res, 400, { error: `登録できるのは最大 ${MAX_ACCOUNTS} アカウントまでです` });
      }
      const { label, accessToken, threadsUserId } = await readBody(req);
      if (!accessToken || typeof accessToken !== "string") {
        return json(res, 400, { error: "アクセストークンを入力してください" });
      }
      const account = {
        id: crypto.randomUUID(),
        label: (label || "").trim() || `アカウント${db.accounts.length + 1}`,
        accessToken: accessToken.trim(),
        threadsUserId: (threadsUserId || "").trim(),
        username: "",
        avatar: "",
        verified: false,
      };
      try {
        const me = await verifyAccount(account.accessToken);
        account.username = me.username || "";
        account.avatar = me.threads_profile_picture_url || "";
        account.threadsUserId = account.threadsUserId || me.id || "";
        account.verified = true;
      } catch (err) {
        account.verified = false;
        account.verifyError = String(err.message || err);
      }
      db.accounts.push(account);
      saveData(db);
      return json(res, 200, { ok: true, verified: account.verified, verifyError: account.verifyError || "", state: publicState() });
    }

    // DELETE /api/accounts/:id
    if (req.method === "DELETE" && parts[1] === "accounts" && parts[2]) {
      const id = parts[2];
      const before = db.accounts.length;
      db.accounts = db.accounts.filter((a) => a.id !== id);
      if (db.accounts.length === before) return json(res, 404, { error: "アカウントが見つかりません" });
      db.posts = db.posts.filter((p) => !(p.accountId === id && p.status === "scheduled"));
      saveData(db);
      return json(res, 200, { ok: true, state: publicState() });
    }

    // POST /api/posts { accountId, text, scheduledAt }
    if (req.method === "POST" && path === "/api/posts") {
      const { accountId, text, scheduledAt } = await readBody(req);
      const account = db.accounts.find((a) => a.id === accountId);
      if (!account) return json(res, 400, { error: "アカウントを選択してください" });
      if (!text || !String(text).trim()) return json(res, 400, { error: "投稿する本文を入力してください" });
      if (String(text).length > 500) return json(res, 400, { error: "Threadsの本文は500文字までです" });
      const at = Number(scheduledAt);
      if (!Number.isFinite(at)) return json(res, 400, { error: "予約日時が不正です" });
      db.posts.push({
        id: crypto.randomUUID(),
        accountId,
        text: String(text),
        scheduledAt: at,
        status: "scheduled",
        createdAt: Date.now(),
        error: "",
      });
      saveData(db);
      return json(res, 200, { ok: true, state: publicState() });
    }

    // DELETE /api/posts/:id
    if (req.method === "DELETE" && parts[1] === "posts" && parts[2]) {
      const before = db.posts.length;
      db.posts = db.posts.filter((p) => p.id !== parts[2]);
      if (db.posts.length === before) return json(res, 404, { error: "予約が見つかりません" });
      saveData(db);
      return json(res, 200, { ok: true, state: publicState() });
    }

    // POST /api/posts/:id/retry — エラーになった予約を再スケジュール
    if (req.method === "POST" && parts[1] === "posts" && parts[3] === "retry") {
      const post = db.posts.find((p) => p.id === parts[2]);
      if (!post) return json(res, 404, { error: "予約が見つかりません" });
      post.status = "scheduled";
      post.error = "";
      post.scheduledAt = Date.now();
      saveData(db);
      return json(res, 200, { ok: true, state: publicState() });
    }

    return json(res, 404, { error: "not found" });
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) });
  }
}

// ---------- 静的ファイル + オリジナルURL ----------

async function serveStatic(res, path) {
  let file = path === "/" || path === "" ? "/index.html" : path;
  const target = normalize(join(publicDir, file));
  if (!target.startsWith(publicDir)) {
    res.writeHead(403); return res.end("forbidden");
  }
  try {
    const content = await readFile(target);
    res.writeHead(200, { "Content-Type": types[extname(target)] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = decodeURIComponent(url.pathname);
  const prefix = `/${db.slug}`;

  // ルートはあなただけのオリジナルURLへ案内
  if (path === "/" || path === "") {
    res.writeHead(302, { Location: `${prefix}/` });
    return res.end();
  }
  if (path === "/favicon.svg" || path === "/favicon.ico") {
    return serveStatic(res, "/favicon.svg");
  }
  if (path === prefix) {
    res.writeHead(302, { Location: `${prefix}/` });
    return res.end();
  }
  if (path.startsWith(`${prefix}/`)) {
    const inner = path.slice(prefix.length) || "/";
    if (inner.startsWith("/api/")) return handleApi(req, res, inner);
    return serveStatic(res, inner);
  }

  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  res.end("<h1>404</h1><p>このツールにはオリジナルURLからアクセスしてください（起動時のコンソールに表示されます）。</p>");
});

server.listen(port, "127.0.0.1", () => {
  console.log("============================================================");
  console.log("  🎮 Threads Pinball Scheduler 起動！");
  console.log(`  あなたのオリジナルURL → http://127.0.0.1:${port}/${db.slug}/`);
  console.log("============================================================");
});
