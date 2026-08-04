---
name: youtube-research
description: YouTube動画のURLから、投稿本文（タイトル・概要欄）、数値（再生数・いいね数・コメント数など）、字幕（手動+自動）を取得する。「YouTubeのこのURL調べて」と言われたら使う。
---

# YouTube リサーチ

> ⚠️ **未検証の注意**
> このスキルのコマンドは仕様書どおりに組み立てたものですが、
> 開発時の実行環境ではネットワークの発信制限（egressポリシー）により
> 実際に `youtube.com` へアクセスして動作確認ができませんでした。
> **初回実行時は必ず結果を確認し、エラーが出たら人間に報告してください。**
> （`which yt-dlp` は確認済み・インストール済みですが、実URLでの取得成功は未確認です）

## 前提

- `yt-dlp` がインストールされていること（`which yt-dlp` で確認。無ければ
  `pip3 install --user yt-dlp` の実行可否をユーザーに確認してから導入する）
- APIキーは不要

## 手順

### 1. 本文・数値を取得する

```bash
yt-dlp --dump-json "<動画URL>" > video_info.json
```

`video_info.json` の主なフィールド（JSON）:
- `title` — タイトル
- `description` — 概要欄（本文）
- `uploader` / `channel` — 投稿者名
- `view_count` — 再生数
- `like_count` — いいね数
- `comment_count` — コメント数
- `upload_date` — 投稿日（YYYYMMDD）
- `duration` — 動画の長さ（秒）

必要な項目だけ抜き出す場合は例えば:
```bash
yt-dlp --dump-json "<動画URL>" | python3 -c "
import json,sys
d = json.load(sys.stdin)
print('タイトル:', d.get('title'))
print('投稿者:', d.get('uploader'))
print('再生数:', d.get('view_count'))
print('いいね数:', d.get('like_count'))
print('コメント数:', d.get('comment_count'))
print('本文:')
print(d.get('description'))
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
- `--write-subs` と `--write-auto-subs` は両方指定する（手動字幕と自動字幕は別枠で、片方だけだと取りこぼす）
- 言語コードは `ja` が手動字幕、`ja-en` などが自動翻訳字幕。`"ja.*"` で両方拾う
- ダウンロードされる字幕ファイルは `.vtt` 形式（例: `<動画タイトル>.ja.vtt`）。中身をそのままテキストとして読める

### 3. 結果をまとめて報告する

- 本文・数値・字幕のうち取得できたものを整理して提示する
- 字幕が存在しない動画（`--list-subs` で何も出ない場合）は「字幕なし」と正直に報告する
- コメント数など動画によっては取得できない項目があれば、その旨を報告する（無理に埋めない）

## 既知の制限

- ライブ配信中・限定公開・年齢制限のかかった動画は追加オプションが必要になる場合がある（未検証）
- ネットワークが制限された環境（本開発環境など）では `Unable to connect to proxy` 系のエラーが出る。これはツールの不具合ではなく実行環境のegress制限が原因なので、その旨をそのままユーザーに報告する
