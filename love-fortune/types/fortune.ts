/**
 * 占い機能で使う型定義。
 * 生成ロジック（lib/fortune/）と画面（components/）の間の契約になるため、
 * 変更する場合は両方への影響を確認すること。
 */

/** 相談テーマの識別子 */
export type FortuneThemeId =
  | "feelings" // あの人の今の気持ち
  | "future" // 2人の今後
  | "crush" // 片思いの行方
  | "reunion" // 復縁の可能性
  | "contact" // 連絡するべきタイミング
  | "newLove" // 新しい出会い
  | "message"; // 今の私に必要な恋愛メッセージ

export interface FortuneTheme {
  id: FortuneThemeId;
  label: string;
  /** テーマ選択カードに表示する短い説明 */
  description: string;
}

/** 相手との現在の関係 */
export type RelationshipId =
  | "acquaintance" // 知り合い・顔見知り
  | "friend" // 友達
  | "dating" // 付き合っている
  | "ex" // 元恋人
  | "complicated" // 複雑な事情がある
  | "none"; // 特定の相手はいない

export interface RelationshipOption {
  id: RelationshipId;
  label: string;
}

/** 「今いちばん知りたいこと」の選択肢 */
export type WishId =
  | "hisFeelings" // 相手の気持ち
  | "whatToDo" // 自分が取るべき行動
  | "futureFlow" // これからの流れ
  | "shouldContinue" // この恋を続けるべきか
  | "timing"; // 動くタイミング

export interface WishOption {
  id: WishId;
  label: string;
}

/** フォームから占い生成ロジックへ渡す入力 */
export interface FortuneInput {
  themeId: FortuneThemeId;
  /** 自分のニックネーム（必須） */
  nickname: string;
  /** 自分の生年月日 YYYY-MM-DD（必須） */
  birthDate: string;
  /** 相手のニックネーム（任意） */
  partnerNickname?: string;
  /** 相手の生年月日 YYYY-MM-DD（任意・不明でも占える） */
  partnerBirthDate?: string;
  /** 現在の関係（必須） */
  relationship: RelationshipId;
  /** 今いちばん知りたいこと（任意） */
  wish?: WishId;
  /** 自由記述の相談内容（任意・端末内でのみ利用しどこにも送信しない） */
  consultation?: string;
}

/** 結果の方向性。断定を避けつつ文章のトーンを分ける */
export type FortuneTone = "positive" | "cautious";

export interface FortuneSection {
  /** 結果画面の見出し */
  title: string;
  /** 本文（プレーンテキスト。改行は \n） */
  body: string;
}

export interface FortuneResult {
  themeId: FortuneThemeId;
  themeLabel: string;
  /** 結果ヘッダーの宛名表示用（テンプレートの選び方によらず名前を出すため） */
  nickname: string;
  tone: FortuneTone;
  /** 生年月日から導いた 1〜9 の数（結果の個別化に使用） */
  destinyNumber: number;
  sections: {
    situation: FortuneSection; // 1. 今の恋愛状況
    feelings: FortuneSection; // 2. 相手の気持ち・現在の流れ
    obstacle: FortuneSection; // 3. 2人の間にある障害
    change: FortuneSection; // 4. この先起こりやすい変化
    action: FortuneSection; // 5. 今やるべき行動
    avoid: FortuneSection; // 6. 避けた方がいい行動
    message: FortuneSection; // 7. 最後の恋愛メッセージ
  };
}

/** 結果セクションを表示順に取り出すためのキー一覧 */
export const FORTUNE_SECTION_ORDER = [
  "situation",
  "feelings",
  "obstacle",
  "change",
  "action",
  "avoid",
  "message",
] as const satisfies readonly (keyof FortuneResult["sections"])[];
