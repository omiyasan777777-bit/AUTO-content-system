# 🎮 Threads Pinball Scheduler

ピンボールで遊びながら Threads の予約投稿ができるローカルツール。
依存パッケージなし（Node.js 18+ だけで動く）。

## 起動

```bash
cd Threads-Pinball
npm start        # または node server.mjs
```

起動するとコンソールに **あなただけのオリジナルURL** が表示されます:

```
🎮 Threads Pinball Scheduler 起動！
あなたのオリジナルURL → http://127.0.0.1:9696/pb-xxxxxxxx/
```

URLの `pb-xxxxxxxx` 部分は初回起動時にランダム生成され、`data.json` に保存されて以後ずっと同じです。
Windows ならリポジトリ直下の `start_threads_pinball.bat` をダブルクリックでもOK。

## できること

- 🕹️ **ピンボール**: 左右フリッパー（←→キー / ボタン / 画面タップ）、バンパー加点、ハイスコア保存
- 👤 **アカウント最大3つ**: 各自の Threads API アクセストークンで登録。登録時に接続テストを実行
- 📅 **予約投稿**: 本文（500文字まで）と日時を指定 → サーバーが30秒ごとにチェックして自動投稿
- 🧵 **ツリー投稿**: 「ツリーに追加」で最大10件。2件目以降は直前の投稿へのリプライとして2秒間隔で連鎖投稿。途中で失敗しても進捗が保存され、🔁再試行で続きから投稿
- 📋 **アカウント別の予約一覧**: タブで切り替え。予約中 / 投稿済み / エラー（🔁で再試行）を表示
- 🎨 **テーマカラー変更**: 右上のカラーピッカーで全体色を変更（ピンボールの色も連動、保存される）
- 🔗 **オリジナルURL**: 自分専用のURLパスで動作。ルート `/` は自動でリダイレクト

## Threads API の準備（個人アカウント）

1. [Meta for Developers](https://developers.facebook.com/) でアプリを作成し「Threads API」ユースケースを追加
2. 権限 `threads_basic` と `threads_content_publish` を有効化（ツリー投稿を使う場合は `threads_manage_replies` も）
3. 自分の Threads アカウントをテスターとして追加し、**長期アクセストークン**を発行
4. 本ツールの「＋ 追加」からトークンを貼り付けて登録

トークンは `Threads-Pinball/data.json` にのみ保存され、git 管理外（.gitignore 済み）です。

## 仕組み

- `server.mjs` … 静的配信 + JSON API + 30秒間隔のスケジューラ。投稿は Threads Graph API の
  `POST /{user-id}/threads` → `POST /{user-id}/threads_publish` の2段階で実行。
  ツリーは2件目以降に `reply_to_id`（直前の投稿ID）を付けて順番に投稿
- `public/pinball.js` … canvas 製ミニピンボール（重力・反射・フリッパー物理）
- `public/app.js` … 状態同期・テーマ・アカウント/予約のUI
- `data.json` … アカウント・予約・テーマ・オリジナルURLスラッグの永続化

## 注意

- PCとこのサーバーが起動している間だけ予約投稿が実行されます（常駐が必要）
- Threads API のレート制限（24時間あたり250投稿など）は Meta 側の仕様に従います
