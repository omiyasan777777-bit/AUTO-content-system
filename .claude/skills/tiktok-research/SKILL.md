---
name: tiktok-research
description: TikTok動画のURLから、投稿本文（キャプション）、数値（再生数・いいね数・コメント数・シェア数など）、字幕（手動+自動）を取得する。「TikTokのこのURL調べて」と言われたら使う。
---

# TikTok リサーチ

> ⚠️ **未検証の注意**
> このスキルのコマンドは仕様書どおりに組み立てたものですが、
> 開発時の実行環境ではネットワークの発信制限（egressポリシー）により
> 実際に `tiktok.com` へアクセスして動作確認ができませんでした。
> **初回実行時は必ず結果を確認し、エラーが出たら人間に報告してください。**
> （`which yt-dlp` は確認済み・インストール済みですが、実URLでの取得成功は未確認です）

## 前提

- `yt-dlp` がインストールされていること（`which yt-dlp` で確認。無ければ
  `pip3 install --user yt-dlp` の実行可否をユーザーに確認してから導入する）
- APIキーは不要
- TikTokの公式APIは非営利・学術限定のため、本スキルは公式APIを使わずyt-dlpのスクレイピング機能を使う

## 手順

### 1. 本文・数値を取得する

```bash
yt-dlp --dump-json "<動画URL>" > video_info.json
```

`video_info.json` の主なフィールド（JSON）:
- `title` / `description` — キャプション（本文）
- `uploader` — 投稿者名
- `view_count` — 再生数
- `like_count` — いいね数
- `comment_count` — コメント数
- `repost_count` — シェア数（取れない場合あり）
- `upload_date` — 投稿日（YYYYMMDD）

必要な項目だけ抜き出す場合:
```bash
yt-dlp --dump-json "<動画URL>" | python3 -c "
import json,sys
d = json.load(sys.stdin)
print('投稿者:', d.get('uploader'))
print('本文:', d.get('description'))
print('再生数:', d.get('view_count'))
print('いいね数:', d.get('like_count'))
print('コメント数:', d.get('comment_count'))
"
```

### 2. 字幕を取得する

まず何が使えるか確認:
```bash
yt-dlp --list-subs "<動画URL>"
```

手動字幕・自動字幕の両方をダウンロード（日本語・日本語自動翻訳を想定）:
```bash
yt-dlp --skip-download --write-subs --write-auto-subs --sub-langs "ja.*" "<動画URL>"
```

**注意点（仕様書より）:**
- フラグは複数形固定。`--write-auto-sub`・`--sub-lang`（単数形）は存在しない
- `--write-subs` と `--write-auto-subs` は両方指定する（片方だけだと取りこぼす）
- 言語コードは `ja` が手動、`ja-en` などが自動翻訳。`"ja.*"` で両方拾う
- TikTokは字幕（キャプション）が付いていない動画も多い。`--list-subs` で何も出なければ「字幕なし」と正直に報告する

### 3. 結果をまとめて報告する

- 本文・数値・字幕のうち取得できたものを整理して提示する
- 取得できない項目（シェア数など動画・アカウント設定によって非公開の場合がある）は無理に埋めず、その旨を報告する

## 既知の制限

- yt-dlpのTikTok抽出は「impersonation（ブラウザなりすまし）」が必要になる場合があるという警告が出ることがある（`pip3 install --user "yt-dlp[default]"` や `curl_cffi` の追加導入が必要になる可能性。未検証）
- 非公開アカウント・年齢制限動画は取得不可
- ネットワークが制限された環境（本開発環境など）では `Unable to connect to proxy` 系のエラーが出る。これはツールの不具合ではなく実行環境のegress制限が原因なので、その旨をそのままユーザーに報告する
