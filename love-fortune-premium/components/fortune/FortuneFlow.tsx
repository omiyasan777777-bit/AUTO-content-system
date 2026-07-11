"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FortuneInput,
  FortuneThemeId,
  HistoryEntry,
  PremiumFortuneResult,
} from "@/types/fortune";
import { generatePremiumFortune, shuffledDeck } from "@/lib/fortune/generatePremium";
import { moonCards } from "@/lib/fortune/premiumTemplates";
import { clearHistory, loadHistory, saveToHistory } from "@/lib/history";
import {
  validateFortuneInput,
  type FieldErrors,
} from "@/lib/fortune/validate";
import { ThemeSelect } from "./ThemeSelect";
import { FortuneForm, type FormValues } from "./FortuneForm";
import { CardDraw } from "./CardDraw";
import { FortuneLoading } from "./FortuneLoading";
import { FortuneResultView } from "./FortuneResultView";

type Step = "theme" | "form" | "cards" | "loading" | "result";

const INITIAL_FORM: FormValues = {
  nickname: "",
  birthDate: "",
  partnerNickname: "",
  partnerBirthDate: "",
  relationship: "",
  wish: "",
  consultation: "",
};

/** 演出の長さ。動きを減らす設定の利用者には待ち時間も短くする */
const LOADING_MS = 3000;
const LOADING_MS_REDUCED = 600;

export function FortuneFlow() {
  const [step, setStep] = useState<Step>("theme");
  const [themeId, setThemeId] = useState<FortuneThemeId | null>(null);
  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [input, setInput] = useState<FortuneInput | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<PremiumFortuneResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 履歴は端末内(localStorage)から読むだけ。外部送信はしない
  // SSRとのhydration不一致を避けるためマウント後に非同期で読み込む
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setHistory(loadHistory());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 画面が切り替わったら先頭から読めるようにする
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleThemeSelect = useCallback((id: FortuneThemeId) => {
    setThemeId(id);
    setStep("form");
  }, []);

  const handleSubmit = useCallback(
    (values: FormValues) => {
      if (step !== "form" || !themeId) return;

      const candidate: FortuneInput = {
        themeId,
        nickname: values.nickname,
        birthDate: values.birthDate,
        partnerNickname: values.partnerNickname || undefined,
        partnerBirthDate: values.partnerBirthDate || undefined,
        relationship: values.relationship as FortuneInput["relationship"],
        wish: (values.wish || undefined) as FortuneInput["wish"],
        consultation: values.consultation || undefined,
      };

      const fieldErrors = validateFortuneInput(candidate);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        return;
      }

      setErrors({});
      setForm(values);
      setInput(candidate);
      setStep("cards");
    },
    [step, themeId],
  );

  const handleCardsConfirm = useCallback(
    (picks: [number, number, number]) => {
      // loading 中の再実行（連打）を防ぐ
      if (step !== "cards" || !input) return;
      setStep("loading");

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      timerRef.current = setTimeout(
        () => {
          const generated = generatePremiumFortune(input, picks);
          saveToHistory(generated);
          setHistory(loadHistory());
          setResult(generated);
          setStep("result");
        },
        reduced ? LOADING_MS_REDUCED : LOADING_MS,
      );
    },
    [step, input],
  );

  // 「もう一度占う」: 入力を保持したままフォームへ戻る
  const handleRetry = useCallback(() => {
    setResult(null);
    setStep("form");
  }, []);

  // 「別のテーマで占う」: プロフィール入力は保持してテーマ選択へ
  const handleChangeTheme = useCallback(() => {
    setResult(null);
    setThemeId(null);
    setStep("theme");
  }, []);

  // 履歴から結果を開く（再保存はしない）
  const handleOpenHistory = useCallback((entry: HistoryEntry) => {
    setResult(entry.result);
    setThemeId(entry.result.themeId);
    setStep("result");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
  }, []);

  switch (step) {
    case "theme":
      return (
        <ThemeSelect
          onSelect={handleThemeSelect}
          history={history}
          onOpenHistory={handleOpenHistory}
          onClearHistory={handleClearHistory}
        />
      );
    case "form":
      return (
        <FortuneForm
          themeId={themeId as FortuneThemeId}
          initialValues={form}
          errors={errors}
          onSubmit={handleSubmit}
          onBack={handleChangeTheme}
        />
      );
    case "cards":
      return (
        <CardDraw
          deckSize={input ? shuffledDeck(input).length : moonCards.length}
          onConfirm={handleCardsConfirm}
          onBack={() => setStep("form")}
        />
      );
    case "loading":
      return <FortuneLoading />;
    case "result":
      return result ? (
        <FortuneResultView
          result={result}
          onRetry={handleRetry}
          onChangeTheme={handleChangeTheme}
        />
      ) : null;
  }
}
