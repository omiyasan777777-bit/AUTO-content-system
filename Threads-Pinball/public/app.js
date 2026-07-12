// UI ロジック — サーバーの /api/state と同期し、アカウント別の予約一覧を描画する
(() => {
  const $ = (id) => document.getElementById(id);

  let state = { accounts: [], posts: [], theme: "#7c5cff", slug: "", maxAccounts: 3 };
  let activeAccountId = localStorage.getItem("active-account") || "";

  // ---------- API ----------
  async function api(path, options) {
    const res = await fetch(`api/${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `エラー (${res.status})`);
    return body;
  }

  async function refresh() {
    state = await api("state");
    applyTheme(state.theme, false);
    render();
  }

  // ---------- テーマカラー ----------
  function applyTheme(color, save) {
    const root = document.documentElement.style;
    root.setProperty("--accent", color);
    root.setProperty("--accent-soft", hexToRgba(color, 0.16));
    root.setProperty("--accent-strong", shade(color, -0.15));
    window.PINBALL_THEME = color; // ピンボールの色も連動
    $("themeColor").value = color;
    if (save) api("theme", { method: "POST", body: JSON.stringify({ color }) }).catch(() => {});
  }

  function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amount)));
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }

  $("themeColor").addEventListener("input", (e) => applyTheme(e.target.value, true));

  // ---------- 描画 ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmtDate(ms) {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function render() {
    // オリジナルURL
    const url = `${location.origin}/${state.slug}/`;
    const urlEl = $("originalUrl");
    urlEl.textContent = `🔗 ${url}`;
    urlEl.onclick = () => {
      navigator.clipboard?.writeText(url);
      urlEl.textContent = "🔗 コピーしました！";
      setTimeout(() => (urlEl.textContent = `🔗 ${url}`), 1200);
    };

    // アカウントタブ
    $("accountCount").textContent = `${state.accounts.length}/${state.maxAccounts}`;
    $("btnAddAccount").style.display = state.accounts.length >= state.maxAccounts ? "none" : "";
    if (!state.accounts.some((a) => a.id === activeAccountId)) {
      activeAccountId = state.accounts[0]?.id || "";
    }
    const tabs = $("accountTabs");
    if (!state.accounts.length) {
      tabs.innerHTML = `<p class="empty">まだアカウントがありません。「＋ 追加」から Threads API を設定してください（最大3つ）。</p>`;
    } else {
      tabs.innerHTML = state.accounts.map((a) => `
        <div class="account-tab ${a.id === activeAccountId ? "active" : ""}" data-id="${a.id}">
          <div class="avatar">${a.avatar ? `<img src="${esc(a.avatar)}" alt="">` : "👤"}</div>
          <div class="info">
            <div class="name">${esc(a.label)}</div>
            <div class="meta">${a.username ? "@" + esc(a.username) : "未接続"} ・ ${esc(a.tokenPreview)}</div>
          </div>
          <span class="badge ${a.verified ? "ok" : "ng"}">${a.verified ? "接続OK" : "未確認"}</span>
          <button class="icon-btn del-account" data-id="${a.id}" title="削除">🗑</button>
        </div>`).join("");
      tabs.querySelectorAll(".account-tab").forEach((el) => {
        el.addEventListener("click", () => {
          activeAccountId = el.dataset.id;
          localStorage.setItem("active-account", activeAccountId);
          render();
        });
      });
      tabs.querySelectorAll(".del-account").forEach((el) => {
        el.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (!confirm("このアカウントと未投稿の予約を削除しますか？")) return;
          try { state = (await api(`accounts/${el.dataset.id}`, { method: "DELETE" })).state; render(); }
          catch (err) { alert(err.message); }
        });
      });
    }

    // 予約一覧（選択中アカウントのみ表示）
    const account = state.accounts.find((a) => a.id === activeAccountId);
    $("listOwner").textContent = account ? `— ${account.label}` : "";
    $("composeCard").style.opacity = account ? "1" : "0.45";
    const list = $("postList");
    const posts = state.posts.filter((p) => p.accountId === activeAccountId);
    if (!account) {
      list.innerHTML = `<p class="empty">アカウントを追加すると予約できます。</p>`;
    } else if (!posts.length) {
      list.innerHTML = `<p class="empty">予約はまだありません。左のピンボールでハイスコアを狙いつつ、上のフォームから予約しましょう。</p>`;
    } else {
      const chip = { scheduled: "⏳ 予約中", posted: "✅ 投稿済み", error: "⚠ エラー" };
      list.innerHTML = posts.map((p) => `
        <div class="post-item ${p.status}">
          <div class="body">
            <div class="text">${esc(p.text)}</div>
            <div class="when">${p.status === "posted" ? "投稿: " + fmtDate(p.postedAt) : "予定: " + fmtDate(p.scheduledAt)}</div>
            ${p.error ? `<div class="err">${esc(p.error)}</div>` : ""}
          </div>
          <span class="status-chip ${p.status}">${chip[p.status] || p.status}</span>
          ${p.status === "error" ? `<button class="icon-btn retry-post" data-id="${p.id}" title="今すぐ再試行">🔁</button>` : ""}
          <button class="icon-btn del-post" data-id="${p.id}" title="削除">🗑</button>
        </div>`).join("");
      list.querySelectorAll(".del-post").forEach((el) => {
        el.addEventListener("click", async () => {
          try { state = (await api(`posts/${el.dataset.id}`, { method: "DELETE" })).state; render(); }
          catch (err) { alert(err.message); }
        });
      });
      list.querySelectorAll(".retry-post").forEach((el) => {
        el.addEventListener("click", async () => {
          try { state = (await api(`posts/${el.dataset.id}/retry`, { method: "POST" })).state; render(); }
          catch (err) { alert(err.message); }
        });
      });
    }
  }

  // ---------- 予約作成 ----------
  $("postText").addEventListener("input", () => {
    $("charCount").textContent = $("postText").value.length;
  });

  function setMsg(el, text, cls) {
    el.textContent = text;
    el.className = `form-msg ${cls || ""}`;
  }

  $("btnSchedule").addEventListener("click", async () => {
    const msg = $("composeMsg");
    const text = $("postText").value;
    const atValue = $("postAt").value;
    if (!activeAccountId) return setMsg(msg, "先にアカウントを追加・選択してください", "error");
    if (!text.trim()) return setMsg(msg, "本文を入力してください", "error");
    if (!atValue) return setMsg(msg, "予約日時を選んでください", "error");
    const at = new Date(atValue).getTime();
    if (at < Date.now() - 60 * 1000) return setMsg(msg, "過去の日時は予約できません", "error");
    try {
      const result = await api("posts", {
        method: "POST",
        body: JSON.stringify({ accountId: activeAccountId, text, scheduledAt: at }),
      });
      state = result.state;
      $("postText").value = "";
      $("charCount").textContent = "0";
      setMsg(msg, `⏰ ${fmtDate(at)} に予約しました！`, "ok");
      render();
    } catch (err) {
      setMsg(msg, err.message, "error");
    }
  });

  // ---------- アカウント追加モーダル ----------
  $("btnAddAccount").addEventListener("click", () => {
    $("accountModal").classList.remove("hidden");
    setMsg($("accountMsg"), "", "");
  });
  $("btnCancelAccount").addEventListener("click", () => $("accountModal").classList.add("hidden"));
  $("accountModal").addEventListener("click", (e) => {
    if (e.target === $("accountModal")) $("accountModal").classList.add("hidden");
  });

  $("btnSaveAccount").addEventListener("click", async () => {
    const msg = $("accountMsg");
    const token = $("accToken").value.trim();
    if (!token) return setMsg(msg, "アクセストークンを入力してください", "error");
    setMsg(msg, "接続テスト中…", "");
    try {
      const result = await api("accounts", {
        method: "POST",
        body: JSON.stringify({
          label: $("accLabel").value,
          accessToken: token,
          threadsUserId: $("accUserId").value,
        }),
      });
      state = result.state;
      activeAccountId = state.accounts[state.accounts.length - 1]?.id || activeAccountId;
      localStorage.setItem("active-account", activeAccountId);
      $("accLabel").value = ""; $("accToken").value = ""; $("accUserId").value = "";
      if (result.verified) {
        $("accountModal").classList.add("hidden");
      } else {
        setMsg(msg, `登録しましたが接続確認に失敗: ${result.verifyError}（あとで削除して再登録できます）`, "error");
      }
      render();
    } catch (err) {
      setMsg(msg, err.message, "error");
    }
  });

  // 予約日時のデフォルト = 1時間後
  (() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    const pad = (n) => String(n).padStart(2, "0");
    $("postAt").value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  // 30秒ごとに同期（投稿済みステータスの反映）
  refresh().catch((err) => console.error(err));
  setInterval(() => refresh().catch(() => {}), 30 * 1000);
})();
