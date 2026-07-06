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
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "threads_config.json"
API_BASE = "https://graph.threads.net/v1.0"

# Threads の1投稿あたりの文字数上限
POST_CHAR_LIMIT = 500


class ThreadsError(RuntimeError):
    """Threads API のエラー（メッセージに原因を含める）"""


# ==============================
# 設定ファイル（複数アカウント対応・最大10個）
# ==============================
# 新形式: {"current": "<user_id>", "accounts": [{access_token, user_id, username, ...}]}
# 旧形式（単一アカウント）は読み込み時に自動で移行する。

MAX_ACCOUNTS = 10
_CFG_LOCK = threading.Lock()


def _read_config_file() -> dict:
    if not CONFIG_PATH.exists():
        return {}
    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _write_config_file(data: dict):
    CONFIG_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _migrated() -> dict:
    """設定を新形式（複数アカウント）で返す。旧形式なら変換する。"""
    data = _read_config_file()
    if "accounts" in data:
        return data
    if data.get("access_token") and data.get("user_id"):
        return {"current": data["user_id"], "accounts": [data]}
    return {"current": None, "accounts": []}


def list_accounts() -> dict:
    """{"current": user_id, "accounts": [...]}（トークンを含むので外部にそのまま出さない）"""
    return _migrated()


def get_account(user_id: str):
    """user_id のアカウント設定を返す。無ければ None"""
    for a in _migrated().get("accounts", []):
        if a.get("user_id") == user_id:
            return a
    return None


def load_config() -> dict:
    """現在選択中のアカウント設定を返す（従来と同じ形の dict）"""
    data = _migrated()
    accounts = data.get("accounts", [])
    if not accounts:
        raise ThreadsError(
            "Threadsが未設定です。Web UIの「🧵 Threads」画面から、"
            "または `python setup_threads.py`（Macは python3）でトークンを登録してください。"
        )
    cur = data.get("current")
    for a in accounts:
        if a.get("user_id") == cur:
            return a
    return accounts[0]


def save_config(cfg: dict):
    """アカウントを追加/更新して現在のアカウントにする（旧APIとの互換用）"""
    add_account(cfg)


def add_account(cfg: dict) -> dict:
    """アカウントを追加（同じuser_idは上書き）して current に設定する"""
    if not cfg.get("access_token") or not cfg.get("user_id"):
        raise ThreadsError("アカウント情報が不完全です（トークン/ユーザーID）")
    with _CFG_LOCK:
        data = _migrated()
        accounts = data.get("accounts", [])
        for i, a in enumerate(accounts):
            if a.get("user_id") == cfg["user_id"]:
                accounts[i] = cfg
                break
        else:
            if len(accounts) >= MAX_ACCOUNTS:
                raise ThreadsError(f"登録できるアカウントは最大{MAX_ACCOUNTS}個です。"
                                   "不要なアカウントを削除してから追加してください。")
            accounts.append(cfg)
        data["accounts"] = accounts
        data["current"] = cfg["user_id"]
        _write_config_file(data)
    return cfg


def set_current_account(user_id: str) -> dict:
    """現在のアカウントを切り替える"""
    with _CFG_LOCK:
        data = _migrated()
        if not any(a.get("user_id") == user_id for a in data.get("accounts", [])):
            raise ThreadsError("そのアカウントは登録されていません")
        data["current"] = user_id
        _write_config_file(data)
    return get_account(user_id)


def remove_account(user_id: str) -> bool:
    with _CFG_LOCK:
        data = _migrated()
        accounts = [a for a in data.get("accounts", []) if a.get("user_id") != user_id]
        if len(accounts) == len(data.get("accounts", [])):
            return False
        data["accounts"] = accounts
        if data.get("current") == user_id:
            data["current"] = accounts[0]["user_id"] if accounts else None
        _write_config_file(data)
    return True


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

    def _attach_insights(p):
        try:
            p["insights"] = get_post_insights(cfg, p["id"])
        except ThreadsError:
            p["insights"] = {}

    # 1投稿=1リクエストのため並列化して高速化（投稿25件で数秒程度に）
    with ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(_attach_insights, posts))
    posts.sort(key=lambda p: p["insights"].get(sort, 0), reverse=True)
    return posts[:top] if top else posts


def keyword_search(cfg: dict, query: str, search_type: str = "TOP", limit: int = 25) -> list:
    """公開投稿のキーワード検索（他人の投稿を含む）。

    search_type: "TOP"（Threads公式の人気順） / "RECENT"（新着順）
    トークンに threads_keyword_search 権限が必要。
    ※他人の投稿のインプレッション数は非公開のため取得できない（Threadsの仕様）。
      like_count はAPIが返す場合のみ含まれる。
    """
    base = {
        "q": query,
        "search_type": search_type,
        "limit": min(max(limit, 1), 50),
        "access_token": cfg["access_token"],
    }
    fields_rich = "id,text,timestamp,permalink,username,media_type,like_count"
    fields_min = "id,text,timestamp,permalink,username,media_type"
    try:
        d = _request("GET", "/keyword_search", dict(base, fields=fields_rich))
    except ThreadsError:
        # like_count 非対応の環境向けフォールバック（権限エラー等はここで再度発生して伝わる）
        d = _request("GET", "/keyword_search", dict(base, fields=fields_min))
    return d.get("data", [])


def get_user_insights(cfg: dict, days: int = 30) -> dict:
    """アカウント全体のインサイト（Growth Hub用）。
    views/likes等は期間の合計、followers_count は現在のフォロワー数。"""
    since = int(time.time()) - days * 86400
    params = {
        "metric": "views,likes,replies,reposts,quotes,followers_count",
        "since": since,
        "access_token": cfg["access_token"],
    }
    try:
        d = _request("GET", f"/{cfg['user_id']}/threads_insights", params)
    except ThreadsError:
        # followers_count 非対応のアカウント向けフォールバック
        params["metric"] = "views,likes,replies,reposts,quotes"
        d = _request("GET", f"/{cfg['user_id']}/threads_insights", params)
    out = {}
    for item in d.get("data", []):
        name = item.get("name")
        if isinstance(item.get("total_value"), dict):
            out[name] = item["total_value"].get("value", 0)
        else:
            out[name] = sum(v.get("value", 0) for v in (item.get("values") or []))
    return out


# ==============================
# 予約投稿（ローカルスケジュール）
# ==============================
# threads_schedule.json に予約を保存し、Webアプリのサーバーが定期チェックして
# 予約時刻を過ぎたものを自動投稿する（サーバー起動中のみ実行される）。

SCHEDULE_PATH = BASE_DIR / "threads_schedule.json"
_SCHED_LOCK = threading.Lock()


def load_schedule() -> list:
    if not SCHEDULE_PATH.exists():
        return []
    try:
        return json.loads(SCHEDULE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_schedule(items: list):
    SCHEDULE_PATH.write_text(
        json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_local_time(at_iso: str) -> float:
    """'YYYY-MM-DDTHH:MM'（ローカル時刻）→ epoch秒。不正な形式は ValueError"""
    return time.mktime(time.strptime(at_iso[:16], "%Y-%m-%dT%H:%M"))


def add_schedule(text: str, at_iso: str, user_id: str = None, username: str = "") -> dict:
    """予約を追加して保存する（時刻の妥当性は呼び出し側で検証済みの前提）。
    user_id を渡すと「予約したときのアカウント」で投稿される。"""
    item = {
        "id": str(int(time.time() * 1000)),
        "text": text,
        "at": at_iso[:16],
        "status": "pending",
        "created_at": int(time.time()),
        "user_id": user_id,
        "username": username,
    }
    with _SCHED_LOCK:
        items = load_schedule()
        items.append(item)
        _save_schedule(items)
    return item


def cancel_schedule(sched_id: str) -> bool:
    with _SCHED_LOCK:
        items = load_schedule()
        for it in items:
            if it.get("id") == sched_id and it.get("status") == "pending":
                items.remove(it)
                _save_schedule(items)
                return True
    return False


def process_due_posts() -> list:
    """予約時刻を過ぎた pending を投稿する。処理した項目のリストを返す。

    投稿（ネットワーク処理）はロックの外で行い、予約の追加/取消をブロックしない。
    """
    if not is_configured():
        return []
    now = time.time()

    # 1) 期限が来た予約に「posting」の印を付ける（ロック内・軽い処理のみ）
    with _SCHED_LOCK:
        items = load_schedule()
        due, changed = [], False
        for it in items:
            status = it.get("status")
            # サーバーが投稿中に落ちた場合の残骸を回収（10分以上 posting のまま）
            if status == "posting" and now - it.get("posting_at", 0) > 600:
                it["status"] = "failed"
                it["error"] = "投稿処理が中断されました。もう一度予約してください"
                changed = True
                continue
            if status != "pending":
                continue
            try:
                due_time = parse_local_time(it.get("at", ""))
            except (ValueError, KeyError):
                it["status"] = "failed"
                it["error"] = "予約時刻の形式が不正です"
                changed = True
                continue
            if due_time <= now:
                it["status"] = "posting"
                it["posting_at"] = int(now)
                due.append(dict(it))
                changed = True
        if changed:
            _save_schedule(items)

    # 2) 投稿はロックの外で実行（予約したときのアカウントを使う）
    results = []
    for it in due:
        upd = {"id": it["id"]}
        try:
            cfg = get_account(it.get("user_id")) if it.get("user_id") else load_config()
            if cfg is None:
                raise ThreadsError("投稿するアカウントが見つかりません（削除された可能性があります）")
            ids = publish_thread(cfg, it["text"])
            upd.update(status="posted", posted_at=int(time.time()),
                       count=len(ids), permalink=get_permalink(cfg, ids[0]))
        except ThreadsError as e:
            upd.update(status="failed", error=str(e))
        results.append(upd)

    # 3) 結果を書き戻す
    if results:
        with _SCHED_LOCK:
            items = load_schedule()
            by_id = {u["id"]: u for u in results}
            for it in items:
                if it.get("id") in by_id:
                    it.update(by_id[it["id"]])
            _save_schedule(items)
    return results


# ==============================
# 投稿
# ==============================

def split_text(text: str, limit: int = POST_CHAR_LIMIT) -> list:
    """ツリー投稿用にテキストを分割する。

    1. `---` だけの行があれば、そこで**手動分割**（ツリーの区切りを自由に設定できる）
    2. 各パートが500字を超える場合のみ、段落→行の区切りで自動分割
    """
    parts, cur = [], []
    for line in (text or "").strip().split("\n"):
        if line.strip() == "---":
            parts.append("\n".join(cur))
            cur = []
        else:
            cur.append(line)
    parts.append("\n".join(cur))

    chunks = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(part) <= limit:
            chunks.append(part)
        else:
            chunks.extend(_auto_split(part, limit))
    return chunks


def _auto_split(text: str, limit: int = POST_CHAR_LIMIT) -> list:
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
