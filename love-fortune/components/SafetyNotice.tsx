import { ShieldCheck } from "lucide-react";

/**
 * 占いの位置づけと安全に関する注意書き。
 * 結果画面の下部などに表示する。
 */
export function SafetyNotice() {
  return (
    <section
      aria-label="ご利用にあたっての注意"
      className="rounded-2xl border border-mauve-200/70 bg-white/70 p-5 text-left"
    >
      <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
        <ShieldCheck aria-hidden="true" className="h-4 w-4 text-mauve-500" />
        ご利用にあたって
      </h2>
      <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-soft">
        <li>
          ・占い結果はあくまで参考情報です。未来や相手の気持ちを保証するものではありません。
        </li>
        <li>
          ・入力された内容は、この画面の中だけで占いに使われます。サーバーやデータベースには保存されません。
        </li>
        <li>
          ・医療・法律・お金・安全に関わる大切な判断には、占いではなく専門家の助言をご利用ください。
        </li>
        <li>
          ・ストーカーやDV、心や体を傷つけたい気持ちなど、深刻な悩みを抱えている場合は、ひとりで抱え込まず公的な相談窓口（
          <a
            href="https://www.mhlw.go.jp/mamorouyokokoro/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mauve-600 underline underline-offset-2"
          >
            厚生労働省 まもろうよ こころ
          </a>
          など）や専門機関に相談してください。
        </li>
      </ul>
    </section>
  );
}
