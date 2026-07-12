/* ============================================================
 * ショート動画メーカー
 * Canvas に毎フレーム描画し、プレビューと書き出しで
 * 同一の drawFrame(t) を使う（見たまま書き出せる）。
 * 書き出しは canvas.captureStream + MediaRecorder。
 * ============================================================ */

"use strict";

// ---------- 定数 ----------

const FPS = 30;
const BITRATE = 8_000_000;

const ASPECTS = {
  "9:16": { w: 720, h: 1280 },
  "1:1":  { w: 960, h: 960 },
  "16:9": { w: 1280, h: 720 },
};

const GRADIENTS = [
  { id: "midnight", name: "ミッドナイト", colors: ["#0f2027", "#2c5364"] },
  { id: "sunset",   name: "サンセット",   colors: ["#ff512f", "#dd2476"] },
  { id: "ocean",    name: "オーシャン",   colors: ["#2193b0", "#6dd5ed"] },
  { id: "sakura",   name: "サクラ",       colors: ["#f8a5c2", "#a6c1ee"] },
  { id: "gold",     name: "ゴールド",     colors: ["#141e30", "#b8860b"] },
  { id: "forest",   name: "フォレスト",   colors: ["#134e5e", "#71b280"] },
  { id: "neon",     name: "ネオン",       colors: ["#41295a", "#d4145a"] },
  { id: "mono",     name: "モノクロ",     colors: ["#232526", "#414345"] },
];

const FONTS = {
  gothic:  '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", "Meiryo", sans-serif',
  mincho:  '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
  rounded: '"Hiragino Maru Gothic ProN", "Yu Gothic UI", "Noto Sans JP", sans-serif',
};

// ---------- 状態 ----------

const S = {
  aspect: "9:16",
  duration: 5,
  mainText: "",
  subText: "",
  badgeText: "",
  font: "gothic",
  fontSize: 64,
  textColor: "#ffffff",
  textAnim: "slideup",
  bgType: "gradient",
  gradient: GRADIENTS[0],
  solidColor: "#111827",
  bgImage: null,          // HTMLImageElement | null
  bgMotion: "zoom",
  scrim: 0.2,
  progressBar: true,
  fadeOut: true,
};

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// roundRect 未対応ブラウザ用フォールバック
if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x + w, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

let playing = true;
let playT = 0;              // 現在の再生位置（秒）
let lastTick = null;        // 前フレームの timestamp
let exporting = false;

// ---------- ユーティリティ ----------

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
// 添字から決定論的な疑似乱数（毎フレーム同じ配置になる）
const rand = (i) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// 改行を尊重しつつ、キャンバス幅に収まるよう1文字単位で折り返す
function wrapText(text, maxWidth) {
  const lines = [];
  for (const raw of text.split("\n")) {
    let line = "";
    for (const ch of raw) {
      if (line && ctx.measureText(line + ch).width > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    lines.push(line);
  }
  return lines;
}

// ---------- 背景描画 ----------

function drawGradient(t, W, H, colors) {
  let x0 = 0, y0 = 0, x1 = W, y1 = H;
  if (S.bgMotion === "pan") {
    // グラデーションの起点をゆっくり回すように動かす
    const a = (t / S.duration) * Math.PI * 0.5;
    x0 = W * 0.5 * (1 - Math.cos(a));
    y0 = H * 0.3 * Math.sin(a);
    x1 = W - x0;
    y1 = H - y0;
  }
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawImageCover(img, W, H, scale) {
  const cr = W / H, ir = img.width / img.height;
  let dw, dh;
  if (ir > cr) { dh = H * scale; dw = dh * ir; }
  else         { dw = W * scale; dh = dw / ir; }
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function drawBackground(t, W, H) {
  const zoom = S.bgMotion === "zoom" ? 1 + 0.08 * (t / S.duration) : 1;

  if (S.bgType === "image" && S.bgImage) {
    drawImageCover(S.bgImage, W, H, zoom);
  } else if (S.bgType === "solid") {
    ctx.fillStyle = S.solidColor;
    ctx.fillRect(0, 0, W, H);
  } else {
    if (S.bgMotion === "zoom") {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-W / 2, -H / 2);
      drawGradient(t, W, H, S.gradient.colors);
      ctx.restore();
    } else {
      drawGradient(t, W, H, S.gradient.colors);
    }
  }

  // 暗さオーバーレイ（文字の可読性用）
  if (S.scrim > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${S.scrim})`;
    ctx.fillRect(0, 0, W, H);
  }

  // パーティクル（下から上へ漂う光の粒・決定論的）
  if (S.bgMotion === "particles") {
    const N = 45;
    for (let i = 0; i < N; i++) {
      const speed = 0.04 + rand(i) * 0.08;
      const x = rand(i * 3 + 1) * W + Math.sin(t * 1.2 + i) * 14;
      const yFrac = (rand(i * 7 + 2) - speed * t + 100) % 1;
      const y = yFrac * (H + 40) - 20;
      const r = 1.5 + rand(i * 11 + 3) * 3.5;
      const tw = 0.35 + 0.3 * Math.sin(t * 3 + i * 2.1); // またたき
      ctx.fillStyle = `rgba(255, 255, 255, ${tw})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------- テキスト描画 ----------

// テキスト登場アニメーションの alpha / offsetY / scale を返す
function introState(t, delay) {
  const introDur = Math.min(0.9, S.duration * 0.3);
  const p = clamp((t - delay) / introDur, 0, 1);
  switch (S.textAnim) {
    case "fade":    return { alpha: easeOutCubic(p), dy: 0, scale: 1 };
    case "slideup": return { alpha: easeOutCubic(p), dy: (1 - easeOutCubic(p)) * 60, scale: 1 };
    case "zoom":    return { alpha: easeOutCubic(p), dy: 0, scale: 0.8 + 0.2 * easeOutCubic(p) };
    case "pop":     return { alpha: clamp(p * 2, 0, 1), dy: 0, scale: p >= 1 ? 1 : easeOutBack(p) };
    default:        return { alpha: 1, dy: 0, scale: 1 };
  }
}

function drawTexts(t, W, H) {
  const u = W / 720; // 720px 基準のスケール係数
  const family = FONTS[S.font];
  const centerY = S.aspect === "9:16" ? H * 0.46 : H * 0.48;

  // --- メインテキスト（折り返し計算） ---
  const mainSize = S.fontSize * u;
  ctx.font = `700 ${mainSize}px ${family}`;
  const mainLines = wrapText(S.mainText, W * 0.86);
  const lineH = mainSize * 1.35;
  const blockH = mainLines.length * lineH;

  // タイプライターは全体の 55% の時間で1文字ずつ表示
  let visibleChars = Infinity;
  const totalChars = mainLines.join("").length;
  if (S.textAnim === "typewriter") {
    visibleChars = Math.floor(clamp(t / (S.duration * 0.55), 0, 1) * totalChars);
  }

  const main = S.textAnim === "typewriter"
    ? { alpha: 1, dy: 0, scale: 1 }
    : introState(t, 0);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(W / 2, centerY + main.dy * u);
  ctx.scale(main.scale, main.scale);
  ctx.globalAlpha = main.alpha;
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 14 * u;
  ctx.shadowOffsetY = 3 * u;
  ctx.fillStyle = S.textColor;
  ctx.font = `700 ${mainSize}px ${family}`;

  let shown = 0;
  mainLines.forEach((line, i) => {
    let text = line;
    if (visibleChars !== Infinity) {
      const remain = Math.max(0, visibleChars - shown);
      text = [...line].slice(0, remain).join("");
      shown += [...line].length;
    }
    ctx.fillText(text, 0, -blockH / 2 + lineH * (i + 0.5));
  });
  ctx.restore();

  // --- サブテキスト（メインの少し後にフェードイン） ---
  if (S.subText.trim()) {
    const subDelay = S.textAnim === "typewriter" ? S.duration * 0.55 : 0.35;
    const sub = { ...introState(t, subDelay) };
    if (S.textAnim === "typewriter" || S.textAnim === "none") {
      const p = clamp((t - subDelay) / 0.5, 0, 1);
      sub.alpha = easeOutCubic(p); sub.dy = 0; sub.scale = 1;
    }
    const subSize = mainSize * 0.42;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = sub.alpha;
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 8 * u;
    ctx.fillStyle = hexToRgba(S.textColor, 0.92);
    ctx.font = `500 ${subSize}px ${family}`;
    ctx.fillText(S.subText, W / 2, centerY + blockH / 2 + subSize * 1.6 + sub.dy * u * 0.5);
    ctx.restore();
  }

  // --- バッジ（上部・最初に降りてくる） ---
  if (S.badgeText.trim()) {
    const p = easeOutCubic(clamp(t / 0.5, 0, 1));
    const size = 26 * u;
    ctx.save();
    ctx.font = `700 ${size}px ${family}`;
    const tw = ctx.measureText(S.badgeText).width;
    const padX = 22 * u, padY = 12 * u;
    const bw = tw + padX * 2, bh = size + padY * 2;
    const bx = (W - bw) / 2;
    const by = H * 0.12 - bh / 2 - (1 - p) * 40 * u;
    ctx.globalAlpha = p;
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(S.badgeText, W / 2, by + bh / 2 + size * 0.05);
    ctx.restore();
  }
}

// ---------- フレーム合成 ----------

function drawFrame(t) {
  const W = canvas.width, H = canvas.height;
  drawBackground(t, W, H);
  drawTexts(t, W, H);

  if (S.progressBar) {
    const p = clamp(t / S.duration, 0, 1);
    const barH = Math.max(5, H * 0.007);
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(0, H - barH, W, barH);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillRect(0, H - barH, W * p, barH);
  }

  if (S.fadeOut) {
    const fadeLen = Math.min(0.5, S.duration * 0.15);
    const p = clamp((t - (S.duration - fadeLen)) / fadeLen, 0, 1);
    if (p > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${p})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

// ---------- プレビューループ ----------

function tick(now) {
  if (lastTick === null) lastTick = now;
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  if (playing) {
    playT += dt;
    if (!exporting && playT >= S.duration) playT %= S.duration; // プレビューはループ
  }

  drawFrame(Math.min(playT, S.duration));

  if (!exporting) {
    $("scrub").value = String(Math.round((playT / S.duration) * 1000));
    $("timeLabel").textContent = `${playT.toFixed(1)} / ${S.duration.toFixed(1)}s`;
  }
  requestAnimationFrame(tick);
}

// ---------- 書き出し ----------

function pickMimeType() {
  const candidates = [
    "video/mp4;codecs=avc1.640028",
    "video/mp4",
    "video/webm;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  return candidates.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || null;
}

function exportVideo() {
  if (exporting) return;
  const mimeType = pickMimeType();
  if (!mimeType) {
    alert("このブラウザは動画の書き出し（MediaRecorder）に対応していません。\nChrome / Edge / Safari の最新版をお使いください。");
    return;
  }
  const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm";

  exporting = true;
  playing = true;
  playT = 0;
  $("exportBtn").disabled = true;
  $("exportProgress").hidden = false;
  $("exportStatus").textContent = `書き出し中…（${ext.toUpperCase()} / 実時間で${S.duration.toFixed(1)}秒かかります）`;

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITRATE });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
    // 日本語ファイル名は環境によって無視されるため ASCII のみ使用
    const now = new Date();
    const stamp = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((n) => String(n).padStart(2, "0")).join("");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `short_${S.aspect.replace(":", "x")}_${S.duration}s_${stamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);

    exporting = false;
    playT = 0;
    $("exportBtn").disabled = false;
    $("exportProgress").hidden = true;
    $("exportStatus").textContent = `✅ 書き出し完了（${ext.toUpperCase()}）。ダウンロードフォルダをご確認ください。`;
  };

  recorder.onerror = () => {
    exporting = false;
    $("exportBtn").disabled = false;
    $("exportProgress").hidden = true;
    $("exportStatus").textContent = "⚠️ 書き出しに失敗しました。もう一度お試しください。";
  };

  recorder.start(200);

  // 進捗表示＆終了監視（描画自体は tick が担う）
  const started = performance.now();
  const watch = () => {
    const elapsed = (performance.now() - started) / 1000;
    const pct = Math.round(clamp(elapsed / S.duration, 0, 1) * 100);
    $("exportFill").style.width = `${pct}%`;
    $("exportPct").textContent = `${pct}%`;
    if (elapsed >= S.duration + 0.1) {
      recorder.stop();
      stream.getTracks().forEach((tr) => tr.stop());
    } else {
      requestAnimationFrame(watch);
    }
  };
  requestAnimationFrame(watch);
}

// ---------- UI 初期化 ----------

function applyAspect() {
  const { w, h } = ASPECTS[S.aspect];
  canvas.width = w;
  canvas.height = h;
}

function buildSwatches() {
  const wrap = $("swatches");
  GRADIENTS.forEach((g) => {
    const el = document.createElement("div");
    el.className = "swatch" + (g.id === S.gradient.id ? " selected" : "");
    el.style.background = `linear-gradient(135deg, ${g.colors[0]}, ${g.colors[1]})`;
    el.innerHTML = `<span class="name">${g.name}</span>`;
    el.addEventListener("click", () => {
      S.gradient = g;
      wrap.querySelectorAll(".swatch").forEach((s) => s.classList.remove("selected"));
      el.classList.add("selected");
    });
    wrap.appendChild(el);
  });
}

function bindControls() {
  $("aspect").addEventListener("change", (e) => { S.aspect = e.target.value; applyAspect(); });

  $("duration").addEventListener("input", (e) => {
    S.duration = parseFloat(e.target.value);
    $("durationLabel").textContent = `${S.duration.toFixed(1)}秒`;
    if (playT > S.duration) playT = 0;
  });

  $("mainText").addEventListener("input", (e) => { S.mainText = e.target.value; });
  $("subText").addEventListener("input", (e) => { S.subText = e.target.value; });
  $("badgeText").addEventListener("input", (e) => { S.badgeText = e.target.value; });
  $("font").addEventListener("change", (e) => { S.font = e.target.value; });
  $("fontSize").addEventListener("input", (e) => {
    S.fontSize = parseInt(e.target.value, 10);
    $("fontSizeLabel").textContent = String(S.fontSize);
  });
  $("textColor").addEventListener("input", (e) => { S.textColor = e.target.value; });
  $("textAnim").addEventListener("change", (e) => { S.textAnim = e.target.value; playT = 0; });

  document.querySelectorAll('input[name="bgType"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      S.bgType = e.target.value;
      $("gradientPane").hidden = S.bgType !== "gradient";
      $("solidPane").hidden = S.bgType !== "solid";
      $("imagePane").hidden = S.bgType !== "image";
    });
  });
  $("solidColor").addEventListener("input", (e) => { S.solidColor = e.target.value; });

  $("bgImage").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      S.bgImage = img;
      $("imageHint").textContent = `✅ ${file.name}（${img.width}×${img.height}）`;
    };
    img.src = URL.createObjectURL(file);
  });

  $("bgMotion").addEventListener("change", (e) => { S.bgMotion = e.target.value; });
  $("scrim").addEventListener("input", (e) => {
    S.scrim = parseInt(e.target.value, 10) / 100;
    $("scrimLabel").textContent = `${e.target.value}%`;
  });
  $("progressBar").addEventListener("change", (e) => { S.progressBar = e.target.checked; });
  $("fadeOut").addEventListener("change", (e) => { S.fadeOut = e.target.checked; });

  $("playBtn").addEventListener("click", () => {
    if (exporting) return;
    playing = !playing;
    $("playBtn").textContent = playing ? "⏸" : "▶";
  });

  $("scrub").addEventListener("input", (e) => {
    if (exporting) return;
    playing = false;
    $("playBtn").textContent = "▶";
    playT = (parseInt(e.target.value, 10) / 1000) * S.duration;
  });

  $("exportBtn").addEventListener("click", exportVideo);
}

function init() {
  S.mainText = $("mainText").value;
  S.subText = $("subText").value;
  S.badgeText = $("badgeText").value;
  applyAspect();
  buildSwatches();
  bindControls();
  requestAnimationFrame(tick);
}

init();
