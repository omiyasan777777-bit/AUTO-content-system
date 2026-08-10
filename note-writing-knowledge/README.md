# Claude Code × ChatGPT マーケティング文章OS

日本の個人発信者が、顧客の原文、教育5層、新PASONA、リストマーケティングを一つの制作工程として運用するためのナレッジパッケージです。

## このパッケージでできること

- 顧客のDM・コメント・相談を、具体的な文章材料へ変える
- 出来事・感情・自己評価・恐れている未来・欲しい許可を分析する
- note、X長文、無料特典、メール、LINE、販売ページを設計する
- 新PASONAを、煽りではなく教育と提案の構造として使う
- ChatGPTで調査と分析を行い、Claude Codeで再現可能なワークフローにする
- 事実、仮説、経験、引用を分ける
- 公開前に誇張、押し売り、未確認情報を点検する

## 最初に読む順番

1. `ARTICLE.md`
2. `CLAUDE.md`
3. `knowledge/customer-truth.md`
4. `knowledge/education-5layers.md`
5. `.claude/skills/customer-truth/SKILL.md`
6. `.claude/skills/education-5layers/SKILL.md`
7. `.claude/skills/article-architecture/SKILL.md`

## 最初の実行

1. `inputs/customer-voice.md` に、匿名化したDM・コメント・相談を一件貼る
2. `inputs/brief.md` に、テーマ・対象者・読後に変えたい認識・CTAを書く
3. Claude Codeで次を依頼する

```text
CLAUDE.mdを読み、customer-truth、education-5layers、article-architectureの順にSkillを使ってください。
本文はまだ書かず、事実、仮説、顧客の原文、不足情報、採用する主張を整理してください。
```

4. 構成を確認した後で執筆を依頼する
5. 最後に `fact-ethics-check` と `brand-voice` を実行する

## 重要な考え方

- 顧客の原文を、きれいなマーケティング用語へ変えすぎない
- 共感は「分かります」ではなく、具体的な場面と理由で示す
- 自己攻撃を弱めるだけで終わらず、問題を生む構造と一歩を示す
- 新PASONAをすべての文章へ強制しない
- CTAは原則一つ
- 購入しない選択肢を残す
- 架空の体験談、顧客、実績、数字を作らない
- 公開・送信・投稿は人間が確認する

## フォルダ

- `knowledge/`：判断基準と参考ナレッジ
- `.claude/skills/`：作業別のSKILL.md
- `prompts/`：ChatGPTで使う調査・分析プロンプト
- `examples/`：記入例
- `inputs/`：自分の材料を入れる場所
- `outputs/`：完成物を保存する場所

## 利用上の注意

このパッケージは文章制作とマーケティング設計の補助です。法律、医療、金融、税務などの最終判断は行いません。顧客情報を入れる前に匿名化し、機密情報や第三者の個人情報を外部へ送信しないでください。
