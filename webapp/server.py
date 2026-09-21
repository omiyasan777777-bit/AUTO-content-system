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
from pathlib import Path

from flask import Flask, Response, request, send_from_directory

BASE_DIR = Path(__file__).parent
PROJECT_DIR = BASE_DIR.parent  # claude の作業ディレクトリ = プロジェクトルート

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
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # アップロード上限 20MB（参考画像用）


def nd(obj) -> str:
    """NDJSON 1行分"""
    return json.dumps(obj, ensure_ascii=False) + "\n"


@app.get("/")
def index():
    return send_from_directory(BASE_DIR / "static", "index.html")


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

# プロジェクト（＝ワーキングフォルダ）を入れる専用コンテナ。
# 構造: projects/<アカウント>/<プロジェクト>/  （アカウント単位で成果物を分ける）
PROJECTS_DIR = PROJECT_DIR / "projects"
ACCOUNTS_FILE = PROJECT_DIR / "accounts.json"


def _sanitize_folder_name(name: str) -> str:
    """プロジェクト名／アカウント名をパス安全なフォルダ名に整える。
    日本語はそのまま残し、ファイル名禁則文字と空白だけ除去する。"""
    name = re.sub(r'[\\/:*?"<>|]+', "", name)  # Windows のファイル名禁則文字
    name = re.sub(r"\s+", "", name)             # 空白は除去（シェル引数の事故防止）
    name = name.strip(" .")                      # 末尾の空白・ドット
    return name[:40]


def _project_dirs(account: str = None):
    """projects/<アカウント>/<プロジェクト> 形式の全プロジェクトフォルダを返す。
    account を指定するとそのアカウント配下のみ。"""
    out = []
    if PROJECTS_DIR.is_dir():
        if account:
            accts = [PROJECTS_DIR / account]
        else:
            accts = [p for p in PROJECTS_DIR.iterdir() if p.is_dir()]
        for adir in accts:
            if adir.is_dir():
                out += [p for p in adir.iterdir() if p.is_dir()]
    return out


def _work_dirs():
    """全ワーキングフォルダ（projects/<アカウント>/<プロジェクト> と旧式 output*）。"""
    return _project_dirs() + [p for p in PROJECT_DIR.glob("output*") if p.is_dir()]


def _valid_workdir(rel: str):
    """`?dir=` 等で渡された相対フォルダ名を検証し、プロジェクト内なら Path を返す。
    形式は projects/<アカウント>/<プロジェクト> または output / output2 … のみ許可。"""
    rel = (rel or "").strip().strip("/\\").replace("\\", "/")
    if not re.match(r"^(projects/[^/]+/[^/]+|output\d*)$", rel):
        return None
    cand = (PROJECT_DIR / rel).resolve()
    try:
        cand.relative_to(PROJECT_DIR.resolve())
    except ValueError:
        return None
    return cand


# ---- アカウント管理（accounts.json） ----

def _load_accounts():
    """accounts.json を読み、各アカウントに folder（保存先フォルダ名）を補完して返す。"""
    try:
        data = json.loads(ACCOUNTS_FILE.read_text(encoding="utf-8"))
    except Exception:
        data = {}
    accts = data.get("accounts") or []
    used = set()
    for a in accts:
        folder = (a.get("folder") or "").strip()
        if not folder:
            folder = _sanitize_folder_name(a.get("name") or a.get("profile") or "account") or "account"
        # フォルダ名の重複を避ける
        base, k = folder, 2
        while folder in used:
            folder = f"{base}-{k}"
            k += 1
        used.add(folder)
        a["folder"] = folder
    if not accts:
        accts = [{"profile": "Profile 1", "name": "メインアカウント", "folder": "メインアカウント"}]
    current = data.get("current") or accts[0]["profile"]
    return {"current": current, "accounts": accts}


def _save_accounts(data):
    ACCOUNTS_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _current_account(data=None):
    """現在選択中のアカウント（dict）を返す。"""
    data = data or _load_accounts()
    for a in data["accounts"]:
        if a["profile"] == data["current"]:
            return a
    return data["accounts"][0]


@app.get("/api/accounts")
def api_accounts():
    """登録アカウント一覧と現在選択中アカウントを返す。"""
    return _load_accounts()


@app.post("/api/accounts/current")
def api_accounts_current():
    """現在のアカウント（投稿・新規プロジェクトの所属先）を切り替える。"""
    body = request.get_json(force=True, silent=True) or {}
    profile = (body.get("profile") or "").strip()
    data = _load_accounts()
    if not any(a["profile"] == profile for a in data["accounts"]):
        return {"error": "未登録のアカウントです"}, 400
    data["current"] = profile
    _save_accounts(data)
    return {"ok": True, "current": profile, "account": _current_account(data)}


@app.post("/api/accounts/add")
def api_accounts_add():
    """アカウントを追加する。次の空き Chrome プロファイルを自動割当し、保存先フォルダも用意する。
    （note.com への実ログインは別途「セットアップ」で setup_note.py を実行する）"""
    body = request.get_json(force=True, silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return {"error": "アカウント名が空です"}, 400
    data = _load_accounts()
    # 次の空き "Profile N" を決める
    used_profiles = {a["profile"] for a in data["accounts"]}
    n = 1
    while f"Profile {n}" in used_profiles:
        n += 1
    profile = f"Profile {n}"
    # 重複しないフォルダ名
    used_folders = {a["folder"] for a in data["accounts"]}
    base = _sanitize_folder_name(name) or f"account{n}"
    folder, k = base, 2
    while folder in used_folders or (PROJECTS_DIR / folder).exists():
        folder = f"{base}-{k}"
        k += 1
    acct = {"profile": profile, "name": name, "folder": folder}
    data["accounts"].append(acct)
    data["current"] = profile          # 追加したら自動で選択状態にする
    _save_accounts(data)
    try:
        (PROJECTS_DIR / folder).mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    return {"ok": True, "account": acct, "current": profile}


@app.post("/api/accounts/delete")
def api_accounts_delete():
    """アカウントを削除する。最後の1件は削除不可。
    成果物フォルダ projects/<folder>/ は安全のため消さない（空のときだけ削除）。
    プロジェクトが残っている場合は kept=True とプロジェクト数を返し、フォルダは保持する。"""
    body = request.get_json(force=True, silent=True) or {}
    profile = (body.get("profile") or "").strip()
    data = _load_accounts()
    target = next((a for a in data["accounts"] if a["profile"] == profile), None)
    if target is None:
        return {"error": "未登録のアカウントです"}, 400
    if len(data["accounts"]) <= 1:
        return {"error": "最後のアカウントは削除できません"}, 400

    folder = target["folder"]
    adir = PROJECTS_DIR / folder
    project_count = len([p for p in adir.iterdir() if p.is_dir()]) if adir.is_dir() else 0
    kept = project_count > 0
    if adir.is_dir() and not kept:
        try:
            adir.rmdir()           # 空のときだけ削除
        except Exception:
            pass

    data["accounts"] = [a for a in data["accounts"] if a["profile"] != profile]
    if data["current"] == profile:
        data["current"] = data["accounts"][0]["profile"]
    _save_accounts(data)
    return {"ok": True, "current": data["current"], "account": _current_account(data),
            "removed": target, "keptFolder": kept, "projectCount": project_count}


@app.get("/api/projects")
def api_projects():
    """プロジェクトフォルダ（空でも含む）を古い順→新しい順で返す。
    `?account=<フォルダ名>` でそのアカウント配下のみに絞る。起動時のタブ復元に使う。"""
    account = (request.args.get("account") or "").strip() or None
    result = []
    for p in sorted(_project_dirs(account), key=lambda x: x.stat().st_mtime):
        has_files = any((p / n).exists() for n in EDITABLE_FILES)
        result.append({
            "name": p.name,
            "account": p.parent.name,
            "folder": f"projects/{p.parent.name}/{p.name}",
            "hasFiles": has_files,
        })
    return {"projects": result}


@app.get("/api/content-files")
def api_content_files():
    """ワーキングフォルダ（projects/* と旧式 output*）と、その中の編集対象ファイル一覧を返す。
    folder は projects/<名前> のようなプロジェクト相対パス。古い順→新しい順で並べる。"""
    result = []
    for p in sorted(_work_dirs(), key=lambda x: x.stat().st_mtime):
        files = [n for n in EDITABLE_FILES if (p / n).exists()]
        if files:
            rel = p.relative_to(PROJECT_DIR).as_posix()
            result.append({"folder": rel, "files": files})
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
    """最新のワーキングフォルダ（更新時刻が一番新しいもの）を返す。無ければ None。"""
    dirs = _work_dirs()
    if not dirs:
        return None
    return max(dirs, key=lambda p: p.stat().st_mtime)


@app.post("/api/new-workfolder")
def api_new_workfolder():
    """プロジェクト名から projects/<アカウント>/<プロジェクト>/ を作成し、相対パスを返す。
    account 未指定なら現在のアカウント配下に作る。名前が空なら project1, project2 … と自動採番。"""
    data = request.get_json(force=True, silent=True) or {}
    # 所属アカウント（フォルダ名）を決定
    acct_folder = (data.get("account") or "").strip()
    accts = _load_accounts()
    if not any(a["folder"] == acct_folder for a in accts["accounts"]):
        acct_folder = _current_account(accts)["folder"]
    adir = PROJECTS_DIR / acct_folder
    try:
        adir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        return {"error": str(e)}, 500

    base = _sanitize_folder_name(data.get("name") or "")
    if not base:
        n = 0
        for p in adir.glob("project*"):
            m = re.match(r"^project(\d+)$", p.name)
            if m:
                n = max(n, int(m.group(1)))
        base = f"project{n + 1}"

    name, k = base, 2
    while (adir / name).exists():
        name = f"{base}-{k}"
        k += 1
    try:
        (adir / name).mkdir()
    except Exception as e:
        return {"error": str(e)}, 500
    return {"ok": True, "folder": f"projects/{acct_folder}/{name}",
            "name": name, "account": acct_folder}


# ---- プロジェクトのメタ情報（投稿ステータス等） ----

META_FIELDS = ["status", "url", "price", "postedAt", "memo"]


def _meta_path(d):
    return d / ".project.json"


def _load_meta(d):
    base = {k: "" for k in META_FIELDS}
    try:
        base.update(json.loads(_meta_path(d).read_text(encoding="utf-8")))
    except Exception:
        pass
    return {k: base.get(k, "") for k in META_FIELDS}


def _save_meta(d, incoming):
    cur = _load_meta(d)
    for k in META_FIELDS:
        if k in incoming and incoming[k] is not None:
            cur[k] = incoming[k]
    _meta_path(d).write_text(json.dumps(cur, ensure_ascii=False, indent=2), encoding="utf-8")
    return cur


def _is_project_dir(cand):
    """cand が projects/<アカウント>/<プロジェクト> 形式の実在ディレクトリかを検証。"""
    if cand is None or not cand.is_dir():
        return False
    try:
        return cand.parent.parent == PROJECTS_DIR.resolve()
    except Exception:
        return False


@app.route("/api/project-meta", methods=["GET", "POST"])
def api_project_meta():
    """プロジェクトの投稿ステータス等メタ情報の取得／保存。"""
    if request.method == "POST":
        body = request.get_json(force=True, silent=True) or {}
        cand = _valid_workdir(body.get("dir"))
        if cand is None or not cand.is_dir():
            return {"error": "プロジェクトが不正です"}, 400
        return {"ok": True, "meta": _save_meta(cand, body)}
    cand = _valid_workdir(request.args.get("dir"))
    if cand is None or not cand.is_dir():
        return {"error": "プロジェクトが不正です"}, 400
    return {"meta": _load_meta(cand)}


@app.get("/api/dashboard")
def api_dashboard():
    """全アカウント横断で、各プロジェクトの進捗・投稿ステータスを集約して返す。"""
    accts = _load_accounts()
    name_by_folder = {a["folder"]: a["name"] for a in accts["accounts"]}
    rows = []
    for p in sorted(_project_dirs(), key=lambda x: x.stat().st_mtime, reverse=True):
        done = sum(1 for n in EDITABLE_FILES if (p / n).exists())
        meta = _load_meta(p)
        acct_folder = p.parent.name
        rows.append({
            "account": acct_folder,
            "accountName": name_by_folder.get(acct_folder, acct_folder),
            "name": p.name,
            "folder": f"projects/{acct_folder}/{p.name}",
            "done": done,
            "total": len(EDITABLE_FILES),
            "status": meta["status"],
            "url": meta["url"],
            "price": meta["price"],
            "postedAt": meta["postedAt"],
        })
    return {"current": _current_account(accts)["folder"], "projects": rows}


@app.post("/api/projects/rename")
def api_projects_rename():
    """プロジェクトフォルダを同じアカウント内でリネームする。"""
    body = request.get_json(force=True, silent=True) or {}
    cand = _valid_workdir(body.get("dir"))
    if not _is_project_dir(cand):
        return {"error": "プロジェクトが不正です"}, 400
    new = _sanitize_folder_name(body.get("name") or "")
    if not new:
        return {"error": "新しい名前が空です"}, 400
    dest = cand.parent / new
    if dest.exists():
        return {"error": "同じ名前のプロジェクトが既にあります"}, 400
    try:
        cand.rename(dest)
    except Exception as e:
        return {"error": str(e)}, 500
    return {"ok": True, "folder": dest.relative_to(PROJECT_DIR).as_posix(),
            "name": new, "account": dest.parent.name}


@app.post("/api/projects/duplicate")
def api_projects_duplicate():
    """プロジェクトを複製する（同じアカウント内に「<名前>-copy」等で作成）。テンプレ流用向け。"""
    body = request.get_json(force=True, silent=True) or {}
    cand = _valid_workdir(body.get("dir"))
    if not _is_project_dir(cand):
        return {"error": "プロジェクトが不正です"}, 400
    base = _sanitize_folder_name(body.get("name") or "") or (cand.name + "-copy")
    dest = cand.parent / base
    k = 2
    while dest.exists():
        dest = cand.parent / f"{base}-{k}"
        k += 1
    try:
        # .project.json（投稿ステータス）は複製しない＝新規プロジェクト扱い
        shutil.copytree(cand, dest, ignore=shutil.ignore_patterns(".project.json"))
    except Exception as e:
        return {"error": str(e)}, 500
    return {"ok": True, "folder": dest.relative_to(PROJECT_DIR).as_posix(),
            "name": dest.name, "account": dest.parent.name}


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
    req_dir = (request.args.get("dir") or "").strip().strip("/\\").replace("\\", "/")
    folder = None
    fname = None
    if req_dir:
        cand = _valid_workdir(req_dir)
        if cand is not None:
            # 指定フォルダがまだ空（新規作成直後）でも、フォルダ名は返して全カードを未完了表示にする
            fname = cand.relative_to(PROJECT_DIR).as_posix()
            if cand.is_dir():
                folder = cand
    else:
        folder = _latest_output_dir()
        fname = folder.relative_to(PROJECT_DIR).as_posix() if folder else None
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
    # 安全のため「projects/<アカウント>/<プロジェクト>/<編集対象md>」「output*/<編集対象md>」または「knowledge/*.md」のみ許可
    is_output = (target.suffix == ".md" and target.name in EDITABLE_FILES
                 and (target.parent.name.startswith("output")
                      or target.parent.parent.parent.name == "projects"))
    is_knowledge = (target.suffix == ".md" and target.parent.name == "knowledge"
                    and target.name != "index.md")
    is_template = (target.suffix == ".md" and target.parent.name == "sales_templates"
                   and target.name != "index.md")
    if not (is_output or is_knowledge or is_template):
        return {"error": "このファイルは編集できません"}, 403
    target.write_text(content, encoding="utf-8")
    return {"ok": True, "saved": str(target)}


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}


@app.post("/api/upload-image")
def api_upload_image():
    """参考画像をプロジェクトの attachments/ に保存し、相対パスを返す。
    AI はこのパスを Read ツールで読み取って制作の参考にする。"""
    rel = (request.form.get("dir") or "").strip()
    cand = _valid_workdir(rel)
    if cand is None or not cand.is_dir():
        return {"error": "プロジェクトフォルダが不正です（先にプロジェクトを作成してください）"}, 400
    f = request.files.get("file")
    if not f or not f.filename:
        return {"error": "ファイルがありません"}, 400
    stem, ext = os.path.splitext(f.filename)
    ext = ext.lower()
    if ext not in IMAGE_EXTS:
        return {"error": "画像ファイル（png/jpg/gif/webp/bmp）のみ対応です"}, 400
    adir = cand / "attachments"
    try:
        adir.mkdir(exist_ok=True)
    except Exception as e:
        return {"error": str(e)}, 500
    safe = _sanitize_folder_name(stem) or "image"
    name, k = safe + ext, 2
    while (adir / name).exists():
        name = f"{safe}-{k}{ext}"
        k += 1
    try:
        f.save(str(adir / name))
    except Exception as e:
        return {"error": str(e)}, 500
    return {"ok": True, "path": (adir / name).relative_to(PROJECT_DIR).as_posix(), "name": name}


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
            "（例: PowerShell で `$env:ACS_ALLOW_FULL=1; python webapp\\server.py`）。"
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
            "Bash(python:*)",                              # count_chars.py / post_to_note.py 等
            "Bash(mkdir:*)", "Bash(ls:*)", "Bash(cat:*)",  # フォルダ作成・確認・章結合
        ])
        cmd += ["--allowedTools", allowed_tools]
    else:
        # auto / full / plan: CLIの permission-mode に委ねる
        # full（フルオート）は全許可のため --allow-dangerously-skip-permissions も付与
        cmd += ["--permission-mode", MODES[mode]]
        if mode == "full":
            cmd += ["--allow-dangerously-skip-permissions"]

    if model:
        cmd += ["--model", model]
    if session_id:
        cmd += ["--resume", session_id]
    # メッセージは stdin で渡す
    # （可変長オプションが位置引数を誤って吸収するのを避けるため）

    def generate():
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
