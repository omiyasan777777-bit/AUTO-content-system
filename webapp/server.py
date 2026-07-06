"""
webapp/server.py - AUTO-content-system Web UI サーバー

ブラウザのチャット画面から claude CLI をヘッドレス起動し、
CLAUDE.md のメニュー/6フェーズパイプラインをWebアプリとして操作する。

使い方:
  python webapp/server.py
  → ブラウザで http://127.0.0.1:8787 を開く

仕組み:
  - メッセージごとに `claude -p --output-format stream-json` を起動
  - 2回目以降は `--resume <session_id>` で会話を継続
  - 出力をNDJSONでブラウザにストリーミング
"""

import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from flask import Flask, Response, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent  # Python3.8では__file__が相対パスのためresolve必須
PROJECT_DIR = BASE_DIR.parent  # claude の作業ディレクトリ = プロジェクトルート

# プロジェクト直下のモジュール（threads_api 等）を import できるようにする
sys.path.insert(0, str(PROJECT_DIR))
import threads_api  # noqa: E402
from threads_api import ThreadsError  # noqa: E402

HOST = "127.0.0.1"  # ローカル専用。外部公開しないこと
PORT = 8787

# Windows コンソール文字化け対策
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

CLAUDE_BIN = shutil.which("claude")

# --model に渡せるモデルの許可リスト（UIのドロップダウンと対応）
ALLOWED_MODELS = {
    "claude-fable-5",
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
}

# 動作モード → CLIの --permission-mode 値（"restricted" は許可リスト方式で別処理）
MODES = {
    "restricted": None,           # 許可リスト方式（既定・安全）
    "auto": "auto",               # 自動モード（CLIがよしなに判断）
    "full": "bypassPermissions",  # フルオート（確認なしで全実行）
    "plan": "plan",               # 計画モード（読み取りのみ・実行しない）
}

# フルオート（全許可）モードは環境変数 ACS_ALLOW_FULL=1 のときだけ有効。
# 既定では無効にして、Web経由の任意コマンド実行の穴を塞ぐ。
ALLOW_FULL = os.environ.get("ACS_ALLOW_FULL") == "1"

app = Flask(__name__)


def nd(obj) -> str:
    """NDJSON 1行分"""
    return json.dumps(obj, ensure_ascii=False) + "\n"


@app.get("/")
def index():
    res = send_from_directory(BASE_DIR / "static", "index.html")
    # 更新（git pull）した画面がリロードだけで確実に反映されるようにキャッシュさせない
    res.headers["Cache-Control"] = "no-store"
    return res


@app.post("/api/open-folder")
def api_open_folder():
    """OSのファイルマネージャ（Windows=エクスプローラー）でフォルダを開く。
    プロジェクト内のフォルダのみ許可する（任意パスは開かない）。"""
    data = request.get_json(force=True, silent=True) or {}
    rel = (data.get("path") or "").strip().strip("/\\")

    # プロジェクト直下からの相対パスだけ許可。.. などで外に出るのを防ぐ
    target = (PROJECT_DIR / rel).resolve() if rel else PROJECT_DIR.resolve()
    try:
        target.relative_to(PROJECT_DIR.resolve())
    except ValueError:
        return {"error": "プロジェクト外のフォルダは開けません"}, 400
    if not target.exists():
        return {"error": f"フォルダが見つかりません: {rel or '(ルート)'}"}, 404

    try:
        if sys.platform == "win32":
            os.startfile(str(target))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(target)])
        else:
            subprocess.Popen(["xdg-open", str(target)])
    except Exception as e:
        return {"error": f"フォルダを開けませんでした: {e}"}, 500
    return {"ok": True, "opened": str(target)}


def _safe_target(rel: str):
    """プロジェクト内に収まる絶対パスを返す。外に出る指定は ValueError。"""
    target = (PROJECT_DIR / rel.strip().strip("/\\")).resolve()
    target.relative_to(PROJECT_DIR.resolve())  # 範囲外なら ValueError
    return target


# プレビュー・編集の対象にしてよいファイル名（フェーズ順）
EDITABLE_FILES = [
    "00a_self_analysis.md",
    "01_research.md",
    "02_concept.md",
    "03_product_design.md",
    "04_paid_content.md",
    "05_sales_letter.md",
]


@app.get("/api/content-files")
def api_content_files():
    """出力フォルダ（output, output2 …）と、その中の編集対象ファイル一覧を返す。"""
    result = []
    for p in sorted(PROJECT_DIR.glob("output*")):
        if not p.is_dir():
            continue
        files = [n for n in EDITABLE_FILES if (p / n).exists()]
        if files:
            result.append({"folder": p.name, "files": files})
    return {"folders": result}


@app.get("/api/knowledge-files")
def api_knowledge_files():
    """knowledge/ 内の .md 一覧（frontmatter の title 付き）を返す。"""
    kdir = PROJECT_DIR / "knowledge"
    files = []
    if kdir.is_dir():
        for p in sorted(kdir.glob("*.md")):
            if p.name == "index.md":
                continue  # 目次は編集対象から除外
            title = p.stem
            try:
                m = re.search(r"^title:\s*(.+)$", p.read_text(encoding="utf-8"), re.MULTILINE)
                if m:
                    title = m.group(1).strip()
            except Exception:
                pass
            files.append({"name": p.name, "title": title})
    return {"files": files}


def _latest_output_dir():
    """最新のワーキングフォルダ（output, output2 … の最大番号）を返す。無ければ None。"""
    best, best_n = None, -1
    for p in PROJECT_DIR.glob("output*"):
        if not p.is_dir():
            continue
        m = re.match(r"^output(\d*)$", p.name)
        if m:
            n = int(m.group(1)) if m.group(1) else 1
            if n > best_n:
                best, best_n = p, n
    return best


@app.post("/api/new-workfolder")
def api_new_workfolder():
    """次の枝番ワーキングフォルダ（output, output2, output3 …）を作成して名前を返す。"""
    n = 0
    for p in PROJECT_DIR.glob("output*"):
        if p.is_dir():
            m = re.match(r"^output(\d*)$", p.name)
            if m:
                k = int(m.group(1)) if m.group(1) else 1
                n = max(n, k)
    name = "output" if n == 0 else f"output{n + 1}"
    try:
        (PROJECT_DIR / name).mkdir(exist_ok=True)
    except Exception as e:
        return {"error": str(e)}, 500
    return {"ok": True, "folder": name}


@app.get("/api/phase-status")
def api_phase_status():
    """指定（または最新）ワーキングフォルダの各フェーズ成果物の有無を返す。"""
    phases = [
        {"key": "0", "label": "自己分析", "file": "00a_self_analysis.md"},
        {"key": "1", "label": "リサーチ", "file": "01_research.md"},
        {"key": "2", "label": "コンセプト", "file": "02_concept.md"},
        {"key": "3", "label": "商品設計", "file": "03_product_design.md"},
        {"key": "4", "label": "本文", "file": "04_paid_content.md"},
        {"key": "5", "label": "レター", "file": "05_sales_letter.md"},
    ]
    req_dir = (request.args.get("dir") or "").strip()
    folder = None
    if req_dir and re.match(r"^output\d*$", req_dir):
        cand = PROJECT_DIR / req_dir
        if cand.is_dir():
            folder = cand
    if folder is None and not req_dir:
        folder = _latest_output_dir()
    fname = folder.name if folder else (req_dir or None)
    # 指定フォルダがまだ無い（新規作成直後で空）場合も、フォルダ名は返して全カードを未完了表示にする
    if folder is None and req_dir and re.match(r"^output\d*$", req_dir):
        fname = req_dir
    for ph in phases:
        fp = folder / ph["file"] if folder else None
        done = bool(fp and fp.exists())
        ph["done"] = done
        ph["path"] = f"{fname}/{ph['file']}" if fname else None
        ph["editable"] = ph["file"] in EDITABLE_FILES
        ph["excerpt"] = _file_excerpt(fp) if done else ""
    return {"folder": fname, "phases": phases}


def _file_excerpt(path, limit=58):
    """ファイルの先頭から、見出し or 最初の本文行を1行ぶん抜粋して返す。"""
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return ""
    lines = text.split("\n")
    i = 0
    # frontmatter（--- … ---）をスキップ
    if lines and lines[0].strip() == "---":
        for j in range(1, len(lines)):
            if lines[j].strip() == "---":
                i = j + 1
                break
    heading, body = "", ""
    for ln in lines[i:]:
        s = ln.strip()
        if not s:
            continue
        if s.startswith("#"):
            if not heading:
                heading = s.lstrip("#").strip()
            continue
        if not body:
            body = s.lstrip(">-・*").strip()
        if heading and body:
            break
    out = heading or body
    return out[:limit] + ("…" if len(out) > limit else "")


@app.get("/api/letter-templates")
def api_letter_templates():
    """sales_templates/ 内の型一覧（frontmatter の name / builtin 付き）を返す。"""
    tdir = PROJECT_DIR / "sales_templates"
    files = []
    if tdir.is_dir():
        for p in sorted(tdir.glob("*.md")):
            if p.name == "index.md":
                continue
            name, builtin = p.stem, False
            try:
                txt = p.read_text(encoding="utf-8")
                m = re.search(r"^name:\s*(.+)$", txt, re.MULTILINE)
                if m:
                    name = m.group(1).strip()
                builtin = bool(re.search(r"^builtin:\s*true\s*$", txt, re.MULTILINE))
            except Exception:
                pass
            files.append({"name": p.name, "title": name, "builtin": builtin})
    return {"files": files}


_LETTER_CURRENT_FILE = PROJECT_DIR / "sales_templates" / ".current"


@app.route("/api/letter-current", methods=["GET", "POST"])
def api_letter_current():
    """現在選択中のセールスレター型（ファイル名）を取得/設定する。"""
    if request.method == "POST":
        data = request.get_json(force=True, silent=True) or {}
        name = (data.get("name") or "").strip()
        # sales_templates 内の .md のみ受け付ける
        if name and (name.endswith(".md") and "/" not in name and "\\" not in name
                     and (PROJECT_DIR / "sales_templates" / name).exists()):
            try:
                _LETTER_CURRENT_FILE.write_text(name, encoding="utf-8")
            except Exception as e:
                return {"error": str(e)}, 500
            return {"ok": True, "current": name}
        return {"error": "不正な型名です"}, 400
    # GET
    cur = ""
    if _LETTER_CURRENT_FILE.exists():
        cur = _LETTER_CURRENT_FILE.read_text(encoding="utf-8").strip()
    return {"current": cur}


@app.get("/api/read-file")
def api_read_file():
    rel = request.args.get("path", "")
    try:
        target = _safe_target(rel)
    except ValueError:
        return {"error": "プロジェクト外のファイルは読めません"}, 400
    if not target.is_file():
        return {"error": "ファイルが見つかりません"}, 404
    return {"content": target.read_text(encoding="utf-8")}


@app.post("/api/save-file")
def api_save_file():
    data = request.get_json(force=True, silent=True) or {}
    rel = data.get("path") or ""
    content = data.get("content")
    if content is None:
        return {"error": "内容がありません"}, 400
    try:
        target = _safe_target(rel)
    except ValueError:
        return {"error": "プロジェクト外のファイルは保存できません"}, 400
    # 安全のため「output*/<編集対象md>」または「knowledge/*.md」のみ許可
    is_output = (target.suffix == ".md" and target.name in EDITABLE_FILES
                 and target.parent.name.startswith("output"))
    is_knowledge = (target.suffix == ".md" and target.parent.name == "knowledge"
                    and target.name != "index.md")
    is_template = (target.suffix == ".md" and target.parent.name == "sales_templates"
                   and target.name != "index.md")
    if not (is_output or is_knowledge or is_template):
        return {"error": "このファイルは編集できません"}, 403
    target.write_text(content, encoding="utf-8")
    return {"ok": True, "saved": str(target)}


# ==============================
# Threads 連携（人気投稿分析・自動投稿）
# ==============================

@app.get("/api/threads/status")
def api_threads_status():
    """Threadsの設定状況（未設定なら手順を案内するためのフラグ）"""
    try:
        cfg = threads_api.load_config()
        return {"configured": True, "username": cfg.get("username", "")}
    except ThreadsError:
        return {"configured": False}


@app.post("/api/threads/setup")
def api_threads_setup():
    """Web UIからのトークン登録（ターミナル不要）。検証して threads_config.json に保存する。
    サーバーは 127.0.0.1 専用のため、トークンがこのPCの外に出ることはない。"""
    data = request.get_json(force=True, silent=True) or {}
    token = (data.get("token") or "").strip()
    secret = (data.get("secret") or "").strip()
    if not token:
        return {"error": "アクセストークンが空です"}, 400
    expires_in = None
    if secret:
        try:
            d = threads_api.exchange_long_lived_token(token, secret)
            token = d["access_token"]
            expires_in = d.get("expires_in")
        except ThreadsError:
            pass  # 交換に失敗したら貼り付けたトークンをそのまま使う
    try:
        me = threads_api.get_me(token)
    except ThreadsError as e:
        return {"error": f"トークンを確認できませんでした: {e}"}, 400
    threads_api.save_config({
        "access_token": token,
        "user_id": me["id"],
        "username": me.get("username", ""),
        "expires_in": expires_in,
        "obtained_at": int(time.time()),
    })
    return {"ok": True, "username": me.get("username", "")}


@app.get("/api/threads/insights")
def api_threads_insights():
    """自分の投稿をインプレッション/いいね順で返す"""
    try:
        days = min(max(int(request.args.get("days", 30)), 1), 365)
        top = min(max(int(request.args.get("top", 10)), 1), 25)
    except ValueError:
        return {"error": "days / top は数値で指定してください"}, 400
    sort = request.args.get("sort", "views")
    if sort not in ("views", "likes", "replies", "reposts", "quotes"):
        return {"error": f"未対応の並び順です: {sort}"}, 400
    try:
        cfg = threads_api.load_config()
        posts = threads_api.fetch_ranked_posts(cfg, days=days, top=top, sort=sort)
    except ThreadsError as e:
        return {"error": str(e)}, 400
    return {
        "username": cfg.get("username", ""),
        "posts": [{
            "text": p.get("text", ""),
            "timestamp": p.get("timestamp", ""),
            "permalink": p.get("permalink", ""),
            "insights": p.get("insights", {}),
        } for p in posts],
    }


@app.get("/api/threads/search")
def api_threads_search():
    """公開投稿のキーワード検索（他人の話題投稿を探す）"""
    q = (request.args.get("q") or "").strip()
    if not q:
        return {"error": "キーワードを入力してください"}, 400
    stype = request.args.get("type", "TOP")
    if stype not in ("TOP", "RECENT"):
        return {"error": f"未対応の並び順です: {stype}"}, 400
    try:
        cfg = threads_api.load_config()
        posts = threads_api.keyword_search(cfg, q, search_type=stype, limit=25)
    except ThreadsError as e:
        msg = str(e)
        low = msg.lower()
        if "permission" in low or "keyword" in low or "oauth" in low or "scope" in low:
            msg += ("\n※キーワード検索には「threads_keyword_search」権限が必要です。"
                    "developers.facebook.com でこの権限にチェックを入れてトークンを再生成し、"
                    "Threads画面から設定し直してください。")
        return {"error": msg}, 400
    return {"posts": [{
        "text": p.get("text", ""),
        "username": p.get("username", ""),
        "timestamp": p.get("timestamp", ""),
        "permalink": p.get("permalink", ""),
        "like_count": p.get("like_count"),
    } for p in posts]}


@app.post("/api/threads/post")
def api_threads_post():
    """テキストをThreadsに投稿（500字超は自動でツリー連投）"""
    data = request.get_json(force=True, silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return {"error": "投稿する本文が空です"}, 400
    try:
        cfg = threads_api.load_config()
        ids = threads_api.publish_thread(cfg, text)
        permalink = threads_api.get_permalink(cfg, ids[0])
    except ThreadsError as e:
        return {"error": str(e)}, 400
    return {"ok": True, "count": len(ids), "permalink": permalink}


@app.post("/api/send")
def api_send():
    data = request.get_json(force=True)
    message = (data.get("message") or "").strip()
    session_id = data.get("session_id") or None
    model = data.get("model") or None
    mode = data.get("mode") or "restricted"

    if not message:
        return {"error": "メッセージが空です"}, 400
    if model and model not in ALLOWED_MODELS:
        return {"error": f"未対応のモデルです: {model}"}, 400
    if mode not in MODES:
        return {"error": f"未対応のモードです: {mode}"}, 400
    # フルオート（全許可）は環境変数で明示的に有効化したときだけ許可する
    if mode == "full" and not ALLOW_FULL:
        return {"error": (
            "フルオートモードは既定で無効です。有効化するには、サーバーを "
            "ACS_ALLOW_FULL=1 を設定して起動してください"
            "（Mac: ターミナルで `ACS_ALLOW_FULL=1 python3 webapp/server.py`、"
            "または start_webapp.command をダブルクリック。"
            "Windows: PowerShell で `$env:ACS_ALLOW_FULL=1; python webapp\\server.py`）。"
            "※確認なしで全コマンドを実行するため、信頼できる作業のみで使用してください。"
        )}, 403
    if not CLAUDE_BIN:
        return {"error": "claude CLI が見つかりません。`npm install -g @anthropic-ai/claude-code` でインストールしてください"}, 500

    cmd = [
        CLAUDE_BIN, "-p",
        "--output-format", "stream-json",
        "--verbose",
    ]

    if mode == "restricted":
        # 制限モード: 6フェーズパイプラインに必要なツールだけを許可する
        allowed_tools = ",".join([
            "Read", "Write", "Edit", "Glob", "Grep",      # プロジェクト内のファイル操作
            "WebSearch", "WebFetch",                       # 競合リサーチ
            "Task", "TodoWrite",                           # 章執筆のサブエージェント・進捗
            "Bash(python:*)", "Bash(python3:*)",           # count_chars.py / post_to_note.py 等（Macはpython3）
            "Bash(mkdir:*)", "Bash(ls:*)", "Bash(cat:*)",  # フォルダ作成・確認・章結合
        ])
        cmd += ["--allowedTools", allowed_tools]
    else:
        # auto / full / plan: CLIの permission-mode に委ねる
        # full（フルオート）は全許可のため --allow-dangerously-skip-permissions も付与
        cmd += ["--permission-mode", MODES[mode]]
        if mode == "full":
            cmd += ["--dangerously-skip-permissions"]  # 旧バージョンのCLIでも通る表記

    if model:
        cmd += ["--model", model]
    if session_id:
        cmd += ["--resume", session_id]
    # メッセージは stdin で渡す
    # （可変長オプションが位置引数を誤って吸収するのを避けるため）

    def generate():
        # 診断用: 起動コマンドをサーバーのターミナルに表示
        print(f"[claude] {' '.join(cmd)}", flush=True)
        proc = subprocess.Popen(
            cmd,
            cwd=str(PROJECT_DIR),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # エラー文も同じパイプで受ける
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        proc.stdin.write(message)
        proc.stdin.close()
        sid = session_id
        got_result = False
        noise = []  # JSONとして解釈できなかった行（エラー報告用）
        try:
            for raw in proc.stdout:
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    ev = json.loads(raw)
                except json.JSONDecodeError:
                    if len(noise) < 50:
                        noise.append(raw)
                    continue

                etype = ev.get("type")
                if etype == "system" and ev.get("subtype") == "init":
                    sid = ev.get("session_id", sid)
                    yield nd({"type": "session", "session_id": sid})
                elif etype == "assistant":
                    for block in (ev.get("message") or {}).get("content", []):
                        if block.get("type") == "text" and block.get("text"):
                            yield nd({"type": "text", "text": block["text"]})
                        elif block.get("type") == "tool_use":
                            yield nd({"type": "tool", "name": block.get("name", "")})
                elif etype == "result":
                    got_result = True
                    sid = ev.get("session_id", sid)
                    yield nd({
                        "type": "done",
                        "session_id": sid,
                        "ok": ev.get("subtype") == "success",
                    })

            proc.wait()
            if not got_result:
                tail = "\n".join(noise[-10:])
                yield nd({
                    "type": "error",
                    "message": f"claude が応答せず終了しました (exit {proc.returncode})\n{tail}",
                })
        except GeneratorExit:
            # ブラウザ側が切断したらプロセスも止める
            pass
        finally:
            if proc.poll() is None:
                proc.kill()

    return Response(generate(), mimetype="application/x-ndjson")


if __name__ == "__main__":
    print("=" * 60)
    print("  AUTO-content-system Web UI")
    print(f"  http://{HOST}:{PORT} をブラウザで開いてください")
    print(f"  作業ディレクトリ: {PROJECT_DIR}")
    print(f"  claude CLI: {CLAUDE_BIN}")
    print("=" * 60)
    app.run(host=HOST, port=PORT, threaded=True)
