// ボンバー — Claude Code のオレンジキャラが主人公のボンバーマン風ミニゲーム
// グリッド: 13x11 / タイル30px。矢印・WASDで移動、Spaceで爆弾。
(() => {
  const canvas = document.getElementById("bomber");
  const ctx = canvas.getContext("2d");
  const COLS = 13, ROWS = 11, TILE = 30;
  const CLAY = "#D97757";        // Claude のオレンジ（クレイ）
  const CLAY_DARK = "#b85a3c";

  // タイル: 0=床 1=固い壁 2=壊せるブロック
  const EMPTY = 0, WALL = 1, SOFT = 2;

  const state = {
    grid: [],
    player: null,
    enemies: [],
    bombs: [],
    flames: [],       // {cx, cy, timer}
    items: [],        // {cx, cy, type: "fire"|"bomb"}
    score: 0,
    best: Number(localStorage.getItem("bomber-best") || 0),
    lives: 3,
    phase: "title",   // title | play | dead | clear | over
    tick: 0,
  };

  const keys = {};
  const tileC = (px) => Math.round((px - TILE / 2) / TILE); // ピクセル中心 → タイル座標
  const center = (c) => c * TILE + TILE / 2;

  // ---------- ステージ生成 ----------
  function buildStage() {
    state.grid = [];
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) {
        if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) row.push(WALL);
        else if (x % 2 === 0 && y % 2 === 0) row.push(WALL);
        else row.push(Math.random() < 0.62 ? SOFT : EMPTY);
      }
      state.grid.push(row);
    }
    // スポーン地点周辺は空ける（プレイヤー左上、敵は他の3隅）
    const corners = [[1, 1], [COLS - 2, 1], [1, ROWS - 2], [COLS - 2, ROWS - 2]];
    for (const [cx, cy] of corners) {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = cx + dx, y = cy + dy;
        if (state.grid[y]?.[x] === SOFT) state.grid[y][x] = EMPTY;
      }
    }
    state.player = {
      px: center(1), py: center(1), speed: 2.0,
      maxBombs: 1, range: 1, dir: "down", inv: 90, moving: false,
    };
    state.enemies = corners.slice(1).map(([cx, cy]) => ({
      px: center(cx), py: center(cy), speed: 1.1,
      dir: ["up", "down", "left", "right"][Math.floor(Math.random() * 4)],
    }));
    state.bombs = [];
    state.flames = [];
    state.items = [];
  }

  function startGame() {
    state.score = 0;
    state.lives = 3;
    buildStage();
    state.phase = "play";
    updateHud();
  }

  function updateHud() {
    document.getElementById("bScore").textContent = state.score;
    document.getElementById("bBest").textContent = Math.max(state.best, state.score);
    document.getElementById("bLives").textContent = state.lives;
  }

  function addScore(n) {
    state.score += n;
    updateHud();
  }

  // ---------- 当たり判定 ----------
  function solidAt(cx, cy, forPlayer) {
    const t = state.grid[cy]?.[cx];
    if (t === undefined || t === WALL || t === SOFT) return true;
    const bomb = state.bombs.find((b) => b.cx === cx && b.cy === cy);
    if (bomb && !(forPlayer && bomb.walkable)) return true;
    return false;
  }

  const RADIUS = 11;
  function canStand(px, py, forPlayer) {
    for (const [ox, oy] of [[-RADIUS, -RADIUS], [RADIUS, -RADIUS], [-RADIUS, RADIUS], [RADIUS, RADIUS]]) {
      if (solidAt(Math.floor((px + ox) / TILE), Math.floor((py + oy) / TILE), forPlayer)) return false;
    }
    return true;
  }

  // 進行方向に対して垂直方向へタイル中央に吸い寄せる（角で引っかからないように）
  function moveEntity(e, dx, dy, forPlayer) {
    if (dx) {
      if (canStand(e.px + dx, e.py, forPlayer)) e.px += dx;
      else {
        const cy = center(tileC(e.py));
        if (Math.abs(cy - e.py) > 1 && canStand(e.px, e.py + Math.sign(cy - e.py) * Math.abs(dx), forPlayer)) {
          e.py += Math.sign(cy - e.py) * Math.abs(dx);
        }
      }
    }
    if (dy) {
      if (canStand(e.px, e.py + dy, forPlayer)) e.py += dy;
      else {
        const cx = center(tileC(e.px));
        if (Math.abs(cx - e.px) > 1 && canStand(e.px + Math.sign(cx - e.px) * Math.abs(dy), e.py, forPlayer)) {
          e.px += Math.sign(cx - e.px) * Math.abs(dy);
        }
      }
    }
  }

  // ---------- 爆弾・爆風 ----------
  function placeBomb() {
    if (state.phase !== "play") return;
    const p = state.player;
    const cx = tileC(p.px), cy = tileC(p.py);
    if (state.bombs.some((b) => b.cx === cx && b.cy === cy)) return;
    if (state.bombs.length >= p.maxBombs) return;
    state.bombs.push({ cx, cy, timer: 140, range: p.range, walkable: true });
  }

  function explode(bomb) {
    const idx = state.bombs.indexOf(bomb);
    if (idx >= 0) state.bombs.splice(idx, 1);
    const cells = [[bomb.cx, bomb.cy]];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let r = 1; r <= bomb.range; r++) {
        const x = bomb.cx + dx * r, y = bomb.cy + dy * r;
        const t = state.grid[y]?.[x];
        if (t === WALL || t === undefined) break;
        cells.push([x, y]);
        if (t === SOFT) {
          state.grid[y][x] = EMPTY;
          addScore(10);
          if (Math.random() < 0.25) {
            state.items.push({ cx: x, cy: y, type: Math.random() < 0.5 ? "fire" : "bomb" });
          }
          break; // ブロックで爆風は止まる
        }
        const chained = state.bombs.find((b) => b.cx === x && b.cy === y);
        if (chained) chained.timer = Math.min(chained.timer, 2); // 誘爆
      }
    }
    for (const [x, y] of cells) state.flames.push({ cx: x, cy: y, timer: 26 });
  }

  function inFlame(px, py) {
    const cx = tileC(px), cy = tileC(py);
    return state.flames.some((f) => f.cx === cx && f.cy === cy);
  }

  function killPlayer() {
    const p = state.player;
    if (p.inv > 0) return;
    state.lives -= 1;
    updateHud();
    if (state.lives <= 0) {
      state.phase = "over";
      state.best = Math.max(state.best, state.score);
      localStorage.setItem("bomber-best", String(state.best));
      return;
    }
    p.px = center(1); p.py = center(1);
    p.inv = 120;
  }

  // ---------- 更新 ----------
  function step() {
    if (state.phase !== "play") return;
    state.tick++;
    const p = state.player;
    if (p.inv > 0) p.inv--;

    // プレイヤー移動
    let dx = 0, dy = 0;
    if (keys.ArrowLeft || keys.KeyA) { dx = -p.speed; p.dir = "left"; }
    else if (keys.ArrowRight || keys.KeyD) { dx = p.speed; p.dir = "right"; }
    if (keys.ArrowUp || keys.KeyW) { dy = -p.speed; p.dir = "up"; }
    else if (keys.ArrowDown || keys.KeyS) { dy = p.speed; p.dir = "down"; }
    p.moving = !!(dx || dy);
    moveEntity(p, dx, dy, true);

    // 置いた爆弾は、体が完全にそのマスから離れるまで通過可能。
    // （中心点がマスを出た瞬間に壁化すると、体半分が残ったまま挟まって動けなくなる）
    for (const b of state.bombs) {
      const overlapping =
        Math.abs(p.px - center(b.cx)) < TILE / 2 + RADIUS &&
        Math.abs(p.py - center(b.cy)) < TILE / 2 + RADIUS;
      if (b.walkable && !overlapping) b.walkable = false;
      b.timer -= 1;
    }
    for (const b of [...state.bombs]) if (b.timer <= 0) explode(b);
    for (const f of state.flames) f.timer -= 1;
    state.flames = state.flames.filter((f) => f.timer > 0);

    // アイテム取得
    state.items = state.items.filter((it) => {
      if (it.cx === tileC(p.px) && it.cy === tileC(p.py)) {
        if (it.type === "fire") p.range = Math.min(p.range + 1, 6);
        else p.maxBombs = Math.min(p.maxBombs + 1, 5);
        addScore(50);
        return false;
      }
      return inFlame(center(it.cx), center(it.cy)) ? false : true; // 爆風で消える
    });

    // 敵AI: タイル中央で進路を選ぶ（直進優先、塞がれたらランダム）
    const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    for (const e of state.enemies) {
      const cx = tileC(e.px), cy = tileC(e.py);
      const atCenter = Math.abs(e.px - center(cx)) < e.speed && Math.abs(e.py - center(cy)) < e.speed;
      if (atCenter) {
        e.px = center(cx); e.py = center(cy);
        const options = Object.entries(dirs).filter(([, [dx2, dy2]]) => !solidAt(cx + dx2, cy + dy2, false));
        if (options.length) {
          const keep = options.find(([d]) => d === e.dir);
          if (!keep || Math.random() < 0.25) e.dir = options[Math.floor(Math.random() * options.length)][0];
        }
      }
      const [mx, my] = dirs[e.dir];
      moveEntity(e, mx * e.speed, my * e.speed, false);
      // 爆風で撃破
      if (inFlame(e.px, e.py)) {
        e.dead = true;
        addScore(200);
      }
      // プレイヤーと接触
      if (Math.hypot(e.px - p.px, e.py - p.py) < RADIUS * 2 - 4) killPlayer();
    }
    state.enemies = state.enemies.filter((e) => !e.dead);

    // プレイヤー被弾
    if (inFlame(p.px, p.py)) killPlayer();

    // 全滅でクリア
    if (state.phase === "play" && !state.enemies.length) {
      state.phase = "clear";
      addScore(500);
      state.best = Math.max(state.best, state.score);
      localStorage.setItem("bomber-best", String(state.best));
    }
  }

  // ---------- 描画 ----------
  function drawClawd(x, y, dir, moving, blink) {
    if (blink) return; // 無敵中の点滅
    const bob = moving ? Math.sin(state.tick * 0.4) * 1.5 : 0;
    ctx.save();
    ctx.translate(x, y + bob);
    // 足
    ctx.fillStyle = CLAY_DARK;
    const walk = moving ? Math.sin(state.tick * 0.4) * 3 : 0;
    ctx.fillRect(-8 + walk, 8, 6, 5);
    ctx.fillRect(2 - walk, 8, 6, 5);
    // 体（角丸オレンジの四角 = Claude Code のマスコット風）
    ctx.fillStyle = CLAY;
    ctx.beginPath();
    ctx.roundRect(-11, -12, 22, 22, 6);
    ctx.fill();
    ctx.strokeStyle = CLAY_DARK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 目（向きに合わせて寄る）
    const ox = dir === "left" ? -3 : dir === "right" ? 3 : 0;
    const oy = dir === "up" ? -2 : dir === "down" ? 1 : 0;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-4 + ox, -3 + oy, 3.2, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(4 + ox, -3 + oy, 3.2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(-4 + ox * 1.3, -3 + oy, 1.5, 0, Math.PI * 2);
    ctx.arc(4 + ox * 1.3, -3 + oy, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // 口
    ctx.strokeStyle = "#7a3a24";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ox * 0.5, 3 + oy, 3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.px, e.py + Math.sin(state.tick * 0.15 + e.px) * 2);
    ctx.fillStyle = "#8a7bff";
    ctx.beginPath();
    ctx.arc(0, -2, 11, Math.PI, 0);
    ctx.lineTo(11, 10);
    for (let i = 0; i < 4; i++) ctx.lineTo(11 - (i * 2 + 1) * (22 / 8), 10 - (i % 2 === 0 ? 4 : 0));
    ctx.lineTo(-11, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-4, -3, 3, 0, Math.PI * 2);
    ctx.arc(4, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(-4, -3, 1.4, 0, Math.PI * 2);
    ctx.arc(4, -3, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    const accent = window.PINBALL_THEME || "#7c5cff";
    // 床
    ctx.fillStyle = "#12132a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = state.grid[y]?.[x];
        const px = x * TILE, py = y * TILE;
        if (t === WALL) {
          ctx.fillStyle = "#33355c";
          ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(px + 1, py + 1, TILE - 2, 4);
        } else if (t === SOFT) {
          ctx.fillStyle = "#7a5a3a";
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = "rgba(0,0,0,0.35)";
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.beginPath();
          ctx.moveTo(px + 2, py + TILE / 2);
          ctx.lineTo(px + TILE - 2, py + TILE / 2);
          ctx.stroke();
        } else if ((x + y) % 2 === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.02)";
          ctx.fillRect(px, py, TILE, TILE);
        }
      }
    }

    // アイテム
    for (const it of state.items) {
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(it.type === "fire" ? "🔥" : "💣", center(it.cx), center(it.cy));
    }

    // 爆弾
    for (const b of state.bombs) {
      const pulse = 1 + Math.sin(state.tick * (b.timer < 40 ? 0.6 : 0.2)) * 0.08;
      ctx.save();
      ctx.translate(center(b.cx), center(b.cy));
      ctx.scale(pulse, pulse);
      ctx.fillStyle = "#1c1d33";
      ctx.beginPath();
      ctx.arc(0, 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "#c9a24b";
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.quadraticCurveTo(5, -13, 8, -11);
      ctx.stroke();
      ctx.fillStyle = "#ffd447";
      ctx.beginPath();
      ctx.arc(8, -11, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 爆風
    for (const f of state.flames) {
      const a = Math.min(1, f.timer / 12);
      ctx.fillStyle = `rgba(255, 140, 40, ${a})`;
      ctx.beginPath();
      ctx.roundRect(f.cx * TILE + 3, f.cy * TILE + 3, TILE - 6, TILE - 6, 8);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 220, 90, ${a})`;
      ctx.beginPath();
      ctx.roundRect(f.cx * TILE + 9, f.cy * TILE + 9, TILE - 18, TILE - 18, 5);
      ctx.fill();
    }

    for (const e of state.enemies) drawEnemy(e);
    if (state.player && state.phase !== "title") {
      drawClawd(state.player.px, state.player.py, state.player.dir, state.player.moving,
        state.player.inv > 0 && state.tick % 8 < 4);
    }

    // オーバーレイ
    if (state.phase !== "play") {
      ctx.fillStyle = "rgba(10, 11, 24, 0.72)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px sans-serif";
      const title = { title: "💣 ボンバー", clear: "🎉 STAGE CLEAR!", over: "GAME OVER" }[state.phase] || "";
      ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 16);
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(state.phase === "clear" ? "Space で次のステージへ" : "Space か 💣ボタンでスタート", canvas.width / 2, canvas.height / 2 + 14);
      if (state.phase === "title") drawClawd(canvas.width / 2, canvas.height / 2 + 52, "down", true, false);
    }
  }

  function loop() {
    if (window.ACTIVE_GAME === "bomber") {
      step();
      draw();
    }
    requestAnimationFrame(loop);
  }

  // ---------- 入力 ----------
  function pressAction() {
    if (state.phase === "play") placeBomb();
    else if (state.phase === "clear") { buildStage(); state.phase = "play"; }  // スコア継続で次ステージ
    else startGame();
  }

  document.addEventListener("keydown", (e) => {
    if (window.ACTIVE_GAME !== "bomber") return;
    const tag = document.activeElement.tagName;
    if (tag === "TEXTAREA" || tag === "INPUT") return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"].includes(e.code)) {
      keys[e.code] = true;
      e.preventDefault();
    }
    if (e.code === "Space") { pressAction(); e.preventDefault(); }
  });
  document.addEventListener("keyup", (e) => { keys[e.code] = false; });

  const hold = (id, code) => {
    const el = document.getElementById(id);
    for (const ev of ["mousedown", "touchstart"]) el.addEventListener(ev, (e) => { keys[code] = true; e.preventDefault(); });
    for (const ev of ["mouseup", "mouseleave", "touchend"]) el.addEventListener(ev, () => { keys[code] = false; });
  };
  hold("bUp", "ArrowUp");
  hold("bDown", "ArrowDown");
  hold("bLeft", "ArrowLeft");
  hold("bRight", "ArrowRight");
  document.getElementById("bBomb").addEventListener("click", pressAction);

  // ---------- ゲーム切替タブ ----------
  const tabs = { pinball: document.getElementById("tabPinball"), bomber: document.getElementById("tabBomber") };
  function switchGame(name) {
    window.ACTIVE_GAME = name;
    document.getElementById("pinballGame").classList.toggle("hidden", name !== "pinball");
    document.getElementById("bomberGame").classList.toggle("hidden", name !== "bomber");
    tabs.pinball.classList.toggle("active", name === "pinball");
    tabs.bomber.classList.toggle("active", name === "bomber");
    localStorage.setItem("active-game", name);
  }
  tabs.pinball.addEventListener("click", () => switchGame("pinball"));
  tabs.bomber.addEventListener("click", () => switchGame("bomber"));
  switchGame(localStorage.getItem("active-game") || "pinball");

  updateHud();
  draw();
  loop();

  // デバッグ/動作検証用フック（UIからは使わない）
  window.__bomber = { state, startGame, placeBomb, keys, tileC, center };
})();
