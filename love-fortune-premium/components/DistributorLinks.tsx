import { ExternalLink, MessageCircle, Sparkles } from "lucide-react";
import { appConfig } from "@/config/app";

/**
 * 配布者（監修者）の案内枠。
 * config/app.ts でURLが設定されているリンクだけを表示し、
 * すべて未設定なら枠ごと表示しない。
 */
export function DistributorLinks() {
  const { distributor } = appConfig;
  const links = [
    {
      url: distributor.snsUrl,
      label: distributor.snsLabel,
      icon: ExternalLink,
    },
    {
      url: distributor.lineUrl,
      label: distributor.lineLabel,
      icon: MessageCircle,
    },
    {
      url: distributor.productUrl,
      label: distributor.productLabel,
      icon: Sparkles,
    },
  ].filter((l) => l.url);

  if (links.length === 0) return null;

  return (
    <section
      aria-label="監修者のご案内"
      className="rounded-2xl border border-gold-soft bg-night-card/80 p-5 text-center"
    >
      <p className="text-xs tracking-widest text-gold">SUPERVISED BY</p>
      <p className="mt-1 font-serif text-lg text-moonlight">{distributor.name}</p>
      {distributor.bio && (
        <p className="mt-2 text-sm leading-relaxed text-moonlight-soft">
          {distributor.bio}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        {links.map(({ url, label, icon: Icon }) => (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-gold-soft bg-night-soft px-6 text-sm font-medium text-gold transition-colors hover:bg-night-card"
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
          </a>
        ))}
      </div>
    </section>
  );
}
