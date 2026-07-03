import test from "node:test";
import assert from "node:assert/strict";
import { hasBoughtWithin24hSignal } from "../server.mjs";

test("24時間以内の購入表示を検出する", () => {
  assert.equal(hasBoughtWithin24hSignal("<span>買われています | 過去24時間以内</span>"), true);
  assert.equal(hasBoughtWithin24hSignal("<span>買われています｜過去２４時間</span>"), true);
  assert.equal(hasBoughtWithin24hSignal('<script>window.__DATA__={"isPurchasedWithinLast24Hours":true}</script>'), true);
  assert.equal(hasBoughtWithin24hSignal('<script>window.__NUXT__=(function(a,b,c){return {isPurchasedWithinLast24Hours:c}}(null,false,true));</script>'), true);
});

test("価格だけの記事を購入済みと判定しない", () => {
  assert.equal(hasBoughtWithin24hSignal("<span>¥1,980</span>"), false);
  assert.equal(hasBoughtWithin24hSignal("<span>買われています</span>"), false);
  assert.equal(hasBoughtWithin24hSignal("<span>過去24時間以内</span>"), false);
  assert.equal(hasBoughtWithin24hSignal('<script>window.__DATA__={"isPurchasedWithinLast24Hours":false}</script>'), false);
  assert.equal(hasBoughtWithin24hSignal('<script>window.__NUXT__=(function(a,b,c){return {isPurchasedWithinLast24Hours:b}}(null,false,true));</script>'), false);
});
