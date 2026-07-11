"use client";

import { useEffect, useState } from "react";
import { Moon, Sparkles, Star } from "lucide-react";

const MESSAGES = [
  "月の相カードを読み解いています…",
  "2人の縁と星の巡りを確かめています…",
  "3ヶ月先までの流れを見つめています…",
];

/** 結果表示前の占い演出。動きを減らす設定では静止表示になる */
export function FortuneLoading() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, 1100);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-24 text-center"
    >
      <div aria-hidden="true" className="relative h-32 w-32">
        <span className="absolute inset-0 flex items-center justify-center">
          <Moon className="h-14 w-14 animate-float text-mauve-300" />
        </span>
        <Star className="absolute left-1 top-4 h-5 w-5 animate-twinkle text-gold" />
        <Sparkles className="absolute right-0 top-10 h-6 w-6 animate-twinkle text-mauve-300 [animation-delay:0.6s]" />
        <Star className="absolute bottom-2 left-8 h-4 w-4 animate-twinkle text-gold-soft [animation-delay:1.2s]" />
      </div>
      <p className="mt-8 font-serif text-lg text-moonlight">{MESSAGES[index]}</p>
      <p className="mt-3 text-xs text-moonlight-faint">そのままお待ちください</p>
    </div>
  );
}
