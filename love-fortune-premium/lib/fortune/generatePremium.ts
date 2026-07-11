import type {
  BondReading,
  DrawnCards,
  FortuneInput,
  LuckyCharm,
  MoonCard,
  PremiumFortuneResult,
  TimelineEntry,
} from "@/types/fortune";
import {
  buildSeed,
  calcDestinyNumber,
  createRandom,
  generateFortune,
  pick,
} from "./generateFortune";
import {
  luckyActions,
  luckyColors,
  luckyDays,
  luckyItems,
  moonCards,
  pairReadings,
  selfReadings,
  timelineTemplates,
} from "./premiumTemplates";

/**
 * プレミアム版の結果生成。
 * 基本7セクション（generateFortune）に、カードリーディング・縁の診断・
 * 3ヶ月タイムライン・ラッキーチャームを加える。
 * 基本版と同じく決定的（同じ入力＋同じカード選択なら同じ結果）。
 */

/**
 * カード置き場の並びを seed から決める。
 * 画面のカード配置と結果を一致させるため、CardDraw と生成側の両方が
 * この関数を使うこと。
 */
export function shuffledDeck(input: FortuneInput, now: Date = new Date()): MoonCard[] {
  const random = createRandom(buildSeed(input, now) ^ 0x5f3759df);
  const deck = [...moonCards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function buildBond(input: FortuneInput): BondReading {
  const selfNumber = calcDestinyNumber(input.birthDate);
  if (input.partnerBirthDate) {
    const partnerNumber = calcDestinyNumber(input.partnerBirthDate);
    let pairNumber = selfNumber + partnerNumber;
    while (pairNumber > 9) {
      pairNumber = String(pairNumber)
        .split("")
        .reduce((acc, d) => acc + Number(d), 0);
    }
    const reading = pairReadings[pairNumber];
    return { kind: "pair", pairNumber, ...reading };
  }
  const reading = selfReadings[selfNumber];
  return { kind: "self", ...reading };
}

function buildTimeline(
  tone: PremiumFortuneResult["tone"],
  random: () => number,
  now: Date,
): [TimelineEntry, TimelineEntry, TimelineEntry] {
  const templates = timelineTemplates[tone];
  const labels = ["今月", "来月", "再来月"] as const;
  const bodies = [templates.month1, templates.month2, templates.month3];
  return [0, 1, 2].map((i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return {
      label: `${d.getMonth() + 1}月（${labels[i]}）`,
      body: pick(bodies[i], random),
    };
  }) as [TimelineEntry, TimelineEntry, TimelineEntry];
}

export function generatePremiumFortune(
  input: FortuneInput,
  /** ユーザーが場から選んだ3枚の位置（0始まり・選んだ順に 過去→現在→未来） */
  cardPicks: [number, number, number],
  now: Date = new Date(),
): PremiumFortuneResult {
  const base = generateFortune(input, now);
  // 基本セクションと違う組み合わせが出るよう seed をずらす
  const random = createRandom(buildSeed(input, now) ^ 0x9e3779b9);

  const deck = shuffledDeck(input, now);
  const cards: DrawnCards = {
    past: deck[cardPicks[0] % deck.length],
    present: deck[cardPicks[1] % deck.length],
    future: deck[cardPicks[2] % deck.length],
  };

  const lucky: LuckyCharm = {
    color: pick(luckyColors, random),
    item: pick(luckyItems, random),
    day: pick(luckyDays, random),
    action: pick(luckyActions, random),
  };

  return {
    ...base,
    cards,
    bond: buildBond(input),
    timeline: buildTimeline(base.tone, random, now),
    lucky,
  };
}
