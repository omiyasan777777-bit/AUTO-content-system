import { appConfig } from "@/config/app";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-mauve-200/60 bg-blush/60 px-6 py-8 text-center">
      <p className="text-xs text-ink-soft">
        当サイトの占い結果は、エンターテインメントとしてお楽しみいただく参考情報です。
      </p>
      <p className="mt-1 text-xs text-ink-soft">
        入力された内容が外部に送信・保存されることはありません。
      </p>
      {appConfig.privacyPolicyUrl && (
        <p className="mt-3">
          <a
            href={appConfig.privacyPolicyUrl}
            className="text-xs text-mauve-600 underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            プライバシーポリシー
          </a>
        </p>
      )}
      <p className="mt-3 text-xs text-ink-faint">{appConfig.footerText}</p>
    </footer>
  );
}
