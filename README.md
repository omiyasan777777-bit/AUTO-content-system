# AUTO-content-system — 有料コンテンツ(note) 全自動システム

## 概要

**売れる有料noteを企画→設計→執筆→下書き貼り付けまで一気通貫で構築する**AIアシスト型制作パイプライン。
たこすけ式メソッドをプロンプト化し、テンプレート駆動で高速・高品質な商品制作を実現する。


## 対象コンテンツ

- note / Brain 等で販売する有料デジタルコンテンツ
- **目標達成型コンセプト**（網羅系）
- 想定価格帯: 1980円〜49,800円（テスト商品〜高額商品）
- 想定ボリューム: 5,000字〜50,000字


## 前提条件

- ジャンル・テーマがある程度決まっている（Phase 0で深掘り可能）
- 販売アカウント（note/ Brain等）を持っている


---

## 全体フロー（6フェーズ）

```
Phase 0: 自己分析・棚卸し    → output/00a_self_analysis.md
Phase 1: 競合リサーチ        → output/01_research.md
Phase 2: コンセプト設計      → output/02_concept.md
Phase 3: 商品設計+タイトル   → output/03_product_design.md
Phase 4: 有料部分作成        → output/04_paid_content.md
Phase 5: 無料部分（レター）  → output/05_sales_letter.md
─────────────────────────────────────────────

```

## 使い方


### パターンA：フルオート（推奨）

Claudeに以下を伝える：

```
テーマ: [コンテンツのテーマ]
ターゲット: [誰向けか]
自分の実績: [あなたの実績・経験]
ノウハウの要点: [何を教えるか箇条書きでよい]

prompts/00_master_orchestrator.md に従って
全フェーズを順番に実行してください。
保存先: output/
```

### パターンB：フェーズ単体実行

```
# 例：コンセプト設計だけ実行
prompts/02_concept_design.md を読んで実行してください。
```

### パターンC：スキル実行

```
/research   → 競合リサーチ
/persona    → ペルソナ設計
/outline    → 構成・章立て設計
/write      → 本文執筆
/proofread  → 校正・品質チェック
/title      → タイトル設計
```

---

## ファイル構成

```
AUTO-content-system/
├── CLAUDE.md                         ← プロジェクト設定
├── README.md                         ← このファイル
├── config.json                       ← パイプライン設定
├── paid_content_pipeline.py          ← Selenium自動化パイプライン
├── prompts/
│   ├── 00_master_orchestrator.md     ← 全体統括プロンプト
│   ├── 00a_self_analysis.md          ← Phase 0: 自己分析・棚卸し
│   ├── 01_competitive_research.md    ← Phase 1: 競合リサーチ
│   ├── 02_concept_design.md          ← Phase 2: コンセプト設計
│   ├── 03_product_design.md          ← Phase 3: 商品設計
│   ├── 04_paid_content.md            ← Phase 4: 有料部分作成
│   └── 05_sales_letter.md            ← Phase 5: セールスレター
└── output/                           ← 生成物の保存先
```

---

## 各フェーズの概要

| Phase | 名称 | 入力 | 出力 |
|-------|------|------|------|
| 0 | 自己分析・棚卸し | ヒアリング | 棚卸し・商品の種 |
| 1 | 競合リサーチ | テーマ | 競合10商品分析・ネタ40個 |
| 2 | コンセプト設計 | リサーチ結果 | 二層コンセプト・仮想ストーリー |
| 3 | 商品設計+タイトル | コンセプト | オファー・カリキュラム・世界観・タイトル |
| 4 | 有料部分作成 | 商品設計 | たこすけ式構成法の本文 |
| 5 | セールスレター | 全前工程 | 17セクション×感情設計×3刷り込みレター |

---

## 統合メソッド（たこすけ式）

- **コンセプト**: 二層構造（コア+抽象）、5要素公式、掛算公式
- **コンテンツ**: たこすけ式構成法、13ステップ下書き、コンテンツマージ法
- **セールス**: 17セクション感情設計、3つの刷り込み、ザイオンス効果、感情ジェットコースター設計
- **SNS運用**: 5つのポスト型、漫画ストーリー型運用、ファン化3フェーズ

---

## セットアップ

1. このフォルダをデスクトップ等に配置
2. Claude Code でこのフォルダを開く
3. `メニュー` と入力してスタート

---

## Web UI の起動（Mac / Windows）

チャット型のWeb UI（🌸 ローズ×ラベンダーのデザイン）から全機能を操作できます。

### Mac

```bash
# 必要なパッケージ（初回のみ）
pip3 install flask selenium webdriver-manager pyperclip psutil

# 起動（どちらでもOK）
./start_webapp.command          # Finderからダブルクリックでも起動可
ACS_ALLOW_FULL=1 python3 webapp/server.py
```

- 初回にダブルクリックで開けない場合は、右クリック →「開く」を選択してください
- ターミナルから一度 `chmod +x start_webapp.command` を実行すると実行権限が付きます
- ブラウザで `http://127.0.0.1:8787` が自動的に開きます

### Windows

```
start_webapp.bat をダブルクリック
```

### note.com への投稿（Mac / Windows 共通）

Google Chrome がインストールされていれば、`python3 setup_note.py`（Windows は `python`）で
ログイン設定後、Web UI の「📮 noteに投稿」からそのまま下書き投稿できます。

---

## Threads 連携（人気投稿分析・自動投稿）

Meta公式の Threads API を使って、以下ができます（Mac / Windows 共通・追加ライブラリ不要）。

- **人気投稿分析**: 自分の投稿をインプレッション（views）・いいね順にランキング表示
- **話題検索**: 他人の投稿を含むThreads全体からキーワードで人気投稿（TOP）/新着を検索
  （※他人の投稿のインプレッション数は非公開のため取得不可。人気順はThreads公式ランキング）
- **自動投稿**: テキストを投稿（500字を超えると自動でツリー連投に分割）

### 初期設定（初回のみ・約5分）

1. https://developers.facebook.com/ でアプリを作成（ユースケース:「Threads APIにアクセス」）
2. アプリ設定 > Threads API >「アクセストークンを生成」
   （権限: threads_basic / threads_content_publish / threads_manage_insights）
3. ターミナルで実行してトークンを貼り付け:

```bash
python3 setup_threads.py        # Windows は python
```

### 使い方

```bash
# 人気投稿ランキング（threads_report.md に保存）
python3 threads_insights.py                    # 直近30日・views順・Top10
python3 threads_insights.py --sort likes       # いいね順
python3 threads_insights.py --days 90 --top 20

# 自動投稿
python3 post_to_threads.py --text "投稿する本文"
python3 post_to_threads.py --file promo.md --dry-run   # 分割の確認だけ

# トークン更新（期限切れのとき / 60日延長）
python3 setup_threads.py --refresh
```

Web UI のクイックバー「🧵 Threads」からも、ランキング表示と投稿ができます。
チャットで「Threads分析」「Threadsで宣伝して」と話しかけてもOKです。
