"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import type { FortuneThemeId } from "@/types/fortune";
import { themes } from "@/lib/fortune/templates";
import { appConfig } from "@/config/app";

interface Props {
  onSelect: (id: FortuneThemeId) => void;
}

export function ThemeSelect({ onSelect }: Props) {
  return (
    <div className="mx-auto w-full max-w-md px-6 pb-16 pt-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-soft"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        {appConfig.buttons.back}
      </Link>

      <div className="mt-4 text-center">
        <p className="text-xs tracking-[0.3em] text-gold">STEP 1 / 2</p>
        <h1 className="mt-3 font-serif text-2xl text-ink">
          今夜は、何を占いますか？
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          いちばん気になっているテーマをひとつ選んでください。
        </p>
      </div>

      <ul className="mt-8 space-y-3">
        {themes.map((theme) => (
          <li key={theme.id}>
            <button
              type="button"
              onClick={() => onSelect(theme.id)}
              className="group flex min-h-16 w-full items-center gap-4 rounded-2xl border border-mauve-200/70 bg-white/80 px-5 py-4 text-left transition-colors hover:border-mauve-400 hover:bg-mauve-100/60"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush"
              >
                <Heart className="h-4 w-4 text-mauve-500" />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-bold text-ink">
                  {theme.label}
                </span>
                <span className="mt-0.5 block text-xs text-ink-soft">
                  {theme.description}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-mauve-300 transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
