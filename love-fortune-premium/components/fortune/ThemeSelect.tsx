"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, History, Moon, Trash2 } from "lucide-react";
import type { FortuneThemeId, HistoryEntry } from "@/types/fortune";
import { themes } from "@/lib/fortune/templates";
import { appConfig } from "@/config/app";

interface Props {
  onSelect: (id: FortuneThemeId) => void;
  history: HistoryEntry[];
  onOpenHistory: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ThemeSelect({
  onSelect,
  history,
  onOpenHistory,
  onClearHistory,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-md px-6 pb-16 pt-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-moonlight-soft"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        {appConfig.buttons.back}
      </Link>

      <div className="mt-4 text-center">
        <p className="text-xs tracking-[0.3em] text-gold">STEP 1 / 3</p>
        <h1 className="mt-3 font-serif text-2xl text-moonlight">
          今夜は、何を占いますか？
        </h1>
        <p className="mt-2 text-sm text-moonlight-soft">
          いちばん気になっているテーマをひとつ選んでください。
        </p>
      </div>

      <ul className="mt-8 space-y-3">
        {themes.map((theme) => (
          <li key={theme.id}>
            <button
              type="button"
              onClick={() => onSelect(theme.id)}
              className="group flex min-h-16 w-full items-center gap-4 rounded-2xl border border-night-line bg-night-card/80 px-5 py-4 text-left transition-colors hover:border-gold-soft hover:bg-night-card"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-night-soft"
              >
                <Moon className="h-4 w-4 text-gold" />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-bold text-moonlight">
                  {theme.label}
                </span>
                <span className="mt-0.5 block text-xs text-moonlight-soft">
                  {theme.description}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-mauve-400 transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </li>
        ))}
      </ul>

      {history.length > 0 && (
        <section aria-label="過去の占い" className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-moonlight-soft">
              <History aria-hidden="true" className="h-4 w-4 text-gold" />
              過去の占い（この端末にのみ保存）
            </h2>
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex min-h-11 items-center gap-1 text-xs text-moonlight-faint hover:text-moonlight-soft"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              すべて削除
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {history.map((entry) => (
              <li key={entry.savedAt}>
                <button
                  type="button"
                  onClick={() => onOpenHistory(entry)}
                  className="flex min-h-12 w-full items-center justify-between rounded-xl border border-night-line/70 bg-night-card/50 px-4 py-2.5 text-left transition-colors hover:border-gold-soft"
                >
                  <span className="text-sm text-moonlight">
                    {entry.result.themeLabel}
                    <span className="ml-2 text-xs text-moonlight-faint">
                      {entry.result.nickname}さん
                    </span>
                  </span>
                  <span className="text-xs text-moonlight-faint">
                    {formatDate(entry.savedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
