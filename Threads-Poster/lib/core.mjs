// Threads Poster — 純粋ロジック（テスト対象）
// サーバー本体から分離した、副作用のない関数群。

/** 価格を「12,800円」形式に整形 */
export function formatPrice(price) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toLocaleString("ja-JP")}円`;
}

/**
 * 投稿本文のプレースホルダを商品情報で解決する。
 * 対応: {商品名} {価格} {URL} {name} {price} {url}
 * {URL} の優先順位: ユーザー指定の短縮URL（a.r10.to等）> アフィリエイトURL > 商品ページ
 */
export function resolvePlaceholders(text, product, customUrl = "") {
  if (!text) return "";
  const name = product?.itemName || "";
  const price = formatPrice(product?.itemPrice);
  const url = customUrl || product?.affiliateUrl || product?.itemUrl || "";
  return text
    .replace(/\{商品名\}|\{name\}/g, name)
    .replace(/\{価格\}|\{price\}/g, price)
    .replace(/\{URL\}|\{url\}/g, url);
}

/**
 * 楽天のセールカレンダー（推定）を生成する。
 * ・楽天スーパーSALE: 3/6/9/12月、4日20:00 〜 11日01:59
 * ・お買い物マラソン: 上記以外の月、おおむね 4日20:00 〜 11日01:59（月により変動するため目安）
 * 日時はJST。ユーザー定義イベント(custom)があれば併合する。
 */
export function buildSaleCalendar(now = new Date(), customEvents = []) {
  const events = [];
  const year = now.getFullYear();
  for (let y = year; y <= year + 1; y++) {
    for (let m = 1; m <= 12; m++) {
      const isSuperSale = [3, 6, 9, 12].includes(m);
      const start = new Date(`${y}-${String(m).padStart(2, "0")}-04T20:00:00+09:00`);
      const end = new Date(`${y}-${String(m).padStart(2, "0")}-11T01:59:00+09:00`);
      events.push({
        id: `auto-${y}-${m}`,
        name: isSuperSale ? "楽天スーパーSALE" : "お買い物マラソン",
        type: isSuperSale ? "super_sale" : "marathon",
        estimated: true,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });
    }
  }
  for (const ev of customEvents) {
    if (ev?.startAt) events.push({ estimated: false, type: "custom", ...ev });
  }
  return events
    .filter((ev) => new Date(ev.endAt || ev.startAt) >= now)
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}

/** 次のセールイベントと開始までの日数を返す */
export function nextSaleEvent(now = new Date(), customEvents = []) {
  const upcoming = buildSaleCalendar(now, customEvents);
  if (!upcoming.length) return null;
  const ev = upcoming[0];
  const startsAt = new Date(ev.startAt);
  const started = startsAt <= now;
  const daysUntil = started ? 0 : Math.ceil((startsAt - now) / 86400000);
  return { ...ev, started, daysUntil };
}

/**
 * 在庫・価格の再チェック結果から、投稿直前のアクションを決める。
 * @returns {action: "post"|"skip"|"replace", reason}
 */
export function decidePrePublishAction(node, latest) {
  if (!node?.product?.itemCode) return { action: "post", reason: "商品リンクなし" };
  if (!latest) return { action: "post", reason: "最新情報を取得できず（そのまま投稿）" };
  if (Number(latest.availability) === 0) {
    const mode = node.outOfStockMode || "skip";
    return mode === "replace"
      ? { action: "replace", reason: "在庫切れ→代替商品に差し替え" }
      : { action: "skip", reason: "在庫切れ→この投稿をスキップ" };
  }
  return { action: "post", reason: "在庫あり" };
}

/** 価格変動を検知して商品情報を更新（自動差し替え）。変動があれば change を返す */
export function applyPriceUpdate(product, latest) {
  if (!product || !latest) return { product, change: null };
  const oldPrice = Number(product.itemPrice) || 0;
  const newPrice = Number(latest.itemPrice) || 0;
  const updated = {
    ...product,
    itemPrice: newPrice || oldPrice,
    availability: latest.availability ?? product.availability,
    itemUrl: latest.itemUrl || product.itemUrl,
    affiliateUrl: latest.affiliateUrl || product.affiliateUrl,
    imageUrl: latest.imageUrl || product.imageUrl,
    checkedAt: new Date().toISOString(),
  };
  if (oldPrice && newPrice && oldPrice !== newPrice) {
    return {
      product: updated,
      change: {
        itemCode: product.itemCode,
        itemName: product.itemName,
        oldPrice,
        newPrice,
        direction: newPrice < oldPrice ? "down" : "up",
      },
    };
  }
  return { product: updated, change: null };
}

/**
 * 楽天アフィリエイトのリンクURLを生成する。
 * 標準形式: https://hb.afl.rakuten.co.jp/hgc/{アフィリエイトID}/?pc={商品URL}&m={商品URL}
 * APIがaffiliateUrlを返さない場合のフォールバックとして使う。
 */
export function buildAffiliateUrl(itemUrl, affiliateId) {
  if (!itemUrl || !affiliateId) return "";
  const enc = encodeURIComponent(itemUrl);
  return `https://hb.afl.rakuten.co.jp/hgc/${affiliateId}/?pc=${enc}&m=${enc}`;
}

/** 商品にアフィリエイトURLが無ければ生成して補完する */
export function ensureAffiliateUrl(item, affiliateId) {
  if (!item) return item;
  if (item.affiliateUrl && item.affiliateUrl.includes("hb.afl.rakuten.co.jp")) return item;
  const built = buildAffiliateUrl(item.itemUrl, affiliateId);
  return built ? { ...item, affiliateUrl: built } : item;
}

/** 楽天APIレスポンスの1商品を内部形式に正規化 */
export function normalizeRakutenItem(raw) {
  const item = raw?.Item || raw || {};
  // 画像はformatVersionにより文字列 or {imageUrl} オブジェクトの両形式がある
  const img0 = item.mediumImageUrls?.[0];
  const rawImg = (typeof img0 === "string" ? img0 : img0?.imageUrl) || "";
  return {
    itemCode: item.itemCode || "",
    itemName: item.itemName || "",
    itemPrice: Number(item.itemPrice) || 0,
    itemUrl: item.itemUrl || "",
    affiliateUrl: item.affiliateUrl || item.itemUrl || "",
    imageUrl: rawImg.replace("?_ex=128x128", "?_ex=300x300"),
    shopName: item.shopName || "",
    availability: item.availability ?? 1,
    reviewAverage: Number(item.reviewAverage) || 0,
    checkedAt: new Date().toISOString(),
  };
}
