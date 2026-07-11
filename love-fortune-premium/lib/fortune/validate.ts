import type { FortuneInput } from "@/types/fortune";
import { relationshipOptions, themes, wishOptions } from "./templates";

/**
 * フォーム入力のバリデーション。
 * エラーメッセージはすべて日本語で、フィールド単位で返す。
 * 入力はサーバーへ送信されずクライアント内で完結するが、
 * 不正な日付や過剰な長さは結果生成前にここで弾く。
 */

export const LIMITS = {
  nickname: 20,
  consultation: 500,
} as const;

export type FieldErrors = Partial<Record<keyof FortuneInput, string>>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD が実在する日付かどうか（2/30 などを弾く） */
function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function validateBirthDate(value: string, label: string): string | null {
  if (!isRealDate(value)) {
    return `${label}は正しい日付で入力してください。`;
  }
  const date = new Date(value);
  const now = new Date();
  if (date.getTime() > now.getTime()) {
    return `${label}に未来の日付は指定できません。`;
  }
  if (date.getFullYear() < 1920) {
    return `${label}は1920年以降で入力してください。`;
  }
  return null;
}

export function validateFortuneInput(input: FortuneInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!themes.some((t) => t.id === input.themeId)) {
    errors.themeId = "占うテーマを選んでください。";
  }

  const nickname = input.nickname.trim();
  if (!nickname) {
    errors.nickname = "ニックネームを入力してください。";
  } else if (nickname.length > LIMITS.nickname) {
    errors.nickname = `ニックネームは${LIMITS.nickname}文字以内で入力してください。`;
  }

  if (!input.birthDate) {
    errors.birthDate = "生年月日を入力してください。";
  } else {
    const err = validateBirthDate(input.birthDate, "生年月日");
    if (err) errors.birthDate = err;
  }

  if (!relationshipOptions.some((r) => r.id === input.relationship)) {
    errors.relationship = "今の関係を選んでください。";
  }

  // ここから任意項目。入力がある場合のみ検査する
  const partnerNickname = input.partnerNickname?.trim();
  if (partnerNickname && partnerNickname.length > LIMITS.nickname) {
    errors.partnerNickname = `相手のニックネームは${LIMITS.nickname}文字以内で入力してください。`;
  }

  if (input.partnerBirthDate) {
    const err = validateBirthDate(input.partnerBirthDate, "相手の生年月日");
    if (err) errors.partnerBirthDate = err;
  }

  if (input.wish && !wishOptions.some((w) => w.id === input.wish)) {
    errors.wish = "選択肢から選んでください。";
  }

  if (input.consultation && input.consultation.length > LIMITS.consultation) {
    errors.consultation = `相談内容は${LIMITS.consultation}文字以内で入力してください。`;
  }

  return errors;
}
