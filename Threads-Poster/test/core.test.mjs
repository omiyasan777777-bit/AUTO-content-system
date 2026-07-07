import test from "node:test";
import assert from "node:assert/strict";
import {
  formatPrice, resolvePlaceholders, buildSaleCalendar, nextSaleEvent,
  decidePrePublishAction, applyPriceUpdate, normalizeRakutenItem,
} from "../lib/core.mjs";

test("formatPrice: カンマ区切り+円", () => {
  assert.equal(formatPrice(12800), "12,800円");
  assert.equal(formatPrice(0), "");
  assert.equal(formatPrice("abc"), "");
});

test("resolvePlaceholders: 日本語・英語の両方を解決", () => {
  const product = { itemName: "テスト商品", itemPrice: 4980, affiliateUrl: "https://hb.afl.rakuten.co.jp/x" };
  const text = "✨{商品名} が {価格}！\n👉 {URL} / {name} {price} {url}";
  const out = resolvePlaceholders(text, product);
  assert.match(out, /テスト商品 が 4,980円！/);
  assert.match(out, /https:\/\/hb\.afl\.rakuten\.co\.jp\/x/);
  assert.doesNotMatch(out, /\{商品名\}|\{price\}/);
});

test("resolvePlaceholders: {URL}はアフィリエイトリンク直行、無ければ商品ページ", () => {
  assert.equal(
    resolvePlaceholders("{URL}", { affiliateUrl: "https://hb.afl.rakuten.co.jp/1", itemUrl: "https://item.rakuten.co.jp/1" }),
    "https://hb.afl.rakuten.co.jp/1",
  );
  assert.equal(
    resolvePlaceholders("{URL}", { itemUrl: "https://item.rakuten.co.jp/1" }),
    "https://item.rakuten.co.jp/1",
  );
});

test("buildSaleCalendar: スーパーSALEは3,6,9,12月、それ以外はマラソン", () => {
  const now = new Date("2026-07-01T00:00:00+09:00");
  const cal = buildSaleCalendar(now);
  const sep = cal.find((ev) => ev.id === "auto-2026-9");
  const jul = cal.find((ev) => ev.id === "auto-2026-7");
  assert.equal(sep.type, "super_sale");
  assert.equal(sep.name, "楽天スーパーSALE");
  assert.equal(jul.type, "marathon");
  // 過去のイベントは含まない
  assert.ok(!cal.find((ev) => ev.id === "auto-2026-1"));
});

test("buildSaleCalendar: カスタムイベントを併合し開始日順に並ぶ", () => {
  const now = new Date("2026-07-01T00:00:00+09:00");
  const cal = buildSaleCalendar(now, [
    { id: "c1", name: "超ポイントバック祭", startAt: "2026-07-02T10:00:00+09:00", endAt: "2026-07-03T23:59:00+09:00" },
  ]);
  assert.equal(cal[0].id, "c1");
  assert.equal(cal[0].type, "custom");
});

test("nextSaleEvent: 開催中なら started=true / daysUntil=0", () => {
  const during = new Date("2026-09-05T12:00:00+09:00");
  const ev = nextSaleEvent(during);
  assert.equal(ev.type, "super_sale");
  assert.equal(ev.started, true);
  assert.equal(ev.daysUntil, 0);
});

test("decidePrePublishAction: 在庫切れ→skip/replaceをモードで分岐", () => {
  const node = { product: { itemCode: "x:1" }, outOfStockMode: "skip" };
  assert.equal(decidePrePublishAction(node, { availability: 0 }).action, "skip");
  node.outOfStockMode = "replace";
  assert.equal(decidePrePublishAction(node, { availability: 0 }).action, "replace");
  assert.equal(decidePrePublishAction(node, { availability: 1 }).action, "post");
  assert.equal(decidePrePublishAction({ product: null }, null).action, "post");
});

test("applyPriceUpdate: 価格変動を検知して自動差し替え", () => {
  const product = { itemCode: "x:1", itemName: "A", itemPrice: 5000, availability: 1 };
  const { product: updated, change } = applyPriceUpdate(product, { itemPrice: 3980, availability: 1 });
  assert.equal(updated.itemPrice, 3980);
  assert.equal(change.direction, "down");
  assert.equal(change.oldPrice, 5000);
  const same = applyPriceUpdate(updated, { itemPrice: 3980, availability: 1 });
  assert.equal(same.change, null);
});

test("normalizeRakutenItem: formatVersion=2形式を正規化", () => {
  const item = normalizeRakutenItem({
    itemCode: "shop:123", itemName: "商品", itemPrice: "1980",
    itemUrl: "https://item.rakuten.co.jp/x", affiliateUrl: "https://hb.afl.rakuten.co.jp/x",
    mediumImageUrls: ["https://img.example/1.jpg?_ex=128x128"],
    shopName: "店", availability: 1, reviewAverage: "4.5",
  });
  assert.equal(item.itemPrice, 1980);
  assert.equal(item.affiliateUrl, "https://hb.afl.rakuten.co.jp/x");
  // 128x128 サムネイルは 300x300 に高解像度化される
  assert.equal(item.imageUrl, "https://img.example/1.jpg?_ex=300x300");
});
