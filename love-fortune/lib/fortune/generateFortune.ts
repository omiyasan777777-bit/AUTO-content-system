import type {
  FortuneInput,
  FortuneResult,
  FortuneTone,
} from "@/types/fortune";
import {
  actionTemplates,
  avoidTemplates,
  changeTemplates,
  closingLines,
  destinyMessages,
  feelingsTemplates,
  obstacleTemplates,
  sectionTitles,
  situationTemplates,
  themes,
  wishClosingLines,
} from "./templates";

/**
 * 占い結果の生成モジュール。
 *
 * 外部APIを使わない決定的な実装。入力内容から seed を作り、
 * seed 付き乱数でテンプレートを組み合わせて結果を構成する。
 * seed に「週番号」を混ぜているため、同じ入力なら約1週間は
 * 同じ結果が返り、週が変わると結果も少し変化する。
 *
 * 将来 Claude API 等の生成AIに差し替える場合は、
 * 同じシグネチャ（FortuneInput -> FortuneResult）で
 * 別実装を用意し、呼び出し側の import を切り替えるだけでよい。
 */

/** 文字列から32bitハッシュを作る（xmur3）。seed生成用 */
function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** seed付き擬似乱数生成器（mulberry32）。0以上1未満を返す */
function createRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 配列から1つ選ぶ */
function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

/**
 * 生年月日から運命数（1〜9）を算出する。
 * 数秘術の要領で、数字を一桁になるまで足し合わせる。
 */
export function calcDestinyNumber(birthDate: string): number {
  let sum = birthDate
    .replace(/\D/g, "")
    .split("")
    .reduce((acc, d) => acc + Number(d), 0);
  while (sum > 9) {
    sum = String(sum)
      .split("")
      .reduce((acc, d) => acc + Number(d), 0);
  }
  // 空文字などで0になった場合の保険。バリデーション済み入力では起こらない
  return sum === 0 ? 9 : sum;
}

/** 「同じ入力なら約1週間は同じ結果」にするための週番号 */
function weekNumber(now: Date): number {
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  return Math.floor(now.getTime() / MS_PER_WEEK);
}

/** 入力から決定的な seed を作る */
function buildSeed(input: FortuneInput, now: Date): number {
  const key = [
    input.themeId,
    input.nickname.trim(),
    input.birthDate,
    input.partnerNickname?.trim() ?? "",
    input.partnerBirthDate ?? "",
    input.relationship,
    input.wish ?? "",
    weekNumber(now),
  ].join("|");
  return hashString(key);
}

/** プレースホルダーを実際の名前に置換する */
function fill(template: string, name: string, partner: string): string {
  return template.replaceAll("{name}", name).replaceAll("{partner}", partner);
}

export function generateFortune(
  input: FortuneInput,
  now: Date = new Date(),
): FortuneResult {
  const random = createRandom(buildSeed(input, now));

  const theme = themes.find((t) => t.id === input.themeId);
  if (!theme) {
    throw new Error(`未知のテーマです: ${input.themeId}`);
  }

  const destinyNumber = calcDestinyNumber(input.birthDate);

  // トーンは seed から決定。前向き:慎重 = 6:4 で、暗くなりすぎないよう調整
  const tone: FortuneTone = random() < 0.6 ? "positive" : "cautious";

  const name = input.nickname.trim();
  const partner = input.partnerNickname?.trim() || "あの人";

  const actionBody = fill(pick(actionTemplates[input.themeId], random), name, partner);
  const actionWithWish = input.wish
    ? `${actionBody}\n\n${wishClosingLines[input.wish]}`
    : actionBody;

  const messageBody = [
    fill(pick(destinyMessages[destinyNumber], random), name, partner),
    pick(closingLines[tone], random),
  ].join("\n\n");

  return {
    themeId: input.themeId,
    themeLabel: theme.label,
    nickname: name,
    tone,
    destinyNumber,
    sections: {
      situation: {
        title: sectionTitles.situation,
        body: fill(pick(situationTemplates[input.relationship], random), name, partner),
      },
      feelings: {
        title: sectionTitles.feelings,
        body: fill(pick(feelingsTemplates[input.themeId][tone], random), name, partner),
      },
      obstacle: {
        title: sectionTitles.obstacle,
        body: fill(pick(obstacleTemplates[input.themeId], random), name, partner),
      },
      change: {
        title: sectionTitles.change,
        body: fill(pick(changeTemplates[input.themeId][tone], random), name, partner),
      },
      action: {
        title: sectionTitles.action,
        body: actionWithWish,
      },
      avoid: {
        title: sectionTitles.avoid,
        body: fill(pick(avoidTemplates[input.themeId], random), name, partner),
      },
      message: {
        title: sectionTitles.message,
        body: messageBody,
      },
    },
  };
}
