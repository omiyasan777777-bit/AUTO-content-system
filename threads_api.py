"""
threads_api.py - Threads（Meta）公式APIクライアント

Threads API（graph.threads.net）で以下を行う共通モジュール:
  - 自分の投稿一覧＋インサイト（views / likes / replies / reposts / quotes）の取得
  - テキスト投稿（500字超は自動でツリー連投に分割）
  - 長期トークンへの交換・リフレッシュ

設定は threads_config.json に保存する（setup_threads.py で作成）。
このファイルはアクセストークンを含むため git 管理しないこと（.gitignore 済み）。
"""

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "threads_config.json"
API_BASE = "https://graph.threads.net/v1.0"

# Threads の1投稿あたりの文字数上限
POST_CHAR_LIMIT = 500


class ThreadsError(RuntimeError):
    """Threads API のエラー（メッセージに原因を含める）"""


# ==============================
# 設定ファイル
# ==============================

def load_config() -> dict:
    if not CONFIG_PATH.exists():
        raise ThreadsError(
            "Threadsが未設定です。`python setup_threads.py`（Macは python3）を実行して"
            "アクセストークンを登録してください。"
        )
    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if not cfg.get("access_token") or not cfg.get("user_id"):
        raise ThreadsError("threads_config.json が不完全です。setup_threads.py をやり直してください。")
    return cfg


def save_config(cfg: dict):
    CONFIG_PATH.write_text(
        json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def is_configured() -> bool:
    try:
        load_config()
        return True
    except ThreadsError:
        return False


# ==============================
# HTTP
# ==============================

def _request(method: str, path: str, params: dict) -> dict:
    """Graph API を呼び出して JSON を返す。エラーは ThreadsError。"""
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    url = API_BASE + path
    if method == "GET":
        req = urllib.request.Request(url + "?" + query)
    else:
        req = urllib.request.Request(url, data=query.encode("utf-8"), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode("utf-8"))
            msg = (body.get("error") or {}).get("message") or str(body)
        except Exception:
            msg = str(e)
        raise ThreadsError(f"Threads API エラー: {msg}") from e
    except urllib.error.URLError as e:
        raise ThreadsError(f"Threads API に接続できません: {e.reason}") from e


# ==============================
# 認証・トークン
# ==============================

def get_me(access_token: str) -> dict:
    """トークンの持ち主（自分）のプロフィールを返す"""
    return _request("GET", "/me", {
        "fields": "id,username",
        "access_token": access_token,
    })


def exchange_long_lived_token(short_token: str, app_secret: str) -> dict:
    """短期トークン → 長期トークン（約60日）に交換"""
    return _request("GET", "/access_token", {
        "grant_type": "th_exchange_token",
        "client_secret": app_secret,
        "access_token": short_token,
    })


def refresh_long_lived_token(cfg: dict) -> dict:
    """長期トークンを更新して設定に保存（有効期限を60日延長）"""
    d = _request("GET", "/refresh_access_token", {
        "grant_type": "th_refresh_token",
        "access_token": cfg["access_token"],
    })
    cfg["access_token"] = d["access_token"]
    cfg["expires_in"] = d.get("expires_in")
    cfg["obtained_at"] = int(time.time())
    save_config(cfg)
    return cfg


# ==============================
# 投稿一覧・インサイト
# ==============================

def get_my_posts(cfg: dict, days: int = 30, limit: int = 25) -> list:
    """自分の投稿一覧（新しい順）。days 日以内・最大 limit 件。"""
    params = {
        "fields": "id,text,timestamp,permalink,media_type",
        "limit": min(max(limit, 1), 100),
        "access_token": cfg["access_token"],
    }
    if days:
        params["since"] = int(time.time()) - days * 86400
    d = _request("GET", f"/{cfg['user_id']}/threads", params)
    return d.get("data", [])


def get_post_insights(cfg: dict, media_id: str) -> dict:
    """1投稿のインサイト {views, likes, replies, reposts, quotes, shares} を返す"""
    metrics = "views,likes,replies,reposts,quotes,shares"
    try:
        d = _request("GET", f"/{media_id}/insights", {
            "metric": metrics, "access_token": cfg["access_token"],
        })
    except ThreadsError:
        # shares 未対応のアカウント向けフォールバック
        d = _request("GET", f"/{media_id}/insights", {
            "metric": "views,likes,replies,reposts,quotes",
            "access_token": cfg["access_token"],
        })
    out = {}
    for item in d.get("data", []):
        name = item.get("name")
        if isinstance(item.get("total_value"), dict):
            out[name] = item["total_value"].get("value", 0)
        else:
            vals = item.get("values") or [{}]
            out[name] = vals[0].get("value", 0)
    return out


def fetch_ranked_posts(cfg: dict, days: int = 30, top: int = 10,
                       sort: str = "views", max_posts: int = 25) -> list:
    """インサイト付きの自分の投稿を sort（views / likes …）の降順で返す"""
    posts = get_my_posts(cfg, days=days, limit=max_posts)
    for p in posts:
        try:
            p["insights"] = get_post_insights(cfg, p["id"])
        except ThreadsError:
            p["insights"] = {}
    posts.sort(key=lambda p: p["insights"].get(sort, 0), reverse=True)
    return posts[:top] if top else posts


# ==============================
# 投稿
# ==============================

def split_text(text: str, limit: int = POST_CHAR_LIMIT) -> list:
    """500字上限に収まるように、段落→行の区切りを優先して分割する"""
    text = text.strip()
    if len(text) <= limit:
        return [text] if text else []
    chunks, current = [], ""
    for para in text.split("\n\n"):
        candidate = (current + "\n\n" + para) if current else para
        if len(candidate) <= limit:
            current = candidate
            continue
        if current:
            chunks.append(current)
            current = ""
        if len(para) <= limit:
            current = para
            continue
        # 1段落でも上限を超える場合は行→強制分割
        for line in para.split("\n"):
            candidate = (current + "\n" + line) if current else line
            if len(candidate) <= limit:
                current = candidate
                continue
            if current:
                chunks.append(current)
                current = ""
            while len(line) > limit:
                chunks.append(line[:limit])
                line = line[limit:]
            current = line
    if current:
        chunks.append(current)
    return chunks


def _create_container(cfg: dict, text: str, reply_to_id: str = None) -> str:
    d = _request("POST", f"/{cfg['user_id']}/threads", {
        "media_type": "TEXT",
        "text": text,
        "reply_to_id": reply_to_id,
        "access_token": cfg["access_token"],
    })
    return d["id"]


def _publish_container(cfg: dict, creation_id: str) -> str:
    d = _request("POST", f"/{cfg['user_id']}/threads_publish", {
        "creation_id": creation_id,
        "access_token": cfg["access_token"],
    })
    return d["id"]


def get_permalink(cfg: dict, media_id: str) -> str:
    try:
        d = _request("GET", f"/{media_id}", {
            "fields": "permalink", "access_token": cfg["access_token"],
        })
        return d.get("permalink", "")
    except ThreadsError:
        return ""


def publish_text(cfg: dict, text: str, reply_to_id: str = None) -> str:
    """1投稿（500字以内）を公開して投稿IDを返す"""
    if len(text) > POST_CHAR_LIMIT:
        raise ThreadsError(f"1投稿は{POST_CHAR_LIMIT}字までです（{len(text)}字）。publish_thread を使ってください。")
    container = _create_container(cfg, text, reply_to_id=reply_to_id)
    time.sleep(2)  # コンテナ処理待ち（公式推奨）
    return _publish_container(cfg, container)


def publish_thread(cfg: dict, text: str) -> list:
    """長文を自動分割してツリー（連投）で公開。投稿IDのリストを返す"""
    chunks = split_text(text)
    if not chunks:
        raise ThreadsError("投稿するテキストが空です。")
    ids, parent = [], None
    for chunk in chunks:
        post_id = publish_text(cfg, chunk, reply_to_id=parent)
        ids.append(post_id)
        parent = post_id
        if len(chunks) > 1:
            time.sleep(3)  # 連投の間隔
    return ids
