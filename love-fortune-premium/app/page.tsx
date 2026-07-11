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
          <Star className="absolute left-8 top-10 h-4 w-4 animate-twinkle text-gold" />
          <Star className="absolute right-14 top-16 h-2.5 w-2.5 animate-twinkle text-mauve-300 [animation-delay:0.5s]" />
          <Sparkles className="absolute right-10 top-32 h-5 w-5 animate-twinkle text-gold-soft [animation-delay:0.8s]" />
          <Star className="absolute bottom-48 left-10 h-3 w-3 animate-twinkle text-mauve-300 [animation-delay:1.4s]" />
          <Star className="absolute bottom-32 right-12 h-4 w-4 animate-twinkle text-gold-soft [animation-delay:1.9s]" />
        </div>

        <p className="text-xs tracking-[0.4em] text-gold">
          {appConfig.appNameLatin}
        </p>
        <div className="mt-6 flex justify-center" aria-hidden="true">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-gold-faint bg-night-card shadow-lg shadow-black/40">
            <Moon className="h-9 w-9 animate-float text-gold" />
          </span>
        </div>
        <h1 className="mt-6 font-serif text-4xl tracking-wide text-moonlight">
          {appConfig.appName}
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-moonlight-soft">
          {appConfig.tagline}
        </p>

        <section aria-label="この占いでわかること" className="mt-10">
          <h2 className="text-sm font-bold tracking-widest text-gold">
            この占いでわかること
          </h2>
          <ul className="mt-4 space-y-3 text-left">
            {appConfig.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 rounded-2xl border border-night-line bg-night-card/70 px-4 py-3.5 text-sm leading-relaxed text-moonlight"
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
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gold px-8 text-base font-bold text-night shadow-lg shadow-black/40 transition-colors hover:bg-gold-soft"
          >
            <Sparkles aria-hidden="true" className="h-5 w-5" />
            {appConfig.buttons.start}
          </Link>
          <p className="mt-3 text-xs text-moonlight-faint">
            登録不要・そのまま占えます
          </p>
        </div>

        <p className="mt-12 text-xs leading-relaxed text-moonlight-faint">
          占い結果は参考情報としてお楽しみください。
          <br />
          入力内容が保存されることはありません。
        </p>
      </main>
      <Footer />
    </>
  );
}
