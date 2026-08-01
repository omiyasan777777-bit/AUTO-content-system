import test from "node:test";
import assert from "node:assert/strict";
import {
  mapApiNote,
  clampLimit,
  extractTitleKeywords,
  aggregateTrendWords,
  estimatePostsPerDay,
  opportunityScore,
  gapLabel,
  sanitizeGenres,
  parseSearchQuery,
  pickImageUrl,
} from "../server.mjs";

test("取得件数を10〜200の範囲に丸める", () => {
  assert.equal(clampLimit(30), 30);
  assert.equal(clampLimit(100), 100);
  assert.equal(clampLimit(5), 10);
  assert.equal(clampLimit(9999), 200);
  assert.equal(clampLimit("50"), 50);
  assert.equal(clampLimit(undefined), 30);
  assert.equal(clampLimit("abc"), 30);
});

test("note APIのレスポンス（camelCase）を記事に変換する", () => {
  const article = mapApiNote({
    key: "nabc123",
    name: "AI副業の始め方",
    price: 980,
    likeCount: 42,
    publishAt: "2026-07-01T10:00:00+09:00",
    eyecatch: "https://assets.st-note.com/img.png",
    user: { urlname: "creator1", nickname: "クリエイター" },
    hashtags: [{ hashtag: { name: "#AI" } }, { hashtag: { name: "#副業" } }],
  }, "AI");
  assert.equal(article.url, "https://note.com/creator1/n/nabc123");
  assert.equal(article.title, "AI副業の始め方");
  assert.equal(article.author, "クリエイター");
  assert.equal(article.likes, 42);
  assert.equal(article.price, 980);
  assert.deepEqual(article.tags, ["AI", "副業"]);
  assert.equal(article.source, "note-search");
});

test("アイキャッチ画像がオブジェクト形式（{url: ...}）でも取得できる", () => {
  const article = mapApiNote({
    key: "nabc999",
    name: "画像オブジェクトのテスト",
    eyecatch: { url: "https://assets.st-note.com/nested.png", width: 900 },
    user: { urlname: "creator3", nickname: "テスター" },
  }, "テスト");
  assert.equal(article.image, "https://assets.st-note.com/nested.png");
});

test("アイキャッチ画像がsnake_caseのフィールド名でも取得できる", () => {
  const article = mapApiNote({
    key: "nabc998",
    name: "スネークケースのテスト",
    eyecatch_url: "https://assets.st-note.com/snake.png",
    user: { urlname: "creator4", nickname: "テスター2" },
  }, "テスト");
  assert.equal(article.image, "https://assets.st-note.com/snake.png");
});

test("pickImageUrl: 文字列・オブジェクト・空値を処理できる", () => {
  assert.equal(pickImageUrl("https://x.example/a.png"), "https://x.example/a.png");
  assert.equal(pickImageUrl({ url: "https://x.example/b.png" }), "https://x.example/b.png");
  assert.equal(pickImageUrl({ src: "https://x.example/c.png" }), "https://x.example/c.png");
  assert.equal(pickImageUrl(null), "");
  assert.equal(pickImageUrl(undefined), "");
  assert.equal(pickImageUrl({}), "");
});

test("note APIのレスポンス（snake_case）も変換できる", () => {
  const article = mapApiNote({
    key: "nxyz789",
    name: "テスト記事",
    like_count: 7,
    publish_at: "2026/06/30 09:00",
    user: { urlname: "creator2", nickname: "書き手" },
  }, "テスト");
  assert.equal(article.url, "https://note.com/creator2/n/nxyz789");
  assert.equal(article.likes, 7);
  assert.deepEqual(article.tags, ["テスト"]);
});

test("URLを組み立てられないノートはnullを返す", () => {
  assert.equal(mapApiNote({ name: "壊れたデータ" }, "x"), null);
  assert.equal(mapApiNote(null, "x"), null);
});

test("タイトルからキーワードを抽出しストップワードを除く", () => {
  const words = extractTitleKeywords("ChatGPTで月5万円を稼ぐための副業ロードマップ");
  assert.ok(words.includes("ChatGPT"));
  assert.ok(words.includes("5万円"));
  assert.ok(words.includes("ロードマップ"));
  assert.ok(!words.includes("ため"));
});

test("人気ワードをスキ数の重み付きで集計する", () => {
  const now = new Date().toISOString();
  const entries = [
    { genre: "副業", articles: [
      { title: "ChatGPT活用術", tags: ["ChatGPT"], likes: 500, price: 980, publishedAt: now },
      { title: "ChatGPTの始め方", tags: [], likes: 10, price: 0, publishedAt: now },
    ] },
    { genre: "AI", articles: [
      { title: "ChatGPTと生きる", tags: ["日常"], likes: 5, price: 0, publishedAt: now },
    ] },
  ];
  const words = aggregateTrendWords(entries);
  const top = words[0];
  assert.equal(top.word, "ChatGPT");
  assert.equal(top.count, 3);
  assert.deepEqual([...top.genres].sort(), ["AI", "副業"]);
  // ジャンル名そのものは集計から除外される
  assert.ok(!words.some((w) => w.word === "副業" || w.word === "AI"));
});

test("新着記事の投稿ペースを推定する", () => {
  const now = Date.now();
  const articles = [0, 1, 2, 3].map((day) => ({ publishedAt: new Date(now - day * 86_400_000).toISOString() }));
  const pace = estimatePostsPerDay(articles);
  assert.ok(pace >= 0.9 && pace <= 1.1, `expected ~1/day, got ${pace}`);
  assert.equal(estimatePostsPerDay([]), 0);
});

test("穴場度スコア: 需要が高いほど高く、供給が多いほど低い", () => {
  const base = { avgLikes: 100, paidRatio: 0.4, totalCount: 10000, postsPerDay: 10 };
  const moreDemand = opportunityScore({ ...base, avgLikes: 800, paidRatio: 0.8 });
  const moreSupply = opportunityScore({ ...base, totalCount: 900000, postsPerDay: 200 });
  const score = opportunityScore(base);
  assert.ok(moreDemand > score, "需要増でスコアが上がる");
  assert.ok(moreSupply < score, "供給増でスコアが下がる");
  assert.ok(score >= 0 && score <= 100);
  assert.equal(typeof gapLabel(score), "string");
});

test("ジャンル入力をサニタイズしフォールバックする", () => {
  assert.deepEqual(sanitizeGenres(["#副業", " AI ", "", "副業"], ["x"]), ["副業", "AI"]);
  assert.deepEqual(sanitizeGenres([], ["副業", "AI"]), ["副業", "AI"]);
  assert.deepEqual(sanitizeGenres(undefined, ["fallback"]), ["fallback"]);
  assert.equal(sanitizeGenres([1, 2, 3, 4, 5].map(String), ["x"], 3).length, 3);
});

test("検索欄への入力を種別判定する: 通常キーワード", () => {
  assert.deepEqual(parseSearchQuery("AI副業"), { type: "keyword", keyword: "AI副業" });
  assert.deepEqual(parseSearchQuery("#恋愛"), { type: "keyword", keyword: "恋愛" });
  assert.deepEqual(parseSearchQuery("  "), { type: "empty" });
  assert.deepEqual(parseSearchQuery(""), { type: "empty" });
});

test("検索欄への入力を種別判定する: noteのハッシュタグ・検索URL", () => {
  assert.deepEqual(parseSearchQuery("https://note.com/hashtag/AI副業"), { type: "keyword", keyword: "AI副業" });
  assert.deepEqual(parseSearchQuery("https://note.com/hashtag/AI?f=popular"), { type: "keyword", keyword: "AI" });
  assert.deepEqual(parseSearchQuery("note.com/hashtag/恋愛"), { type: "keyword", keyword: "恋愛" });
  assert.deepEqual(parseSearchQuery("https://note.com/search?q=%E5%89%AF%E6%A5%AD&context=note&mode=search"), { type: "keyword", keyword: "副業" });
});

test("検索欄への入力を種別判定する: note記事URLはarticle扱い", () => {
  const result = parseSearchQuery("https://note.com/creator1/n/nabc123");
  assert.equal(result.type, "article");
  assert.equal(result.url, "https://note.com/creator1/n/nabc123");
});

test("検索欄への入力を種別判定する: note.com以外や未対応URLはinvalid", () => {
  assert.deepEqual(parseSearchQuery("https://example.com/hashtag/AI"), { type: "invalid" });
  assert.deepEqual(parseSearchQuery("https://note.com/"), { type: "invalid" });
  assert.deepEqual(parseSearchQuery("https://note.com/creator1"), { type: "invalid" });
});
