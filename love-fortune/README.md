# 恋のしるべ — 恋愛占いWebアプリ

生年月日と今の関係から、恋愛のヒントを届ける占いWebアプリです。
URLを送るだけで、誰でもスマホからそのまま使えます（登録・インストール不要）。

- フレームワーク: Next.js (App Router) + TypeScript + Tailwind CSS
- 入力内容はサーバーに送信・保存されません（占いはすべてブラウザ内で完結）
- 外部AI APIは不要で動作します

## ローカルでの起動

```bash
cd love-fortune
npm install
npm run dev
```

→ http://localhost:3000 を開く。

## 品質チェック

```bash
npx tsc --noEmit   # 型チェック
npm run lint       # lint
npm run build      # 本番ビルド
```

## 配布前にカスタマイズする場所

コードの深い部分を触らなくても、次の2ファイルでほぼすべて変更できます。

- `config/app.ts`
  - アプリ名 / キャッチコピー / 説明文
  - 配布者名・SNSリンク・LINEリンク・商品リンク（空文字ならボタンごと非表示）
  - ボタン文言 / フッター表記 / プライバシーポリシーURL
  - `※仮置き` `※未設定` というコメントが付いた箇所を探して書き換える
- `app/globals.css`
  - `@theme` ブロックのテーマカラー

占い結果の文章を変えたい場合は `lib/fortune/templates.ts` を編集します。

## 占いロジックの仕組み

- `lib/fortune/generateFortune.ts` … 入力内容から seed を作り、決定的に結果を組み立てる
- `lib/fortune/templates.ts` … 結果文章のデータ（テーマ別 × トーン別）
- 同じ入力なら約1週間は同じ結果になり、週が変わると少し変化します
- 将来 Claude API 等の生成AIに差し替える場合は、`generateFortune` と同じ
  シグネチャ（`FortuneInput -> FortuneResult`）で別実装を用意し、
  `components/fortune/FortuneFlow.tsx` の import を切り替えるだけです

## Vercelへのデプロイ

1. このリポジトリをGitHubにpushする
2. [Vercel](https://vercel.com) で「New Project」→ リポジトリを選択
3. **Root Directory に `love-fortune` を指定**する（モノレポのため必須）
4. 環境変数 `NEXT_PUBLIC_SITE_URL` に本番URL（例: `https://xxx.vercel.app`）を設定
5. Deploy を実行

デプロイ後、割り当てられたURLを `NEXT_PUBLIC_SITE_URL` に設定して再デプロイすると、
OGP・canonical・sitemap が本番URLになります。

## OGP画像の差し替え

`public/og.png`（1200×630）を差し替えれば反映されます。
`assets/og-template.html` をブラウザで開いて文言・配色を編集し、
1200×630 でスクリーンショットを撮ると簡単に作り直せます。
