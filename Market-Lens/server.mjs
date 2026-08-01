import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const port = Number(process.env.PORT || 4173);
const appVersion = "2.0.0";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

const decode = (value = "") => value
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x2F;/g, "/");

function meta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const found = html.match(pattern);
    if (found) return decode(found[1]);
  }
  return "";
}

function parseArticle(html, url) {
  let article = {};
  const jsonLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const item of jsonLd) {
    try {
      const data = JSON.parse(item[1]);
      const candidates = data["@graph"] || [data];
      const post = candidates.find((entry) => entry?.["@type"] === "BlogPosting");
      if (post) { article = post; break; }
    } catch { /* malformed third-party JSON-LD */ }
  }
  const likePatterns = [
    /aria-label=["']([\d,]+)スキ/i,
    /o-noteLikeV3__count[^>]*>\s*([\d,]+)\s*</i,
    /"likeCount"\s*:\s*(\d+)/i,
  ];
  let likes = 0;
  for (const pattern of likePatterns) {
    const match = html.match(pattern);
    if (match) { likes = Number(match[1].replace(/,/g, "")); break; }
  }
  const pricePatterns = [
    /(?:¥|￥)\s*([\d,]+)/,
    /"price"\s*:\s*(\d+)/,
    /"priceWithTax"\s*:\s*(\d+)/,
  ];
  let price = 0;
  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (match) { price = Number(match[1].replace(/,/g, "")); break; }
  }
  const keywords = Array.isArray(article.keywords)
    ? article.keywords
    : String(article.keywords || "").split(",").map((x) => x.trim()).filter(Boolean);
  const author = typeof article.author === "object" ? article.author?.name : article.author;
  return {
    id: `imported-${Date.now()}`,
    title: article.headline || meta(html, "og:title").split("｜")[0] || "タイトル未取得",
    author: author || meta(html, "author") || meta(html, "og:title").split("｜")[1] || "不明",
    url,
    image: article.image?.url || (typeof article.image === "string" ? article.image : "") || meta(html, "og:image"),
    description: article.description || meta(html, "description") || meta(html, "og:description"),
    publishedAt: article.datePublished || new Date().toISOString(),
    modifiedAt: article.dateModified || article.datePublished || new Date().toISOString(),
    likes,
    price,
    tags: keywords,
    category: keywords[0] || "未分類",
    source: "imported",
  };
}

function relativeDateToIso(label = "") {
  const clean = decode(label).replace(/\s+/g, "").trim();
  const now = Date.now();
  const rules = [
    [/^(\d+)分前$/, 60_000], [/^(\d+)時間前$/, 3_600_000], [/^(\d+)日前$/, 86_400_000],
    [/^(\d+)週間前$/, 604_800_000], [/^(\d+)か月前$/, 2_592_000_000], [/^(\d+)年前$/, 31_536_000_000],
  ];
  for (const [pattern, unit] of rules) {
    const match = clean.match(pattern);
    if (match) return new Date(now - Number(match[1]) * unit).toISOString();
  }
  const absolute = clean.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (absolute) return new Date(`${absolute[1]}-${absolute[2].padStart(2,"0")}-${absolute[3].padStart(2,"0")}T00:00:00+09:00`).toISOString();
  return new Date().toISOString();
}

function stripTags(value = "") {
  return decode(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function parseHashtagResults(html, keyword) {
  const sections = html.match(/<section[^>]+class=["'][^"']*m-largeNoteWrapper[^"']*["'][\s\S]*?<\/section>/gi) || [];
  const seen = new Set();
  const articles = [];
  for (const section of sections) {
    const link = section.match(/<a[^>]+href=["'](\/[^"']+\/n\/n[a-zA-Z0-9]+)["'][^>]*(?:aria-label|title)=["']([^"']+)["']/i)
      || section.match(/<a[^>]+href=["'](\/[^"']+\/n\/n[a-zA-Z0-9]+)["']/i);
    if (!link || seen.has(link[1])) continue;
    seen.add(link[1]);
    const url = `https://note.com${decode(link[1])}`;
    const key = link[1].match(/\/n\/(n[a-zA-Z0-9]+)/)?.[1] || String(articles.length);
    const title = decode(link[2] || section.match(/m-noteBodyTitle__title[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "タイトル未取得").replace(/<[^>]+>/g, "").trim();
    const image = decode(section.match(/m-thumbnail__image[^>]+src=["']([^"']+)["']/i)?.[1] || "");
    const author = stripTags(section.match(/o-largeNoteSummary__userName[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "不明");
    const dateLabel = stripTags(section.match(/o-largeNoteSummary__date[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
    const price = Number((section.match(/m-noteBodyStatus__Price[\s\S]*?(?:¥|￥)\s*([\d,]+)/i)?.[1] || "0").replace(/,/g, ""));
    const likes = Number((section.match(/class=["'][^"']*text-sm text-text-secondary[^"']*["'][^>]*>\s*([\d,]+)\s*</i)?.[1] || "0").replace(/,/g, ""));
    articles.push({
      id: `note-${key}`, title, author, url, image, description: `noteの「#${keyword}」公開タグページから取得した記事です。`,
      publishedAt: relativeDateToIso(dateLabel), modifiedAt: relativeDateToIso(dateLabel), dateLabel,
      likes, price, tags: [keyword], category: keyword, source: "note-search", rank: articles.length + 1,
    });
    if (articles.length >= 50) break;
  }
  const total = html.match(/o-timelineHashtagHeader__num[\s\S]{0,200}?>([\d,]+)件/i)?.[1] || "";
  return { articles, total };
}

function parseSearchQuery(raw) {
  const value = String(raw || "").trim();
  if (!value) return { type: "empty" };
  const urlLike = /^https?:\/\//i.test(value)
    ? value
    : (/^([a-z0-9-]+\.)?note\.com\//i.test(value) ? `https://${value}` : null);
  if (!urlLike) return { type: "keyword", keyword: value.replace(/^[#＃]/, "").trim() };
  let url;
  try { url = new URL(urlLike); } catch { return { type: "invalid" }; }
  if (!/(^|\.)note\.com$/.test(url.hostname)) return { type: "invalid" };
  const hashtagMatch = url.pathname.match(/^\/hashtag\/([^/]+)/);
  if (hashtagMatch) return { type: "keyword", keyword: decodeURIComponent(hashtagMatch[1]) };
  if (url.pathname === "/search") {
    const q = url.searchParams.get("q");
    if (q) return { type: "keyword", keyword: q };
  }
  if (/\/n\/n[a-zA-Z0-9]+/.test(url.pathname)) return { type: "article", url: url.href };
  return { type: "invalid" };
}

async function searchByArticleUrl(urlHref, res) {
  try {
    const response = await fetch(urlHref, {
      headers: { "User-Agent": userAgent, "Accept-Language": "ja-JP,ja;q=0.9" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const article = parseArticle(await response.text(), urlHref);
    return json(res, 200, {
      articles: [article], candidatesFound: 0, candidatesChecked: 0, checkFailures: 0, soldOnly: false,
      total: "1", keyword: article.title, sort: "popular", limit: 1, hasMore: false, refreshed: false,
      sourceUrl: urlHref, searched: [], expanded: false, singleArticle: true, fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return json(res, 502, { error: "記事を取得できませんでした。公開記事か、通信環境をご確認ください。", detail: error.message });
  }
}

const searchCache = new Map();
let lastSearchAt = 0;

const genreAliases = {
  "副業": ["副業", "複業", "サイドビジネス"],
  "ビジネス": ["ビジネス", "マーケティング", "起業"],
  "恋愛": ["恋愛", "婚活", "恋愛心理"],
  "投資": ["投資", "資産形成", "株式投資"],
  "子育て": ["子育て", "育児", "教育"],
  "美容": ["美容", "スキンケア", "ダイエット"],
  "ai": ["AI", "生成AI", "ChatGPT"],
  "ライティング": ["ライティング", "文章術", "webライター"],
  "ライフスタイル": ["ライフスタイル", "暮らし", "習慣"],
  "キャリア": ["キャリア", "転職", "働き方"],
};

function searchCandidates(keyword) {
  const normalized = keyword.normalize("NFKC").toLowerCase().replace(/[\s・\/／、,]+/g, "");
  const aliasKey = Object.keys(genreAliases).find((key) => normalized === key.normalize("NFKC").toLowerCase());
  const split = keyword.split(/[\s・\/／、,]+/).map((x) => x.trim()).filter((x) => x.length > 1);
  return [...new Set([keyword, ...(aliasKey ? genreAliases[aliasKey] : []), ...split])].slice(0, 4);
}

const userAgent = "MarketLens/2.0 (personal local research tool)";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHashtag(tag, filter) {
  const url = `https://note.com/hashtag/${encodeURIComponent(tag)}?f=${filter}`;
  const response = await fetch(url, { headers: { "User-Agent": userAgent, "Accept-Language": "ja-JP,ja;q=0.9" }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { ...parseHashtagResults(await response.text(), tag), tag, url };
}

// ---- note 非公式JSON API（取得できない場合はHTMLスクレイピングへフォールバック） ----

function clampLimit(value, fallback = 30) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(10, Math.min(200, Math.round(n)));
}

function parseNoteDate(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function pickImageUrl(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.url || value.src || value.large || value.original || "";
  return "";
}

function mapApiNote(note, keyword) {
  if (!note || typeof note !== "object") return null;
  const key = note.key || note.note_key || "";
  const urlname = note.user?.urlname || note.user?.url_name || "";
  const url = note.noteUrl || note.note_url || (key && urlname ? `https://note.com/${urlname}/n/${key}` : "");
  if (!url) return null;
  const likes = Number(note.likeCount ?? note.like_count ?? 0) || 0;
  const price = Number(note.price ?? 0) || 0;
  const published = parseNoteDate(note.publishAt ?? note.publish_at ?? note.firstPublishedAt ?? note.first_published_at ?? note.createdAt ?? note.created_at);
  const tags = (Array.isArray(note.hashtags) ? note.hashtags : [])
    .map((h) => String(h?.hashtag?.name || h?.name || "").replace(/^[#＃]/, "").trim())
    .filter(Boolean);
  return {
    id: `note-${key || url}`,
    title: stripTags(String(note.name || note.title || "タイトル未取得")),
    author: stripTags(String(note.user?.nickname || note.user?.name || "不明")),
    url,
    image: pickImageUrl(note.eyecatch) || pickImageUrl(note.sp_eyecatch) || pickImageUrl(note.eyecatchUrl)
      || pickImageUrl(note.eyecatch_url) || pickImageUrl(note.eyecatchImage) || pickImageUrl(note.eyecatch_image) || "",
    description: stripTags(String(note.body || "")).slice(0, 160) || `noteの「#${keyword}」タグから取得した記事です。`,
    publishedAt: published,
    modifiedAt: published,
    likes,
    price,
    tags: tags.length ? tags : [keyword],
    category: keyword,
    source: "note-search",
  };
}

const apiOrderCandidates = { popular: ["popular"], hot: ["hot", "trend"], new: ["new"] };

async function fetchNoteApi(tag, order, page) {
  const url = `https://note.com/api/v3/hashtags/${encodeURIComponent(tag)}/notes?order=${encodeURIComponent(order)}&page=${page}`;
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent, "Accept": "application/json", "Accept-Language": "ja-JP,ja;q=0.9" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  const data = body?.data || {};
  const rawNotes = data.notes || data.hashtagNotes || data.hashtag_notes;
  if (!Array.isArray(rawNotes)) throw new Error("unexpected API shape");
  const articles = rawNotes.map((note) => mapApiNote(note?.note || note, tag)).filter(Boolean);
  const lastFlag = data.isLastPage ?? data.is_last_page;
  const totalRaw = data.totalCount ?? data.total_count ?? data.count;
  return {
    articles,
    isLastPage: lastFlag === undefined ? articles.length === 0 : Boolean(lastFlag),
    total: totalRaw ? Number(totalRaw).toLocaleString("ja-JP") : "",
  };
}

const pageCache = new Map();

async function fetchHashtagPaged(tag, filter, page = 1, { fresh = false } = {}) {
  const cacheKey = `${tag}:${filter}:${page}`;
  const cached = pageCache.get(cacheKey);
  if (!fresh && cached && Date.now() - cached.at < 300_000) return cached.data;
  const pageUrl = `https://note.com/hashtag/${encodeURIComponent(tag)}?f=${filter}${page > 1 ? `&page=${page}` : ""}`;
  let data = null;
  for (const order of apiOrderCandidates[filter] || [filter]) {
    try {
      data = { ...(await fetchNoteApi(tag, order, page)), tag, url: pageUrl };
      break;
    } catch { /* try next order value, then HTML fallback */ }
  }
  if (!data) {
    if (page > 1) {
      data = { articles: [], total: "", isLastPage: true, tag, url: pageUrl };
    } else {
      data = { ...(await fetchHashtag(tag, filter)), isLastPage: true };
    }
  }
  pageCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

async function collectHashtagArticles(candidates, keyword, filter, limit, { fresh = false } = {}) {
  const merged = [];
  const seen = new Set();
  const searched = [];
  let total = "";
  let sourceUrl = "";
  let hasMore = false;
  for (const candidate of candidates) {
    searched.push(candidate);
    let page = 1;
    while (merged.length < limit && page <= 10) {
      let result;
      try { result = await fetchHashtagPaged(candidate, filter, page, { fresh }); }
      catch { break; }
      if (!sourceUrl) sourceUrl = result.url;
      if (!total && result.total) total = result.total;
      let leftover = 0;
      for (const article of result.articles) {
        if (seen.has(article.url)) continue;
        if (merged.length >= limit) { leftover += 1; continue; }
        seen.add(article.url);
        merged.push({ ...article, category: keyword, tags: [...new Set([keyword, ...(article.tags || [])])], discoverySort: filter, rank: merged.length + 1 });
      }
      if (merged.length >= limit) { hasMore = leftover > 0 || !result.isLastPage; break; }
      if (result.isLastPage || !result.articles.length) break;
      page += 1;
      await sleep(150);
    }
    if (merged.length >= limit) break;
  }
  return { merged, searched, total, sourceUrl, hasMore };
}

function hasBoughtWithin24hSignal(html) {
  if (/買われています/.test(html) && /過去\s*(?:24|２４)\s*時間(?:以内)?/.test(html)) return true;

  // note renders this badge from Nuxt state. The visible Japanese label is not
  // always present in the server HTML, but this boolean is the badge's source.
  const direct = html.match(/["']?isPurchasedWithinLast24Hours["']?\s*:\s*(true|false)/i);
  if (direct) return direct[1].toLowerCase() === "true";

  const nuxtStart = html.indexOf("window.__NUXT__=(function(");
  if (nuxtStart < 0) return false;
  const signature = html.slice(nuxtStart).match(/^window\.__NUXT__=\(function\(([^)]*)\)/);
  const scriptEnd = html.indexOf("</script>", nuxtStart);
  const callStart = scriptEnd < 0 ? -1 : html.lastIndexOf("}(", scriptEnd);
  const stateValue = html.slice(nuxtStart, scriptEnd < 0 ? undefined : scriptEnd)
    .match(/isPurchasedWithinLast24Hours\s*:\s*([A-Za-z_$][\w$]*)/);
  if (!signature || !stateValue || callStart < 0) return false;

  const params = signature[1].split(",").map((value) => value.trim());
  const paramIndex = params.indexOf(stateValue[1]);
  if (paramIndex < 0) return false;
  const rawArgs = html.slice(callStart + 2, scriptEnd).replace(/\)\);\s*$/, "");
  const args = splitTopLevelJsArguments(rawArgs);
  const token = args[paramIndex]?.trim();
  return token === "true" || token === "!0";
}

function splitTopLevelJsArguments(source) {
  const values = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (char === "," && depth === 0) {
      values.push(source.slice(start, index));
      start = index + 1;
    }
  }
  values.push(source.slice(start));
  return values;
}

async function verifyBoughtWithin24h(article) {
  if (!article.price || !article.url) return { status: "error" };
  try {
    const response = await fetch(article.url, {
      headers: { "User-Agent": userAgent, "Accept-Language": "ja-JP,ja;q=0.9" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return { status: "error" };
    const html = await response.text();
    if (!hasBoughtWithin24hSignal(html)) return { status: "checked" };
    return { status: "matched", article: { ...article, bought24h: true, purchaseSignal: "買われています｜過去24時間以内", signalCheckedAt: new Date().toISOString() } };
  } catch { return { status: "error" }; }
}

async function filterBoughtWithin24h(articles, limit = 30) {
  const checkCap = Math.min(120, Math.max(60, limit * 2));
  const paid = articles.filter((article) => article.price > 0).slice(0, checkCap);
  const matches = [];
  let verifiedCount = 0;
  let failedCount = 0;
  for (let index = 0; index < paid.length; index += 4) {
    const batch = await Promise.all(paid.slice(index, index + 4).map(verifyBoughtWithin24h));
    for (const result of batch) {
      if (result.status === "matched") { matches.push(result.article); verifiedCount += 1; }
      else if (result.status === "checked") verifiedCount += 1;
      else failedCount += 1;
    }
    if (index + 4 < paid.length) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return { matches, verifiedCount, failedCount, candidatesFound: paid.length };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function readJsonBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || "{}"); } catch { return null; }
}

async function searchNote(req, res) {
  const input = await readJsonBody(req);
  if (!input) return json(res, 400, { error: "検索条件を確認してください。" });
  const sort = ["popular", "hot", "new"].includes(input.sort) ? input.sort : "popular";
  const soldOnly = input.soldOnly === true;
  const limit = clampLimit(input.limit);
  const refresh = input.refresh === true;
  const rawInput = String(input.keyword || "").normalize("NFKC").trim().slice(0, 300);
  const parsed = parseSearchQuery(rawInput);
  if (parsed.type === "empty") return json(res, 400, { error: "検索キーワードを入力してください。" });
  if (parsed.type === "invalid") return json(res, 400, { error: "このURLには対応していません。noteのハッシュタグURL・検索URL・記事URLを入力してください。" });
  if (parsed.type === "article") return searchByArticleUrl(parsed.url, res);
  const keyword = parsed.keyword.slice(0, 60);
  if (!keyword) return json(res, 400, { error: "検索キーワードを入力してください。" });
  const cacheKey = `${keyword}:${sort}:${soldOnly ? "sold24h" : "all"}:${limit}`;
  const cached = searchCache.get(cacheKey);
  if (!refresh && cached && Date.now() - cached.at < 300_000) return json(res, 200, { ...cached.data, cached: true });
  if (Date.now() - lastSearchAt < 1200) return json(res, 429, { error: "少し待ってから検索してください。" });
  lastSearchAt = Date.now();
  const filter = { popular: "popular", hot: "hot", new: "new" }[sort];
  try {
    const candidates = searchCandidates(keyword);
    let merged = [];
    let searched = [];
    let total = "";
    let sourceUrl = "";
    let hasMore = false;
    if (soldOnly) {
      const gatherCap = Math.min(240, Math.max(120, limit * 4));
      const seen = new Set();
      const sourceRequests = candidates.flatMap((candidate) => [...new Set([filter, "popular", "hot", "new"])].map((sourceFilter) => ({ candidate, sourceFilter })));
      const sourceResults = await mapWithConcurrency(sourceRequests, 3, async ({ candidate, sourceFilter }) => {
        try { return await fetchHashtagPaged(candidate, sourceFilter, 1, { fresh: refresh }); }
        catch { return null; }
      });
      for (let sourceIndex = 0; sourceIndex < sourceRequests.length; sourceIndex += 1) {
        const { candidate, sourceFilter } = sourceRequests[sourceIndex];
        const result = sourceResults[sourceIndex];
        if (!searched.includes(candidate)) searched.push(candidate);
        if (!result) continue;
        if (!sourceUrl) sourceUrl = result.url;
        if (!total && result.total) total = result.total;
        for (const article of result.articles) {
          if (seen.has(article.url)) continue;
          seen.add(article.url);
          merged.push({ ...article, category: keyword, tags: [...new Set([keyword, candidate, ...(article.tags || [])])], discoverySort: sourceFilter, rank: merged.length + 1 });
          if (merged.length >= gatherCap) break;
        }
        if (merged.length >= gatherCap) break;
      }
    } else {
      ({ merged, searched, total, sourceUrl, hasMore } = await collectHashtagArticles(candidates, keyword, filter, limit, { fresh: refresh }));
    }
    if (!merged.length) {
      const noteSearchUrl = `https://note.com/search?q=${encodeURIComponent(keyword)}&context=note&mode=search`;
      return json(res, 404, { error: `「${keyword}」に一致するタグ記事を取得できませんでした。`, noteSearchUrl, searched });
    }
    const verification = soldOnly ? await filterBoughtWithin24h(merged, limit) : null;
    if (soldOnly && verification.candidatesFound > 0 && verification.verifiedCount === 0) {
      return json(res, 502, { error: "有料記事ページの購入表示を確認できませんでした。時間をおいて再検索してください。" });
    }
    const articles = soldOnly ? verification.matches : merged.slice(0, limit);
    const data = { articles, candidatesFound: verification?.candidatesFound || 0, candidatesChecked: verification?.verifiedCount || 0, checkFailures: verification?.failedCount || 0, soldOnly, total, keyword, sort, limit, hasMore: soldOnly ? false : hasMore, refreshed: refresh, sourceUrl, searched, expanded: searched.length > 1, fetchedAt: new Date().toISOString() };
    searchCache.set(cacheKey, { at: Date.now(), data });
    return json(res, 200, data);
  } catch (error) {
    return json(res, 502, { error: "noteの検索結果を取得できませんでした。時間をおいて再度お試しください。", detail: error.message });
  }
}

// ---- 人気ワード分析 ----

const TREND_STOPWORDS = new Set([
  "note", "する", "した", "して", "しない", "いる", "ある", "ない", "です", "ます", "でした",
  "こと", "もの", "ため", "これ", "それ", "あれ", "この", "その", "あの", "ここ", "そこ",
  "という", "ついて", "について", "ための", "たち", "など", "から", "まで", "より", "まだ",
  "そして", "しかし", "だから", "なぜ", "どう", "どうして", "あなた", "わたし", "自分",
]);

function extractTitleKeywords(title = "") {
  const normalized = String(title).normalize("NFKC");
  const matches = normalized.match(/[A-Za-z][A-Za-z0-9+.#-]{1,15}|[0-9]{1,4}(?:万円|円|万|選|日間|日|週間|ヶ月|か月|カ月|年|歳|kg|分)|[ァ-ヴー]{2,12}|[一-龠々]{2,8}/g) || [];
  return matches.map((word) => word.trim()).filter((word) => word.length >= 2 && !TREND_STOPWORDS.has(word.toLowerCase()));
}

function aggregateTrendWords(entries, { limit = 40 } = {}) {
  const genreSet = new Set(entries.map((entry) => String(entry.genre || "").normalize("NFKC").toLowerCase()));
  const words = new Map();
  for (const { genre, articles } of entries) {
    for (const article of articles || []) {
      let weight = 1 + Math.log10((article.likes || 0) + 1);
      if (article.price > 0) weight += 0.5;
      const ageDays = (Date.now() - new Date(article.publishedAt).getTime()) / 86_400_000;
      if (Number.isFinite(ageDays) && ageDays >= 0 && ageDays <= 7) weight *= 1.5;
      const seenInArticle = new Set();
      const add = (rawWord, wordWeight) => {
        const word = String(rawWord || "").normalize("NFKC").replace(/^[#＃]/, "").trim();
        const lower = word.toLowerCase();
        if (word.length < 2 || word.length > 16) return;
        if (TREND_STOPWORDS.has(lower) || genreSet.has(lower)) return;
        if (seenInArticle.has(lower)) return;
        seenInArticle.add(lower);
        const entry = words.get(lower) || { word, score: 0, count: 0, genres: new Set(), likes: 0 };
        entry.score += wordWeight;
        entry.count += 1;
        entry.genres.add(genre);
        entry.likes += article.likes || 0;
        words.set(lower, entry);
      };
      for (const tag of article.tags || []) add(tag, weight * 1.5);
      for (const word of extractTitleKeywords(article.title)) add(word, weight);
    }
  }
  return [...words.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => ({
      word: entry.word,
      score: Math.round(entry.score * 10) / 10,
      count: entry.count,
      genres: [...entry.genres],
      avgLikes: entry.count ? Math.round(entry.likes / entry.count) : 0,
    }));
}

// ---- 穴場ジャンル分析 ----

function estimatePostsPerDay(articles = []) {
  const times = articles
    .map((article) => new Date(article.publishedAt).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  if (times.length < 2) return times.length;
  const spanDays = Math.max((times[0] - times[times.length - 1]) / 86_400_000, 0.05);
  return Math.min(999, Math.round(((times.length - 1) / spanDays) * 10) / 10);
}

function opportunityScore({ avgLikes = 0, paidRatio = 0, totalCount = 0, postsPerDay = 0 } = {}) {
  const demandLikes = Math.min(1, Math.log10(avgLikes + 1) / 3);
  const demand = 0.55 * demandLikes + 0.45 * Math.min(1, Math.max(0, paidRatio));
  const supplyTotal = totalCount > 0 ? Math.min(1, Math.log10(totalCount + 1) / 6) : 0.5;
  const supplyVelocity = Math.min(1, Math.log10(Math.max(0, postsPerDay) + 1) / 2);
  const supply = 0.6 * supplyTotal + 0.4 * supplyVelocity;
  return Math.max(0, Math.min(100, Math.round(100 * (0.62 * demand + 0.38 * (1 - supply)))));
}

function gapLabel(score) {
  if (score >= 65) return "🌟 穴場候補";
  if (score >= 50) return "検討の価値あり";
  if (score >= 35) return "標準的";
  return "激戦区 / 需要弱";
}

function gapComment({ avgLikes = 0, paidRatio = 0, totalCount = 0, postsPerDay = 0 } = {}) {
  const demand = avgLikes >= 100 || paidRatio >= 0.4 ? "需要シグナルあり（スキ・有料化が活発）" : "需要シグナルは弱め";
  const supply = totalCount >= 100000 || postsPerDay >= 50
    ? "投稿量が多く競争が激しい"
    : totalCount >= 10000 || postsPerDay >= 10
      ? "投稿量は中程度"
      : "投稿量が少なめ";
  return `${demand}・${supply}`;
}

const trendSeeds = ["副業", "ビジネス", "恋愛", "投資", "子育て", "美容", "AI", "ライティング", "キャリア", "ライフスタイル"];
const gapSeeds = ["副業", "AI", "恋愛", "投資", "子育て", "美容", "ライティング", "キャリア", "ダイエット", "英語学習", "メンタルヘルス", "節約", "フリーランス", "婚活"];

const analysisCache = new Map();
let analysisBusy = false;

function sanitizeGenres(input, fallback, max = 14) {
  const list = Array.isArray(input) ? input : [];
  const cleaned = [...new Set(list
    .map((genre) => String(genre || "").normalize("NFKC").replace(/^[#＃]/, "").trim())
    .filter((genre) => genre && genre.length <= 30))].slice(0, max);
  return cleaned.length ? cleaned : fallback;
}

async function trendWordsHandler(req, res) {
  const input = await readJsonBody(req);
  if (!input) return json(res, 400, { error: "リクエストを確認してください。" });
  const genres = sanitizeGenres(input.genres, trendSeeds, 12);
  const cacheKey = `trends:${genres.join("|")}`;
  const cached = analysisCache.get(cacheKey);
  if (input.refresh !== true && cached && Date.now() - cached.at < 1_800_000) return json(res, 200, { ...cached.data, cached: true });
  if (analysisBusy) return json(res, 429, { error: "別の分析を実行中です。少し待ってから再度お試しください。" });
  analysisBusy = true;
  try {
    const jobs = genres.flatMap((genre) => [{ genre, filter: "popular" }, { genre, filter: "new" }]);
    const results = await mapWithConcurrency(jobs, 3, async ({ genre, filter }) => {
      try { return { genre, result: await fetchHashtagPaged(genre, filter, 1) }; }
      catch { return null; }
    });
    const byGenre = new Map();
    for (const item of results) {
      if (!item?.result) continue;
      const bucket = byGenre.get(item.genre) || { genre: item.genre, articles: [], seen: new Set() };
      for (const article of item.result.articles) {
        if (bucket.seen.has(article.url)) continue;
        bucket.seen.add(article.url);
        bucket.articles.push(article);
      }
      byGenre.set(item.genre, bucket);
    }
    const entries = [...byGenre.values()].map(({ genre, articles }) => ({ genre, articles }));
    if (!entries.length) return json(res, 502, { error: "noteからデータを取得できませんでした。時間をおいて再度お試しください。" });
    const words = aggregateTrendWords(entries);
    const articleCount = entries.reduce((sum, entry) => sum + entry.articles.length, 0);
    const data = { words, genres: entries.map((entry) => entry.genre), articleCount, fetchedAt: new Date().toISOString() };
    analysisCache.set(cacheKey, { at: Date.now(), data });
    return json(res, 200, data);
  } catch (error) {
    return json(res, 502, { error: "人気ワードを集計できませんでした。時間をおいて再度お試しください。", detail: error.message });
  } finally {
    analysisBusy = false;
  }
}

async function analyzeGenre(genre) {
  const [popular, latest] = await Promise.all([
    fetchHashtagPaged(genre, "popular", 1).catch(() => null),
    fetchHashtagPaged(genre, "new", 1).catch(() => null),
  ]);
  if (!popular && !latest) return null;
  const sampled = (popular?.articles || []).slice(0, 12);
  const avgLikes = sampled.length ? Math.round(sampled.reduce((sum, article) => sum + (article.likes || 0), 0) / sampled.length) : 0;
  const paid = sampled.filter((article) => article.price > 0);
  const paidRatio = sampled.length ? paid.length / sampled.length : 0;
  const avgPrice = paid.length ? Math.round(paid.reduce((sum, article) => sum + article.price, 0) / paid.length) : 0;
  const totalCount = Number(String(popular?.total || latest?.total || "").replace(/,/g, "")) || 0;
  const postsPerDay = estimatePostsPerDay(latest?.articles || []);
  const metrics = { avgLikes, paidRatio, avgPrice, totalCount, postsPerDay };
  const score = opportunityScore(metrics);
  return {
    genre,
    ...metrics,
    paidRatio: Math.round(paidRatio * 100) / 100,
    sampleCount: sampled.length,
    score,
    label: gapLabel(score),
    comment: gapComment(metrics),
    url: popular?.url || latest?.url || `https://note.com/hashtag/${encodeURIComponent(genre)}`,
  };
}

async function gapFinderHandler(req, res) {
  const input = await readJsonBody(req);
  if (!input) return json(res, 400, { error: "リクエストを確認してください。" });
  const genres = sanitizeGenres(input.genres, gapSeeds, 14);
  const cacheKey = `gap:${genres.join("|")}`;
  const cached = analysisCache.get(cacheKey);
  if (input.refresh !== true && cached && Date.now() - cached.at < 1_800_000) return json(res, 200, { ...cached.data, cached: true });
  if (analysisBusy) return json(res, 429, { error: "別の分析を実行中です。少し待ってから再度お試しください。" });
  analysisBusy = true;
  try {
    const results = (await mapWithConcurrency(genres, 3, (genre) => analyzeGenre(genre))).filter(Boolean);
    if (!results.length) return json(res, 502, { error: "noteからデータを取得できませんでした。時間をおいて再度お試しください。" });
    results.sort((a, b) => b.score - a.score);
    const data = { results, genres, fetchedAt: new Date().toISOString() };
    analysisCache.set(cacheKey, { at: Date.now(), data });
    return json(res, 200, data);
  } catch (error) {
    return json(res, 502, { error: "穴場ジャンルを分析できませんでした。時間をおいて再度お試しください。", detail: error.message });
  } finally {
    analysisBusy = false;
  }
}

async function importNote(req, res) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let url;
  try { url = new URL(JSON.parse(raw).url); } catch { return json(res, 400, { error: "URLを確認してください。" }); }
  if (url.protocol !== "https:" || !/(^|\.)note\.com$/.test(url.hostname) || !/\/n\/n[a-zA-Z0-9]+/.test(url.pathname)) {
    return json(res, 400, { error: "note.com の公開記事URLを入力してください。" });
  }
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent, "Accept-Language": "ja-JP,ja;q=0.9" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    return json(res, 200, { article: parseArticle(html, url.href) });
  } catch (error) {
    return json(res, 502, { error: "記事を取得できませんでした。公開記事か、通信環境をご確認ください。", detail: error.message });
  }
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": types[".json"], "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/api/version") return json(res, 200, { version: appVersion });
  if (req.method === "POST" && url.pathname === "/api/import") return importNote(req, res);
  if (req.method === "POST" && url.pathname === "/api/search") return searchNote(req, res);
  if (req.method === "POST" && url.pathname === "/api/trends") return trendWordsHandler(req, res);
  if (req.method === "POST" && url.pathname === "/api/gap") return gapFinderHandler(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "Method not allowed" });
  const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const safe = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const path = join(root, safe);
  if (!path.startsWith(root)) return json(res, 403, { error: "Forbidden" });
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error("Not a file");
    const body = await readFile(path);
    res.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream", "Cache-Control": "no-cache" });
    if (req.method === "HEAD") return res.end();
    res.end(body);
  } catch {
    const body = await readFile(join(root, "index.html"));
    res.writeHead(200, { "Content-Type": types[".html"] });
    res.end(body);
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(port, "127.0.0.1", () => {
    console.log(`Market Lens is running at http://127.0.0.1:${port}`);
  });
}

export {
  hasBoughtWithin24hSignal,
  parseHashtagResults,
  mapApiNote,
  clampLimit,
  extractTitleKeywords,
  aggregateTrendWords,
  estimatePostsPerDay,
  opportunityScore,
  gapLabel,
  gapComment,
  sanitizeGenres,
  parseSearchQuery,
  json,
  appVersion,
  importNote,
  searchNote,
  trendWordsHandler,
  gapFinderHandler,
  pickImageUrl,
};
