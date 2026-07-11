"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FortuneInput,
  FortuneResult,
  FortuneThemeId,
} from "@/types/fortune";
import { generateFortune } from "@/lib/fortune/generateFortune";
import {
  validateFortuneInput,
  type FieldErrors,
} from "@/lib/fortune/validate";
import { ThemeSelect } from "./ThemeSelect";
import { FortuneForm, type FormValues } from "./FortuneForm";
import { FortuneLoading } from "./FortuneLoading";
import { FortuneResultView } from "./FortuneResultView";

type Step = "theme" | "form" | "loading" | "result";

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
const LOADING_MS = 2800;
const LOADING_MS_REDUCED = 600;

export function FortuneFlow() {
  const [step, setStep] = useState<Step>("theme");
  const [themeId, setThemeId] = useState<FortuneThemeId | null>(null);
  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<FortuneResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // loading 中の再送信（連打）を防ぐ
      if (step !== "form" || !themeId) return;

      const input: FortuneInput = {
        themeId,
        nickname: values.nickname,
        birthDate: values.birthDate,
        partnerNickname: values.partnerNickname || undefined,
        partnerBirthDate: values.partnerBirthDate || undefined,
        relationship: values.relationship as FortuneInput["relationship"],
        wish: (values.wish || undefined) as FortuneInput["wish"],
        consultation: values.consultation || undefined,
      };

      const fieldErrors = validateFortuneInput(input);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        return;
      }

      setErrors({});
      setForm(values);
      setStep("loading");

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      timerRef.current = setTimeout(
        () => {
          setResult(generateFortune(input));
          setStep("result");
        },
        reduced ? LOADING_MS_REDUCED : LOADING_MS,
      );
    },
    [step, themeId],
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

  switch (step) {
    case "theme":
      return <ThemeSelect onSelect={handleThemeSelect} />;
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
