"""
guild/server.py - AIギルド「月光工房」ギルドホールサーバー

5人のAIメンバー（ソラ/エリカ/ナナ/ユイ/アオイ）に claude CLI で仕事を依頼し、
実際のツール使用に反応して動く「ギルドホール」画面をブラウザに提供する。

使い方:
  python guild/server.py
  → ブラウザで http://127.0.0.1:8788 を開く

仕組み:
  - 依頼ごとに `claude -p --output-format stream-json` をメンバーの役割書つきで起動
  - stream-json の tool_use イベントを「今どこで何をしているか」に変換
    （Web検索→書庫 / コマンド→工房 / サブエージェント→酒場 / 執筆→自席）
  - 成果物は guild/quests/ に frontmatter つきで納品させ、KPIボードが自動集計
"""

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

try:
    from flask import Flask, request, send_from_directory
except ImportError:
    print("=" * 60)
    print("  Flask が入っていません。先にこれを実行してください:")
    print("    Mac:     python3 -m pip install flask")
    print("    Windows: pip install flask （py環境なら py -m pip install flask）")
    print("=" * 60)
    input("Enterで閉じる")
    raise SystemExit(1)

BASE_DIR = Path(__file__).parent
PROJECT_DIR = BASE_DIR.parent  # claude の作業ディレクトリ = プロジェクトルート
QUESTS_DIR = BASE_DIR / "quests"
STATE_DIR = BASE_DIR / "state"

HOST = "127.0.0.1"  # ローカル専用。外部公開しないこと
PORT = 8788

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

CLAUDE_BIN = shutil.which("claude")

# ギルドの一日（run-day）の実行順と既定の依頼文
DAY_PLAN = [
    ("sora", "今日のネタを調達してください。AI×副業ジャンルで、初心者に刺さるトレンドを3つ。"),
    ("erika", "ソラの最新リサーチを基に、Threads/X の投稿を作ってください。"),
    ("yui", "ソラの最新リサーチを基に、無料note記事の下書きを1本書いてください。"),
    ("aoi", "ユイの最新記事とエリカの投稿を基に、収益導線とセールス文を設計してください。"),
    ("nana", "guild/quests/ にある本日の未レビュー成果物をすべて検分し、採点してください。"),
]

# ツール名 → ギルドホール内の居場所
TOOL_LOCATIONS = [
    (("WebSearch", "WebFetch"), "library", "書庫で調べ物中"),
    (("Bash",), "workshop", "工房でからくりを操作中"),
    (("Task",), "tavern", "酒場のテーブルで相談中"),
    (("Write", "Edit", "NotebookEdit"), "desk", "自席で執筆中"),
    (("Read", "Glob", "Grep", "TodoWrite"), "desk", "自席で資料を確認中"),
]

app = Flask(__name__)

_lock = threading.Lock()
_members = {}        # id -> {id,name,job,emoji,color, status, location, doing, ...}
_events = []         # 吹き出しイベント [{id, member, kind, text, ts}]
_event_seq = 0
_day_running = False


def _parse_frontmatter(text):
    """先頭の --- ブロックを dict にして返す（値はすべて文字列）。"""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    fm = {}
    if m:
        for line in m.group(1).splitlines():
            kv = re.match(r"^(\w+):\s*(.+?)\s*$", line)
            if kv:
                fm[kv.group(1)] = kv.group(2).strip().strip('"')
    return fm


def _load_members():
    for p in sorted((BASE_DIR / "members").glob("*.md")):
        fm = _parse_frontmatter(p.read_text(encoding="utf-8"))
        mid = fm.get("id") or p.stem
        _members[mid] = {
            "id": mid,
            "name": fm.get("name", mid),
            "job": fm.get("job", ""),
            "emoji": fm.get("emoji", "🙂"),
            "color": fm.get("color", "#888"),
            "status": "idle",       # idle / working / done / error
            "location": "desk",     # desk / library / workshop / tavern
            "doing": "待機中",
            "deliverable": "",
            "updated": time.time(),
            "prompt_file": str(p),
        }


def _push_event(member, kind, text):
    global _event_seq
    with _lock:
        _event_seq += 1
        _events.append({
            "id": _event_seq,
            "member": member,
            "kind": kind,  # member（納品報告）/ master（マスターの返事）
            "text": text,
            "ts": time.time(),
        })
        del _events[:-100]  # 直近100件だけ保持


def _set_member(mid, **kw):
    with _lock:
        _members[mid].update(kw, updated=time.time())


def _latest_quest_for(mid, since_ts):
    """since_ts 以降に納品されたこのメンバーの成果物の (title, filename) を返す。"""
    best = None
    for p in QUESTS_DIR.glob("*.md"):
        if p.stat().st_mtime < since_ts - 5:
            continue
        fm = _parse_frontmatter(p.read_text(encoding="utf-8"))
        if fm.get("member") == mid:
            if best is None or p.stat().st_mtime > best[0]:
                best = (p.stat().st_mtime, fm.get("title", p.stem), p.name)
    return (best[1], best[2]) if best else (None, None)


MASTER_REPLIES = [
    "確認しました。いい仕上がりですね",
    "受け取りました。掟もきちんと守れています",
    "お疲れさまです。次のクエストも頼みます",
    "拝見しました。この調子でいきましょう",
]


def _run_quest(mid, instruction):
    """1メンバーに1クエストを依頼して完了まで面倒を見る（ワーカースレッド用）。"""
    member = _members[mid]
    started = time.time()
    _set_member(mid, status="working", location="desk", doing="依頼を確認中")

    now = datetime.now()
    fname_hint = now.strftime("%Y%m%d-%H%M")
    prompt = (
        f"あなたはAIギルド「月光工房」のメンバーです。\n"
        f"1. まず {member['prompt_file']} を読み、その役割になりきってください。\n"
        f"2. 次に guild/GUILD.md（ギルド憲章）を読み、掟を厳守してください。\n"
        f"3. 参考素材が必要なら guild/quests/ の既存成果物を読んでください。\n"
        f"4. 成果物は guild/quests/{fname_hint}_{mid}_<英数字スラッグ>.md に、"
        f"憲章の「納品の作法」どおり frontmatter（member: {mid} / type / title / date"
        f"{' / score' if mid == 'nana' else ''}）つきで保存してください。\n"
        f"5. titleは吹き出しにそのまま表示されるので30字以内で。\n\n"
        f"【ギルドマスターからの依頼】\n{instruction}"
    )

    allowed_tools = ",".join([
        "Read", "Write", "Edit", "Glob", "Grep",
        "WebSearch", "WebFetch",
        "Task", "TodoWrite",
        "Bash(python:*)", "Bash(mkdir:*)", "Bash(ls:*)", "Bash(cat:*)",
    ])
    cmd = [
        CLAUDE_BIN, "-p",
        "--output-format", "stream-json", "--verbose",
        "--allowedTools", allowed_tools,
    ]

    try:
        proc = subprocess.Popen(
            cmd, cwd=str(PROJECT_DIR),
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace",
        )
        proc.stdin.write(prompt)
        proc.stdin.close()

        ok = False
        for raw in proc.stdout:
            raw = raw.strip()
            if not raw:
                continue
            try:
                ev = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if ev.get("type") == "assistant":
                for block in (ev.get("message") or {}).get("content", []):
                    if block.get("type") == "tool_use":
                        tool = block.get("name", "")
                        for names, loc, doing in TOOL_LOCATIONS:
                            if tool in names or any(tool.startswith(n) for n in names):
                                _set_member(mid, location=loc, doing=doing)
                                break
            elif ev.get("type") == "result":
                ok = ev.get("subtype") == "success"
        proc.wait()
    except Exception as e:
        _set_member(mid, status="error", location="desk", doing=f"エラー: {e}")
        _push_event(mid, "member", "すみません、途中で倒れてしまいました…")
        return

    title, fname = _latest_quest_for(mid, started)
    if ok and title:
        _set_member(mid, status="done", location="desk",
                    doing="納品完了", deliverable=title)
        _push_event(mid, "member", f"『{title}』、できました！")
        time.sleep(1.6)  # マスターが歩み寄ってから返事する“間”
        reply = MASTER_REPLIES[_event_seq % len(MASTER_REPLIES)]
        _push_event(mid, "master", f"{member['name']}、{reply}")
    elif ok:
        _set_member(mid, status="done", location="desk", doing="作業完了（納品ファイルなし）")
        _push_event(mid, "member", "作業は終えましたが、納品書が見当たりません…")
    else:
        _set_member(mid, status="error", location="desk", doing="クエスト失敗")
        _push_event(mid, "member", "クエストに失敗しました。ログを確認してください")

    # 少し置いて待機に戻す（画面上の余韻）
    time.sleep(6)
    if _members[mid]["status"] in ("done", "error"):
        _set_member(mid, status="idle", doing="待機中")


def _run_day():
    """ギルドの一日: DAY_PLAN の順に直列でクエストを回す。"""
    global _day_running
    try:
        for mid, instruction in DAY_PLAN:
            _run_quest(mid, instruction)
    finally:
        _day_running = False


@app.get("/")
def index():
    return send_from_directory(BASE_DIR / "static", "index.html")


@app.get("/api/state")
def api_state():
    after = request.args.get("after", type=int) or 0
    with _lock:
        return {
            "members": [dict(m) for m in _members.values()],
            "events": [e for e in _events if e["id"] > after],
            "day_running": _day_running,
            "claude_ready": bool(CLAUDE_BIN),
        }


@app.get("/api/kpi")
def api_kpi():
    """guild/quests/ の frontmatter からKPIを自動集計する。飾りの数字ではない。"""
    counts = {mid: {"research": 0, "post": 0, "article": 0, "sales": 0, "review": 0}
              for mid in _members}
    scores = []
    for p in QUESTS_DIR.glob("*.md"):
        fm = _parse_frontmatter(p.read_text(encoding="utf-8"))
        mid, qtype = fm.get("member"), fm.get("type")
        if mid in counts and qtype in counts[mid]:
            counts[mid][qtype] += 1
        if qtype == "review" and fm.get("score", "").isdigit():
            scores.append(int(fm["score"]))
    ledger = {"revenue": 0, "followers_threads": 0, "followers_x": 0}
    ledger_file = STATE_DIR / "ledger.json"
    if ledger_file.exists():
        try:
            ledger.update(json.loads(ledger_file.read_text(encoding="utf-8")))
        except Exception:
            pass
    return {
        "counts": counts,
        "avg_score": round(sum(scores) / len(scores)) if scores else None,
        "ledger": ledger,
        "total_quests": sum(sum(c.values()) for c in counts.values()),
    }


@app.post("/api/quest")
def api_quest():
    data = request.get_json(force=True, silent=True) or {}
    mid = (data.get("member") or "").strip()
    instruction = (data.get("instruction") or "").strip()
    if mid not in _members:
        return {"error": f"そのメンバーはいません: {mid}"}, 400
    if not instruction:
        return {"error": "依頼内容が空です"}, 400
    if not CLAUDE_BIN:
        return {"error": "claude CLI が見つかりません。`npm install -g @anthropic-ai/claude-code`"}, 500
    if _members[mid]["status"] == "working":
        return {"error": f"{_members[mid]['name']}は作業中です。完了を待ってください"}, 409
    threading.Thread(target=_run_quest, args=(mid, instruction), daemon=True).start()
    return {"ok": True}


@app.post("/api/run-day")
def api_run_day():
    global _day_running
    if not CLAUDE_BIN:
        return {"error": "claude CLI が見つかりません"}, 500
    with _lock:
        if _day_running:
            return {"error": "ギルドの一日はすでに進行中です"}, 409
        if any(m["status"] == "working" for m in _members.values()):
            return {"error": "作業中のメンバーがいます。完了を待ってください"}, 409
        _day_running = True
    threading.Thread(target=_run_day, daemon=True).start()
    return {"ok": True}


@app.get("/api/quests")
def api_quests():
    """納品済みクエスト一覧（新しい順）。"""
    items = []
    for p in QUESTS_DIR.glob("*.md"):
        fm = _parse_frontmatter(p.read_text(encoding="utf-8"))
        items.append({
            "file": p.name,
            "member": fm.get("member", ""),
            "type": fm.get("type", ""),
            "title": fm.get("title", p.stem),
            "date": fm.get("date", ""),
            "score": fm.get("score", ""),
            "mtime": p.stat().st_mtime,
        })
    items.sort(key=lambda x: -x["mtime"])
    return {"quests": items[:50]}


@app.get("/api/quest-file")
def api_quest_file():
    name = request.args.get("name", "")
    if "/" in name or "\\" in name or not name.endswith(".md"):
        return {"error": "不正なファイル名です"}, 400
    p = QUESTS_DIR / name
    if not p.is_file():
        return {"error": "ファイルが見つかりません"}, 404
    return {"content": p.read_text(encoding="utf-8")}


if __name__ == "__main__":
    QUESTS_DIR.mkdir(exist_ok=True)
    STATE_DIR.mkdir(exist_ok=True)
    _load_members()
    print("=" * 60)
    print("  AIギルド「月光工房」ギルドホール")
    print(f"  http://{HOST}:{PORT} をブラウザで開いてください")
    print(f"  作業ディレクトリ: {PROJECT_DIR}")
    print(f"  claude CLI: {CLAUDE_BIN}")
    print("=" * 60)
    app.run(host=HOST, port=PORT, threaded=True)
