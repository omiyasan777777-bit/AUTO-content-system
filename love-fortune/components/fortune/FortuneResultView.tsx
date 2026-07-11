"use client";

import {
  Compass,
  Feather,
  Footprints,
  Heart,
  type LucideIcon,
  Mountain,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wind,
} from "lucide-react";
import type { FortuneResult } from "@/types/fortune";
import { FORTUNE_SECTION_ORDER } from "@/types/fortune";
import { appConfig } from "@/config/app";
import { SafetyNotice } from "@/components/SafetyNotice";
import { DistributorLinks } from "@/components/DistributorLinks";
import { ShareActions } from "./ShareActions";

interface Props {
  result: FortuneResult;
  onRetry: () => void;
  onChangeTheme: () => void;
}

const SECTION_ICONS: Record<
  (typeof FORTUNE_SECTION_ORDER)[number],
  LucideIcon
> = {
  situation: Compass,
  feelings: Heart,
  obstacle: Mountain,
  change: Wind,
  action: Footprints,
  avoid: ShieldAlert,
  message: Feather,
};

export function FortuneResultView({ result, onRetry, onChangeTheme }: Props) {
  return (
    <div className="mx-auto w-full max-w-md px-6 pb-16 pt-10">
      <header className="text-center">
        <p className="text-xs tracking-[0.3em] text-gold">YOUR FORTUNE</p>
        <p className="mt-3 text-sm text-ink-soft">{result.nickname}さんへ</p>
        <h1 className="mt-1 font-serif text-2xl leading-relaxed text-ink">
          {result.themeLabel}
        </h1>
        <p className="mt-2 text-xs text-ink-faint">
          あなたの導きの数：{result.destinyNumber}
        </p>
      </header>

      <div className="mt-8 space-y-4">
        {FORTUNE_SECTION_ORDER.map((key, index) => {
          const section = result.sections[key];
          const Icon = SECTION_ICONS[key];
          const isLast = key === "message";
          return (
            <section
              key={key}
              aria-label={section.title}
              style={{ animationDelay: `${index * 90}ms` }}
              className={`animate-rise rounded-2xl border p-5 ${
                isLast
                  ? "border-gold-soft bg-gradient-to-b from-white to-blush"
                  : "border-mauve-200/70 bg-white/85"
              }`}
            >
              <h2 className="flex items-center gap-2.5 text-sm font-bold text-mauve-700">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lavender"
                >
                  <Icon className="h-4 w-4 text-mauve-600" />
                </span>
                {section.title}
              </h2>
              <div className="mt-3 space-y-3">
                {section.body.split("\n\n").map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-[15px] leading-relaxed text-ink"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-10 space-y-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-mauve-600 px-8 text-sm font-bold text-white shadow-lg shadow-mauve-300/50 transition-colors hover:bg-mauve-700"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          {appConfig.buttons.retry}
        </button>
        <button
          type="button"
          onClick={onChangeTheme}
          className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full border border-mauve-300 bg-white px-8 text-sm font-bold text-mauve-700 transition-colors hover:bg-mauve-100"
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          {appConfig.buttons.changeTheme}
        </button>
        <ShareActions result={result} />
      </div>

      <div className="mt-10 space-y-4">
        <DistributorLinks />
        <SafetyNotice />
      </div>
    </div>
  );
}
