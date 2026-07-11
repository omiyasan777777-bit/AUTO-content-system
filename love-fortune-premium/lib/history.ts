import type { HistoryEntry, PremiumFortuneResult } from "@/types/fortune";

/**
 * 占い履歴の保存・読み出し。
 * 保存先は端末内の localStorage のみで、外部には一切送信しない。
 * 容量やプライバシーに配慮し、直近10件だけ保持する。
 */

const STORAGE_KEY = "koi-no-shirube-premium:history";
const MAX_ENTRIES = 10;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        typeof e === "object" && e !== null && "savedAt" in e && "result" in e,
    );
  } catch {
    // 壊れたデータや容量制限は履歴なしとして扱う（占い自体は妨げない）
    return [];
  }
}

export function saveToHistory(result: PremiumFortuneResult): void {
  if (typeof window === "undefined") return;
  try {
    const entries = loadHistory();
    entries.unshift({ savedAt: new Date().toISOString(), result });
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_ENTRIES)),
    );
  } catch {
    // プライベートブラウズ等で保存できなくても占いは続行できる
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 失敗しても実害はない
  }
}
