"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Sparkles } from "lucide-react";
import type { FortuneThemeId } from "@/types/fortune";
import {
  relationshipOptions,
  themes,
  wishOptions,
} from "@/lib/fortune/templates";
import { LIMITS, type FieldErrors } from "@/lib/fortune/validate";
import { appConfig } from "@/config/app";

export interface FormValues {
  nickname: string;
  birthDate: string;
  partnerNickname: string;
  partnerBirthDate: string;
  relationship: string;
  wish: string;
  consultation: string;
}

interface Props {
  themeId: FortuneThemeId;
  initialValues: FormValues;
  errors: FieldErrors;
  onSubmit: (values: FormValues) => void;
  onBack: () => void;
}

function RequiredBadge() {
  return (
    <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-night">
      必須
    </span>
  );
}

function OptionalBadge() {
  return (
    <span className="ml-2 rounded-full bg-night-soft px-2 py-0.5 text-[10px] font-bold text-moonlight-soft">
      任意
    </span>
  );
}

function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-red-300">
      {message}
    </p>
  );
}

const inputClass =
  "mt-2 w-full min-h-12 rounded-xl border border-night-line bg-night-soft px-4 py-3 text-base text-moonlight placeholder:text-moonlight-faint focus:border-gold";
const labelClass = "flex items-center text-sm font-bold text-moonlight";

export function FortuneForm({
  themeId,
  initialValues,
  errors,
  onSubmit,
  onBack,
}: Props) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const formRef = useRef<HTMLFormElement>(null);
  const theme = themes.find((t) => t.id === themeId);

  // <input type="date"> に未来日を選ばせないための上限
  const today = new Date().toISOString().slice(0, 10);

  // バリデーションエラーが出たら、最初のエラー項目へフォーカスを移す
  useEffect(() => {
    const firstErrorField = Object.keys(errors)[0];
    if (!firstErrorField || !formRef.current) return;
    const el = formRef.current.querySelector<HTMLElement>(
      `#${firstErrorField}`,
    );
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [errors]);

  const set = (field: keyof FormValues) => (value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="mx-auto w-full max-w-md px-6 pb-16 pt-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-1 text-sm text-moonlight-soft"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        テーマ選択に{appConfig.buttons.back}
      </button>

      <div className="mt-4 text-center">
        <p className="text-xs tracking-[0.3em] text-gold">STEP 2 / 3</p>
        <h1 className="mt-3 font-serif text-2xl text-moonlight">
          あなたのことを教えてください
        </h1>
        <p className="mt-2 text-sm text-moonlight-soft">
          占うテーマ：<span className="font-bold">{theme?.label}</span>
        </p>
        <p className="mt-2 text-xs text-moonlight-faint">
          入力内容はこの画面の中だけで使われ、どこにも保存されません。
        </p>
      </div>

      <form
        ref={formRef}
        className="mt-8 space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        {/* ---- 必須項目 ---- */}
        <div>
          <label htmlFor="nickname" className={labelClass}>
            あなたのニックネーム
            <RequiredBadge />
          </label>
          <input
            id="nickname"
            type="text"
            value={values.nickname}
            onChange={(e) => set("nickname")(e.target.value)}
            maxLength={LIMITS.nickname}
            autoComplete="nickname"
            placeholder="例：みお"
            aria-required="true"
            aria-invalid={Boolean(errors.nickname)}
            aria-describedby={errors.nickname ? "nickname-error" : undefined}
            className={inputClass}
          />
          <ErrorText id="nickname-error" message={errors.nickname} />
        </div>

        <div>
          <label htmlFor="birthDate" className={labelClass}>
            あなたの生年月日
            <RequiredBadge />
          </label>
          <input
            id="birthDate"
            type="date"
            value={values.birthDate}
            onChange={(e) => set("birthDate")(e.target.value)}
            min="1920-01-01"
            max={today}
            aria-required="true"
            aria-invalid={Boolean(errors.birthDate)}
            aria-describedby={errors.birthDate ? "birthDate-error" : undefined}
            className={inputClass}
          />
          <ErrorText id="birthDate-error" message={errors.birthDate} />
        </div>

        <div>
          <label htmlFor="relationship" className={labelClass}>
            相手との今の関係
            <RequiredBadge />
          </label>
          <select
            id="relationship"
            value={values.relationship}
            onChange={(e) => set("relationship")(e.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.relationship)}
            aria-describedby={
              errors.relationship ? "relationship-error" : undefined
            }
            className={inputClass}
          >
            <option value="">選択してください</option>
            {relationshipOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <ErrorText id="relationship-error" message={errors.relationship} />
        </div>

        {/* ---- 任意項目 ---- */}
        <div className="rounded-2xl border border-night-line/70 bg-night-card/60 p-5">
          <p className="text-sm font-bold text-moonlight">
            さらにくわしく占いたい方へ
          </p>
          <p className="mt-1 text-xs text-moonlight-soft">
            ここから下は空欄のままでも占えます。
          </p>

          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor="partnerNickname" className={labelClass}>
                相手のニックネーム
                <OptionalBadge />
              </label>
              <input
                id="partnerNickname"
                type="text"
                value={values.partnerNickname}
                onChange={(e) => set("partnerNickname")(e.target.value)}
                maxLength={LIMITS.nickname}
                placeholder="例：Kさん（わからなくてもOK）"
                aria-invalid={Boolean(errors.partnerNickname)}
                aria-describedby={
                  errors.partnerNickname ? "partnerNickname-error" : undefined
                }
                className={inputClass}
              />
              <ErrorText
                id="partnerNickname-error"
                message={errors.partnerNickname}
              />
            </div>

            <div>
              <label htmlFor="partnerBirthDate" className={labelClass}>
                相手の生年月日
                <OptionalBadge />
              </label>
              <input
                id="partnerBirthDate"
                type="date"
                value={values.partnerBirthDate}
                onChange={(e) => set("partnerBirthDate")(e.target.value)}
                min="1920-01-01"
                max={today}
                aria-invalid={Boolean(errors.partnerBirthDate)}
                aria-describedby={
                  errors.partnerBirthDate ? "partnerBirthDate-error" : undefined
                }
                className={inputClass}
              />
              <p className="mt-1.5 text-xs text-moonlight-faint">
                わからない場合は空欄のままで大丈夫です。
              </p>
              <ErrorText
                id="partnerBirthDate-error"
                message={errors.partnerBirthDate}
              />
            </div>

            <div>
              <label htmlFor="wish" className={labelClass}>
                今いちばん知りたいこと
                <OptionalBadge />
              </label>
              <select
                id="wish"
                value={values.wish}
                onChange={(e) => set("wish")(e.target.value)}
                aria-invalid={Boolean(errors.wish)}
                aria-describedby={errors.wish ? "wish-error" : undefined}
                className={inputClass}
              >
                <option value="">選択してください</option>
                {wishOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ErrorText id="wish-error" message={errors.wish} />
            </div>

            <div>
              <label htmlFor="consultation" className={labelClass}>
                相談したいこと
                <OptionalBadge />
              </label>
              <textarea
                id="consultation"
                value={values.consultation}
                onChange={(e) => set("consultation")(e.target.value)}
                maxLength={LIMITS.consultation}
                rows={4}
                placeholder="今の状況や気持ちを、自由に書いてください。"
                aria-invalid={Boolean(errors.consultation)}
                aria-describedby="consultation-count consultation-error"
                className={inputClass}
              />
              <p
                id="consultation-count"
                className="mt-1 text-right text-xs text-moonlight-faint"
              >
                {values.consultation.length} / {LIMITS.consultation}文字
              </p>
              <ErrorText
                id="consultation-error"
                message={errors.consultation}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gold px-8 text-base font-bold text-night shadow-lg shadow-black/40 transition-colors hover:bg-gold-soft"
        >
          <Sparkles aria-hidden="true" className="h-5 w-5" />
          {appConfig.buttons.submit}
        </button>
      </form>
    </div>
  );
}
