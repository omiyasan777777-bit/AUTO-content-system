"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, FileDown, ImageDown, Share2 } from "lucide-react";
import type { PremiumFortuneResult } from "@/types/fortune";
import { FORTUNE_SECTION_ORDER } from "@/types/fortune";
import { premiumSectionTitles } from "@/lib/fortune/premiumTemplates";
import { saveResultImage } from "@/lib/resultImage";
import { saveCertificatePdf } from "@/lib/certificatePdf";
import { appConfig } from "@/config/app";

interface Props {
  result: PremiumFortuneResult;
}

/** 結果をテキスト化する（共有・コピー用。URLに個人情報は含めない） */
function resultToText(result: PremiumFortuneResult): string {
  const cardLine = `過去「${result.cards.past.name}」／現在「${result.cards.present.name}」／未来「${result.cards.future.name}」`;
  const lines = [
    `🌙 ${appConfig.appName}｜${result.themeLabel}`,
    "",
    `◆ ${premiumSectionTitles.cards}`,
    cardLine,
    "",
    ...FORTUNE_SECTION_ORDER.flatMap((key) => {
      const section = result.sections[key];
      return [`◆ ${section.title}`, section.body, ""];
    }),
    `◆ ${premiumSectionTitles.timeline}`,
    ...result.timeline.map((t) => `【${t.label}】${t.body}`),
    "",
    `◆ ${premiumSectionTitles.lucky}`,
    `色: ${result.lucky.color} ／ もの: ${result.lucky.item} ／ 曜日: ${result.lucky.day}`,
    `おまじない: ${result.lucky.action}`,
  ];
  return lines.join("\n").trim();
}

type Feedback = { kind: "success" | "error"; text: string } | null;

export function ShareActions({ result }: Props) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);
  const [pdfSaving, setPdfSaving] = useState(false);
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

  // 結果カードを画像として保存（共有シート or ダウンロード）
  const handleSaveImage = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const how = await saveResultImage(result);
      showFeedback({
        kind: "success",
        text:
          how === "shared"
            ? "画像を共有しました。"
            : "画像を保存しました。（ダウンロードに保存されています）",
      });
    } catch {
      showFeedback({
        kind: "error",
        text: "画像を保存できませんでした。スクリーンショットをご利用ください。",
      });
    } finally {
      setSaving(false);
    }
  };

  // 鑑定書を正式なA4のPDFに組んで保存
  const handleSavePdf = async () => {
    if (pdfSaving) return;
    setPdfSaving(true);
    try {
      const how = await saveCertificatePdf(result);
      showFeedback({
        kind: "success",
        text:
          how === "shared"
            ? "鑑定書を共有しました。"
            : "鑑定書を保存しました。（ダウンロードに保存されています）",
      });
    } catch {
      showFeedback({
        kind: "error",
        text: "鑑定書を作成できませんでした。時間をおいてお試しください。",
      });
    } finally {
      setPdfSaving(false);
    }
  };

  const secondaryButton =
    "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-gold-soft bg-transparent px-5 text-sm font-bold text-gold transition-colors hover:bg-night-card";

  return (
    <div>
      <button
        type="button"
        onClick={handleSavePdf}
        disabled={pdfSaving}
        className={`${secondaryButton} w-full ${pdfSaving ? "opacity-60" : ""}`}
      >
        <FileDown aria-hidden="true" className="h-4 w-4" />
        {pdfSaving ? "鑑定書を作成中…" : appConfig.buttons.savePdf}
      </button>
      <button
        type="button"
        onClick={handleSaveImage}
        disabled={saving}
        className={`${secondaryButton} mt-2 w-full ${saving ? "opacity-60" : ""}`}
      >
        <ImageDown aria-hidden="true" className="h-4 w-4" />
        {saving ? "画像を作成中…" : appConfig.buttons.saveImage}
      </button>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={handleShare} className={secondaryButton}>
          <Share2 aria-hidden="true" className="h-4 w-4" />
          {appConfig.buttons.share}
        </button>
        <button
          type="button"
          onClick={handleCopyResult}
          className={secondaryButton}
        >
          <Copy aria-hidden="true" className="h-4 w-4" />
          {appConfig.buttons.copyResult}
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`mt-2 flex min-h-5 items-center justify-center gap-1 text-xs ${
          feedback?.kind === "error" ? "text-red-300" : "text-gold"
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
