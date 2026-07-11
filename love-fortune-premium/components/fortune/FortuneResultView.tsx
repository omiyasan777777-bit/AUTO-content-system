"use client";

import {
  CalendarDays,
  Compass,
  Feather,
  Footprints,
  Gem,
  Heart,
  HeartHandshake,
  type LucideIcon,
  Moon,
  Mountain,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wind,
} from "lucide-react";
import type {
  CardPosition,
  FortuneSection,
  PremiumFortuneResult,
} from "@/types/fortune";
import { premiumSectionTitles } from "@/lib/fortune/premiumTemplates";
import { appConfig } from "@/config/app";
import { SafetyNotice } from "@/components/SafetyNotice";
import { DistributorLinks } from "@/components/DistributorLinks";
import { ShareActions } from "./ShareActions";

interface Props {
  result: PremiumFortuneResult;
  onRetry: () => void;
  onChangeTheme: () => void;
}

const CARD_POSITIONS: { key: CardPosition; label: string }[] = [
  { key: "past", label: "過去" },
  { key: "present", label: "現在" },
  { key: "future", label: "未来" },
];

function SectionCard({
  icon: Icon,
  title,
  children,
  highlight = false,
  delay = 0,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
  delay?: number;
}) {
  return (
    <section
      aria-label={title}
      style={{ animationDelay: `${delay}ms` }}
      className={`animate-rise rounded-2xl border p-5 ${
        highlight
          ? "border-gold-soft bg-gradient-to-b from-night-card to-mauve-800"
          : "border-night-line bg-night-card/85"
      }`}
    >
      <h2 className="flex items-center gap-2.5 text-sm font-bold text-gold">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-night-soft"
        >
          <Icon className="h-4 w-4 text-gold" />
        </span>
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Paragraphs({ body }: { body: string }) {
  return (
    <>
      {body.split("\n\n").map((paragraph, i) => (
        <p key={i} className="text-[15px] leading-relaxed text-moonlight">
          {paragraph}
        </p>
      ))}
    </>
  );
}

function BaseSection({
  section,
  icon,
  delay,
}: {
  section: FortuneSection;
  icon: LucideIcon;
  delay: number;
}) {
  return (
    <SectionCard icon={icon} title={section.title} delay={delay}>
      <Paragraphs body={section.body} />
    </SectionCard>
  );
}

export function FortuneResultView({ result, onRetry, onChangeTheme }: Props) {
  const { sections, cards, bond, timeline, lucky } = result;
  // セクションの表示順に90msずつずらすアニメーション遅延
  const delays = Array.from({ length: 11 }, (_, i) => (i + 1) * 90);

  return (
    <div className="mx-auto w-full max-w-md px-6 pb-16 pt-10">
      <header className="text-center">
        <p className="text-xs tracking-[0.3em] text-gold">YOUR FORTUNE</p>
        <p className="mt-3 text-sm text-moonlight-soft">
          {result.nickname}さんへ
        </p>
        <h1 className="mt-1 font-serif text-2xl leading-relaxed text-moonlight">
          {result.themeLabel}
        </h1>
        <p className="mt-2 text-xs text-moonlight-faint">
          あなたの導きの数：{result.destinyNumber}
        </p>
      </header>

      <div className="mt-8 space-y-4">
        {/* 1. 月の相カード */}
        <SectionCard
          icon={Moon}
          title={premiumSectionTitles.cards}
          delay={delays[0]}
        >
          <div className="grid grid-cols-3 gap-2" aria-hidden="true">
            {CARD_POSITIONS.map(({ key, label }, i) => (
              <div
                key={key}
                style={{ animationDelay: `${200 + i * 250}ms` }}
                className="animate-flip rounded-xl border border-gold-faint bg-night-soft px-2 py-4 text-center"
              >
                <p className="text-[10px] tracking-widest text-gold">{label}</p>
                <Moon className="mx-auto mt-2 h-5 w-5 text-gold" />
                <p className="mt-2 font-serif text-base text-moonlight">
                  {cards[key].name}
                </p>
                <p className="mt-1 text-[10px] text-moonlight-faint">
                  {cards[key].keyword}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-1 space-y-4">
            {CARD_POSITIONS.map(({ key, label }) => (
              <div key={key}>
                <p className="text-xs font-bold text-gold">
                  {label}｜{cards[key].name}
                  <span className="ml-2 font-normal text-moonlight-faint">
                    {cards[key].reading}
                  </span>
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-moonlight">
                  {cards[key].meanings[key]}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 2-3. 状況と相手の気持ち */}
        <BaseSection section={sections.situation} icon={Compass} delay={delays[1]} />
        <BaseSection section={sections.feelings} icon={Heart} delay={delays[2]} />

        {/* 4. 2人の縁 / 恋愛気質 */}
        <SectionCard
          icon={HeartHandshake}
          title={
            bond.kind === "pair"
              ? premiumSectionTitles.bondPair
              : premiumSectionTitles.bondSelf
          }
          delay={delays[3]}
        >
          <p className="font-serif text-lg text-gold">
            {bond.kind === "pair"
              ? `縁の数 ${bond.pairNumber}「${bond.title}」`
              : bond.title}
          </p>
          <Paragraphs body={bond.body} />
          {bond.kind === "self" && (
            <p className="text-xs text-moonlight-faint">
              ※相手の生年月日を入力すると、2人の縁のリーディングに変わります。
            </p>
          )}
        </SectionCard>

        {/* 5. 障害 */}
        <BaseSection section={sections.obstacle} icon={Mountain} delay={delays[4]} />

        {/* 6. 3ヶ月タイムライン */}
        <SectionCard
          icon={CalendarDays}
          title={premiumSectionTitles.timeline}
          delay={delays[5]}
        >
          <ol className="space-y-4">
            {timeline.map((entry) => (
              <li
                key={entry.label}
                className="border-l-2 border-gold-faint pl-4"
              >
                <p className="text-xs font-bold text-gold">{entry.label}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-moonlight">
                  {entry.body}
                </p>
              </li>
            ))}
          </ol>
        </SectionCard>

        {/* 7-9. 変化・行動・避けること */}
        <BaseSection section={sections.change} icon={Wind} delay={delays[6]} />
        <BaseSection section={sections.action} icon={Footprints} delay={delays[7]} />
        <BaseSection section={sections.avoid} icon={ShieldAlert} delay={delays[8]} />

        {/* 10. ラッキーチャーム */}
        <SectionCard icon={Gem} title={premiumSectionTitles.lucky} delay={delays[9]}>
          <dl className="grid grid-cols-2 gap-3">
            {[
              ["色", lucky.color],
              ["もの", lucky.item],
              ["曜日", lucky.day],
              ["おまじない", lucky.action],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-night-line/70 bg-night-soft/60 px-3 py-3 text-center"
              >
                <dt className="text-[10px] tracking-widest text-gold">
                  {label}
                </dt>
                <dd className="mt-1 text-sm leading-snug text-moonlight">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        {/* 11. 最後のメッセージ */}
        <SectionCard
          icon={Feather}
          title={sections.message.title}
          highlight
          delay={delays[10]}
        >
          <Paragraphs body={sections.message.body} />
        </SectionCard>
      </div>

      <div className="mt-10 space-y-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-gold px-8 text-sm font-bold text-night shadow-lg shadow-black/40 transition-colors hover:bg-gold-soft"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          {appConfig.buttons.retry}
        </button>
        <button
          type="button"
          onClick={onChangeTheme}
          className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full border border-gold-soft bg-transparent px-8 text-sm font-bold text-gold transition-colors hover:bg-night-card"
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
