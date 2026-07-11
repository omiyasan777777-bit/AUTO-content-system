"use client";

import { useState } from "react";
import { ChevronLeft, Moon, Sparkles } from "lucide-react";
import { appConfig } from "@/config/app";

interface Props {
  /** 場に並ぶカードの枚数（中身は結果生成側が決めるため見せない） */
  deckSize: number;
  onConfirm: (picks: [number, number, number]) => void;
  onBack: () => void;
}

const POSITION_LABELS = ["過去", "現在", "未来"] as const;

/**
 * 月の相カードを3枚選ぶ演出画面。
 * カードは伏せられており、選んだ順に「過去・現在・未来」の位置に入る。
 */
export function CardDraw({ deckSize, onConfirm, onBack }: Props) {
  const [picks, setPicks] = useState<number[]>([]);

  const toggle = (index: number) => {
    setPicks((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length >= 3) return prev;
      return [...prev, index];
    });
  };

  const ready = picks.length === 3;

  return (
    <div className="mx-auto w-full max-w-md px-6 pb-16 pt-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-1 text-sm text-moonlight-soft"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        入力に{appConfig.buttons.back}
      </button>

      <div className="mt-4 text-center">
        <p className="text-xs tracking-[0.3em] text-gold">DRAW THE MOON</p>
        <h1 className="mt-3 font-serif text-2xl text-moonlight">
          月の相カードを3枚、選んでください
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-moonlight-soft">
          心を落ち着けて、気になるカードを直感で。
          <br />
          選んだ順に「過去・現在・未来」を映します。
        </p>
      </div>

      {/* 選択状況（過去/現在/未来のどこまで選んだか） */}
      <div className="mt-6 flex justify-center gap-3" aria-hidden="true">
        {POSITION_LABELS.map((label, i) => (
          <span
            key={label}
            className={`rounded-full border px-4 py-1 text-xs ${
              picks.length > i
                ? "border-gold bg-gold/15 text-gold"
                : "border-night-line text-moonlight-faint"
            }`}
          >
            {label}
          </span>
        ))}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {picks.length}枚選択済み。あと{3 - picks.length}枚選べます。
      </p>

      <ul className="mt-6 grid grid-cols-5 gap-3">
        {Array.from({ length: deckSize }, (_, index) => {
          const order = picks.indexOf(index);
          const selected = order >= 0;
          return (
            <li key={index} style={{ animationDelay: `${index * 50}ms` }} className="animate-card-in">
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-pressed={selected}
                aria-label={
                  selected
                    ? `${index + 1}枚目のカード（${POSITION_LABELS[order]}として選択中。押すと戻す）`
                    : `${index + 1}枚目の伏せられたカードを選ぶ`
                }
                className={`relative flex aspect-[5/8] w-full items-center justify-center rounded-xl border transition-all ${
                  selected
                    ? "-translate-y-1.5 border-gold bg-mauve-800 shadow-lg shadow-black/50"
                    : "border-night-line bg-night-card hover:border-gold-soft"
                }`}
              >
                <Moon
                  aria-hidden="true"
                  className={`h-6 w-6 ${selected ? "text-gold" : "text-mauve-400"}`}
                />
                {selected && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-[11px] font-bold text-night"
                  >
                    {order + 1}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => ready && onConfirm(picks as [number, number, number])}
        disabled={!ready}
        className={`mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-8 text-base font-bold transition-colors ${
          ready
            ? "bg-gold text-night shadow-lg shadow-black/40 hover:bg-gold-soft"
            : "cursor-not-allowed bg-night-card text-moonlight-faint"
        }`}
      >
        <Sparkles aria-hidden="true" className="h-5 w-5" />
        {ready
          ? appConfig.buttons.drawDone
          : `あと${3 - picks.length}枚選んでください`}
      </button>
    </div>
  );
}
