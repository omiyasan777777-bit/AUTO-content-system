# iPhoneだけで完結するUnix開発環境：a-Shell完全活用ガイド
## 〜ターミナル初心者からAI画像プロンプト管理まで〜

---

## はじめに｜スマホだけでこんなことができる時代になった

「ノートPCを持ち歩かなくても、iPhoneひとつでサーバー管理やプログラミングができたら最高じゃないか？」

そう思ったことはありませんか？

実は今、iPhoneやiPadだけで本格的なUnixコマンド操作、Python実行、SSH接続、さらにはAI画像生成のプロンプト管理まで——すべてが**完全無料**で実現できます。

そのカギとなるアプリが、**a-Shell（エーシェル）** です。

本記事では、a-Shellの基本インストールから、実務で使える応用テクニック、そして注目の「AI画像生成プロンプト管理」ワークフローまで、徹底的に解説します。

読み終えるころには、あなたのiPhoneが"ポケットの中のLinux端末"に変わっているはずです。

---

## CHAPTER 1｜a-Shellとは何か？

### 1-1. 基本情報

a-ShellはiOS/iPadOS向けの**完全ローカル動作するターミナルエミュレータ**です。

| 項目 | 内容 |
|------|------|
| 開発者 | Nicolas Holzschuch（オープンソース） |
| 価格 | **完全無料**（App Store） |
| 対応OS | iOS 13以降 / iPadOS 13以降 |
| リポジトリ | github.com/holzschu/a-shell |
| カテゴリ | 開発者ツール |

最大の特徴は**「サーバー不要・インターネット不要でUnixコマンドが動く」**という点です。

一般的なSSHアプリはリモートサーバーに接続してコマンドを動かします。しかしa-Shellは違います。コマンドがiPhone/iPad本体のArm64プロセッサ上でネイティブ実行されます。

つまり、**電波のない場所でも**、**データ通信がなくても**、Python スクリプトを走らせたり、テキストファイルを編集したり、自作プログラムを実行したりできます。

### 1-2. 何ができるのか？ざっくりイメージ

a-Shellでできることを一言で言うなら「iPhoneの中にミニLinux環境が入っている」感覚です。

具体的にはこんなことができます：

- **ls、cd、cat、grep** といったUNIX基本コマンドを実行
- **Python 3** でスクリプトを書いて実行
- **Vim** でコードやテキストを編集
- **SSH** でサーバーに接続してリモート操作
- **curl** でAPIを叩いてAIサービスを活用
- **Git（lg2）** でバージョン管理・GitHubと連携
- **ImageMagick** で画像変換・リサイズ
- **ffmpeg** で動画・音声変換

これらがすべてiPhone/iPadひとつで、**完全無料**で完結します。

---

## CHAPTER 2｜インストールと初期設定

### 2-1. インストール手順

インストールは拍子抜けするほど簡単です。

1. App Storeを開く
2. 検索欄に「**a-Shell**」と入力
3. 「入手」をタップ（完全無料）
4. インストール完了後、アプリを起動

起動直後、黒い画面にプロンプトが表示されれば成功です。

まず `help` と入力してEnterキーを押してみましょう。使えるコマンドの説明が表示されます。

```
$ help
```

**a-Shell mini** という軽量版も別途App Storeで配信されています。こちらはffmpegとImageMagickがあらかじめ内蔵されていて、より軽量な構成を好む方に向いています。

### 2-2. 最初に知っておくべきiOSの制約

a-Shellを使う上で、最初に1つだけ覚えておくべきことがあります。

**書き込みができるのは以下の3か所だけです：**

| ディレクトリ | 用途 |
|------------|------|
| `~/Documents/` | スクリプト・設定ファイル・プロジェクト |
| `~/Library/` | Pythonパッケージなどのシステムファイル |
| `~/tmp/` | 一時ファイル |

`~`（ホームディレクトリのルート）は読み取り専用です。スクリプトやファイルはすべて `~/Documents/` に置く習慣をつけましょう。

### 2-3. 初期設定：環境を整える

a-Shellは起動時に `~/Documents/.profile` を読み込みます。ここに環境変数やエイリアスを設定しておくと便利です。

```bash
# Vimで設定ファイルを作成
vim ~/Documents/.profile
```

以下の内容を入力して保存します（Vimの操作：`i`で入力モード、`Esc`→`:wq`で保存終了）：

```bash
# パスの追加（自作コマンドをどこからでも呼び出せる）
export PATH="$PATH:~/Documents/bin"

# よく使うエイリアス
alias ll="ls -la"
alias py="python3"

# APIキーなど（後述）
# export OPENAI_API_KEY="sk-xxxx"
```

設定を反映させるには `source ~/Documents/.profile` を実行するか、アプリを再起動します。

### 2-4. 外観のカスタマイズ

黒背景に白文字のデフォルト設定から変更したい場合は `config` コマンドを使います。

```bash
config          # 設定メニューを表示
config -p       # 設定を次回起動時も保持
```

フォント種類・サイズ、背景色、テキスト色、カーソル形状を好みに合わせてカスタマイズできます。目に優しい配色にすることで、長時間の作業も快適になります。

---

## CHAPTER 3｜基本コマンド完全リファレンス

### 3-1. ファイル操作の基本

```bash
ls              # ファイル・ディレクトリ一覧
ls -la          # 詳細表示（権限・サイズ・日付）
cd ~/Documents  # ディレクトリ移動
cd -            # 直前のディレクトリに戻る
pwd             # 現在地を表示
mkdir myproject # ディレクトリ作成
cp file1 file2  # ファイルコピー
mv file1 file2  # ファイル移動・名前変更
rm file         # ファイル削除
cat file.txt    # ファイル内容を表示
```

### 3-2. テキスト処理

```bash
grep "検索文字" file.txt     # テキスト検索
grep -r "検索文字" ./        # ディレクトリ内を再帰検索
awk '{print $1}' file.txt   # 1列目を抽出
sed 's/old/new/g' file.txt  # テキスト置換
wc -l file.txt              # 行数カウント
sort file.txt               # 並び替え
uniq file.txt               # 重複行を削除
```

### 3-3. ネットワーク系コマンド

```bash
curl https://example.com                    # URLのコンテンツを取得
curl -o file.html https://example.com       # ファイルとして保存
ping google.com                             # 疎通確認
nslookup example.com                        # DNS確認
whois example.com                           # ドメイン情報
ifconfig                                    # ネットワーク設定確認
```

### 3-4. a-Shell固有の便利コマンド

iOSならではの便利コマンドがあります。これを知っているだけで作業効率が大きく変わります。

```bash
# 他のアプリのフォルダへのアクセス権を付与
pickFolder

# ブックマーク操作（よく使うディレクトリを登録）
bookmark              # 現在のディレクトリをブックマーク
showmarks             # ブックマーク一覧
jump myproject        # ブックマーク "myproject" へジャンプ
cd ~myproject         # 同上

# クリップボード連携（Macともユニバーサルクリップボードで共有）
cat file.txt | pbcopy  # ファイル内容をクリップボードにコピー

# 新しいウィンドウを開く（iPadOSのマルチウィンドウ機能）
newWindow
```

**`pickFolder` は必須の操作です。** これを使うことで、Working CopyやKodaなど他アプリのフォルダにもアクセスできるようになります。

### 3-5. パッケージのインストール

a-Shellには `pkg` コマンドがあり、追加機能をインストールできます。

```bash
pkg install zip        # zip/unzip（圧縮・解凍）
pkg install ffmpeg     # 動画・音声変換
pkg install jq         # JSON解析（API連携に必須）
pkg install ace        # Aceコードエディタ（Web IDE）
pkg install monaco     # Monaco エディタ（VS Codeベース）
```

特に `jq` はAPI連携時にJSON出力を見やすく整形・抽出するのに非常に便利です。後述するAI API連携で重宝します。

---

## CHAPTER 4｜Python活用ガイド

### 4-1. Python 3の実行

a-ShellにはPython 3がプリインストールされています。

```bash
python3 --version    # バージョン確認
python3 script.py    # スクリプト実行
python3              # 対話モード起動
```

### 4-2. pipでパッケージをインストール

純粋Pythonパッケージ（ネイティブC拡張なし）はpipでインストールできます。

```bash
pip install requests        # HTTPリクエスト
pip install beautifulsoup4  # HTMLパース
pip install python-dotenv   # .envファイル読み込み
pip install rich            # リッチなターミナル表示
```

**注意点：** numpy、PillowなどネイティブC拡張を含むパッケージはインストールできません。画像処理はImageMagickの `convert` コマンドを代わりに使います。

### 4-3. 実用的なPythonスクリプト例

**例1：テキストファイルのバッチ処理**

```python
# ~/Documents/batch_rename.py
import os, re

folder = os.path.expanduser("~/Documents/texts")
for filename in os.listdir(folder):
    if filename.endswith(".txt"):
        new_name = re.sub(r'\s+', '_', filename)
        os.rename(
            os.path.join(folder, filename),
            os.path.join(folder, new_name)
        )
        print(f"Renamed: {filename} → {new_name}")
```

**例2：APIレスポンスのJSON整形**

```python
# ~/Documents/json_pretty.py
import sys, json

data = json.load(sys.stdin)
print(json.dumps(data, ensure_ascii=False, indent=2))
```

使い方：`curl https://api.example.com/data | python3 ~/Documents/json_pretty.py`

---

## CHAPTER 5｜SSH接続・リモートサーバー管理

### 5-1. 基本のSSH接続

```bash
ssh user@192.168.1.10           # IPアドレスで接続
ssh user@example.com -p 22      # ポート指定
ssh -i ~/.ssh/id_rsa user@host  # 秘密鍵認証
```

### 5-2. SSHの設定ファイルで接続を簡略化

毎回長いコマンドを入力するのは手間です。設定ファイルを作っておきましょう。

```bash
mkdir ~/Documents/.ssh
vim ~/Documents/.ssh/config
```

```
Host myserver
  HostName example.com
  User myuser
  Port 22
  IdentityFile ~/Documents/.ssh/id_rsa

Host staging
  HostName staging.example.com
  User deploy
  Port 2222
```

設定後は `ssh myserver` だけで接続できます。

### 5-3. ファイルの転送

```bash
# アップロード
scp local_file.txt user@host:/remote/path/

# ダウンロード
scp user@host:/remote/path/file.txt ~/Documents/

# フォルダごと転送
scp -r local_folder/ user@host:/remote/path/

# インタラクティブなファイル操作
sftp user@host
```

### 5-4. iPadのSplit Viewで最強の作業環境を作る

iPadOSのSplit View（画面分割）機能を使い、左画面でSSH接続しながら右画面でローカルスクリプトを編集する、という使い方が可能です。

`newWindow` コマンドで新しいa-Shellウィンドウを開き、Split Viewに並べるだけです。tmuxを使わなくてもマルチターミナル環境が完成します。

---

## CHAPTER 6｜Git（lg2）でバージョン管理

a-ShellにはlibGit2ベースの `lg2` コマンドが内蔵されており、GitHubとの連携が可能です。

```bash
# リポジトリのクローン
lg2 clone https://github.com/username/repo.git ~/Documents/repo

# 基本操作
cd ~/Documents/repo
lg2 status
lg2 add .
lg2 commit -m "コミットメッセージ"
lg2 push origin main

# ブランチ操作
lg2 branch feature/new-function
lg2 checkout feature/new-function
lg2 merge feature/new-function
```

GitHubのPAT（Personal Access Token）を使えば、プライベートリポジトリへのpush/pullも可能です。プロンプトライブラリや自作スクリプトをGitHubでバックアップ・バージョン管理するのに最適です。

---

## CHAPTER 7｜AI画像生成プロンプト管理システムの構築

ここからが本記事のメインディッシュです。a-Shellを使って**iPhone/iPadだけで完結するAI画像プロンプト管理システム**を構築します。

### 7-1. なぜa-ShellでAI活用なのか？

画像生成AIを使っていると、こんな悩みが出てきます。

- 良いプロンプトを思いついてもメモアプリに散らばって管理が大変
- 同じようなプロンプトを毎回手打ちするのが面倒
- PC作業中に「あのプロンプトどこ行った？」と探す時間のムダ
- iPhoneとPCで同じプロンプトを使いたいが同期が面倒

a-Shellを使えば、**JSONファイルで体系的に管理→Git でバックアップ→curlでAPIを直接叩いて生成→結果をFilesアプリに保存** という完全なパイプラインがiPhoneひとつで完結します。

### 7-2. プロンプト管理スクリプトの作成

まず、プロンプトを管理するPythonスクリプトを作成します。

```bash
vim ~/Documents/pm.py
```

以下のコードを入力します：

```python
#!/usr/bin/env python3
# Prompt Manager for AI Image Generation

import json, os, sys, datetime

PROMPTS_FILE = os.path.expanduser("~/Documents/prompts.json")

def load():
    if os.path.exists(PROMPTS_FILE):
        with open(PROMPTS_FILE) as f:
            return json.load(f)
    return []

def save(prompts):
    with open(PROMPTS_FILE, "w") as f:
        json.dump(prompts, f, ensure_ascii=False, indent=2)

def add(title, prompt, negative="", tags=None):
    prompts = load()
    entry = {
        "id": len(prompts) + 1,
        "title": title,
        "prompt": prompt,
        "negative": negative,
        "tags": tags or [],
        "created": datetime.date.today().isoformat()
    }
    prompts.append(entry)
    save(prompts)
    print(f"✅ 保存しました: [{entry['id']}] {title}")

def search(keyword):
    results = []
    for p in load():
        if (keyword.lower() in p["prompt"].lower() or
            keyword.lower() in p["title"].lower() or
            keyword in p.get("tags", [])):
            results.append(p)
    if not results:
        print(f"「{keyword}」に一致するプロンプトはありません")
        return
    for p in results:
        print(f"\n[{p['id']}] {p['title']} ({p['created']})")
        print(f"  Tags: {', '.join(p['tags'])}")
        print(f"  Prompt: {p['prompt'][:80]}...")

def show(id_num):
    for p in load():
        if p["id"] == id_num:
            print(f"\n📝 [{p['id']}] {p['title']}")
            print(f"Tags: {', '.join(p['tags'])}")
            print(f"\nPrompt:\n{p['prompt']}")
            if p.get("negative"):
                print(f"\nNegative:\n{p['negative']}")
            return
    print(f"ID {id_num} は見つかりません")

def list_all():
    for p in load():
        print(f"[{p['id']:3}] {p['title']:30} | {', '.join(p['tags'])}")

# コマンドライン引数処理
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使い方: pm.py [list|search|show|add]")
        sys.exit()
    
    cmd = sys.argv[1]
    if cmd == "list":
        list_all()
    elif cmd == "search" and len(sys.argv) > 2:
        search(sys.argv[2])
    elif cmd == "show" and len(sys.argv) > 2:
        show(int(sys.argv[2]))
    elif cmd == "add":
        title = input("タイトル: ")
        prompt = input("プロンプト: ")
        negative = input("ネガティブ（任意）: ")
        tags = input("タグ（カンマ区切り）: ").split(",")
        add(title, prompt, negative, [t.strip() for t in tags])
```

保存したら実行権限を付与し、エイリアスを設定します：

```bash
chmod +x ~/Documents/pm.py
mkdir -p ~/Documents/bin
ln -s ~/Documents/pm.py ~/Documents/bin/pm
```

### 7-3. プロンプトの登録と活用

スクリプトの使い方は以下の通りです：

```bash
# プロンプトを追加（対話形式）
pm add

# 一覧表示
pm list

# キーワード検索
pm search "sunset"
pm search "anime"

# IDで詳細表示
pm show 1
```

**使用例：プロンプトを登録してみる**

```
$ pm add
タイトル: 夕焼けと富士山・水彩風
プロンプト: beautiful sunset over Mount Fuji, watercolor painting style, soft colors, Japanese art, trending on artstation, 8k
ネガティブ（任意）: ugly, blurry, low quality, deformed
タグ（カンマ区切り）: 風景, 富士山, 水彩, 日本

✅ 保存しました: [1] 夕焼けと富士山・水彩風
```

```
$ pm list
[  1] 夕焼けと富士山・水彩風          | 風景, 富士山, 水彩, 日本
[  2] サイバーパンク都市・夜景         | SF, サイバーパンク, 夜景
[  3] ファンタジー少女・魔法使い       | アニメ, キャラクター, 魔法
```

### 7-4. OpenAI DALL-E APIで実際に画像生成

プロンプト管理ができたら、次はAPIで実際に画像を生成します。

まずAPIキーを設定します：

```bash
# .profileに追記
echo 'export OPENAI_API_KEY="sk-xxxxxxxxxxxx"' >> ~/Documents/.profile
source ~/Documents/.profile
```

画像生成スクリプトを作成します：

```bash
vim ~/Documents/generate.py
```

```python
#!/usr/bin/env python3
# DALL-E 3 Image Generator

import json, os, sys, urllib.request, urllib.error, datetime

API_KEY = os.environ.get("OPENAI_API_KEY", "")
SAVE_DIR = os.path.expanduser("~/Documents/generated")
os.makedirs(SAVE_DIR, exist_ok=True)

def generate(prompt, size="1024x1024", quality="standard"):
    if not API_KEY:
        print("❌ OPENAI_API_KEY が設定されていません")
        sys.exit(1)
    
    print(f"🎨 生成中: {prompt[:50]}...")
    
    payload = json.dumps({
        "model": "dall-e-3",
        "prompt": prompt,
        "n": 1,
        "size": size,
        "quality": quality
    }).encode()
    
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
    )
    
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read())
            url = data["data"][0]["url"]
            revised = data["data"][0].get("revised_prompt", "")
            
            # 画像をダウンロード
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = os.path.join(SAVE_DIR, f"dalle_{timestamp}.png")
            urllib.request.urlretrieve(url, filename)
            
            print(f"✅ 保存完了: {filename}")
            if revised:
                print(f"📝 修正プロンプト: {revised[:100]}...")
            return filename
    except urllib.error.HTTPError as e:
        print(f"❌ エラー: {e.code} - {e.read().decode()}")
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        prompt = input("プロンプトを入力: ")
    else:
        prompt = " ".join(sys.argv[1:])
    generate(prompt)
```

使い方：

```bash
python3 ~/Documents/generate.py "A futuristic Tokyo city at night, neon lights, rain, cinematic"
```

### 7-5. プロンプト管理→生成→保存の自動パイプライン

プロンプト管理スクリプトと画像生成スクリプトを組み合わせます。

```bash
vim ~/Documents/gen_from_library.sh
```

```bash
#!/bin/bash
# プロンプトライブラリから選んで生成

echo "📚 保存済みプロンプト一覧:"
python3 ~/Documents/pm.py list

echo ""
echo -n "生成したいプロンプトのID: "
read id

# IDからプロンプトを取得（Python経由）
PROMPT=$(python3 -c "
import json, os
with open(os.path.expanduser('~/Documents/prompts.json')) as f:
    prompts = json.load(f)
for p in prompts:
    if p['id'] == $id:
        print(p['prompt'])
        break
")

if [ -z "$PROMPT" ]; then
    echo "❌ IDが見つかりません"
    exit 1
fi

echo "🎨 プロンプト: $PROMPT"
echo ""
python3 ~/Documents/generate.py "$PROMPT"
```

```bash
chmod +x ~/Documents/gen_from_library.sh
~/Documents/gen_from_library.sh
```

### 7-6. Apple Shortcutsとの連携

a-ShellはApple Shortcutsと深く統合されています。これを使えば、ホーム画面のウィジェットをタップするだけでプロンプト生成→画像保存ができるようになります。

**Shortcutsの設定手順：**

1. ショートカットアプリを開く
2. 「+」で新規ショートカット作成
3. 「a-Shell」アクションを追加
4. コマンドに以下を入力：
   ```
   python3 ~/Documents/generate.py "PROMPT_HERE"
   ```
5. ウィジェットに追加してホーム画面から1タップで実行

**テキスト入力→自動生成のフロー：**

1. 「テキストを入力」アクション → ユーザーがプロンプトを入力
2. 「a-Shell Execute Command」→ `python3 ~/Documents/generate.py "${1}"`
3. 「a-Shell Get File」→ 最新の生成ファイルを取得
4. 「写真ライブラリに保存」→ カメラロールに保存

これで**テキスト入力→API呼び出し→画像保存**の全工程がiPhone上で完結します。

### 7-7. Gitでプロンプトライブラリをバックアップ

大切なプロンプトはGitHubでバックアップしておきましょう。

```bash
cd ~/Documents
lg2 init prompt-library
cd prompt-library
cp ~/Documents/prompts.json .

lg2 add prompts.json
lg2 commit -m "Initial prompt library"
lg2 remote add origin https://github.com/yourusername/prompt-library.git
lg2 push origin main
```

以降、プロンプトを追加したら：

```bash
cd ~/Documents/prompt-library
cp ~/Documents/prompts.json .
lg2 add prompts.json
lg2 commit -m "Add new prompts: $(date)"
lg2 push origin main
```

これでiPhoneが壊れてもプロンプトライブラリは安全です。また、MacやPCからも同じライブラリを参照できます。

---

## CHAPTER 8｜他のiOSターミナルアプリとの比較

a-Shellは多くのiOSターミナルアプリの中でどう位置づけられるのでしょうか。

| アプリ | 価格 | SSH | ローカル実行 | Python | 特徴 |
|--------|------|-----|------------|--------|------|
| **a-Shell** | **無料** | ○ | ○ネイティブ | ○ | オールインワン |
| iSH | 無料 | ○ | ○x86エミュ | ○ | Alpine Linux環境 |
| Blink Shell | 有料 | ○Mosh対応 | △ | × | プロSSH特化 |
| Termius | 無料+課金 | ○ | × | × | クロスプラットフォーム |
| Pythonista | 有料 | × | ○ | ○高機能 | Python開発特化 |
| Secure ShellFish | 有料 | ○ | × | × | Files.app統合 |

**選び方の指針：**

- **コスト最優先かつローカル開発もしたい** → **a-Shell**（断然おすすめ）
- **LinuxパッケージをAPKで管理したい** → iSH（ただしx86エミュレーションで遅い）
- **SSH専用・品質最優先** → Blink Shell
- **チーム共有・クロスデバイス管理** → Termius
- **iOS特化のPythonアプリを作りたい** → Pythonista
- **Finderのようにサーバーのファイルを扱いたい** → Secure ShellFish

**結論として**、コストをかけずに最も多くのことができるのがa-Shellです。特にプログラミング学習中の方や、AI活用・自動化に興味がある方には最初の一択として強くおすすめできます。

---

## CHAPTER 9｜よくある質問・トラブルシューティング

### Q1. pipでパッケージがインストールできない

**A:** `numpy`、`Pillow` などネイティブC拡張を含むパッケージはインストール不可です。`requests`、`beautifulsoup4`、`python-dotenv` など純粋Pythonパッケージのみ対応しています。画像処理にはImageMagickの `convert` コマンドを代わりに使いましょう。

### Q2. 「Permission denied」エラーが出る

**A:** `~` ルートは読み取り専用です。すべての作業ファイルを `~/Documents/` 以下に置いてください。

### Q3. 他のアプリのフォルダにアクセスできない

**A:** `pickFolder` コマンドを実行し、Filesアプリからアクセスしたいフォルダを選択してください。アクセス権が付与され、`cd` で移動できるようになります。

### Q4. SSH接続中に画面表示が崩れる

**A:** tmux使用時に複数ペインで表示崩れが起きる既知の問題があります。iPadのSplit ViewでSSHウィンドウを2つ並べることで回避できます。

### Q5. C言語のプログラムが実行できない

**A:** a-ShellのClangはWebAssembly形式にコンパイルします。`clang program.c` でコンパイル後、`wasm a.out` または `./a.out` で実行してください。

### Q6. `.bashrc` が読み込まれない

**A:** a-Shellは `~/.bashrc` ではなく `~/Documents/.profile` を読み込みます。設定はこちらに書いてください。

### Q7. Shortcutsから実行するとコマンドが動かない

**A:** 「In Extension」モードは軽量で制限があります。「In App」モードに切り替えることで解決するケースが多いです。

### Q8. APIキーをコードに直書きしたくない

**A:** `~/Documents/.profile` に `export OPENAI_API_KEY="sk-xxxx"` と書いておくことで、スクリプト内では `os.environ.get("OPENAI_API_KEY")` で安全に参照できます。

---

## CHAPTER 10｜上級者向けTips集

### Tip 1. jqでAPIレスポンスを優雅にパース

```bash
pkg install jq

# OpenAI APIの画像URLだけを抽出
curl -s https://api.openai.com/v1/images/generations \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"dall-e-3","prompt":"cyberpunk tokyo","n":1,"size":"1024x1024"}' \
  | jq -r '.data[0].url'
```

### Tip 2. ImageMagickで生成画像を加工

a-Shell mini にはImageMagickがプリインストールされています。

```bash
# 画像のリサイズ
convert input.png -resize 512x512 output.png

# 複数画像を横並びに結合
convert +append img1.png img2.png combined.png

# 縦並びに結合
convert -append img1.png img2.png vertical.png

# 丸く切り抜き（SNSアイコン用）
convert input.png -resize 500x500 \
  \( +clone -threshold -1 -negate -fill white -draw "circle 250,250 250,0" \) \
  -alpha off -compose copy_opacity -composite icon.png
```

### Tip 3. バッチ処理でプロンプトの一括生成

```bash
vim ~/Documents/batch_generate.sh
```

```bash
#!/bin/bash
# プロンプトリストから一括生成

PROMPTS=(
    "sunset over Tokyo, cinematic lighting"
    "cherry blossoms in spring rain, oil painting"
    "futuristic samurai, digital art"
)

for prompt in "${PROMPTS[@]}"; do
    echo "生成中: $prompt"
    python3 ~/Documents/generate.py "$prompt"
    sleep 2  # レート制限対策
done

echo "✅ 全件完了"
```

### Tip 4. TextSoap代わりに sed/awk でテキスト整形

プロンプトのバリエーション展開に使えます。

```bash
# プロンプトのスタイル部分だけ置換
echo "a beautiful landscape, oil painting style" | sed 's/oil painting/watercolor/'
echo "a beautiful landscape, oil painting style" | sed 's/oil painting/anime/'
```

### Tip 5. cronの代わりにShortcutsの「オートメーション」機能を使う

a-Shell には cron はありませんが、Shortcutsのオートメーション（時間トリガー）を使うことで定期実行が可能です。

- 毎朝7時に今日の天気をcurlで取得してメモに保存
- 毎週月曜にプロンプトライブラリをGitHubにpush
- 充電開始時に処理の重いスクリプトを実行

---

## おわりに｜iPhoneが"最強のポケットツール"になる

a-Shellは、iPhoneやiPadを**本格的な開発ツール**に変えてくれるアプリです。

無料なのに：
- ✅ Unixコマンドが使える
- ✅ Python 3でスクリプトが書ける
- ✅ SSHでサーバー管理ができる
- ✅ curlでAI APIを叩ける
- ✅ Gitでバージョン管理できる
- ✅ ImageMagickで画像処理できる
- ✅ Apple Shortcutsと連携できる

本記事で紹介したAI画像プロンプト管理システムは、すべてiPhone一台・コスト0円で構築できます。

まずはApp Storeでa-Shellをインストールして、`help` コマンドを打ってみてください。

あなたのiPhoneが、今日から"ポケットの中のUnixサーバー"に変わります。

---

## 付録：よく使うコマンドクイックリファレンス

```
【ファイル操作】
ls -la          ディレクトリ詳細表示
cd ~/Documents  Documentsへ移動
cp src dst      コピー
mv src dst      移動・リネーム
rm file         削除

【iOS固有】
pickFolder      他アプリフォルダへアクセス
bookmark        現在地をブックマーク
jump name       ブックマークへジャンプ
pbcopy          クリップボードにコピー
newWindow       新しいウィンドウ

【Python】
python3 script.py     スクリプト実行
pip install package   パッケージインストール

【ネットワーク】
ssh user@host         SSH接続
scp file user@host:/  ファイルアップロード
curl -s URL           HTTPリクエスト

【Git】
lg2 clone URL         クローン
lg2 add .             ステージング
lg2 commit -m "msg"   コミット
lg2 push origin main  プッシュ

【パッケージ追加】
pkg install jq        JSON解析ツール
pkg install ffmpeg    動画変換
pkg install zip       圧縮・解凍
```
