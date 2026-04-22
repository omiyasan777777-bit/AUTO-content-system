# 【実践編】各ツールのセットアップ手順と移行チェックリスト

## Cline セットアップ手順（VS Code）

### Step 1: 拡張機能のインストール

VS Codeの拡張機能マーケットプレイスで「Cline」を検索してインストール。
またはコマンドパレットから：

```
ext install saoudrizwan.claude-dev
```

### Step 2: APIキーの設定

Clineの設定画面を開き、使用するプロバイダーを選択します。

**Gemini APIを使う場合（最安）**
1. Google AI Studioでプロジェクト作成 → APIキー発行
2. ClineのAPI Provider: 「Google Gemini」を選択
3. APIキーを貼り付けてモデルを選択（`gemini-2.5-pro`推奨）

**OpenRouter経由で使う場合（複数モデルを一括管理）**
1. openrouter.ai でアカウント作成
2. APIキーを発行し、ClineのProvider: 「OpenRouter」を選択
3. お好みのモデルを選択（Llama 3、Mistral等）

### Step 3: カスタム指示の設定

Cline設定の「Custom Instructions」に、プロジェクト固有のルールを記載：

```
- 日本語でコミュニケーションする
- コミットメッセージは日本語で書く
- 変更前に必ず既存コードを確認する
- テストコードは必ずセットで書く
```

---

## Aider セットアップ手順（ターミナル）

### Step 1: インストール

```bash
# pip経由
pip install aider-chat

# または brew (Mac)
brew install aider
```

### Step 2: APIキーの設定

```bash
# Gemini APIを使う場合
export GEMINI_API_KEY="your-api-key"
aider --model gemini/gemini-2.5-pro

# Claude APIを使う場合（制限が緩い時用）
export ANTHROPIC_API_KEY="your-api-key"
aider --model claude-sonnet-4-5
```

### Step 3: プロジェクトで使い始める

```bash
# Gitリポジトリのルートで実行
cd your-project
aider

# 特定のファイルを指定して開始
aider src/main.py src/utils.py
```

> 🖼️ **【場面イラスト】**
> `ターミナル画面の前でコーヒーを片手に作業するエンジニアのイラスト。画面には「aider>」のプロンプトと緑のテキスト。「Gitとの連携で自動コミット」の吹き出し付き。落ち着いたダークテーマのイラスト風。`

### Aider 便利コマンド集

| コマンド | 説明 |
|---------|------|
| `/add ファイル名` | 編集対象にファイルを追加 |
| `/drop ファイル名` | 編集対象からファイルを除外 |
| `/commit` | 現在の変更をコミット |
| `/diff` | 変更差分を表示 |
| `/undo` | 最後の変更を取り消し |

---

## Windsurf セットアップ手順

### Step 1: ダウンロードとインストール

1. `windsurf.com` からインストーラーをダウンロード
2. インストール後、VS Codeの設定やプラグインをインポート可能
3. Googleアカウントまたはメールでサインアップ

### Step 2: Cascade Agentの起動

- サイドバーの「Cascade」アイコンをクリック
- または `Cmd/Ctrl + L` でCascadeチャットを開く
- 「Agent」モードと「Edit」モードを切り替えて使い分ける

### Step 3: Cascadeの効果的な使い方

**Agentモード（Claude Code相当）**: 自律的にファイル操作・実行を行う
```
「src/componentsフォルダ内の全コンポーネントにエラーハンドリングを追加して」
```

**Editモード（ピンポイント編集）**: 特定箇所だけを修正する
```
「この関数の処理をasync/awaitに書き換えて」
```

---

## Claude Codeからの移行チェックリスト

### 移行前の準備
- [ ] 現在使用中のClaude Codeの設定・カスタム指示をメモしておく
- [ ] CLAUDE.mdファイルの内容を確認・バックアップ
- [ ] よく使うコマンドやワークフローをリストアップ

### Clineへの移行
- [ ] VS Code拡張機能をインストール済み
- [ ] 代替APIキー（Gemini等）を取得済み
- [ ] Claude Codeのカスタム指示をClineのCustom Instructionsに移植
- [ ] テストプロジェクトで動作確認済み

### Aiderへの移行
- [ ] `pip install aider-chat` 完了
- [ ] 代替APIキーを環境変数に設定済み
- [ ] `.aider.conf.yml` でプロジェクト設定を定義
- [ ] `aider --help` でコマンド一覧を確認済み

### 緊急時の対応フロー

> 📊 **【図解：緊急時フローチャート】**
> `「Claude Codeが制限に達した時の対応フロー」を表すフローチャート。スタート「制限エラー発生」→ 菱形「VS Code使用中？」→ Yes「Cline起動 + Gemini切替」／No「ターミナルでAider起動」→ 両方とも「作業継続」へ。緑・青・オレンジのシンプルなフローチャート図。`

```
Claude Codeが制限に達した
    ↓
VS Codeを使っている → Clineを起動、Gemini APIに切り替え
    ↓
ターミナルで作業中 → aider --model gemini/gemini-2.5-pro
    ↓
長期的に移行検討 → Windsurfを試す（無料プランあり）
```

---

## コスト比較（月額概算）

| ツール | 使い方 | 月額目安 |
|--------|--------|----------|
| Claude Code | ヘビーユース | $20〜$100+ |
| Cline + Gemini 2.5 Pro | 同等ヘビーユース | $3〜$15 |
| Cline + OpenRouter | ライトユース | $1〜$5 |
| Aider + Gemini | ヘビーユース | $3〜$20 |
| Windsurf Pro | 固定プラン | $15/月 |

※ 使用量・プロジェクト規模により大きく変動します。

---

## まとめ：ベストな組み合わせ

**最強コンビ**: Claude Code（通常時）+ Cline/Gemini（制限時）

この2刀流を確立しておくだけで、
レートリミットに悩まされる機会は劇的に減ります。

まずは今日中に **Clineをインストールし、Gemini APIキーを取得**してみてください。
設定は10分もあれば完了します。

## メタ情報

タイトル: Claude Codeの制限でお困りの方へ｜代理AIエージェント3選【2026年最新版】
価格: 無料
