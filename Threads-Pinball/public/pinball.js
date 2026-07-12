// ミニピンボール — canvas ひとつで完結する簡易物理エンジン
// テーマカラーは window.PINBALL_THEME（app.js が更新）を毎フレーム参照する
(() => {
  const canvas = document.getElementById("pinball");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  const GRAVITY = 0.22;
  const DAMPING = 0.995;
  const BALL_R = 8;

  const state = {
    score: 0,
    best: Number(localStorage.getItem("pinball-best") || 0),
    balls: 3,
    ball: null,          // { x, y, vx, vy }
    waiting: true,       // 発射待ち
    gameOver: false,
    flash: 0,
  };

  // バンパー（円）: 当たると加点して弾き返す
  const bumpers = [
    { x: W * 0.5, y: 150, r: 26, score: 100, hit: 0 },
    { x: W * 0.28, y: 230, r: 20, score: 150, hit: 0 },
    { x: W * 0.72, y: 230, r: 20, score: 150, hit: 0 },
    { x: W * 0.5, y: 320, r: 16, score: 300, hit: 0 },
  ];

  // フリッパー: pivot を中心に angle が動く線分（角度は先端の向きをそのまま表す）
  const FLIP_LEN = 78;
  const flippers = [
    { x: W * 0.5 - 96, y: H - 70, rest: 0.5, active: -0.45, angle: 0.5, pressed: false },
    { x: W * 0.5 + 96, y: H - 70, rest: Math.PI - 0.5, active: Math.PI + 0.45, angle: Math.PI - 0.5, pressed: false },
  ];

  // 外壁（斜めのガイドをフリッパーへ向けて配置）
  const walls = [
    { x1: 12, y1: 0, x2: 12, y2: H - 170 },
    { x1: W - 12, y1: 0, x2: W - 12, y2: H - 170 },
    { x1: 12, y1: H - 170, x2: flippers[0].x, y2: flippers[0].y },
    { x1: W - 12, y1: H - 170, x2: flippers[1].x, y2: flippers[1].y },
  ];

  function theme() {
    return window.PINBALL_THEME || "#7c5cff";
  }

  function launch() {
    if (state.gameOver) {
      state.score = 0;
      state.balls = 3;
      state.gameOver = false;
    }
    if (!state.waiting) return;
    state.waiting = false;
    state.ball = {
      x: W * 0.5 + (Math.random() * 120 - 60),
      y: 60,
      vx: Math.random() * 4 - 2,
      vy: 2,
    };
  }

  function loseBall() {
    state.ball = null;
    state.waiting = true;
    state.balls -= 1;
    if (state.balls <= 0) {
      state.gameOver = true;
      state.best = Math.max(state.best, state.score);
      localStorage.setItem("pinball-best", String(state.best));
    }
    updateHud();
  }

  function addScore(n) {
    state.score += n;
    state.flash = 6;
    updateHud();
  }

  function updateHud() {
    document.getElementById("score").textContent = state.score;
    document.getElementById("best").textContent = Math.max(state.best, state.score);
    document.getElementById("balls").textContent = Math.max(state.balls, 0);
  }

  function flipperTip(f) {
    return { x: f.x + Math.cos(f.angle) * FLIP_LEN, y: f.y + Math.sin(f.angle) * FLIP_LEN };
  }

  // 線分との衝突: 最近接点までの距離が半径未満なら押し出して反射
  function collideSegment(b, x1, y1, x2, y2, bounce, extraKick) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((b.x - x1) * dx + (b.y - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + dx * t, py = y1 + dy * t;
    const distX = b.x - px, distY = b.y - py;
    const dist = Math.hypot(distX, distY);
    if (dist >= BALL_R || dist === 0) return false;
    const nx = distX / dist, ny = distY / dist;
    b.x = px + nx * (BALL_R + 0.5);
    b.y = py + ny * (BALL_R + 0.5);
    const dot = b.vx * nx + b.vy * ny;
    if (dot < 0) {
      b.vx -= (1 + bounce) * dot * nx;
      b.vy -= (1 + bounce) * dot * ny;
    }
    if (extraKick) {
      b.vx += nx * extraKick;
      b.vy += ny * extraKick;
    }
    return true;
  }

  function step() {
    // フリッパーのアニメーション
    for (const f of flippers) {
      const target = f.pressed ? f.active : f.rest;
      const prev = f.angle;
      f.angle += (target - f.angle) * 0.45;
      f.speed = Math.abs(f.angle - prev); // 動いている勢いをキック力に使う
    }

    const b = state.ball;
    if (!b) return;

    b.vy += GRAVITY;
    b.vx *= DAMPING;
    b.vy *= DAMPING;
    b.x += b.vx;
    b.y += b.vy;

    // 天井
    if (b.y < BALL_R + 10) { b.y = BALL_R + 10; b.vy = Math.abs(b.vy); }

    // 外壁・ガイド
    for (const w of walls) collideSegment(b, w.x1, w.y1, w.x2, w.y2, 0.6, 0);

    // バンパー
    for (const bp of bumpers) {
      const dx = b.x - bp.x, dy = b.y - bp.y;
      const dist = Math.hypot(dx, dy);
      if (dist < BALL_R + bp.r && dist > 0) {
        const nx = dx / dist, ny = dy / dist;
        b.x = bp.x + nx * (BALL_R + bp.r + 0.5);
        b.y = bp.y + ny * (BALL_R + bp.r + 0.5);
        const dot = b.vx * nx + b.vy * ny;
        b.vx -= 2 * dot * nx;
        b.vy -= 2 * dot * ny;
        b.vx += nx * 2.2;
        b.vy += ny * 2.2;
        bp.hit = 8;
        addScore(bp.score);
      }
      if (bp.hit > 0) bp.hit -= 1;
    }

    // フリッパー（動いている最中は強めに弾く）
    for (const f of flippers) {
      const tip = flipperTip(f);
      collideSegment(b, f.x, f.y, tip.x, tip.y, 0.4, f.speed * 40);
    }

    // ドレイン（落下）
    if (b.y > H + BALL_R * 2) loseBall();
  }

  function draw() {
    const accent = theme();
    ctx.clearRect(0, 0, W, H);

    // 背景グラデ
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#141530");
    grad.addColorStop(1, "#0a0b18");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 外壁
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    for (const w of walls) {
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }

    // バンパー
    for (const bp of bumpers) {
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, bp.r + (bp.hit ? 3 : 0), 0, Math.PI * 2);
      ctx.fillStyle = bp.hit ? "#ffd447" : accent;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(bp.score), bp.x, bp.y);
    }

    // フリッパー
    for (const f of flippers) {
      const tip = flipperTip(f);
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.strokeStyle = "#ffd447";
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(f.x, f.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
    }

    // ボール
    if (state.ball) {
      ctx.beginPath();
      ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = state.flash > 0 ? "#ffd447" : "#f2f1fb";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (state.flash > 0) state.flash -= 1;

    // メッセージ
    ctx.textAlign = "center";
    if (state.gameOver) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("GAME OVER", W / 2, H / 2 - 14);
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText("Space か「発射」でもう一回", W / 2, H / 2 + 14);
    } else if (state.waiting) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "13px sans-serif";
      ctx.fillText("Space か「発射」でスタート", W / 2, H / 2);
    }
  }

  function loop() {
    step();
    draw();
    requestAnimationFrame(loop);
  }

  // 入力
  function setFlip(side, pressed) {
    flippers[side].pressed = pressed;
  }
  document.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft") { setFlip(0, true); e.preventDefault(); }
    if (e.code === "ArrowRight") { setFlip(1, true); e.preventDefault(); }
    if (e.code === "Space" && document.activeElement.tagName !== "TEXTAREA" && document.activeElement.tagName !== "INPUT") {
      launch(); e.preventDefault();
    }
  });
  document.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft") setFlip(0, false);
    if (e.code === "ArrowRight") setFlip(1, false);
  });
  const bind = (id, side) => {
    const el = document.getElementById(id);
    for (const ev of ["mousedown", "touchstart"]) el.addEventListener(ev, (e) => { setFlip(side, true); e.preventDefault(); });
    for (const ev of ["mouseup", "mouseleave", "touchend"]) el.addEventListener(ev, () => setFlip(side, false));
  };
  bind("btnLeft", 0);
  bind("btnRight", 1);
  document.getElementById("btnLaunch").addEventListener("click", launch);
  canvas.addEventListener("pointerdown", (e) => {
    if (state.waiting || state.gameOver) { launch(); return; }
    const rect = canvas.getBoundingClientRect();
    const side = (e.clientX - rect.left) < rect.width / 2 ? 0 : 1;
    setFlip(side, true);
    setTimeout(() => setFlip(side, false), 160);
  });

  updateHud();
  loop();
})();
