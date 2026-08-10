# 15分で最初の一件を分析する

## 1

`inputs/customer-voice.md` を開く。

## 2

過去のDMまたは相談を一件選び、
名前、連絡先、会社名などを削除して原文を貼る。

## 3

`inputs/brief.md` に次だけ書く。

- テーマ
- 対象者
- 読後に信じてほしいこと
- CTA

## 4

Claude Codeへ伝える。

```text
CLAUDE.mdを読んでください。
customer-truthとeducation-5layersのSkillを使い、
まだ記事を書かず、事実、仮説、5層、新しい自己解釈、
今日できる一歩を出してください。
```

## 5

AIが創作した背景を削る。

## 6

承認後に `article-architecture` を使う。

```text
承認済みの分析から、一記事一主張で構成を作ってください。
各章の役割、使う原文、根拠、反論、CTAを示し、
本文はまだ書かないでください。
```
