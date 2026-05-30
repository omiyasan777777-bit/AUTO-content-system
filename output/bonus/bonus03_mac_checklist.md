# 【特典③】Mac環境構築チェックリスト
## Codexアプリ導入〜初回実行までの全工程確認リスト（Mac版）

> WindowsとMacの差分を中心に解説します。基本的な流れはWindows版（特典②）と同じです。

---

## ✅ PHASE 1：Codexアプリのインストール

### 1-1. ダウンロード
- [ ] ブラウザで `openai.com/codex` にアクセスした
- [ ] 「Download for Mac」ボタンをクリックしてインストーラー（.dmgファイル）をダウンロードした
- [ ] ダウンロードフォルダにファイルが保存されていることを確認した

### 1-2. インストール実行
- [ ] ダウンロードした `.dmg` ファイルをダブルクリックして開いた
- [ ] CodexのアイコンをApplications（アプリケーション）フォルダにドラッグ＆ドロップした
- [ ] Applicationsフォルダを閉じた

⚠️ **Macユーザーが最もよくハマるポイント①：初回起動時の警告**

「"Codex"は開発元を確認できないため開けません」と表示された場合：

方法A（推奨）：
1. Appleメニュー →「システム設定」（macOS Ventura以降）または「システム環境設定」（それ以前）を開く
2. 「プライバシーとセキュリティ」を開く
3. 「セキュリティ」セクションに「Codexは…」という表示と「このまま開く」ボタンがある
4. 「このまま開く」をクリック
5. 管理者パスワードを入力する

方法B：
1. Finderでアプリケーションフォルダを開く
2. Codexアプリを右クリック（またはControlキー+クリック）
3. 「開く」を選択
4. 「開く」ボタンをクリック

- [ ] 上記のいずれかの方法でCodexアプリを開けた
- [ ] Codexのホーム画面が表示された

---

## ✅ PHASE 2：OpenAI APIキーの取得と設定

Windows版（特典②）のPHASE 2と同じ手順です。以下のチェックのみ確認してください。

- [ ] `platform.openai.com` でAPIキーを発行した
- [ ] APIキーを安全な場所に保存した（Macの場合はメモアプリまたはキーチェーンを推奨）
- [ ] CodexアプリにAPIキーを設定した
- [ ] モデルを `gpt-4o-mini` に設定した

---

## ✅ PHASE 3：楽天アフィリエイトAPIキーの取得

Windows版（特典②）のPHASE 3と同じ手順です。

- [ ] 楽天アフィリエイトに登録・審査通過済み
- [ ] `webservice.rakuten.co.jp` でアプリIDを取得した
- [ ] アプリIDとアフィリエイトIDをメモに保存した

---

## ✅ PHASE 4：Codexの接続テスト

Windows版（特典②）のPHASE 4と同じ手順です。

- [ ] 特典①の「指示書01：接続テスト」を実行した
- [ ] 楽天商品データが表示された
- [ ] アフィリエイトURLが正しく付与されている

---

## ✅ PHASE 5：Pythonスクリプトのフォルダ整備（Mac版）

### 5-1. 作業フォルダの作成
- [ ] Finderを開いた
- [ ] ホームフォルダ（/Users/ユーザー名/）に「楽天アフィリエイト」フォルダを作成した
- [ ] フォルダ内に以下のファイルを配置した：
  - [ ] `main.py`（特典①の指示書08で生成）
  - [ ] `keywords.txt`（1行1キーワードで記入）

### 5-2. Pythonの確認

⚠️ **Macユーザーが最もよくハマるポイント②：PythonのバージョンとPATH**

macOS はデフォルトで Python 2.x がインストールされていることがあります。Python 3 が必要です。

- [ ] ターミナルを開いた（LaunchpadまたはSpotlightで「ターミナル」と検索）
- [ ] `python3 --version` とコマンドを入力してEnterを押した
- [ ] `Python 3.x.x` と表示された（表示されない場合は下記の手順で対処）

Python 3がインストールされていない場合：
- [ ] `python.org` からPython 3の最新版をダウンロードしてインストールした
- [ ] または Codexに「Python 3をmacOSにインストールする方法を教えてください」と聞いてインストールした
- [ ] 再度 `python3 --version` で確認した

### 5-3. 必要なライブラリのインストール
- [ ] ターミナルで以下のコマンドを実行した：
  ```
  pip3 install requests openai pandas
  ```
- [ ] インストールが完了した（エラーが出た場合はCodexに貼り付けて対処）

### 5-4. main.pyの手動実行テスト
- [ ] ターミナルで以下のコマンドを実行した：
  ```
  cd /Users/（ユーザー名）/楽天アフィリエイト
  python3 main.py
  ```
- [ ] エラーなく実行が完了した
- [ ] 「楽天アフィリエイト」フォルダ内にCSVファイルとTXTファイルが生成された

---

## ✅ PHASE 6：launchdによる自動実行の設定（Mac版）

Macでは「launchd」というOSビルトインの仕組みを使って毎日自動実行を設定します。

### 6-1. plistファイルの生成

Codexに以下の指示書を渡してplistファイルを生成してもらいます。

```
【作業の目的】
Macで毎日06:00にPythonスクリプトを自動実行するlaunchd設定ファイル（plist）を作成してください。

【やってほしいこと】
- 以下の設定でplistファイルを作成してください：
  - Label: "com.rakutenaffiliate.daily"
  - ProgramArguments: ["/usr/bin/python3", "/Users/（ユーザー名）/楽天アフィリエイト/main.py"]
  - StartCalendarInterval: 毎日 Hour=6, Minute=0
  - WorkingDirectory: "/Users/（ユーザー名）/楽天アフィリエイト"
  - StandardOutPath: "/Users/（ユーザー名）/楽天アフィリエイト/launchd_out.log"
  - StandardErrorPath: "/Users/（ユーザー名）/楽天アフィリエイト/launchd_err.log"
- ファイル名: "com.rakutenaffiliate.daily.plist"
- plistファイルをLaunchAgentsフォルダに配置するコマンドも出力してください
- launchdに登録するコマンドも出力してください

【制約・条件】
- XMLのplist形式で作成してください
- /Users/（ユーザー名）/ の部分は実際のホームディレクトリパスに置き換えてください
```

- [ ] Codexがplistファイルを生成した
- [ ] plistファイルの内容に自分のユーザー名・パスが正しく記載されているか確認した

### 6-2. plistファイルの配置と登録

⚠️ **Macユーザーが最もよくハマるポイント③：plistの配置場所**

plistファイルは必ず `~/Library/LaunchAgents/` フォルダに配置する必要があります。このフォルダはFinderでは通常非表示です。ターミナルを使います。

- [ ] ターミナルを開いた
- [ ] 以下のコマンドでplistファイルをLaunchAgentsに配置した：
  ```
  cp /Users/（ユーザー名）/楽天アフィリエイト/com.rakutenaffiliate.daily.plist ~/Library/LaunchAgents/
  ```
- [ ] 以下のコマンドでlaunchdに登録した：
  ```
  launchctl load ~/Library/LaunchAgents/com.rakutenaffiliate.daily.plist
  ```
- [ ] エラーメッセージが出なかった

### 6-3. 動作テスト
- [ ] ターミナルで以下のコマンドを実行して手動テストをした：
  ```
  launchctl start com.rakutenaffiliate.daily
  ```
- [ ] 「楽天アフィリエイト」フォルダ内にCSVファイルとTXTファイルが生成された
- [ ] `launchd_out.log` に実行結果が記録されていた

---

## ✅ launchd 設定ファイルのサンプル

以下のサンプルを参考にしてください。`YOUR_USERNAME` を自分のMacのユーザー名に書き換えてください。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.rakutenaffiliate.daily</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/YOUR_USERNAME/楽天アフィリエイト/main.py</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Users/YOUR_USERNAME/楽天アフィリエイト</string>

    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>6</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>

    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/楽天アフィリエイト/launchd_out.log</string>

    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/楽天アフィリエイト/launchd_err.log</string>

    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
```

---

## ✅ 最終確認チェックリスト

- [ ] Codexアプリが起動できる
- [ ] 楽天APIの接続テストが成功した
- [ ] Python 3がインストールされている
- [ ] `pip3 install requests openai pandas` が完了している
- [ ] main.pyが手動実行でエラーなく動作した
- [ ] plistファイルがLaunchAgentsに配置されている
- [ ] launchdへの登録が完了している（エラーなし）
- [ ] 手動テスト実行でファイルが生成されることを確認した

---

## ❓ Macユーザーのよくある質問

**Q: `python3` コマンドが見つからないと言われる**

A: Python 3がインストールされていない可能性があります。Codexに「macOSにPython 3をインストールする方法を教えてください」と聞いてインストールしてください。Homebrewを使う方法（`brew install python3`）が一般的です。

**Q: plistを登録したが毎日実行されない**

A: ターミナルで `launchctl list | grep rakuten` を実行して、登録されているか確認してください。表示されない場合はplistの配置とloadコマンドをやり直してください。Macがスリープ中の06:00は実行されません。スリープ設定を見直すか、実行時刻をMacが起動している時間帯に変更してください。

**Q: plistを削除（登録解除）したい場合**

A: 以下のコマンドを実行してください：
```
launchctl unload ~/Library/LaunchAgents/com.rakutenaffiliate.daily.plist
rm ~/Library/LaunchAgents/com.rakutenaffiliate.daily.plist
```

**Q: `launchctl load` でエラーが出る**

A: plistファイルの権限設定の問題かもしれません。以下のコマンドで権限を修正してください：
```
chmod 644 ~/Library/LaunchAgents/com.rakutenaffiliate.daily.plist
```
