import Link from "next/link";
import { Moon, Sparkles, Star } from "lucide-react";
import { appConfig } from "@/config/app";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <main className="relative mx-auto w-full max-w-md flex-1 px-6 pb-16 pt-20 text-center">
        {/* 装飾（読み上げ不要のためaria-hidden） */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <Star className="absolute left-8 top-10 h-4 w-4 animate-twinkle text-gold-soft" />
          <Sparkles className="absolute right-10 top-24 h-5 w-5 animate-twinkle text-mauve-300 [animation-delay:0.8s]" />
          <Star className="absolute bottom-40 left-12 h-3 w-3 animate-twinkle text-mauve-300 [animation-delay:1.4s]" />
        </div>

        <p className="text-xs tracking-[0.35em] text-gold">LOVE FORTUNE</p>
        <div className="mt-6 flex justify-center" aria-hidden="true">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lavender">
            <Moon className="h-8 w-8 animate-float text-mauve-500" />
          </span>
        </div>
        <h1 className="mt-6 font-serif text-4xl tracking-wide text-ink">
          {appConfig.appName}
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-ink-soft">
          {appConfig.tagline}
        </p>

        <section aria-label="この占いでわかること" className="mt-10">
          <h2 className="text-sm font-bold tracking-widest text-mauve-600">
            この占いでわかること
          </h2>
          <ul className="mt-4 space-y-3 text-left">
            {appConfig.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 rounded-2xl border border-mauve-200/70 bg-white/70 px-4 py-3.5 text-sm leading-relaxed text-ink"
              >
                <Star
                  aria-hidden="true"
                  className="mt-1 h-4 w-4 shrink-0 text-gold"
                />
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10">
          <Link
            href="/fortune"
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-mauve-600 px-8 text-base font-bold text-white shadow-lg shadow-mauve-300/50 transition-colors hover:bg-mauve-700"
          >
            <Sparkles aria-hidden="true" className="h-5 w-5" />
            {appConfig.buttons.start}
          </Link>
          <p className="mt-3 text-xs text-ink-faint">
            登録不要・そのまま占えます
          </p>
        </div>

        <p className="mt-12 text-xs leading-relaxed text-ink-faint">
          占い結果は参考情報としてお楽しみください。
          <br />
          入力内容が保存されることはありません。
        </p>
      </main>
      <Footer />
    </>
  );
}
