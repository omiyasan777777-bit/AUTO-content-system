"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import type { FortuneResult } from "@/types/fortune";
import { FORTUNE_SECTION_ORDER } from "@/types/fortune";
import { appConfig } from "@/config/app";

interface Props {
  result: FortuneResult;
}

/** 結果をテキスト化する（共有・コピー用。URLに個人情報は含めない） */
function resultToText(result: FortuneResult): string {
  const lines = [
    `🌙 ${appConfig.appName}｜${result.themeLabel}`,
    "",
    ...FORTUNE_SECTION_ORDER.flatMap((key) => {
      const section = result.sections[key];
      return [`◆ ${section.title}`, section.body, ""];
    }),
  ];
  return lines.join("\n").trim();
}

type Feedback = { kind: "success" | "error"; text: string } | null;

export function ShareActions({ result }: Props) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showFeedback = (next: Exclude<Feedback, null>) => {
    setFeedback(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFeedback(null), 2500);
  };

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showFeedback({ kind: "success", text: successMessage });
    } catch {
      showFeedback({
        kind: "error",
        text: "コピーできませんでした。お使いのブラウザではこの機能が使えない可能性があります。",
      });
    }
  };

  // アプリのURLを共有する（結果本文や名前は含めない）
  const handleShare = async () => {
    const url = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({
          title: appConfig.appName,
          text: appConfig.shareText,
          url,
        });
      } catch {
        // 共有シートを閉じただけの場合もあるため、エラー表示はしない
      }
      return;
    }
    // Web Share API が使えないブラウザではリンクをコピーする
    await copyText(
      `${appConfig.shareText}\n${url}`,
      "共有リンクをコピーしました。",
    );
  };

  // 結果全文を自分用に控えるためのコピー
  const handleCopyResult = async () => {
    await copyText(resultToText(result), "占い結果をコピーしました。");
  };

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-mauve-300 bg-white px-6 text-sm font-bold text-mauve-700 transition-colors hover:bg-mauve-100"
        >
          <Share2 aria-hidden="true" className="h-4 w-4" />
          {appConfig.buttons.share}
        </button>
        <button
          type="button"
          onClick={handleCopyResult}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-mauve-300 bg-white px-6 text-sm font-bold text-mauve-700 transition-colors hover:bg-mauve-100"
        >
          <Copy aria-hidden="true" className="h-4 w-4" />
          {appConfig.buttons.copyResult}
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`mt-2 flex min-h-5 items-center justify-center gap-1 text-xs ${
          feedback?.kind === "error" ? "text-red-700" : "text-mauve-700"
        }`}
      >
        {feedback && (
          <>
            {feedback.kind === "success" && (
              <Check aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            {feedback.text}
          </>
        )}
      </p>
    </div>
  );
}
